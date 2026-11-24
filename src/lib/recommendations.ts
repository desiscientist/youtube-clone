import type { Prisma } from "@prisma/client";
import { FINISHED_MARGIN_SECONDS, withProgress } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import {
  longFormWhere,
  toVideoCard,
  videoCardInclude,
  type VideoCardData,
} from "@/lib/videos";

/** How many candidate videos are ranked per request. */
const POOL_SIZE = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

type Context = {
  videoId: string;
  channelId: string;
  category: string;
  tags: string[];
};

type Options = {
  userId: string | null;
  category?: string;
  /** Ranking for "Up next" beside this video. */
  context?: Context;
  offset?: number;
  limit?: number;
};

/** What the viewer has shown interest in, built from their activity. */
async function loadTaste(userId: string) {
  const [history, likes, dislikes, subscriptions] = await Promise.all([
    prisma.watchHistory.findMany({
      where: { userId },
      orderBy: { watchedAt: "desc" },
      take: 100,
      select: {
        videoId: true,
        progress: true,
        video: {
          select: {
            channelId: true,
            category: true,
            tags: true,
            duration: true,
          },
        },
      },
    }),
    prisma.like.findMany({
      where: { userId, videoId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        video: { select: { channelId: true, category: true, tags: true } },
      },
    }),
    prisma.dislike.findMany({
      where: { userId, videoId: { not: null } },
      take: 200,
      select: { videoId: true, video: { select: { channelId: true } } },
    }),
    prisma.subscription.findMany({
      where: { userId },
      select: { channelId: true },
    }),
  ]);

  const channels = new Map<string, number>();
  const categories = new Map<string, number>();
  const tags = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, amount: number) =>
    map.set(key, (map.get(key) ?? 0) + amount);

  for (const { channelId } of subscriptions) add(channels, channelId, 4);
  for (const { video } of likes) {
    if (!video) continue;
    add(channels, video.channelId, 2);
    add(categories, video.category, 2);
    for (const tag of video.tags) add(tags, tag, 1);
  }
  for (const { video } of history) {
    add(channels, video.channelId, 1);
    add(categories, video.category, 1);
    for (const tag of video.tags) add(tags, tag, 0.5);
  }

  const finished = new Set(
    history
      .filter(
        ({ progress, video }) =>
          video.duration !== null &&
          progress >= video.duration - FINISHED_MARGIN_SECONDS,
      )
      .map(({ videoId }) => videoId),
  );
  const dislikedVideos = new Set(dislikes.map((item) => item.videoId));
  const dislikedChannels = new Map<string, number>();
  for (const { video } of dislikes) {
    if (video) add(dislikedChannels, video.channelId, 1);
  }

  return {
    channels,
    categories,
    tags,
    finished,
    dislikedVideos,
    dislikedChannels,
    topCategory: Math.max(1, ...Array.from(categories.values())),
  };
}

/** A stable 0–1 number per video and day, to shuffle ties without flicker. */
function jitter(id: string) {
  const seed = `${id}:${Math.floor(Date.now() / DAY_MS)}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/** Re-orders so the same channel doesn't fill the screen. */
function diversify<T extends { channelId: string }>(ranked: T[]) {
  const result: T[] = [];
  const waiting = [...ranked];
  while (waiting.length > 0) {
    const recent = new Set(result.slice(-3).map((item) => item.channelId));
    const index = waiting.findIndex((item) => !recent.has(item.channelId));
    result.push(...waiting.splice(index === -1 ? 0 : index, 1));
  }
  return result;
}

/**
 * Ranked videos for the home feed ("For you") or "Up next". Signed-in
 * viewers get videos from channels, categories, and tags they engage with;
 * everyone gets a mix of popular and fresh videos.
 */
export async function recommendVideos({
  userId,
  category,
  context,
  offset = 0,
  limit = 24,
}: Options): Promise<{ videos: VideoCardData[]; nextOffset: number | null }> {
  const where: Prisma.VideoWhereInput = {
    ...longFormWhere,
    ...(category && { category }),
    ...(context && { id: { not: context.videoId } }),
  };
  const [pool, taste] = await Promise.all([
    prisma.video.findMany({
      where,
      include: videoCardInclude,
      orderBy: { createdAt: "desc" },
      take: POOL_SIZE,
    }),
    userId ? loadTaste(userId) : null,
  ]);

  const now = Date.now();
  const scored = pool
    .filter((video) => !taste?.dislikedVideos.has(video.id))
    .map((video) => {
      const popularity = Math.log10(video.viewCount + 10) / 6;
      const freshness = Math.exp(
        -(now - video.createdAt.getTime()) / (30 * DAY_MS),
      );
      let score = popularity + 0.8 * freshness + 0.3 * jitter(video.id);

      if (taste) {
        const channel = Math.min(
          1,
          (taste.channels.get(video.channelId) ?? 0) / 6,
        );
        const categoryScore =
          (taste.categories.get(video.category) ?? 0) / taste.topCategory;
        const tagScore = Math.min(
          1,
          video.tags.reduce((sum, tag) => sum + (taste.tags.get(tag) ?? 0), 0) /
            3,
        );
        score += 2.5 * channel + 1.5 * categoryScore + tagScore;
        if (taste.finished.has(video.id)) score -= 1.5;
        score -= Math.min(
          1.5,
          0.5 * (taste.dislikedChannels.get(video.channelId) ?? 0),
        );
      }

      if (context) {
        if (video.channelId === context.channelId) score += 1.5;
        if (video.category === context.category) score += 1;
        const shared = video.tags.filter((tag) =>
          context.tags.includes(tag),
        ).length;
        score += Math.min(1.5, 0.5 * shared);
      }
      return { video, score, channelId: video.channelId };
    })
    .sort((a, b) => b.score - a.score);

  const ranked = diversify(scored);
  const page = ranked
    .slice(offset, offset + limit)
    .map(({ video }) => toVideoCard(video));
  const nextOffset = offset + limit < ranked.length ? offset + limit : null;
  return { videos: await withProgress(page, userId), nextOffset };
}

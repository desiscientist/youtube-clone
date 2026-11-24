import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ShortsFeed, type ShortData } from "@/components/shorts-feed";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import {
  FALLBACK_THUMBNAIL,
  colorFor,
  formatViews,
  initials,
  shortsWhere,
} from "@/lib/videos";

type ShortsPageProps = { params: { videoId: string } };

const shortInclude = {
  channel: {
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
      userId: true,
    },
  },
  _count: { select: { likes: true, comments: true } },
} as const;

export default async function ShortsPage({ params }: ShortsPageProps) {
  const userId = await getCurrentUserId();
  const current = await prisma.video.findUnique({
    where: { id: params.videoId },
    include: shortInclude,
  });
  if (!current || !current.isShort) notFound();
  const isOwner = userId === current.userId;
  if (
    !isOwner &&
    (current.status !== "READY" || current.visibility === "PRIVATE")
  ) {
    notFound();
  }

  // The Short that was opened comes first, then the rest of the feed.
  const others = await prisma.video.findMany({
    where: { ...shortsWhere, id: { not: current.id } },
    include: shortInclude,
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const videos = [current, ...others];

  const [likes, dislikes, subscriptions] = userId
    ? await Promise.all([
        prisma.like.findMany({
          where: { userId, videoId: { in: videos.map((video) => video.id) } },
          select: { videoId: true },
        }),
        prisma.dislike.findMany({
          where: { userId, videoId: { in: videos.map((video) => video.id) } },
          select: { videoId: true },
        }),
        prisma.subscription.findMany({
          where: {
            userId,
            channelId: { in: videos.map((video) => video.channel.id) },
          },
          select: { channelId: true },
        }),
      ])
    : [[], [], []];
  const liked = new Set(likes.map((like) => like.videoId));
  const disliked = new Set(dislikes.map((dislike) => dislike.videoId));
  const subscribed = new Set(subscriptions.map((item) => item.channelId));

  const shorts: ShortData[] = videos.map((video) => ({
    id: video.id,
    title: video.title,
    videoUrl: video.videoUrl || `/api/media/${video.id}/processed/720p.mp4`,
    thumbnail: video.thumbnailUrl || FALLBACK_THUMBNAIL,
    views: formatViews(video.viewCount),
    likeCount: video._count.likes,
    commentCount: video._count.comments,
    reaction: liked.has(video.id)
      ? "like"
      : disliked.has(video.id)
        ? "dislike"
        : "none",
    channel: {
      id: video.channel.id,
      name: video.channel.name,
      handle: video.channel.handle,
      avatar: video.channel.avatarUrl,
      color: colorFor(video.channel.name),
      initials: initials(video.channel.name),
      subscribed: subscribed.has(video.channel.id),
      isOwn: userId === video.channel.userId,
    },
  }));

  return (
    <AppShell className="pb-0">
      <ShortsFeed shorts={shorts} signedIn={userId !== null} />
    </AppShell>
  );
}

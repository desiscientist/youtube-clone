import { notFound } from "next/navigation";
import type { WatchPlaylist } from "@/components/up-next";
import { WatchExperience } from "@/components/watch-experience";
import { FINISHED_MARGIN_SECONDS } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { recommendVideos } from "@/lib/recommendations";
import { getCurrentUserId } from "@/lib/session";
import {
  FALLBACK_THUMBNAIL,
  colorFor,
  formatDuration,
  timeAgo,
  videoCardInclude,
} from "@/lib/videos";

type WatchPageProps = {
  searchParams: { v?: string; list?: string };
};

export default async function WatchPage({ searchParams }: WatchPageProps) {
  const videoId = searchParams.v;
  if (!videoId || videoId.length > 64) notFound();

  const userId = await getCurrentUserId();
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          userId: true,
          _count: { select: { subscribers: true } },
        },
      },
      _count: { select: { likes: true } },
    },
  });
  if (!video) notFound();

  const isOwner = userId === video.userId;
  if (video.visibility === "PRIVATE" && !isOwner) notFound();
  if (video.status !== "READY" && !isOwner) notFound();

  const [liked, disliked, subscription, upNext, history, playlist] =
    await Promise.all([
      userId
        ? prisma.like.findUnique({
            where: { userId_videoId: { userId, videoId: video.id } },
            select: { id: true },
          })
        : null,
      userId
        ? prisma.dislike.findUnique({
            where: { userId_videoId: { userId, videoId: video.id } },
            select: { id: true },
          })
        : null,
      userId
        ? prisma.subscription.findUnique({
            where: {
              userId_channelId: { userId, channelId: video.channel.id },
            },
            select: { id: true },
          })
        : null,
      // Ranked for this video and this viewer's tastes.
      recommendVideos({
        userId,
        limit: 12,
        context: {
          videoId: video.id,
          channelId: video.channelId,
          category: video.category,
          tags: video.tags,
        },
      }),
      userId
        ? prisma.watchHistory.findUnique({
            where: { userId_videoId: { userId, videoId: video.id } },
            select: { progress: true },
          })
        : null,
      searchParams.list ? loadPlaylist(searchParams.list, userId) : null,
    ]);

  const recommendations = upNext.videos;

  // Resume unless the viewer barely started or already finished it.
  const saved = history?.progress ?? 0;
  const startAt =
    saved > 5 &&
    (!video.duration || saved < video.duration - FINISHED_MARGIN_SECONDS)
      ? saved
      : undefined;

  const playlistIndex =
    playlist?.items.findIndex((item) => item.id === video.id) ?? -1;
  const watchPlaylist: WatchPlaylist | undefined =
    playlist && playlistIndex >= 0
      ? { ...playlist, index: playlistIndex }
      : undefined;

  const processed = video.videoUrl?.startsWith(`/api/media/${video.id}/`);

  return (
    <WatchExperience
      // A fresh player for every video, e.g. when autoplay moves on.
      key={video.id}
      isOwner={isOwner}
      playlist={watchPlaylist}
      startAt={startAt}
      recommendations={recommendations}
      social={{
        signedIn: userId !== null,
        likeCount: video._count.likes,
        reaction: liked ? "like" : disliked ? "dislike" : "none",
        channelId: video.channel.id,
        subscriberCount: video.channel._count.subscribers,
        subscribed: Boolean(subscription),
        isOwnChannel: userId === video.channel.userId,
      }}
      trackViews
      video={{
        id: video.id,
        title: video.title,
        description: video.description,
        category: video.category,
        viewCount: `${video.viewCount.toLocaleString()} views`,
        posted: timeAgo(video.createdAt),
        duration: formatDuration(video.duration),
        thumbnailUrl: video.thumbnailUrl || FALLBACK_THUMBNAIL,
        captionsUrl: video.captionsUrl,
        videoUrl:
          video.videoUrl || `/api/media/${video.id}/processed/1080p.mp4`,
        hlsUrl: video.hlsUrl,
        channelName: video.channel.name,
        channelHandle: video.channel.handle,
        channelAvatar: video.channel.avatarUrl,
        channelColor: colorFor(video.channel.name),
        status: video.status,
        // Only uploads processed by StreamBox have multiple quality files.
        isSample: !processed,
        processingError: video.processingError,
        visibility: video.visibility,
      }}
    />
  );
}

/** A playlist's playable items, if this viewer may see the playlist. */
async function loadPlaylist(playlistId: string, userId: string | null) {
  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    include: {
      videos: {
        orderBy: { position: "asc" },
        include: { video: { include: videoCardInclude } },
      },
    },
  });
  if (!playlist) return null;
  if (playlist.visibility === "PRIVATE" && playlist.userId !== userId) {
    return null;
  }

  return {
    id: playlist.id,
    name: playlist.name,
    items: playlist.videos
      .filter(
        ({ video }) =>
          (video.status === "READY" && video.visibility !== "PRIVATE") ||
          video.userId === userId,
      )
      .map(({ video }) => ({
        id: video.id,
        title: video.title,
        channel: video.channel.name,
        thumbnail: video.thumbnailUrl || FALLBACK_THUMBNAIL,
        duration: formatDuration(video.duration),
      })),
  };
}

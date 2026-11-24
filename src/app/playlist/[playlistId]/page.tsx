import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Play, Trash2, X } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { AppShell, EmptyPanel } from "@/components/app-shell";
import { VideoCard } from "@/components/video-card";
import { withProgress } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { timeAgo, toVideoCard, videoCardInclude } from "@/lib/videos";

type PlaylistPageProps = { params: { playlistId: string } };

export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const userId = await getCurrentUserId();
  const playlist = await prisma.playlist.findUnique({
    where: { id: params.playlistId },
    include: {
      user: {
        select: {
          name: true,
          channel: { select: { name: true, handle: true } },
        },
      },
      videos: {
        orderBy: { position: "asc" },
        include: { video: { include: videoCardInclude } },
      },
    },
  });
  if (!playlist) notFound();

  const isOwner = userId === playlist.userId;
  if (playlist.visibility === "PRIVATE" && !isOwner) notFound();

  // Hide videos that are no longer viewable, unless they're the owner's own.
  const items = playlist.videos.filter(
    ({ video }) =>
      (video.status === "READY" && video.visibility !== "PRIVATE") ||
      video.userId === userId,
  );
  const ownerChannel = playlist.user.channel;
  const cards = await withProgress(
    items.map(({ video }) => toVideoCard(video)),
    userId,
  );

  return (
    <AppShell className="px-4 pt-6 sm:px-6 xl:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-surface-muted p-6">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            {playlist.visibility === "PRIVATE" && <Lock size={13} />}
            {playlist.isWatchLater
              ? "Only you can see this list"
              : playlist.visibility === "PUBLIC"
                ? "Public playlist"
                : "Private playlist"}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {playlist.name}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {ownerChannel ? (
              <Link
                className="hover:text-foreground"
                href={`/channel/${ownerChannel.handle}`}
              >
                {ownerChannel.name}
              </Link>
            ) : (
              playlist.user.name
            )}{" "}
            · {items.length} {items.length === 1 ? "video" : "videos"} · Updated{" "}
            {timeAgo(playlist.updatedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          {items.length > 0 && (
            <Link
              className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:bg-foreground/85"
              href={`/watch?v=${items[0].videoId}&list=${playlist.id}`}
            >
              <Play className="mr-2" fill="currentColor" size={15} /> Play all
            </Link>
          )}
          {isOwner && !playlist.isWatchLater && (
            <ActionButton
              confirmMessage={`Delete the playlist "${playlist.name}"? The videos themselves stay on StreamBox.`}
              redirectTo="/feed/playlists"
              url={`/api/playlists/${playlist.id}`}
              variant="secondary"
            >
              <Trash2 size={16} /> Delete playlist
            </ActionButton>
          )}
        </div>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {cards.map((video) => (
            <VideoCard
              action={
                isOwner && (
                  <ActionButton
                    aria-label={`Remove ${video.title} from this playlist`}
                    className="-mr-2 -mt-1"
                    size="icon-sm"
                    title="Remove from playlist"
                    url={`/api/playlists/${playlist.id}/videos?videoId=${video.id}`}
                    variant="ghost"
                  >
                    <X size={18} />
                  </ActionButton>
                )
              }
              href={`/watch?v=${video.id}&list=${playlist.id}`}
              key={video.id}
              video={video}
            />
          ))}
        </div>
      ) : (
        <EmptyPanel title="This playlist is empty">
          {isOwner &&
            (playlist.isWatchLater
              ? "Click the clock on any thumbnail to save a video for later."
              : "Use the Save button under any video to add it here.")}
        </EmptyPanel>
      )}
    </AppShell>
  );
}

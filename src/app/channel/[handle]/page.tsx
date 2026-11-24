import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Settings } from "lucide-react";
import { AppShell, EmptyPanel } from "@/components/app-shell";
import { ChannelSubscribe } from "@/components/channel-subscribe";
import { PlaylistGrid } from "@/components/playlist-grid";
import { ShortsShelf } from "@/components/shorts-shelf";
import { VideoGrid } from "@/components/home-feed";
import { ChannelAvatar } from "@/components/video-card";
import { withProgress } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import {
  colorFor,
  initials,
  publicVideoWhere,
  toVideoCard,
  videoCardInclude,
} from "@/lib/videos";

type ChannelPageProps = { params: { handle: string } };

export default async function ChannelPage({ params }: ChannelPageProps) {
  const handle = decodeURIComponent(params.handle);
  const userId = await getCurrentUserId();

  const channel = await prisma.channel.findUnique({
    where: { handle },
    include: { _count: { select: { subscribers: true } } },
  });
  if (!channel) notFound();

  const isOwnChannel = userId === channel.userId;
  const [videos, playlists, subscription] = await Promise.all([
    prisma.video.findMany({
      where: { channelId: channel.id, ...publicVideoWhere },
      include: videoCardInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.playlist.findMany({
      where: { userId: channel.userId, visibility: "PUBLIC" },
      include: {
        _count: { select: { videos: true } },
        videos: {
          orderBy: { position: "asc" },
          take: 1,
          select: { video: { select: { thumbnailUrl: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    userId && !isOwnChannel
      ? prisma.subscription.findUnique({
          where: { userId_channelId: { userId, channelId: channel.id } },
          select: { id: true },
        })
      : null,
  ]);

  const color = colorFor(channel.name);
  const allCards = await withProgress(videos.map(toVideoCard), userId);
  const longForm = allCards.filter((card) => !card.isShort);
  const shorts = allCards.filter((card) => card.isShort);

  return (
    <AppShell>
      <div
        className="h-32 bg-cover bg-center sm:h-44"
        style={
          channel.bannerUrl
            ? { backgroundImage: `url("${channel.bannerUrl}")` }
            : {
                backgroundImage: `linear-gradient(120deg, ${color}, ${color}55)`,
              }
        }
      />
      <div className="px-4 sm:px-6 xl:px-8">
        <div className="flex flex-col gap-5 border-b border-border py-6 sm:flex-row sm:items-center">
          <ChannelAvatar
            avatar={channel.avatarUrl}
            color={color}
            initials={initials(channel.name)}
            size={112}
          />
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">
              {channel.name}
            </h1>
            <ChannelSubscribe
              channelId={channel.id}
              handle={channel.handle}
              initialSubscribed={Boolean(subscription)}
              initialSubscriberCount={channel._count.subscribers}
              isOwnChannel={isOwnChannel}
              ownerAction={
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-surface-muted px-4 text-sm font-semibold hover:bg-surface-muted/75"
                    href="/studio/channel"
                  >
                    <Pencil size={15} /> Customize channel
                  </Link>
                  <Link
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-surface-muted px-4 text-sm font-semibold hover:bg-surface-muted/75"
                    href="/studio"
                  >
                    <Settings size={16} /> Manage videos
                  </Link>
                </div>
              }
              signedIn={userId !== null}
              videoCount={videos.length}
            />
            {channel.description && (
              <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-muted">
                {channel.description}
              </p>
            )}
          </div>
        </div>

        <section className="py-6">
          {shorts.length > 0 && <ShortsShelf shorts={shorts} />}
          <h2 className="mb-4 text-lg font-semibold">Videos</h2>
          {longForm.length > 0 ? (
            <VideoGrid videos={longForm} />
          ) : shorts.length > 0 ? (
            <p className="text-sm text-muted">
              This channel only posts Shorts so far.
            </p>
          ) : (
            <EmptyPanel title="No videos yet">
              {isOwnChannel ? (
                <Link className="font-semibold text-accent" href="/upload">
                  Upload your first video
                </Link>
              ) : (
                "This channel hasn't published any videos."
              )}
            </EmptyPanel>
          )}
        </section>

        {playlists.length > 0 && (
          <section className="border-t border-border py-6">
            <h2 className="mb-4 text-lg font-semibold">Playlists</h2>
            <PlaylistGrid
              playlists={playlists.map((playlist) => ({
                id: playlist.id,
                name: playlist.name,
                videoCount: playlist._count.videos,
                thumbnail: playlist.videos[0]?.video.thumbnailUrl ?? null,
              }))}
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}

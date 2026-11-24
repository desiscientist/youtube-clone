import Link from "next/link";
import { AppShell, EmptyPanel, PageHeading } from "@/components/app-shell";
import { VideoGrid } from "@/components/home-feed";
import { ChannelAvatar } from "@/components/video-card";
import { ShortsShelf } from "@/components/shorts-shelf";
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

export default async function SubscriptionsPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null; // middleware sends visitors to sign in

  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    include: {
      channel: {
        select: { id: true, name: true, handle: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const videos = subscriptions.length
    ? await prisma.video.findMany({
        where: {
          ...publicVideoWhere,
          channelId: { in: subscriptions.map((item) => item.channel.id) },
        },
        include: videoCardInclude,
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  const cards = await withProgress(videos.map(toVideoCard), userId);
  const longForm = cards.filter((card) => !card.isShort);
  const shorts = cards.filter((card) => card.isShort);

  return (
    <AppShell className="px-4 pt-6 sm:px-6 xl:px-8">
      <PageHeading
        subtitle="The latest videos from channels you follow."
        title="Subscriptions"
      />
      {subscriptions.length === 0 ? (
        <EmptyPanel title="You're not subscribed to anyone yet">
          Hit <strong>Subscribe</strong> on a channel you like and its new
          videos will appear here.{" "}
          <Link className="font-semibold text-accent" href="/">
            Browse videos
          </Link>
        </EmptyPanel>
      ) : (
        <>
          <ul
            aria-label="Your subscriptions"
            className="scrollbar-hidden mb-8 flex gap-5 overflow-x-auto pb-2"
          >
            {subscriptions.map(({ channel }) => (
              <li key={channel.id}>
                <Link
                  className="flex w-20 flex-col items-center gap-2 text-center text-xs hover:text-accent"
                  href={`/channel/${channel.handle}`}
                >
                  <ChannelAvatar
                    avatar={channel.avatarUrl}
                    color={colorFor(channel.name)}
                    initials={initials(channel.name)}
                    size={64}
                  />
                  <span className="line-clamp-2">{channel.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          {shorts.length > 0 && (
            <ShortsShelf
              shorts={shorts}
              title="Shorts from your subscriptions"
            />
          )}
          {longForm.length > 0 ? (
            <VideoGrid videos={longForm} />
          ) : (
            <EmptyPanel title="No videos yet">
              Your subscriptions haven&apos;t published anything yet.
            </EmptyPanel>
          )}
        </>
      )}
    </AppShell>
  );
}

import Link from "next/link";
import { Upload } from "lucide-react";
import { AppShell, EmptyPanel, PageHeading } from "@/components/app-shell";
import {
  StudioVideoTable,
  type StudioVideo,
} from "@/components/studio-video-table";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import {
  FALLBACK_THUMBNAIL,
  formatCount,
  formatDuration,
  timeAgo,
} from "@/lib/videos";

export default async function StudioPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null; // middleware sends visitors to sign in

  const [channel, videos] = await Promise.all([
    prisma.channel.findUnique({
      where: { userId },
      select: {
        name: true,
        handle: true,
        _count: { select: { subscribers: true } },
      },
    }),
    prisma.video.findMany({
      where: { userId },
      include: { _count: { select: { likes: true, comments: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totals = videos.reduce(
    (sum, video) => ({
      views: sum.views + video.viewCount,
      likes: sum.likes + video._count.likes,
      comments: sum.comments + video._count.comments,
    }),
    { views: 0, likes: 0, comments: 0 },
  );

  const rows: StudioVideo[] = videos.map((video) => ({
    id: video.id,
    title: video.title,
    description: video.description,
    category: video.category,
    visibility: video.visibility,
    status: video.status,
    processingError: video.processingError,
    thumbnail: video.thumbnailUrl || FALLBACK_THUMBNAIL,
    duration: formatDuration(video.duration),
    posted: timeAgo(video.createdAt),
    views: video.viewCount,
    likes: video._count.likes,
    comments: video._count.comments,
  }));

  const stats = [
    { label: "Subscribers", value: channel?._count.subscribers ?? 0 },
    { label: "Videos", value: videos.length },
    { label: "Total views", value: totals.views },
    { label: "Likes", value: totals.likes },
    { label: "Comments", value: totals.comments },
  ];

  return (
    <AppShell className="px-4 pt-6 sm:px-6 xl:px-8">
      <PageHeading
        actions={
          <div className="flex gap-2">
            {channel && (
              <Link
                className="inline-flex h-10 items-center rounded-full bg-surface-muted px-4 text-sm font-medium hover:bg-surface-muted/75"
                href={`/channel/${channel.handle}`}
              >
                View channel
              </Link>
            )}
            <Link
              className="inline-flex h-10 items-center rounded-full bg-surface-muted px-4 text-sm font-medium hover:bg-surface-muted/75"
              href="/studio/analytics"
            >
              Analytics
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-full bg-surface-muted px-4 text-sm font-medium hover:bg-surface-muted/75"
              href="/studio/channel"
            >
              Customize channel
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90"
              href="/upload"
            >
              <Upload size={16} /> Upload
            </Link>
          </div>
        }
        subtitle={channel ? `Managing ${channel.name}` : undefined}
        title="Creator studio"
      />

      <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div className="rounded-2xl bg-surface-muted p-4" key={stat.label}>
            <dt className="text-xs font-medium text-muted">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">
              {formatCount(stat.value)}
            </dd>
          </div>
        ))}
      </dl>

      {rows.length > 0 ? (
        <StudioVideoTable videos={rows} />
      ) : (
        <EmptyPanel title="You haven't uploaded anything yet">
          <Link className="font-semibold text-accent" href="/upload">
            Upload your first video
          </Link>
        </EmptyPanel>
      )}
    </AppShell>
  );
}

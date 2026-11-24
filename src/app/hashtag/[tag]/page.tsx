import { notFound } from "next/navigation";
import { Hash } from "lucide-react";
import { AppShell, EmptyPanel } from "@/components/app-shell";
import { VideoGrid } from "@/components/home-feed";
import { withProgress } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import {
  formatCount,
  publicVideoWhere,
  toVideoCard,
  videoCardInclude,
} from "@/lib/videos";

type HashtagPageProps = { params: { tag: string } };

export default async function HashtagPage({ params }: HashtagPageProps) {
  const tag = decodeURIComponent(params.tag)
    .replace(/^#/, "")
    .toLocaleLowerCase();
  if (!/^[\p{L}\p{N}_]{1,50}$/u.test(tag)) notFound();

  const userId = await getCurrentUserId();
  const where = {
    ...publicVideoWhere,
    OR: [
      { tags: { has: tag } },
      // Older videos whose hashtags weren't turned into tags yet.
      { description: { contains: `#${tag}`, mode: "insensitive" as const } },
      { title: { contains: `#${tag}`, mode: "insensitive" as const } },
    ],
  };
  const [videos, channelCount] = await Promise.all([
    prisma.video.findMany({
      where,
      include: videoCardInclude,
      orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
      take: 60,
    }),
    prisma.channel.count({ where: { videos: { some: where } } }),
  ]);

  return (
    <AppShell className="px-4 pt-6 sm:px-6 xl:px-8">
      <div className="mb-8 flex items-center gap-4">
        <span className="grid size-16 place-items-center rounded-2xl bg-surface-muted">
          <Hash size={30} />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">#{tag}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatCount(videos.length)}{" "}
            {videos.length === 1 ? "video" : "videos"} ·{" "}
            {formatCount(channelCount)}{" "}
            {channelCount === 1 ? "channel" : "channels"}
          </p>
        </div>
      </div>
      {videos.length > 0 ? (
        <VideoGrid
          videos={await withProgress(videos.map(toVideoCard), userId)}
        />
      ) : (
        <EmptyPanel title={`No videos with #${tag} yet`}>
          Add #{tag} to a video&apos;s description to have it show up here.
        </EmptyPanel>
      )}
    </AppShell>
  );
}

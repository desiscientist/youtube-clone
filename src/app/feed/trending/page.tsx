import { AppShell, EmptyPanel, PageHeading } from "@/components/app-shell";
import { VideoGrid } from "@/components/home-feed";
import { prisma } from "@/lib/prisma";
import { withProgress } from "@/lib/progress";
import { getCurrentUserId } from "@/lib/session";
import { longFormWhere, toVideoCard, videoCardInclude } from "@/lib/videos";

export const dynamic = "force-dynamic";

export default async function TrendingPage() {
  const userId = await getCurrentUserId();
  const videos = await prisma.video.findMany({
    where: longFormWhere,
    include: videoCardInclude,
    orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
    take: 48,
  });

  return (
    <AppShell className="px-4 pt-6 sm:px-6 xl:px-8">
      <PageHeading
        subtitle="The most-watched videos on StreamBox."
        title="Trending"
      />
      {videos.length > 0 ? (
        <VideoGrid
          videos={await withProgress(videos.map(toVideoCard), userId)}
        />
      ) : (
        <EmptyPanel title="Nothing trending yet" />
      )}
    </AppShell>
  );
}

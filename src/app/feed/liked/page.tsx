import { AppShell, EmptyPanel, PageHeading } from "@/components/app-shell";
import { VideoGrid } from "@/components/home-feed";
import { withProgress } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { toVideoCard, videoCardInclude } from "@/lib/videos";

export default async function LikedVideosPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null; // middleware sends visitors to sign in

  const likes = await prisma.like.findMany({
    where: {
      userId,
      video: {
        status: "READY",
        OR: [{ visibility: { not: "PRIVATE" } }, { userId }],
      },
    },
    include: { video: { include: videoCardInclude } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const videos = await withProgress(
    likes.flatMap((like) => (like.video ? [toVideoCard(like.video)] : [])),
    userId,
  );

  return (
    <AppShell className="px-4 pt-6 sm:px-6 xl:px-8">
      <PageHeading
        subtitle={`${videos.length} ${videos.length === 1 ? "video" : "videos"}`}
        title="Liked videos"
      />
      {videos.length > 0 ? (
        <VideoGrid videos={videos} />
      ) : (
        <EmptyPanel title="No liked videos yet">
          Like a video and it&apos;ll be saved here.
        </EmptyPanel>
      )}
    </AppShell>
  );
}

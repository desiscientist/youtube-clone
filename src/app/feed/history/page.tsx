import { X } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { AppShell, EmptyPanel, PageHeading } from "@/components/app-shell";
import { VideoCard } from "@/components/video-card";
import { progressPercent } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { toVideoCard, videoCardInclude } from "@/lib/videos";

export default async function HistoryPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null; // middleware sends visitors to sign in

  const history = await prisma.watchHistory.findMany({
    where: {
      userId,
      video: {
        status: "READY",
        OR: [{ visibility: { not: "PRIVATE" } }, { userId }],
      },
    },
    include: { video: { include: videoCardInclude } },
    orderBy: { watchedAt: "desc" },
    take: 200,
  });

  return (
    <AppShell className="px-4 pt-6 sm:px-6 xl:px-8">
      <PageHeading
        actions={
          history.length > 0 && (
            <ActionButton
              confirmMessage="Clear your entire watch history?"
              url="/api/history"
              variant="secondary"
            >
              Clear all history
            </ActionButton>
          )
        }
        subtitle="Videos you've played, most recent first."
        title="Watch history"
      />
      {history.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {history.map((entry) => (
            <VideoCard
              action={
                <ActionButton
                  aria-label={`Remove ${entry.video.title} from history`}
                  className="-mr-2 -mt-1"
                  size="icon-sm"
                  title="Remove from history"
                  url={`/api/history?videoId=${entry.videoId}`}
                  variant="ghost"
                >
                  <X size={18} />
                </ActionButton>
              }
              key={entry.id}
              video={{
                ...toVideoCard(entry.video),
                progress: progressPercent(entry.progress, entry.video.duration),
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyPanel title="No watch history yet">
          Videos you play will show up here.
        </EmptyPanel>
      )}
    </AppShell>
  );
}

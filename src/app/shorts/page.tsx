import { redirect } from "next/navigation";
import { AppShell, EmptyPanel } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { shortsWhere } from "@/lib/videos";

export const dynamic = "force-dynamic";

/** /shorts opens the newest Short; the feed scrolls on from there. */
export default async function ShortsIndexPage() {
  const latest = await prisma.video.findFirst({
    where: shortsWhere,
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (latest) redirect(`/shorts/${latest.id}`);

  return (
    <AppShell className="px-4 pt-6 sm:px-6">
      <EmptyPanel title="No Shorts yet">
        Upload a vertical video under 3 minutes and it becomes a Short.
      </EmptyPanel>
    </AppShell>
  );
}

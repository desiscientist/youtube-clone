import { AppShell, EmptyPanel, PageHeading } from "@/components/app-shell";
import { PlaylistGrid } from "@/components/playlist-grid";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { timeAgo } from "@/lib/videos";

export default async function PlaylistsPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null; // middleware sends visitors to sign in

  const playlists = await prisma.playlist.findMany({
    where: { userId },
    include: {
      _count: { select: { videos: true } },
      videos: {
        orderBy: { position: "asc" },
        take: 1,
        select: { video: { select: { thumbnailUrl: true } } },
      },
    },
    orderBy: [{ isWatchLater: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <AppShell className="px-4 pt-6 sm:px-6 xl:px-8">
      <PageHeading
        subtitle="Use the Save button under any video to add it to a playlist."
        title="Your playlists"
      />
      {playlists.length > 0 ? (
        <PlaylistGrid
          playlists={playlists.map((playlist) => ({
            id: playlist.id,
            name: playlist.name,
            videoCount: playlist._count.videos,
            thumbnail: playlist.videos[0]?.video.thumbnailUrl ?? null,
            detail: `${playlist.visibility === "PUBLIC" ? "Public" : "Private"} · Updated ${timeAgo(playlist.updatedAt)}`,
          }))}
        />
      ) : (
        <EmptyPanel title="No playlists yet">
          Click <strong>Save</strong> under a video to create your first one.
        </EmptyPanel>
      )}
    </AppShell>
  );
}

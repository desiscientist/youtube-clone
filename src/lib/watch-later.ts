import { prisma } from "@/lib/prisma";

export const WATCH_LATER_NAME = "Watch later";

/** The viewer's built-in Watch later playlist, created the first time it's needed. */
export async function getOrCreateWatchLater(userId: string) {
  const existing = await prisma.playlist.findFirst({
    where: { userId, isWatchLater: true },
    select: { id: true },
  });
  if (existing) return existing;

  // The lock stops two simultaneous first saves from creating two playlists.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`watch-later:${userId}`}))`;
    const found = await tx.playlist.findFirst({
      where: { userId, isWatchLater: true },
      select: { id: true },
    });
    if (found) return found;
    return tx.playlist.create({
      data: {
        userId,
        name: WATCH_LATER_NAME,
        visibility: "PRIVATE",
        isWatchLater: true,
      },
      select: { id: true },
    });
  });
}

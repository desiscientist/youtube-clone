import { prisma } from "@/lib/prisma";
import type { VideoCardData } from "@/lib/videos";

/** A saved position this close to the end counts as "finished". */
export const FINISHED_MARGIN_SECONDS = 10;

/** Percentage watched for a saved position, or undefined if not started. */
export function progressPercent(
  seconds: number,
  durationSeconds: number | null,
) {
  if (!durationSeconds || seconds <= 0) return undefined;
  if (seconds >= durationSeconds - FINISHED_MARGIN_SECONDS) return 100;
  return Math.min(100, Math.max(1, (seconds / durationSeconds) * 100));
}

/** Adds the viewer's watch progress to each card, for the red bar on thumbnails. */
export async function withProgress(
  cards: VideoCardData[],
  userId: string | null,
): Promise<VideoCardData[]> {
  if (!userId || cards.length === 0) return cards;

  const history = await prisma.watchHistory.findMany({
    where: { userId, videoId: { in: cards.map((card) => card.id) } },
    select: { videoId: true, progress: true },
  });
  const progressById = new Map(
    history.map((entry) => [entry.videoId, entry.progress]),
  );

  return cards.map((card) => {
    const seconds = progressById.get(card.id);
    if (seconds === undefined) return card;
    return {
      ...card,
      progress: progressPercent(seconds, card.durationSeconds),
    };
  });
}

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ANALYTICS_PERIODS = {
  7: "Last 7 days",
  28: "Last 28 days",
  90: "Last 90 days",
} as const;
export type AnalyticsPeriod = keyof typeof ANALYTICS_PERIODS;

export type DailyPoint = { date: string; value: number };
export type MetricSeries = {
  total: number;
  /** Total for the period before, for the "vs previous" comparison. */
  previousTotal: number;
  daily: DailyPoint[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every day in the window as YYYY-MM-DD (UTC), oldest first. */
function dayKeys(start: Date, days: number) {
  return Array.from({ length: days }, (_, i) =>
    new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10),
  );
}

/**
 * Counts rows per UTC day for one channel. `table`/`column`/`join` are fixed
 * strings chosen below, never user input; values go in as bound parameters.
 */
async function countByDay(
  table: "View" | "Subscription" | "Like" | "Comment",
  channelId: string,
  since: Date,
) {
  const tableSql = Prisma.raw(`"${table}"`);
  const timeColumn = Prisma.raw(
    table === "View" ? `t."viewedAt"` : `t."createdAt"`,
  );
  const channelFilter =
    table === "Subscription"
      ? Prisma.sql`t."channelId" = ${channelId}`
      : Prisma.sql`t."videoId" IN (SELECT id FROM "Video" WHERE "channelId" = ${channelId})`;

  const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT date_trunc('day', ${timeColumn} AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count
    FROM ${tableSql} t
    WHERE ${channelFilter} AND ${timeColumn} >= ${since}
    GROUP BY 1
  `;
  return new Map(
    rows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.count)]),
  );
}

async function metric(
  table: "View" | "Subscription" | "Like" | "Comment",
  channelId: string,
  days: number,
): Promise<MetricSeries> {
  const today = new Date(new Date().toISOString().slice(0, 10)); // UTC midnight
  const start = new Date(today.getTime() - (days - 1) * DAY_MS);
  const previousStart = new Date(start.getTime() - days * DAY_MS);

  const counts = await countByDay(table, channelId, previousStart);
  const current = dayKeys(start, days);
  const previous = new Set(dayKeys(previousStart, days));
  const daily = current.map((date) => ({ date, value: counts.get(date) ?? 0 }));
  let previousTotal = 0;
  counts.forEach((count, date) => {
    if (previous.has(date)) previousTotal += count;
  });
  return {
    total: daily.reduce((sum, point) => sum + point.value, 0),
    previousTotal,
    daily,
  };
}

/** Daily views, new subscribers, likes, and comments for a channel. */
export async function channelAnalytics(
  channelId: string,
  days: AnalyticsPeriod,
) {
  const since = new Date(Date.now() - days * DAY_MS);
  const [views, subscribers, likes, comments, topRows] = await Promise.all([
    metric("View", channelId, days),
    metric("Subscription", channelId, days),
    metric("Like", channelId, days),
    metric("Comment", channelId, days),
    prisma.view.groupBy({
      by: ["videoId"],
      where: { viewedAt: { gte: since }, video: { channelId } },
      _count: { _all: true },
      orderBy: { _count: { videoId: "desc" } },
      take: 10,
    }),
  ]);

  const topVideos = await prisma.video.findMany({
    where: { id: { in: topRows.map((row) => row.videoId) } },
    select: { id: true, title: true, thumbnailUrl: true, isShort: true },
  });
  const byId = new Map(topVideos.map((video) => [video.id, video]));

  return {
    views,
    subscribers,
    likes,
    comments,
    top: topRows.flatMap((row) => {
      const video = byId.get(row.videoId);
      return video ? [{ ...video, views: row._count._all }] : [];
    }),
  };
}

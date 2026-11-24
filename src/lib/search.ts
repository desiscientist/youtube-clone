import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicVideoWhere, videoCardInclude } from "@/lib/videos";

export const DATE_FILTERS = {
  hour: { label: "Last hour", ms: 60 * 60 * 1000 },
  today: { label: "Today", ms: 24 * 60 * 60 * 1000 },
  week: { label: "This week", ms: 7 * 24 * 60 * 60 * 1000 },
  month: { label: "This month", ms: 30 * 24 * 60 * 60 * 1000 },
  year: { label: "This year", ms: 365 * 24 * 60 * 60 * 1000 },
} as const;

export const DURATION_FILTERS = {
  short: { label: "Under 4 minutes", min: 0, max: 240 },
  medium: { label: "4–20 minutes", min: 240, max: 1200 },
  long: { label: "Over 20 minutes", min: 1200, max: undefined },
} as const;

export const SORT_OPTIONS = {
  relevance: "Relevance",
  date: "Upload date",
  views: "View count",
} as const;

export type SearchFilters = {
  q: string;
  date?: keyof typeof DATE_FILTERS;
  duration?: keyof typeof DURATION_FILTERS;
  sort: keyof typeof SORT_OPTIONS;
};

function pick<T extends object>(options: T, value: string | undefined) {
  return value && value in options ? (value as keyof T) : undefined;
}

/** Reads search filters from URL params, ignoring anything unrecognised. */
export function parseSearchParams(params: Record<string, string | undefined>) {
  return {
    q: (params.q ?? "").trim().slice(0, 100),
    date: pick(DATE_FILTERS, params.date),
    duration: pick(DURATION_FILTERS, params.duration),
    sort: pick(SORT_OPTIONS, params.sort) ?? "relevance",
  } satisfies SearchFilters;
}

function searchTerms(q: string) {
  return q.toLocaleLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
}

/** Every word must appear in the title, description, channel, or tags. */
function termsWhere(terms: string[]): Prisma.VideoWhereInput[] {
  return terms.map((term) => ({
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { channel: { name: { contains: term, mode: "insensitive" } } },
      { tags: { has: term.replace(/^#/, "") } },
    ],
  }));
}

export async function searchVideos(filters: SearchFilters) {
  const terms = searchTerms(filters.q);
  if (terms.length === 0) return [];

  const duration = filters.duration && DURATION_FILTERS[filters.duration];
  const where: Prisma.VideoWhereInput = {
    ...publicVideoWhere,
    AND: termsWhere(terms),
    ...(filters.date && {
      createdAt: { gte: new Date(Date.now() - DATE_FILTERS[filters.date].ms) },
    }),
    ...(duration && {
      duration: {
        gte: duration.min,
        ...(duration.max && { lt: duration.max }),
      },
    }),
  };

  const videos = await prisma.video.findMany({
    where,
    include: videoCardInclude,
    // Relevance starts from view order and is re-ranked below.
    orderBy:
      filters.sort === "date" ? { createdAt: "desc" } : { viewCount: "desc" },
    take: 100,
  });
  if (filters.sort !== "relevance") return videos;

  // Relevance: title matches beat channel matches beat description matches;
  // the database already sorted by views, which breaks ties.
  const phrase = filters.q.toLocaleLowerCase();
  const score = (video: (typeof videos)[number]) => {
    const title = video.title.toLocaleLowerCase();
    const channel = video.channel.name.toLocaleLowerCase();
    let total = title.includes(phrase) ? 10 : 0;
    for (const term of terms) {
      if (title.includes(term)) total += 3;
      if (channel.includes(term)) total += 2;
      if (video.tags.includes(term)) total += 2;
    }
    return total;
  };
  return videos
    .map((video, index) => ({ video, index, score: score(video) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.video);
}

/** Channels whose name or handle matches, shown above video results. */
export async function searchChannels(q: string) {
  const term = q.trim();
  if (!term) return [];
  return prisma.channel.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { handle: { contains: term.replace(/^@/, ""), mode: "insensitive" } },
      ],
    },
    include: {
      _count: { select: { subscribers: true, videos: true } },
    },
    orderBy: { subscribers: { _count: "desc" } },
    take: 3,
  });
}

/** Up to 8 suggestions for the search box: video titles and channel names. */
export async function searchSuggestions(q: string) {
  const term = q.trim();
  if (term.length < 1) return [];

  const [videos, channels] = await Promise.all([
    prisma.video.findMany({
      where: {
        ...publicVideoWhere,
        title: { contains: term, mode: "insensitive" },
      },
      select: { title: true },
      orderBy: { viewCount: "desc" },
      take: 12,
    }),
    prisma.channel.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      select: { name: true },
      take: 3,
    }),
  ]);

  // Titles that start with what was typed come first.
  const lower = term.toLocaleLowerCase();
  const titles = videos
    .map((video) => video.title)
    .sort(
      (a, b) =>
        Number(!a.toLocaleLowerCase().startsWith(lower)) -
        Number(!b.toLocaleLowerCase().startsWith(lower)),
    );
  const seen = new Set<string>();
  return [...channels.map((channel) => channel.name), ...titles]
    .filter((text) => {
      const key = text.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

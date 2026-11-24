import type { Prisma } from "@prisma/client";

export const VIDEO_CATEGORIES = [
  "Music",
  "Gaming",
  "News",
  "Technology",
  "Travel",
  "Food",
  "Education",
  "Sports",
  "Lifestyle",
  "Other",
] as const;

export const FALLBACK_THUMBNAIL =
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=960&q=85";

/** Data needed to render a video card anywhere in the app. */
export type VideoCardData = {
  id: string;
  title: string;
  channel: string;
  channelHandle: string;
  channelInitials: string;
  channelColor: string;
  channelAvatar: string | null;
  category: string;
  views: string;
  posted: string;
  duration: string;
  durationSeconds: number | null;
  thumbnail: string;
  isShort: boolean;
  /** How much of the video the viewer has watched, 0–100. */
  progress?: number;
};

/** Only public, fully processed videos appear in feeds. */
export const publicVideoWhere = {
  status: "READY",
  visibility: "PUBLIC",
} satisfies Prisma.VideoWhereInput;

/** Regular (non-Shorts) public videos. */
export const longFormWhere = {
  ...publicVideoWhere,
  isShort: false,
} satisfies Prisma.VideoWhereInput;

export const shortsWhere = {
  ...publicVideoWhere,
  isShort: true,
} satisfies Prisma.VideoWhereInput;

export const videoCardInclude = {
  channel: { select: { name: true, handle: true, avatarUrl: true } },
} satisfies Prisma.VideoInclude;

type VideoWithChannel = Prisma.VideoGetPayload<{
  include: typeof videoCardInclude;
}>;

export function toVideoCard(video: VideoWithChannel): VideoCardData {
  return {
    id: video.id,
    title: video.title,
    channel: video.channel.name,
    channelHandle: video.channel.handle,
    channelInitials: initials(video.channel.name),
    channelColor: colorFor(video.channel.name),
    channelAvatar: video.channel.avatarUrl,
    category: video.category,
    views: formatViews(video.viewCount),
    posted: timeAgo(video.createdAt),
    duration: formatDuration(video.duration),
    durationSeconds: video.duration,
    thumbnail: video.thumbnailUrl || FALLBACK_THUMBNAIL,
    isShort: video.isShort,
  };
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return letters.toLocaleUpperCase() || "SB";
}

const channelColors = [
  "#6d8d79",
  "#c27b55",
  "#586c9b",
  "#8065a8",
  "#b5596b",
  "#4f8a8b",
  "#9a7b3f",
  "#5d7fb8",
];

/** A stable avatar colour derived from the channel name. */
export function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return channelColors[hash % channelColors.length];
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatViews(value: number) {
  return `${formatCount(value)} ${value === 1 ? "view" : "views"}`;
}

export function formatSubscribers(value: number) {
  return `${formatCount(value)} ${value === 1 ? "subscriber" : "subscribers"}`;
}

export function timeAgo(date: Date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const units: [string, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    const amount = Math.floor(seconds / size);
    if (amount >= 1) return `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
  }
  return "Just now";
}

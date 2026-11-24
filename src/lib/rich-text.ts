export type RichToken =
  | { type: "text"; value: string }
  | { type: "time"; value: string; seconds: number }
  | { type: "tag"; value: string; tag: string }
  | { type: "url"; value: string };

// URLs, #hashtags, and timestamps like 1:05 or 1:02:30.
const TOKEN_PATTERN =
  /(https?:\/\/[^\s<>"']+)|(^|[^\p{L}\p{N}_&/])#([\p{L}\p{N}_]{1,50})|(?<![\d:])((?:\d{1,2}:)?\d{1,2}:\d{2})(?![\d:])/gu;

/** Seconds for "m:ss" or "h:mm:ss", or null if it isn't a valid time. */
export function parseTimestamp(value: string) {
  const parts = value.split(":").map(Number);
  if (parts.some((part) => !Number.isInteger(part))) return null;
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  if (s > 59 || (parts.length === 3 && m > 59)) return null;
  return h * 3600 + m * 60 + s;
}

/** Splits text into plain text, links, hashtags, and timestamps. */
export function tokenize(text: string): RichToken[] {
  const tokens: RichToken[] = [];
  let last = 0;
  const pushText = (end: number) => {
    if (end > last) tokens.push({ type: "text", value: text.slice(last, end) });
  };

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (match[1]) {
      // Leave trailing punctuation out of the link.
      const url = match[1].replace(/[.,;:!?)\]]+$/, "");
      pushText(index);
      tokens.push({ type: "url", value: url });
      last = index + url.length;
    } else if (match[3]) {
      const start = index + match[2].length;
      pushText(start);
      tokens.push({
        type: "tag",
        value: `#${match[3]}`,
        tag: match[3].toLocaleLowerCase(),
      });
      last = start + match[3].length + 1;
    } else if (match[4]) {
      const seconds = parseTimestamp(match[4]);
      if (seconds === null) continue;
      pushText(index);
      tokens.push({ type: "time", value: match[4], seconds });
      last = index + match[4].length;
    }
  }
  pushText(text.length);
  return tokens;
}

/**
 * Adds a description's hashtags to a video's tags (lowercase, no "#"),
 * keeping at most 15 tags of up to 30 characters.
 */
export function mergeHashtags(tags: string[], description: string) {
  return Array.from(
    new Set([
      ...tags.map((tag) => tag.toLocaleLowerCase()),
      ...extractHashtags(description),
    ]),
  )
    .filter((tag) => tag.length <= 30)
    .slice(0, 15);
}

/** Lowercase hashtags found in text, without the "#". */
export function extractHashtags(text: string) {
  return Array.from(
    new Set(
      tokenize(text).flatMap((token) =>
        token.type === "tag" ? [token.tag] : [],
      ),
    ),
  );
}

export type Chapter = { start: number; title: string };

/**
 * Chapters from a description, YouTube-style: lines that start with a
 * timestamp, beginning at 0:00, at least three of them, in order.
 */
export function parseChapters(description: string): Chapter[] {
  const chapters: Chapter[] = [];
  for (const line of description.split("\n")) {
    const match = line
      .trim()
      .match(/^((?:\d{1,2}:)?\d{1,2}:\d{2})\s*[-–—:]?\s+(.+)$/);
    if (!match) continue;
    const start = parseTimestamp(match[1]);
    if (start === null) continue;
    chapters.push({ start, title: match[2].trim().slice(0, 100) });
  }
  const valid =
    chapters.length >= 3 &&
    chapters[0].start === 0 &&
    chapters.every(
      (chapter, i) => i === 0 || chapter.start > chapters[i - 1].start,
    );
  return valid ? chapters : [];
}

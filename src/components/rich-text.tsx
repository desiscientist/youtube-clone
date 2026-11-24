"use client";

import Link from "next/link";
import { tokenize } from "@/lib/rich-text";

export const SEEK_EVENT = "streambox:seek";

/** Asks the video player on this page to jump to a time. */
export function seekPlayer(seconds: number) {
  window.dispatchEvent(new CustomEvent(SEEK_EVENT, { detail: seconds }));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Renders user text with clickable timestamps (seek the player), hashtags
 * (open the hashtag page), and links (open in a new tab).
 */
export function RichText({
  text,
  seekable = true,
}: {
  text: string;
  /** False where there's no player to seek, e.g. outside the watch page. */
  seekable?: boolean;
}) {
  return (
    <>
      {tokenize(text).map((token, index) => {
        switch (token.type) {
          case "time":
            return seekable ? (
              <button
                className="font-medium text-sky-600 hover:underline dark:text-sky-400"
                key={index}
                onClick={() => seekPlayer(token.seconds)}
                type="button"
              >
                {token.value}
              </button>
            ) : (
              <span key={index}>{token.value}</span>
            );
          case "tag":
            return (
              <Link
                className="font-medium text-sky-600 hover:underline dark:text-sky-400"
                href={`/hashtag/${encodeURIComponent(token.tag)}`}
                key={index}
              >
                {token.value}
              </Link>
            );
          case "url":
            return (
              <a
                className="break-all text-sky-600 hover:underline dark:text-sky-400"
                href={token.value}
                key={index}
                rel="noopener noreferrer nofollow ugc"
                target="_blank"
              >
                {token.value}
              </a>
            );
          default:
            return <span key={index}>{token.value}</span>;
        }
      })}
    </>
  );
}

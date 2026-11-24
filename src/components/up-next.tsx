"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListVideo, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AUTOPLAY_KEY = "streambox-autoplay";
const COUNTDOWN_SECONDS = 5;

/** The viewer's autoplay preference, remembered in this browser. On by default. */
export function useAutoplayPreference() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(AUTOPLAY_KEY) === "off")
        setEnabled(false);
    } catch {
      // Storage can be blocked (private mode); keep the default.
    }
  }, []);

  function update(next: boolean) {
    setEnabled(next);
    try {
      window.localStorage.setItem(AUTOPLAY_KEY, next ? "on" : "off");
    } catch {
      // Ignore: the choice still applies for this page.
    }
  }

  return [enabled, update] as const;
}

export function AutoplaySwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted">
      Autoplay
      <button
        aria-checked={enabled}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          enabled ? "bg-accent" : "bg-surface-muted ring-1 ring-border",
        )}
        onClick={() => onChange(!enabled)}
        role="switch"
        type="button"
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

export type NextVideo = { href: string; title: string; thumbnail: string };

/** Shown over the player when a video ends: plays the next one after a countdown. */
export function UpNextOverlay({
  next,
  onCancel,
  onPlay,
}: {
  next: NextVideo;
  onCancel: () => void;
  onPlay: () => void;
}) {
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (remaining <= 0) {
      onPlay();
      return;
    }
    const timer = window.setTimeout(
      () => setRemaining((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [remaining, onPlay]);

  return (
    <div className="absolute inset-0 z-20 grid place-items-center rounded-xl bg-black/85 p-4 text-white sm:rounded-2xl">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-white/70">Up next in {remaining}</p>
        <div
          className="mx-auto mt-3 aspect-video w-56 rounded-xl bg-cover bg-center"
          style={{ backgroundImage: `url("${next.thumbnail}")` }}
        />
        <p className="mt-3 line-clamp-2 font-semibold">{next.title}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button
            className="bg-white/15 text-white hover:bg-white/25"
            onClick={onCancel}
            size="sm"
            variant="ghost"
          >
            <X size={16} /> Cancel
          </Button>
          <Button onClick={onPlay} size="sm">
            <Play fill="currentColor" size={15} /> Play now
          </Button>
        </div>
      </div>
    </div>
  );
}

export type WatchPlaylist = {
  id: string;
  name: string;
  index: number;
  items: {
    id: string;
    title: string;
    channel: string;
    thumbnail: string;
    duration: string;
  }[];
};

/** The playlist being played, with the current video highlighted. */
export function PlaylistPanel({ playlist }: { playlist: WatchPlaylist }) {
  return (
    <section
      aria-label={`Playlist: ${playlist.name}`}
      className="mb-6 overflow-hidden rounded-2xl border border-border"
    >
      <div className="bg-surface-muted px-4 py-3">
        <Link
          className="inline-flex items-center gap-2 font-semibold hover:text-accent"
          href={`/playlist/${playlist.id}`}
        >
          <ListVideo size={17} /> {playlist.name}
        </Link>
        <p className="mt-0.5 text-xs text-muted">
          {playlist.index + 1} / {playlist.items.length}
        </p>
      </div>
      <ol className="max-h-[360px] overflow-y-auto py-1">
        {playlist.items.map((item, index) => (
          <li key={item.id}>
            <Link
              aria-current={index === playlist.index ? "true" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 hover:bg-surface-muted",
                index === playlist.index && "bg-accent/10",
              )}
              href={`/watch?v=${item.id}&list=${playlist.id}`}
            >
              <span className="w-5 shrink-0 text-center text-xs text-muted">
                {index === playlist.index ? (
                  <Play
                    className="inline text-accent"
                    fill="currentColor"
                    size={12}
                  />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className="relative aspect-video w-24 shrink-0 rounded-lg bg-surface-muted bg-cover bg-center"
                style={{ backgroundImage: `url("${item.thumbnail}")` }}
              >
                {item.duration && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px] text-white">
                    {item.duration}
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-medium leading-5">
                  {item.title}
                </span>
                <span className="block truncate text-xs text-muted">
                  {item.channel}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

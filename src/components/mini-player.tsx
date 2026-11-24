"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Maximize2, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type MiniPlayerVideo = {
  videoId: string;
  title: string;
  channel: string;
  src: string;
  time: number;
};

type MiniPlayerContextValue = {
  video: MiniPlayerVideo | null;
  open: (video: MiniPlayerVideo) => void;
  close: () => void;
};

const MiniPlayerContext = createContext<MiniPlayerContextValue>({
  video: null,
  open: () => undefined,
  close: () => undefined,
});

export function useMiniPlayer() {
  return useContext(MiniPlayerContext);
}

function saveProgress(videoId: string, seconds: number) {
  if (seconds <= 0) return;
  navigator.sendBeacon?.(
    `/api/videos/${videoId}/progress`,
    new Blob([JSON.stringify({ seconds })], { type: "application/json" }),
  );
}

/** Keeps a video playing in a corner while the viewer browses other pages. */
export function MiniPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [video, setVideo] = useState<MiniPlayerVideo | null>(null);
  const open = useCallback((next: MiniPlayerVideo) => setVideo(next), []);
  const close = useCallback(() => setVideo(null), []);
  const value = useMemo(() => ({ video, open, close }), [video, open, close]);

  return (
    <MiniPlayerContext.Provider value={value}>
      {children}
      {video && (
        <MiniPlayer key={video.videoId} video={video} onClose={close} />
      )}
    </MiniPlayerContext.Provider>
  );
}

function MiniPlayer({
  video,
  onClose,
}: {
  video: MiniPlayerVideo;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { open } = useMiniPlayer();
  const element = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  // The watch and Shorts pages have their own player.
  const hidden = pathname === "/watch" || pathname.startsWith("/shorts");

  useEffect(() => {
    const player = element.current;
    if (!player) return;
    if (hidden) {
      player.pause();
      return;
    }
    void player.play().catch(() => setPlaying(false));
  }, [hidden]);

  function expand() {
    const time = element.current?.currentTime ?? video.time;
    saveProgress(video.videoId, time);
    // The watch page picks the position up from here.
    open({ ...video, time });
    router.push(`/watch?v=${video.videoId}`);
  }

  function dismiss() {
    if (element.current)
      saveProgress(video.videoId, element.current.currentTime);
    onClose();
  }

  return (
    <div
      aria-label="Mini player"
      className={
        hidden
          ? "hidden"
          : "fixed bottom-20 right-3 z-50 w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl md:bottom-4 md:right-4"
      }
      role="region"
    >
      <div className="group relative aspect-video bg-black">
        <video
          className="size-full object-contain"
          onClick={expand}
          onEnded={dismiss}
          onLoadedMetadata={(event) => {
            event.currentTarget.currentTime = video.time;
          }}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          playsInline
          ref={element}
          src={video.src}
        />
        <div className="absolute inset-0 flex items-start justify-between bg-gradient-to-b from-black/60 to-transparent p-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <Button
            aria-label="Open full player"
            className="text-white hover:bg-white/15"
            onClick={expand}
            size="icon-sm"
            variant="ghost"
          >
            <Maximize2 size={16} />
          </Button>
          <Button
            aria-label="Close mini player"
            className="text-white hover:bg-white/15"
            onClick={dismiss}
            size="icon-sm"
            variant="ghost"
          >
            <X size={18} />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 p-2.5">
        <Button
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => {
            const player = element.current;
            if (!player) return;
            if (player.paused) void player.play();
            else player.pause();
          }}
          size="icon-sm"
          variant="ghost"
        >
          {playing ? (
            <Pause fill="currentColor" size={16} />
          ) : (
            <Play fill="currentColor" size={16} />
          )}
        </Button>
        <button
          className="min-w-0 flex-1 text-left"
          onClick={expand}
          type="button"
        >
          <span className="block truncate text-sm font-semibold">
            {video.title}
          </span>
          <span className="block truncate text-xs text-muted">
            {video.channel}
          </span>
        </button>
      </div>
    </div>
  );
}

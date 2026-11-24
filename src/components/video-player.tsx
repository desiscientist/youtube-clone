"use client";

import Hls from "hls.js";
import {
  Captions,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SEEK_EVENT } from "@/components/rich-text";
import { Button } from "@/components/ui/button";
import type { Chapter } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type VideoPlayerProps = {
  title: string;
  sourceUrl: string;
  hlsUrl?: string | null;
  sources?: Partial<Record<"360p" | "720p" | "1080p", string>>;
  captionsUrl?: string | null;
  onPlay?: () => void;
  onTheaterChange?: (theater: boolean) => void;
  /** Seconds to start from, e.g. where the viewer left off last time. */
  startAt?: number;
  /** Called about every 10 seconds of playback, on pause, and on leaving. */
  onProgress?: (seconds: number) => void;
  onEnded?: () => void;
  /** Try to start playing as soon as the video loads. */
  autoPlay?: boolean;
  /** Chapters from the description, marked on the seek bar. */
  chapters?: Chapter[];
  /** Called when the player goes away, e.g. to hand off to the mini-player. */
  onLeave?: (state: { time: number; playing: boolean }) => void;
};

const PROGRESS_SAVE_INTERVAL_SECONDS = 10;

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function VideoPlayer({
  title,
  sourceUrl,
  hlsUrl,
  sources = {},
  captionsUrl,
  onPlay,
  onTheaterChange,
  startAt,
  onProgress,
  onEnded,
  autoPlay = false,
  chapters = [],
  onLeave,
}: VideoPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const pendingStartRef = useRef(startAt);
  const pendingAutoPlayRef = useRef(autoPlay);
  const lastSavedRef = useRef(startAt ?? 0);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState("auto");
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [theater, setTheater] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState("");

  const selectedSource =
    quality === "auto"
      ? hlsUrl || sourceUrl
      : sources[quality as keyof typeof sources] || sourceUrl;

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
    videoRef.current.muted = muted;
  }, [muted, volume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedSource) return;

    const resumeAt = video.currentTime;
    const shouldResume = !video.paused;
    setError("");

    const resumePlayback = () => {
      const startFrom = pendingStartRef.current;
      if (resumeAt > 0 && resumeAt < video.duration) {
        video.currentTime = resumeAt;
      } else if (startFrom && startFrom > 0 && startFrom < video.duration) {
        // First load only: continue where the viewer left off last time.
        video.currentTime = startFrom;
        setResumedFrom(startFrom);
      }
      pendingStartRef.current = undefined;
      if (shouldResume || pendingAutoPlayRef.current) {
        pendingAutoPlayRef.current = false;
        // Browsers may block autoplay with sound; the viewer can press play.
        void video.play().catch(() => undefined);
      }
    };

    if (quality === "auto" && hlsUrl && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, capLevelToPlayerSize: true });
      hlsRef.current = hls;
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(hlsUrl));
      hls.on(Hls.Events.MANIFEST_PARSED, resumePlayback);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError(
            "This video stream could not be loaded. Please try another quality.",
          );
          hls.destroy();
          hlsRef.current = null;
        }
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    video.src = selectedSource;
    video.load();
    video.addEventListener("loadedmetadata", resumePlayback, { once: true });
    return () => {
      video.removeEventListener("loadedmetadata", resumePlayback);
      video.removeAttribute("src");
      video.load();
    };
  }, [hlsUrl, quality, selectedSource]);

  // Save the position when the viewer leaves the page or closes the tab.
  useEffect(() => {
    const video = videoRef.current;
    const save = () => {
      if (video && video.currentTime > 0) {
        onProgressRef.current?.(video.currentTime);
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
      if (video) {
        onLeaveRef.current?.({
          time: video.currentTime,
          playing: !video.paused && !video.ended,
        });
      }
    };
  }, []);

  // Clicking a timestamp in the description or comments jumps here.
  useEffect(() => {
    function onSeek(event: Event) {
      const seconds = (event as CustomEvent<number>).detail;
      const video = videoRef.current;
      if (!video || !Number.isFinite(seconds)) return;
      video.currentTime = Math.min(seconds, video.duration || seconds);
      void video.play().catch(() => undefined);
      playerRef.current?.focus({ preventScroll: true });
    }
    window.addEventListener(SEEK_EVENT, onSeek);
    return () => window.removeEventListener(SEEK_EVENT, onSeek);
  }, []);

  useEffect(() => {
    if (resumedFrom === null) return;
    const timer = window.setTimeout(() => setResumedFrom(null), 4000);
    return () => window.clearTimeout(timer);
  }, [resumedFrom]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === playerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {
        setError(
          "Playback could not start. Check the video source and try again.",
        );
      });
    } else {
      video.pause();
    }
  }, []);

  const seek = useCallback((amount: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(
      0,
      Math.min(video.duration, video.currentTime + amount),
    );
  }, []);

  async function toggleFullscreen() {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await player.requestFullscreen();
      }
    } catch {
      setError("Fullscreen is unavailable in this browser.");
    }
  }

  async function togglePictureInPicture() {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) {
      setError("Picture-in-picture is unavailable in this browser.");
      return;
    }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      setError("Picture-in-picture could not be started.");
    }
  }

  function handleKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (
      target.isContentEditable ||
      ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName)
    ) {
      return;
    }

    switch (event.key.toLocaleLowerCase()) {
      case " ":
      case "k":
        event.preventDefault();
        togglePlayback();
        break;
      case "j":
        event.preventDefault();
        seek(-10);
        break;
      case "l":
        event.preventDefault();
        seek(10);
        break;
      case "arrowleft":
        event.preventDefault();
        seek(-5);
        break;
      case "arrowright":
        event.preventDefault();
        seek(5);
        break;
      case "arrowup":
        event.preventDefault();
        setVolume((value) => {
          const next = Math.min(1, value + 0.05);
          if (videoRef.current) videoRef.current.volume = next;
          return next;
        });
        break;
      case "arrowdown":
        event.preventDefault();
        setVolume((value) => {
          const next = Math.max(0, value - 0.05);
          if (videoRef.current) videoRef.current.volume = next;
          return next;
        });
        break;
      case "m":
        setMuted((value) => !value);
        break;
      case "f":
        void toggleFullscreen();
        break;
      default:
        break;
    }
  }

  function toggleCaptions() {
    const tracks = videoRef.current?.textTracks;
    if (!tracks?.length) {
      setError("Captions are not available for this video.");
      return;
    }
    const enabled = !captionsEnabled;
    for (let index = 0; index < tracks.length; index += 1) {
      tracks[index].mode = enabled ? "showing" : "disabled";
    }
    setCaptionsEnabled(enabled);
  }

  const currentChapter = chapters.reduce<Chapter | null>(
    (found, chapter) => (chapter.start <= currentTime ? chapter : found),
    null,
  );

  const progressPercent = duration
    ? Math.min(100, (currentTime / duration) * 100)
    : 0;
  const bufferedPercent = duration
    ? Math.min(100, (buffered / duration) * 100)
    : 0;

  return (
    <div
      className={cn(
        "group/player relative aspect-video w-full overflow-hidden bg-black text-white outline-none",
        theater ? "rounded-none" : "rounded-xl sm:rounded-2xl",
      )}
      onDoubleClick={() => void toggleFullscreen()}
      onKeyDown={handleKeyboard}
      ref={playerRef}
      tabIndex={0}
    >
      <video
        aria-label={title}
        className="size-full object-contain"
        onClick={togglePlayback}
        onDurationChange={(event) =>
          setDuration(event.currentTarget.duration || 0)
        }
        onError={() =>
          setError(
            "This video could not be played. Try selecting another quality.",
          )
        }
        onLoadedMetadata={(event) =>
          setDuration(event.currentTarget.duration || 0)
        }
        onEnded={(event) => {
          onProgressRef.current?.(event.currentTarget.duration);
          lastSavedRef.current = event.currentTarget.duration;
          onEnded?.();
        }}
        onPause={(event) => {
          setPlaying(false);
          const time = event.currentTarget.currentTime;
          if (time > 0 && !event.currentTarget.ended) {
            onProgressRef.current?.(time);
            lastSavedRef.current = time;
          }
        }}
        onPlay={() => {
          setPlaying(true);
          onPlay?.();
        }}
        onProgress={(event) => {
          const ranges = event.currentTarget.buffered;
          if (ranges.length > 0) setBuffered(ranges.end(ranges.length - 1));
        }}
        onTimeUpdate={(event) => {
          const time = event.currentTarget.currentTime;
          setCurrentTime(time);
          if (
            Math.abs(time - lastSavedRef.current) >=
            PROGRESS_SAVE_INTERVAL_SECONDS
          ) {
            lastSavedRef.current = time;
            onProgressRef.current?.(time);
          }
        }}
        playsInline
        ref={videoRef}
        title={title}
      >
        {captionsUrl && (
          <track
            default={captionsEnabled}
            kind="captions"
            label="Captions"
            src={captionsUrl}
            srcLang="en"
          />
        )}
      </video>

      <button
        aria-label={playing ? "Pause video" : "Play video"}
        className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/50 via-transparent to-black/20 opacity-0 transition-opacity focus:opacity-100 group-hover/player:opacity-100"
        onClick={togglePlayback}
        type="button"
      >
        <span className="grid size-16 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
          {playing ? (
            <Pause fill="currentColor" size={29} />
          ) : (
            <Play className="ml-1" fill="currentColor" size={29} />
          )}
        </span>
      </button>

      {resumedFrom !== null && !error && (
        <div
          className="absolute left-4 top-4 z-10 flex items-center gap-3 rounded-xl bg-black/80 px-4 py-2 text-sm text-white"
          role="status"
        >
          Resumed from {formatTime(resumedFrom)}
          <button
            className="font-semibold underline underline-offset-2"
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = 0;
              setResumedFrom(null);
            }}
            type="button"
          >
            Start over
          </button>
        </div>
      )}

      {error && (
        <div
          className="absolute inset-x-4 top-4 z-10 rounded-xl bg-black/80 px-4 py-3 text-center text-sm text-white"
          role="alert"
        >
          {error}
          <button
            className="ml-3 font-semibold underline underline-offset-2"
            onClick={() => setError("")}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-10 opacity-100 transition-opacity sm:px-4 sm:pb-4">
        <div className="relative mb-3 h-1.5">
          <div className="absolute inset-0 rounded-full bg-white/25" />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/45"
            style={{ width: `${bufferedPercent}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            style={{ width: `${progressPercent}%` }}
          />
          {duration > 0 &&
            chapters
              .slice(1)
              .map((chapter) => (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 w-0.5 bg-black/70"
                  key={chapter.start}
                  style={{ left: `${(chapter.start / duration) * 100}%` }}
                  title={chapter.title}
                />
              ))}
          <input
            aria-label="Seek video"
            className="absolute inset-[-5px_0] h-[calc(100%+10px)] w-full cursor-pointer opacity-0"
            max={duration || 0}
            min={0}
            onChange={(event) => {
              const time = Number(event.target.value);
              if (videoRef.current) videoRef.current.currentTime = time;
              setCurrentTime(time);
            }}
            type="range"
            value={currentTime}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <Button
              aria-label={playing ? "Pause" : "Play"}
              className="size-9 text-white hover:bg-white/15 hover:text-white"
              onClick={togglePlayback}
              size="icon"
              variant="ghost"
            >
              {playing ? (
                <Pause fill="currentColor" size={20} />
              ) : (
                <Play fill="currentColor" size={20} />
              )}
            </Button>
            <Button
              aria-label={muted ? "Unmute" : "Mute"}
              className="size-9 text-white hover:bg-white/15 hover:text-white"
              onClick={() => setMuted((value) => !value)}
              size="icon"
              variant="ghost"
            >
              {muted || volume === 0 ? (
                <VolumeX size={20} />
              ) : (
                <Volume2 size={20} />
              )}
            </Button>
            <input
              aria-label="Volume"
              className="hidden h-1 w-20 cursor-pointer accent-white sm:block"
              max={1}
              min={0}
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                setMuted(next === 0);
                if (videoRef.current) videoRef.current.volume = next;
              }}
              step={0.05}
              type="range"
              value={volume}
            />
            <span className="ml-1 whitespace-nowrap text-xs tabular-nums sm:text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            {currentChapter && (
              <span className="ml-2 hidden max-w-[220px] truncate text-sm text-white/85 md:inline">
                · {currentChapter.title}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <label className="sr-only" htmlFor="playback-speed">
              Playback speed
            </label>
            <select
              aria-label="Playback speed"
              className="max-w-[72px] cursor-pointer bg-transparent px-1 text-xs outline-none hover:bg-white/10 sm:px-2 sm:text-sm"
              id="playback-speed"
              onChange={(event) => {
                const rate = Number(event.target.value);
                setPlaybackRate(rate);
                if (videoRef.current) videoRef.current.playbackRate = rate;
              }}
              value={playbackRate}
            >
              {playbackRates.map((rate) => (
                <option className="bg-neutral-900" key={rate} value={rate}>
                  {rate === 1 ? "Normal" : `${rate}×`}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="video-quality">
              Video quality
            </label>
            <select
              aria-label="Video quality"
              className="max-w-[78px] cursor-pointer bg-transparent px-1 text-xs outline-none hover:bg-white/10 sm:px-2 sm:text-sm"
              id="video-quality"
              onChange={(event) => setQuality(event.target.value)}
              value={quality}
            >
              {hlsUrl && (
                <option className="bg-neutral-900" value="auto">
                  Auto
                </option>
              )}
              {(["1080p", "720p", "360p"] as const)
                .filter((resolution) => sources[resolution])
                .map((resolution) => (
                  <option
                    className="bg-neutral-900"
                    key={resolution}
                    value={resolution}
                  >
                    {resolution}
                  </option>
                ))}
              {!hlsUrl && !Object.keys(sources).length && (
                <option className="bg-neutral-900" value="auto">
                  Auto
                </option>
              )}
            </select>
            <Button
              aria-label={
                captionsEnabled ? "Turn captions off" : "Turn captions on"
              }
              className={cn(
                "size-9 text-white hover:bg-white/15 hover:text-white",
                captionsEnabled && "text-accent",
              )}
              onClick={toggleCaptions}
              size="icon"
              title={captionsUrl ? "Captions" : "No captions available"}
              variant="ghost"
            >
              <Captions size={20} />
            </Button>
            <Button
              aria-label="Picture in picture"
              className="hidden size-9 text-white hover:bg-white/15 hover:text-white sm:inline-flex"
              onClick={() => void togglePictureInPicture()}
              size="icon"
              variant="ghost"
            >
              <PictureInPicture2 size={19} />
            </Button>
            <Button
              aria-label={theater ? "Exit theater mode" : "Theater mode"}
              className="hidden size-9 text-white hover:bg-white/15 hover:text-white sm:inline-flex"
              onClick={() => {
                setTheater((value) => {
                  onTheaterChange?.(!value);
                  return !value;
                });
              }}
              size="icon"
              variant="ghost"
            >
              <Settings2 size={19} />
            </Button>
            <Button
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="size-9 text-white hover:bg-white/15 hover:text-white"
              onClick={() => void toggleFullscreen()}
              size="icon"
              variant="ghost"
            >
              {fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

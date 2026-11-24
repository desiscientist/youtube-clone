"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Pause,
  Play,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { CommentsSection } from "@/components/comments-section";
import { useVideoReaction, type Reaction } from "@/components/reaction-buttons";
import { SubscribeButton } from "@/components/subscribe-button";
import { ChannelAvatar } from "@/components/video-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/videos";

export type ShortData = {
  id: string;
  title: string;
  videoUrl: string;
  thumbnail: string;
  views: string;
  likeCount: number;
  commentCount: number;
  reaction: Reaction;
  channel: {
    id: string;
    name: string;
    handle: string;
    avatar: string | null;
    color: string;
    initials: string;
    subscribed: boolean;
    isOwn: boolean;
  };
};

/** Full-height, snap-scrolling feed of vertical videos. */
export function ShortsFeed({
  shorts,
  signedIn,
}: {
  shorts: ShortData[];
  signedIn: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(false);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  // Whichever Short is mostly on screen becomes the active one.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { root, threshold: 0.6 },
    );
    root
      .querySelectorAll("[data-index]")
      .forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [shorts.length]);

  // Keep the address bar on the Short being watched, like YouTube does.
  useEffect(() => {
    const short = shorts[active];
    if (short) window.history.replaceState(null, "", `/shorts/${short.id}`);
    setCommentsFor(null);
  }, [active, shorts]);

  const scrollTo = useCallback((index: number) => {
    const target = scroller.current?.querySelector(`[data-index="${index}"]`);
    target?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="relative flex">
      <div
        className="scrollbar-hidden h-[calc(100dvh-64px-64px)] flex-1 snap-y snap-mandatory overflow-y-scroll md:h-[calc(100dvh-64px)]"
        ref={scroller}
      >
        {shorts.map((short, index) => (
          <section
            aria-label={short.title}
            className="flex h-full snap-start snap-always items-center justify-center gap-4 py-3"
            data-index={index}
            key={short.id}
          >
            <ShortPlayer
              active={index === active}
              muted={muted}
              onAutoplayMuted={() => setMuted(true)}
              onToggleMute={() => setMuted((value) => !value)}
              short={short}
              signedIn={signedIn}
            />
            <ShortActions
              commentsOpen={commentsFor === short.id}
              onToggleComments={() =>
                setCommentsFor((current) =>
                  current === short.id ? null : short.id,
                )
              }
              short={short}
              signedIn={signedIn}
            />
          </section>
        ))}
      </div>

      {commentsFor && (
        <aside
          aria-label="Comments"
          className="absolute inset-0 z-30 overflow-y-auto bg-background p-4 md:static md:h-[calc(100dvh-64px)] md:w-[420px] md:border-l md:border-border"
        >
          <div className="flex justify-end">
            <Button
              aria-label="Close comments"
              onClick={() => setCommentsFor(null)}
              size="icon-sm"
              variant="ghost"
            >
              <X size={18} />
            </Button>
          </div>
          <CommentsSection videoId={commentsFor} />
        </aside>
      )}

      <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
        <Button
          aria-label="Previous Short"
          disabled={active === 0}
          onClick={() => scrollTo(active - 1)}
          size="icon"
          variant="secondary"
        >
          <ChevronUp size={22} />
        </Button>
        <Button
          aria-label="Next Short"
          disabled={active >= shorts.length - 1}
          onClick={() => scrollTo(active + 1)}
          size="icon"
          variant="secondary"
        >
          <ChevronDown size={22} />
        </Button>
      </div>
    </div>
  );
}

function ShortPlayer({
  short,
  active,
  muted,
  onToggleMute,
  onAutoplayMuted,
  signedIn,
}: {
  short: ShortData;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onAutoplayMuted: () => void;
  signedIn: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const viewRecorded = useRef(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (active) {
      element.currentTime = 0;
      setPaused(false);
      element.play().catch(() => {
        // Autoplay with sound was blocked: start muted instead.
        element.muted = true;
        onAutoplayMuted();
        void element.play().catch(() => setPaused(true));
      });
    } else {
      element.pause();
    }
    // Only re-run when this Short becomes active or inactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (video.current) video.current.muted = muted;
  }, [muted]);

  function togglePlay() {
    const element = video.current;
    if (!element) return;
    if (element.paused) {
      void element.play();
      setPaused(false);
    } else {
      element.pause();
      setPaused(true);
    }
  }

  return (
    <div className="relative aspect-[9/16] h-full max-h-[calc(100%-8px)] overflow-hidden rounded-2xl bg-black">
      <video
        className="size-full object-cover"
        loop
        onClick={togglePlay}
        onPlay={() => {
          if (viewRecorded.current) return;
          viewRecorded.current = true;
          void fetch(`/api/videos/${short.id}/view`, { method: "POST" }).catch(
            () => undefined,
          );
        }}
        onTimeUpdate={(event) => {
          const { currentTime, duration } = event.currentTarget;
          if (duration) setProgress((currentTime / duration) * 100);
        }}
        playsInline
        poster={short.thumbnail}
        preload={active ? "auto" : "metadata"}
        ref={video}
        src={short.videoUrl}
      />

      {paused && (
        <button
          aria-label="Play"
          className="absolute inset-0 grid place-items-center bg-black/20"
          onClick={togglePlay}
          type="button"
        >
          <span className="grid size-16 place-items-center rounded-full bg-black/55">
            <Play className="ml-1 text-white" fill="currentColor" size={28} />
          </span>
        </button>
      )}

      <div className="absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/50 to-transparent p-3">
        <Button
          aria-label={paused ? "Play" : "Pause"}
          className="text-white hover:bg-white/15"
          onClick={togglePlay}
          size="icon-sm"
          variant="ghost"
        >
          {paused ? (
            <Play fill="currentColor" size={18} />
          ) : (
            <Pause fill="currentColor" size={18} />
          )}
        </Button>
        <Button
          aria-label={muted ? "Unmute" : "Mute"}
          className="text-white hover:bg-white/15"
          onClick={onToggleMute}
          size="icon-sm"
          variant="ghost"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </Button>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16 text-white">
        <div className="flex items-center gap-2">
          <Link
            className="flex min-w-0 items-center gap-2 text-sm font-semibold"
            href={`/channel/${short.channel.handle}`}
          >
            <ChannelAvatar
              avatar={short.channel.avatar}
              color={short.channel.color}
              initials={short.channel.initials}
              size={32}
            />
            <span className="truncate">@{short.channel.handle}</span>
          </Link>
          {!short.channel.isOwn && (
            <SubscribeButton
              channelId={short.channel.id}
              initialSubscribed={short.channel.subscribed}
              signedIn={signedIn}
            />
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-sm">{short.title}</p>
        <p className="mt-1 text-xs text-white/70">{short.views}</p>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/30">
        <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function ShortActions({
  short,
  signedIn,
  commentsOpen,
  onToggleComments,
}: {
  short: ShortData;
  signedIn: boolean;
  commentsOpen: boolean;
  onToggleComments: () => void;
}) {
  const { reaction, likeCount, choose } = useVideoReaction({
    videoId: short.id,
    signedIn,
    initialReaction: short.reaction,
    initialLikeCount: short.likeCount,
  });
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/shorts/${short.id}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const actions = [
    {
      label: reaction === "like" ? "Remove like" : "Like",
      caption: likeCount > 0 ? formatCount(likeCount) : "Like",
      icon: (
        <ThumbsUp
          className={cn(reaction === "like" && "fill-current")}
          size={22}
        />
      ),
      pressed: reaction === "like",
      onClick: () => choose("like"),
    },
    {
      label: reaction === "dislike" ? "Remove dislike" : "Dislike",
      caption: "Dislike",
      icon: (
        <ThumbsDown
          className={cn(reaction === "dislike" && "fill-current")}
          size={22}
        />
      ),
      pressed: reaction === "dislike",
      onClick: () => choose("dislike"),
    },
    {
      label: "Comments",
      caption:
        short.commentCount > 0 ? formatCount(short.commentCount) : "Comment",
      icon: <MessageSquare size={22} />,
      pressed: commentsOpen,
      onClick: onToggleComments,
    },
    {
      label: "Copy link",
      caption: copied ? "Copied" : "Share",
      icon: <Share2 size={22} />,
      pressed: false,
      onClick: share,
    },
  ];

  return (
    <div className="flex flex-col gap-4 self-end pb-6">
      {actions.map((action, index) => (
        <button
          aria-label={action.label}
          aria-pressed={action.pressed}
          className="flex flex-col items-center gap-1 text-xs font-medium"
          key={index}
          onClick={action.onClick}
          type="button"
        >
          <span
            className={cn(
              "grid size-12 place-items-center rounded-full bg-surface-muted transition hover:bg-surface-muted/75",
              action.pressed &&
                "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            {action.icon}
          </span>
          {action.caption}
        </button>
      ))}
    </div>
  );
}

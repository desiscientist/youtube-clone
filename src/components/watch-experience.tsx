"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Flag, Pencil, Share2 } from "lucide-react";
import { CommentsSection } from "@/components/comments-section";
import { useMiniPlayer } from "@/components/mini-player";
import { MoreMenu, ReportDialog } from "@/components/report-dialog";
import { RichText, seekPlayer } from "@/components/rich-text";
import { ReactionButtons, type Reaction } from "@/components/reaction-buttons";
import { SaveToPlaylist } from "@/components/save-to-playlist";
import { SiteHeader } from "@/components/site-header";
import { Sidebar } from "@/components/sidebar";
import { SubscribeButton } from "@/components/subscribe-button";
import {
  AutoplaySwitch,
  PlaylistPanel,
  UpNextOverlay,
  useAutoplayPreference,
  type NextVideo,
  type WatchPlaylist,
} from "@/components/up-next";
import { VideoCard } from "@/components/video-card";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { redirectToLogin } from "@/lib/login-redirect";
import { parseChapters } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { formatSubscribers, type VideoCardData } from "@/lib/videos";

export type WatchVideo = {
  id: string;
  title: string;
  description: string;
  category: string;
  viewCount: string;
  posted: string;
  duration: string;
  thumbnailUrl: string;
  captionsUrl?: string | null;
  videoUrl: string;
  hlsUrl: string | null;
  channelName: string;
  channelHandle: string;
  channelAvatar: string | null;
  channelColor: string;
  status: string;
  isSample: boolean;
  processingError?: string | null;
  visibility?: string;
};

export type WatchSocial = {
  signedIn: boolean;
  likeCount: number;
  reaction: Reaction;
  channelId: string;
  subscriberCount: number;
  subscribed: boolean;
  isOwnChannel: boolean;
};

export function WatchExperience({
  video,
  recommendations,
  social,
  trackViews,
  isOwner = false,
  startAt,
  playlist,
}: {
  video: WatchVideo;
  recommendations: VideoCardData[];
  social: WatchSocial;
  trackViews: boolean;
  isOwner?: boolean;
  startAt?: number;
  playlist?: WatchPlaylist;
}) {
  const router = useRouter();
  const miniPlayer = useMiniPlayer();
  // Coming back from the mini-player continues from where it was.
  const [resumeFrom] = useState(() =>
    miniPlayer.video?.videoId === video.id ? miniPlayer.video.time : startAt,
  );
  const [reporting, setReporting] = useState(false);
  const chapters = useMemo(
    () => parseChapters(video.description),
    [video.description],
  );
  const { close: closeMiniPlayer, open: openMiniPlayer } = miniPlayer;
  // This page has its own player, so any mini-player stops.
  useEffect(() => closeMiniPlayer(), [closeMiniPlayer]);
  const [autoplay, setAutoplay] = useAutoplayPreference();
  const [ended, setEnded] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(
    social.subscriberCount,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theater, setTheater] = useState(false);
  const [viewCount, setViewCount] = useState(video.viewCount);
  const [copied, setCopied] = useState(false);

  const sources = useMemo(() => {
    if (video.isSample) return {};
    return {
      "360p": `/api/media/${video.id}/processed/360p.mp4`,
      "720p": `/api/media/${video.id}/processed/720p.mp4`,
      "1080p": `/api/media/${video.id}/processed/1080p.mp4`,
    };
  }, [video.id, video.isSample]);

  // In a playlist, the next item plays; otherwise the top recommendation.
  const next: NextVideo | null = useMemo(() => {
    if (playlist) {
      const item = playlist.items[playlist.index + 1];
      return item
        ? {
            href: `/watch?v=${item.id}&list=${playlist.id}`,
            title: item.title,
            thumbnail: item.thumbnail,
          }
        : null;
    }
    const first = recommendations[0];
    return first
      ? {
          href: `/watch?v=${first.id}`,
          title: first.title,
          thumbnail: first.thumbnail,
        }
      : null;
  }, [playlist, recommendations]);

  const playNext = useCallback(() => {
    if (next) router.push(next.href);
  }, [next, router]);

  const cancelNext = useCallback(() => setEnded(false), []);

  const saveProgress = useCallback(
    (seconds: number) => {
      if (!social.signedIn) return;
      const body = JSON.stringify({ seconds });
      const url = `/api/videos/${video.id}/progress`;
      // sendBeacon still delivers when the tab is closing.
      const sent = navigator.sendBeacon?.(
        url,
        new Blob([body], { type: "application/json" }),
      );
      if (!sent) {
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => undefined);
      }
    },
    [social.signedIn, video.id],
  );

  async function shareVideo() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function recordView() {
    if (!trackViews) return;
    try {
      const response = await fetch(`/api/videos/${video.id}/view`, {
        method: "POST",
      });
      if (!response.ok) return;
      const result = (await response.json()) as { counted: boolean };
      if (result.counted) {
        setViewCount((current) => {
          const numericCount = Number(current.replace(/[^\d]/g, ""));
          return Number.isFinite(numericCount)
            ? `${(numericCount + 1).toLocaleString()} views`
            : current;
        });
      }
    } catch (error) {
      console.error("Could not record this video view.", error);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        onSidebarToggle={() => setSidebarCollapsed((value) => !value)}
      />
      {!theater && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapse={() => setSidebarCollapsed(true)}
        />
      )}
      <main
        className={cn(
          "min-h-[calc(100vh-64px)] transition-[padding] duration-200",
          !theater && (sidebarCollapsed ? "md:pl-[76px]" : "md:pl-[240px]"),
          theater && "md:px-8",
        )}
      >
        <div
          className={cn(
            "mx-auto grid max-w-[1800px] gap-6 px-3 pb-24 pt-4 sm:px-6 sm:pt-6",
            theater
              ? "grid-cols-1"
              : "grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_380px]",
          )}
        >
          <div className="min-w-0">
            {video.status === "READY" ? (
              <div className="relative">
                <VideoPlayer
                  autoPlay
                  captionsUrl={video.captionsUrl}
                  hlsUrl={video.hlsUrl}
                  onEnded={() => setEnded(true)}
                  onPlay={() => {
                    setEnded(false);
                    void recordView();
                  }}
                  onProgress={saveProgress}
                  onTheaterChange={setTheater}
                  chapters={chapters}
                  onLeave={({ time, playing }) => {
                    // Still playing when leaving the page: keep going small.
                    if (!playing) return;
                    openMiniPlayer({
                      videoId: video.id,
                      title: video.title,
                      channel: video.channelName,
                      src: video.videoUrl,
                      time,
                    });
                  }}
                  sourceUrl={video.videoUrl}
                  sources={sources}
                  startAt={resumeFrom}
                  title={video.title}
                />
                {ended && autoplay && next && (
                  <UpNextOverlay
                    next={next}
                    onCancel={cancelNext}
                    onPlay={playNext}
                  />
                )}
              </div>
            ) : (
              <div className="grid aspect-video place-items-center rounded-2xl bg-surface-muted p-6 text-center">
                <div className="max-w-lg">
                  <p className="text-lg font-semibold">
                    {video.status === "PROCESSING"
                      ? "This video is still processing"
                      : "This video could not be processed"}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {video.processingError ||
                      "Check back after video processing has finished."}
                  </p>
                  {isOwner && video.status === "FAILED" && (
                    <Link
                      className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90"
                      href="/upload"
                    >
                      Open upload center
                    </Link>
                  )}
                </div>
              </div>
            )}

            <h1 className="mt-4 text-xl font-bold leading-7 tracking-tight sm:text-2xl">
              {video.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {video.channelAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="size-11 rounded-full object-cover"
                    height={44}
                    src={video.channelAvatar}
                    width={44}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: video.channelColor }}
                  >
                    {video.channelName.slice(0, 2).toLocaleUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <Link
                    className="block truncate text-sm font-semibold hover:text-accent"
                    href={`/channel/${video.channelHandle}`}
                  >
                    {video.channelName}
                  </Link>
                  <p className="text-xs text-muted">
                    {formatSubscribers(subscriberCount)}
                  </p>
                </div>
                <div className="ml-2">
                  {social.isOwnChannel ? (
                    <Link
                      className="inline-flex h-9 items-center gap-2 rounded-full bg-surface-muted px-4 text-sm font-semibold hover:bg-surface-muted/75"
                      href="/studio"
                    >
                      <Pencil size={15} /> Manage video
                    </Link>
                  ) : (
                    <SubscribeButton
                      channelId={social.channelId}
                      initialSubscribed={social.subscribed}
                      onCountChange={setSubscriberCount}
                      signedIn={social.signedIn}
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ReactionButtons
                  initialLikeCount={social.likeCount}
                  initialReaction={social.reaction}
                  signedIn={social.signedIn}
                  videoId={video.id}
                />
                <Button onClick={shareVideo} size="sm" variant="secondary">
                  {copied ? <Check size={17} /> : <Share2 size={17} />}
                  {copied ? "Copied" : "Share"}
                </Button>
                <SaveToPlaylist signedIn={social.signedIn} videoId={video.id} />
                {!isOwner && (
                  <MoreMenu
                    items={[
                      {
                        label: "Report",
                        icon: <Flag size={16} />,
                        onSelect: () =>
                          social.signedIn
                            ? setReporting(true)
                            : redirectToLogin(),
                      },
                    ]}
                    label="More actions"
                  />
                )}
              </div>
            </div>

            <details className="mt-4 rounded-2xl bg-surface-muted p-4">
              <summary className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="font-semibold">{viewCount}</span>
                <span className="mx-2 text-muted">·</span>
                {video.posted}
                <span className="ml-2 text-muted">Show description</span>
              </summary>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                {video.description ? (
                  <RichText text={video.description} />
                ) : (
                  "No description provided."
                )}
              </p>
              {chapters.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Chapters</h3>
                  <ol className="scrollbar-hidden mt-2 flex gap-2 overflow-x-auto pb-1">
                    {chapters.map((chapter) => (
                      <li className="shrink-0" key={chapter.start}>
                        <button
                          className="w-40 rounded-xl bg-background px-3 py-2 text-left text-xs hover:bg-background/70"
                          onClick={() => seekPlayer(chapter.start)}
                          type="button"
                        >
                          <span className="block font-medium text-sky-600 dark:text-sky-400">
                            {formatChapterTime(chapter.start)}
                          </span>
                          <span className="line-clamp-2">{chapter.title}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="mt-3 text-xs font-medium text-muted">
                Category: {video.category}
              </p>
            </details>

            {video.status === "READY" && <CommentsSection videoId={video.id} />}
            {reporting && (
              <ReportDialog
                onClose={() => setReporting(false)}
                target={{ videoId: video.id }}
              />
            )}
          </div>

          {!theater && (
            <aside aria-label="Recommended videos" className="min-w-0">
              {playlist && <PlaylistPanel playlist={playlist} />}
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-semibold">Up next</h2>
                <div className="flex items-center gap-4">
                  <AutoplaySwitch enabled={autoplay} onChange={setAutoplay} />
                  <Link
                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
                    href="/"
                  >
                    More <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-1">
                {recommendations.map((recommendation) => (
                  <VideoCard key={recommendation.id} video={recommendation} />
                ))}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

function formatChapterTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

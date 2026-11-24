"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ShortsShelf } from "@/components/shorts-shelf";
import { VideoCard } from "@/components/video-card";
import { VideoGridSkeleton } from "@/components/video-grid-skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VideoCardData } from "@/lib/videos";

const categories = [
  "All",
  "Music",
  "Gaming",
  "News",
  "Technology",
  "Travel",
  "Food",
  "Education",
  "Sports",
  "Lifestyle",
];

type FeedPage = { videos: VideoCardData[]; nextOffset: number | null };

export function HomeFeed({
  firstPage,
  shorts,
  category,
}: {
  /** The first page, rendered on the server. More load as you scroll. */
  firstPage: FeedPage;
  shorts: VideoCardData[];
  /** The selected category, or undefined for "All". */
  category?: string;
}) {
  const categoryScroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const active = category ?? "All";

  const feed = useInfiniteQuery({
    queryKey: ["home-feed", category ?? "all"],
    initialPageParam: 0,
    initialData: { pages: [firstPage], pageParams: [0] },
    // The server-rendered page is fresh; don't refetch it straight away.
    staleTime: 5 * 60_000,
    getNextPageParam: (last: FeedPage) => last.nextOffset ?? undefined,
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const params = new URLSearchParams({ offset: String(pageParam) });
      if (category) params.set("category", category);
      const response = await fetch(`/api/feed?${params.toString()}`);
      if (!response.ok) throw new Error("Could not load more videos.");
      return response.json();
    },
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feed;

  // Load the next page when the bottom of the grid comes into view.
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // The same video can't appear twice even if rankings shift between pages.
  const seen = new Set<string>();
  const videos = (feed.data?.pages ?? []).flatMap((page) =>
    page.videos.filter((video) => !seen.has(video.id) && seen.add(video.id)),
  );
  const visibleShorts =
    active === "All"
      ? shorts
      : shorts.filter((short) => short.category === active);

  return (
    <AppShell>
      <div className="sticky top-16 z-20 border-b border-border/70 bg-background/95 pl-3 backdrop-blur md:pl-6">
        <div
          className="scrollbar-hidden flex h-[58px] items-center gap-3 overflow-x-auto pr-4"
          ref={categoryScroller}
        >
          <Button
            aria-label="Scroll categories left"
            className="sticky left-0 hidden shrink-0 bg-background/90 shadow-[8px_0_12px_rgb(var(--background))] sm:inline-flex"
            onClick={() =>
              categoryScroller.current?.scrollBy({
                left: -240,
                behavior: "smooth",
              })
            }
            size="icon-sm"
            variant="ghost"
          >
            <ChevronLeft size={18} />
          </Button>
          {categories.map((item) => (
            <Link
              aria-current={active === item ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-lg bg-surface-muted px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-muted/75",
                active === item &&
                  "bg-foreground text-background hover:bg-foreground/90",
              )}
              href={
                item === "All" ? "/" : `/?category=${encodeURIComponent(item)}`
              }
              key={item}
              scroll={false}
            >
              {item}
            </Link>
          ))}
          <Button
            aria-label="Scroll categories right"
            className="sticky right-0 hidden shrink-0 bg-background/90 shadow-[-8px_0_12px_rgb(var(--background))] sm:inline-flex"
            onClick={() =>
              categoryScroller.current?.scrollBy({
                left: 240,
                behavior: "smooth",
              })
            }
            size="icon-sm"
            variant="ghost"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      <section
        aria-label="Recommended videos"
        className="px-4 pt-6 sm:px-6 sm:pt-7 xl:px-8"
      >
        <h1 className="mb-5 text-xl font-bold tracking-tight">
          {active === "All" ? "For you" : active}
        </h1>

        {visibleShorts.length > 0 && <ShortsShelf shorts={visibleShorts} />}

        {videos.length > 0 ? (
          <>
            <VideoGrid videos={videos} />
            <div aria-hidden="true" className="h-px" ref={sentinel} />
            {isFetchingNextPage && (
              <div className="mt-8">
                <VideoGridSkeleton count={4} />
              </div>
            )}
            {feed.isError && (
              <div className="mt-8 flex justify-center">
                <Button
                  onClick={() => void fetchNextPage()}
                  variant="secondary"
                >
                  Couldn&apos;t load more. Try again
                </Button>
              </div>
            )}
            {!hasNextPage && videos.length > 24 && (
              <p className="mt-10 flex items-center justify-center gap-2 text-sm text-muted">
                You&apos;re all caught up
              </p>
            )}
          </>
        ) : (
          <div className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-border px-6 text-center">
            <div>
              <p className="text-lg font-semibold">No videos found</p>
              <p className="mt-2 text-sm text-muted">
                {active === "All"
                  ? "Nobody has published a video yet. Be the first!"
                  : "Nothing in this category yet. Try another one."}
              </p>
              {active !== "All" && (
                <Link
                  className="mt-5 inline-flex h-10 items-center rounded-full bg-surface-muted px-4 text-sm font-medium hover:bg-surface-muted/75"
                  href="/"
                >
                  Show all videos
                </Link>
              )}
            </div>
          </div>
        )}
        {feed.isFetching && !isFetchingNextPage && videos.length === 0 && (
          <LoaderCircle className="mx-auto mt-6 animate-spin text-muted" />
        )}
      </section>
    </AppShell>
  );
}

export function VideoGrid({ videos }: { videos: VideoCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}

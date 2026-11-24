import Link from "next/link";
import { AppShell, EmptyPanel } from "@/components/app-shell";
import { ChannelAvatar, VideoRow } from "@/components/video-card";
import { withProgress } from "@/lib/progress";
import {
  DATE_FILTERS,
  DURATION_FILTERS,
  SORT_OPTIONS,
  parseSearchParams,
  searchChannels,
  searchVideos,
  type SearchFilters,
} from "@/lib/search";
import { getCurrentUserId } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  colorFor,
  formatSubscribers,
  initials,
  toVideoCard,
} from "@/lib/videos";

type ResultsPageProps = {
  searchParams: Record<string, string | undefined>;
};

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const filters = parseSearchParams(searchParams);
  const userId = await getCurrentUserId();

  const [videos, channels] = await Promise.all([
    searchVideos(filters),
    // Channel matches only make sense for unfiltered searches.
    filters.date || filters.duration ? [] : searchChannels(filters.q),
  ]);
  const cards = await withProgress(videos.map(toVideoCard), userId);
  const descriptions = new Map(
    videos.map((video) => [video.id, video.description]),
  );

  return (
    <AppShell
      className="mx-auto max-w-[1100px] px-4 pt-4 sm:px-6"
      initialQuery={filters.q}
    >
      <FilterBar filters={filters} />

      {!filters.q ? (
        <EmptyPanel title="Search StreamBox">
          Type something in the search box to find videos and channels.
        </EmptyPanel>
      ) : (
        <>
          {channels.length > 0 && (
            <ul className="mb-6 grid gap-3 border-b border-border pb-6">
              {channels.map((channel) => (
                <li key={channel.id}>
                  <Link
                    className="flex items-center gap-4 rounded-2xl p-3 hover:bg-surface-muted sm:gap-8 sm:px-10"
                    href={`/channel/${channel.handle}`}
                  >
                    <ChannelAvatar
                      avatar={channel.avatarUrl}
                      color={colorFor(channel.name)}
                      initials={initials(channel.name)}
                      size={88}
                    />
                    <div className="min-w-0">
                      <p className="text-lg font-semibold">{channel.name}</p>
                      <p className="text-xs text-muted">
                        @{channel.handle} ·{" "}
                        {formatSubscribers(channel._count.subscribers)} ·{" "}
                        {channel._count.videos} videos
                      </p>
                      {channel.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted">
                          {channel.description}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {cards.length > 0 ? (
            <ul className="grid gap-6">
              {cards.map((card) => (
                <li key={card.id}>
                  <VideoRow snippet={descriptions.get(card.id)} video={card} />
                </li>
              ))}
            </ul>
          ) : (
            channels.length === 0 && (
              <EmptyPanel title={`No results for "${filters.q}"`}>
                Try different words, or remove some filters.
              </EmptyPanel>
            )
          )}
        </>
      )}
    </AppShell>
  );
}

/** Filter chips. Each is a link, so filtered searches can be shared and bookmarked. */
function FilterBar({ filters }: { filters: SearchFilters }) {
  const hrefWith = (change: Partial<SearchFilters>) => {
    const next = { ...filters, ...change };
    const params = new URLSearchParams({ q: next.q });
    if (next.date) params.set("date", next.date);
    if (next.duration) params.set("duration", next.duration);
    if (next.sort !== "relevance") params.set("sort", next.sort);
    return `/results?${params.toString()}`;
  };

  const groups = [
    {
      label: "Upload date",
      options: Object.entries(DATE_FILTERS).map(([key, value]) => ({
        label: value.label,
        active: filters.date === key,
        href: hrefWith({
          date:
            filters.date === key ? undefined : (key as SearchFilters["date"]),
        }),
      })),
    },
    {
      label: "Duration",
      options: Object.entries(DURATION_FILTERS).map(([key, value]) => ({
        label: value.label,
        active: filters.duration === key,
        href: hrefWith({
          duration:
            filters.duration === key
              ? undefined
              : (key as SearchFilters["duration"]),
        }),
      })),
    },
    {
      label: "Sort by",
      options: Object.entries(SORT_OPTIONS).map(([key, label]) => ({
        label,
        active: filters.sort === key,
        href: hrefWith({ sort: key as SearchFilters["sort"] }),
      })),
    },
  ];

  if (!filters.q) return null;
  return (
    <details
      className="mb-6 rounded-2xl border border-border"
      open={Boolean(
        filters.date || filters.duration || filters.sort !== "relevance",
      )}
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        Filters
        {(filters.date || filters.duration) && (
          <Link
            className="ml-3 text-xs text-accent"
            href={hrefWith({ date: undefined, duration: undefined })}
          >
            Clear
          </Link>
        )}
      </summary>
      <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {group.label}
            </p>
            <ul className="grid gap-1">
              {group.options.map((option) => (
                <li key={option.label}>
                  <Link
                    aria-current={option.active ? "true" : undefined}
                    className={cn(
                      "block rounded-lg px-2 py-1 text-sm hover:bg-surface-muted",
                      option.active && "bg-surface-muted font-semibold",
                    )}
                    href={option.href}
                  >
                    {option.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import { AnalyticsChart } from "@/components/analytics-chart";
import { AppShell, EmptyPanel, PageHeading } from "@/components/app-shell";
import {
  ANALYTICS_PERIODS,
  channelAnalytics,
  type AnalyticsPeriod,
  type MetricSeries,
} from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { cn } from "@/lib/utils";
import { FALLBACK_THUMBNAIL, formatCount } from "@/lib/videos";

const METRICS = {
  views: "Views",
  subscribers: "New subscribers",
  likes: "Likes",
  comments: "Comments",
} as const;
type MetricKey = keyof typeof METRICS;

type AnalyticsPageProps = {
  searchParams: { days?: string; metric?: string };
};

export default async function AnalyticsPage({
  searchParams,
}: AnalyticsPageProps) {
  const userId = await getCurrentUserId();
  if (!userId) return null; // middleware sends visitors to sign in

  const days = (
    Number(searchParams.days) in ANALYTICS_PERIODS
      ? Number(searchParams.days)
      : 28
  ) as AnalyticsPeriod;
  const metricKey: MetricKey =
    searchParams.metric && searchParams.metric in METRICS
      ? (searchParams.metric as MetricKey)
      : "views";

  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: { id: true, name: true },
  });
  if (!channel) {
    return (
      <AppShell className="px-4 pt-6 sm:px-6 xl:px-8">
        <EmptyPanel title="You don't have a channel yet" />
      </AppShell>
    );
  }

  const data = await channelAnalytics(channel.id, days);
  const href = (change: { days?: number; metric?: MetricKey }) =>
    `/studio/analytics?days=${change.days ?? days}&metric=${change.metric ?? metricKey}`;
  const topMax = Math.max(1, ...data.top.map((video) => video.views));

  return (
    <AppShell className="px-4 pt-6 sm:px-6 xl:px-8">
      <Link
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        href="/studio"
      >
        <ArrowLeft size={16} /> Creator studio
      </Link>
      <PageHeading
        actions={
          // Filters sit in one row above the charts.
          <nav
            aria-label="Time range"
            className="flex rounded-full bg-surface-muted p-1"
          >
            {Object.entries(ANALYTICS_PERIODS).map(([value, label]) => (
              <Link
                aria-current={Number(value) === days ? "true" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground",
                  Number(value) === days &&
                    "bg-background text-foreground shadow-sm",
                )}
                href={href({ days: Number(value) })}
                key={value}
                scroll={false}
              >
                {label}
              </Link>
            ))}
          </nav>
        }
        subtitle={`How ${channel.name} is doing`}
        title="Channel analytics"
      />

      <section className="rounded-2xl border border-border">
        {/* Each tile is also the tab that picks what the chart shows. */}
        <div
          className="grid grid-cols-2 border-b border-border lg:grid-cols-4"
          role="tablist"
        >
          {(Object.keys(METRICS) as MetricKey[]).map((key) => (
            <MetricTab
              active={key === metricKey}
              href={href({ metric: key })}
              key={key}
              label={METRICS[key]}
              series={data[key]}
            />
          ))}
        </div>
        <div className="p-4 sm:p-6">
          <h2 className="mb-2 font-semibold">
            {METRICS[metricKey]} · {ANALYTICS_PERIODS[days].toLocaleLowerCase()}
          </h2>
          <AnalyticsChart
            label={METRICS[metricKey]}
            points={data[metricKey].daily}
          />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border p-4 sm:p-6">
        <h2 className="font-semibold">
          Top content · {ANALYTICS_PERIODS[days].toLocaleLowerCase()}
        </h2>
        <p className="mt-1 text-sm text-muted">By views in this period.</p>
        {data.top.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No views in this period yet.
          </p>
        ) : (
          <ol className="mt-5 grid gap-3">
            {data.top.map((video, index) => (
              <li className="flex items-center gap-3" key={video.id}>
                <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted">
                  {index + 1}
                </span>
                <Link
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 hover:bg-surface-muted"
                  href={
                    video.isShort
                      ? `/shorts/${video.id}`
                      : `/watch?v=${video.id}`
                  }
                >
                  <span
                    className="aspect-video w-20 shrink-0 rounded-lg bg-surface-muted bg-cover bg-center"
                    style={{
                      backgroundImage: `url("${video.thumbnailUrl || FALLBACK_THUMBNAIL}")`,
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-medium">
                      {video.title}
                    </span>
                    {/* A thin bar, growing from the left, with its value at the tip. */}
                    <span className="mt-1.5 flex items-center gap-2">
                      <span
                        className="h-2 max-w-[70%] rounded-r bg-viz-series"
                        style={{ width: `${(video.views / topMax) * 70}%` }}
                      />
                      <span className="text-xs tabular-nums text-muted">
                        {video.views.toLocaleString()}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </AppShell>
  );
}

function MetricTab({
  label,
  series,
  active,
  href,
}: {
  label: string;
  series: MetricSeries;
  active: boolean;
  href: string;
}) {
  const change =
    series.previousTotal > 0
      ? ((series.total - series.previousTotal) / series.previousTotal) * 100
      : null;
  const Icon =
    change === null || Math.abs(change) < 0.5
      ? ArrowRight
      : change > 0
        ? ArrowUpRight
        : ArrowDownRight;
  return (
    <Link
      aria-selected={active}
      className={cn(
        "border-b-2 border-transparent p-4 hover:bg-surface-muted/60 sm:p-5",
        active && "border-viz-series bg-surface-muted/60",
      )}
      href={href}
      role="tab"
      scroll={false}
    >
      <span className="block text-sm text-muted">{label}</span>
      <span className="mt-1 block text-2xl font-bold tabular-nums">
        {formatCount(series.total)}
      </span>
      {/* Direction is shown by the arrow and the words, not by colour. */}
      <span className="mt-1 flex items-center gap-1 text-xs text-muted">
        <Icon aria-hidden="true" size={14} />
        {change === null
          ? series.total > 0
            ? "New this period"
            : "No change"
          : `${change > 0 ? "+" : ""}${Math.round(change)}% vs previous`}
      </span>
    </Link>
  );
}

"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import type { DailyPoint } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const HEIGHT = 240;
const MARGIN = { top: 12, right: 12, bottom: 28, left: 44 };

const fullDate = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const number = new Intl.NumberFormat("en");
const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** A round axis maximum (1, 2, 5 × 10ⁿ) at or above the data's maximum. */
function niceMax(value: number) {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
}

/**
 * One metric over time: a 2px line with a soft area, hairline grid, a
 * crosshair + tooltip on hover or arrow keys, and a table view.
 */
export function AnalyticsChart({
  points,
  label,
}: {
  points: DailyPoint[];
  /** e.g. "Views". Names the series (one series, so no legend). */
  label: string;
}) {
  const container = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, Math.floor(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
    const x = (i: number) =>
      MARGIN.left +
      (points.length <= 1
        ? plotWidth / 2
        : (i / (points.length - 1)) * plotWidth);
    const y = (v: number) => MARGIN.top + plotHeight - (v / max) * plotHeight;
    const line = points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
      )
      .join(" ");
    const baseline = y(0);
    const area = points.length
      ? `${line} L${x(points.length - 1).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`
      : "";
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
    // About five date labels, always including the last day.
    const every = Math.max(1, Math.ceil(points.length / 5));
    const dateTicks = points
      .map((p, i) => ({ i, date: p.date }))
      .filter(({ i }) => (points.length - 1 - i) % every === 0);
    return { plotWidth, x, y, line, area, ticks, dateTicks, baseline };
  }, [points, width]);

  function pick(clientX: number, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    if (points.length === 0) return;
    const ratio = (clientX - rect.left - MARGIN.left) / geometry.plotWidth;
    const index = Math.round(ratio * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, index)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    setActive((current) =>
      Math.max(
        0,
        Math.min(points.length - 1, (current ?? points.length - 1) + step),
      ),
    );
  }

  const point = active !== null ? points[active] : null;
  const total = points.reduce((sum, p) => sum + p.value, 0);

  return (
    // Measured as a whole so the width survives switching to the table.
    <figure className="m-0" ref={container}>
      <div className="mb-2 flex items-center justify-end">
        <button
          aria-pressed={showTable}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-muted hover:text-foreground"
          onClick={() => setShowTable((value) => !value)}
          type="button"
        >
          {showTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-[260px] overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">{label} per day</caption>
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium" scope="col">
                  Date
                </th>
                <th className="px-3 py-2 text-right font-medium" scope="col">
                  {label}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr className="border-t border-border" key={p.date}>
                  <td className="px-3 py-1.5">
                    {fullDate.format(new Date(p.date))}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {number.format(p.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          aria-label={`${label} per day. ${number.format(total)} in total. Use the arrow keys to read each day.`}
          className="relative outline-none focus-visible:ring-2 focus-visible:ring-viz-series/50"
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
          onPointerLeave={() => setActive(null)}
          onPointerMove={(event) => pick(event.clientX, event.currentTarget)}
          role="img"
          tabIndex={0}
        >
          <svg
            aria-hidden="true"
            className="block"
            height={HEIGHT}
            width={width}
          >
            {geometry.ticks.map((tick) => (
              <g key={tick}>
                <line
                  className="stroke-border"
                  strokeWidth={1}
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={geometry.y(tick)}
                  y2={geometry.y(tick)}
                />
                <text
                  className="fill-muted text-[11px] tabular-nums"
                  dominantBaseline="middle"
                  textAnchor="end"
                  x={MARGIN.left - 8}
                  y={geometry.y(tick)}
                >
                  {compact.format(tick)}
                </text>
              </g>
            ))}
            {geometry.dateTicks.map(({ i, date }) => (
              <text
                className="fill-muted text-[11px]"
                key={date}
                textAnchor={
                  i === points.length - 1 ? "end" : i === 0 ? "start" : "middle"
                }
                x={geometry.x(i)}
                y={HEIGHT - 8}
              >
                {shortDate.format(new Date(date))}
              </text>
            ))}

            <path className="fill-viz-series/10" d={geometry.area} />
            <path
              className="fill-none stroke-viz-series"
              d={geometry.line}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />

            {point && active !== null && (
              <>
                <line
                  className="stroke-muted/60"
                  strokeWidth={1}
                  x1={geometry.x(active)}
                  x2={geometry.x(active)}
                  y1={MARGIN.top}
                  y2={geometry.baseline}
                />
                <circle
                  className="fill-viz-series stroke-surface"
                  cx={geometry.x(active)}
                  cy={geometry.y(point.value)}
                  r={5}
                  strokeWidth={2}
                />
              </>
            )}
          </svg>

          {point && active !== null && (
            <div
              className={cn(
                "pointer-events-none absolute top-0 z-10 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg",
                // Keep the tooltip inside the chart near the right edge.
                geometry.x(active) > width * 0.7
                  ? "-translate-x-[calc(100%+12px)]"
                  : "translate-x-3",
              )}
              role="status"
              style={{ left: geometry.x(active) }}
            >
              <p className="text-muted">
                {fullDate.format(new Date(point.date))}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 font-semibold tabular-nums">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-3 rounded bg-viz-series"
                />
                {number.format(point.value)} {label.toLocaleLowerCase()}
              </p>
            </div>
          )}
        </div>
      )}
      <figcaption className="mt-2 text-xs text-muted">
        Daily totals in UTC. Hover, or focus the chart and use ← →, to read a
        day.
      </figcaption>
    </figure>
  );
}

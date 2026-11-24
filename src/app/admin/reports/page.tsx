import Link from "next/link";
import { notFound } from "next/navigation";
import { Flag, MessageSquare, Video } from "lucide-react";
import { AppShell, EmptyPanel, PageHeading } from "@/components/app-shell";
import { ReportActions } from "@/components/report-actions";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { FALLBACK_THUMBNAIL, timeAgo } from "@/lib/videos";

type AdminReportsPageProps = { searchParams: { view?: string } };

export default async function AdminReportsPage({
  searchParams,
}: AdminReportsPageProps) {
  // Non-admins get a plain 404, so the page's existence isn't advertised.
  if (!(await getAdminUserId())) notFound();
  const showClosed = searchParams.view === "closed";

  const reports = await prisma.report.findMany({
    where: showClosed ? { status: { not: "OPEN" } } : { status: "OPEN" },
    include: {
      reporter: { select: { name: true, email: true } },
      resolvedBy: { select: { name: true, email: true } },
      video: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          isShort: true,
          channel: { select: { name: true, handle: true } },
        },
      },
      comment: {
        select: { id: true, user: { select: { name: true, email: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Group open reports about the same item so each item is decided once.
  const groups = new Map<string, typeof reports>();
  for (const report of reports) {
    const key = showClosed
      ? report.id
      : `${report.targetType}:${report.commentId ?? report.videoId ?? report.id}`;
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }

  return (
    <AppShell className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
      <PageHeading
        actions={
          <nav
            aria-label="Report status"
            className="flex rounded-full bg-surface-muted p-1"
          >
            {[
              { label: "Open", href: "/admin/reports", active: !showClosed },
              {
                label: "Closed",
                href: "/admin/reports?view=closed",
                active: showClosed,
              },
            ].map((tab) => (
              <Link
                aria-current={tab.active ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium text-muted hover:text-foreground",
                  tab.active && "bg-background text-foreground shadow-sm",
                )}
                href={tab.href}
                key={tab.label}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        }
        subtitle={
          showClosed
            ? "Recent decisions, newest first."
            : "Review what viewers flagged. Removing deletes the video or comment for everyone."
        }
        title="Reports"
      />

      {groups.size === 0 ? (
        <EmptyPanel
          title={showClosed ? "No closed reports yet" : "Nothing to review"}
        >
          {!showClosed && "New reports from viewers will appear here."}
        </EmptyPanel>
      ) : (
        <ul className="grid gap-4">
          {Array.from(groups.values()).map((group) => {
            const first = group[0];
            const isComment = first.targetType === "comment";
            const contentGone = isComment ? !first.comment : !first.video;
            const reasons = Array.from(
              new Set(group.map((report) => report.reason)),
            );
            const watchHref = first.video
              ? first.video.isShort
                ? `/shorts/${first.video.id}`
                : `/watch?v=${first.video.id}`
              : null;
            return (
              <li
                className="rounded-2xl border border-border p-4 sm:p-5"
                key={first.id}
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  {!isComment && (
                    <span
                      className="aspect-video w-full shrink-0 rounded-xl bg-surface-muted bg-cover bg-center sm:w-44"
                      style={{
                        backgroundImage: `url("${first.video?.thumbnailUrl || FALLBACK_THUMBNAIL}")`,
                      }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      {isComment ? (
                        <MessageSquare size={14} />
                      ) : (
                        <Video size={14} />
                      )}
                      {isComment ? "Comment" : "Video"}
                      {!showClosed && (
                        <>
                          <span aria-hidden="true">·</span>
                          <Flag size={13} /> {group.length}{" "}
                          {group.length === 1 ? "report" : "reports"}
                        </>
                      )}
                      {contentGone && (
                        <span className="rounded-full bg-surface-muted px-2 py-0.5">
                          Already removed
                        </span>
                      )}
                    </p>

                    {isComment ? (
                      <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 border-border pl-3 text-sm">
                        {first.targetLabel}
                      </blockquote>
                    ) : (
                      <p className="mt-1 font-semibold">{first.targetLabel}</p>
                    )}
                    <p className="mt-2 text-xs text-muted">
                      {isComment && first.comment
                        ? `By ${first.comment.user.name || first.comment.user.email}`
                        : first.video
                          ? `Channel: ${first.video.channel.name}`
                          : null}
                      {watchHref && (
                        <>
                          {" · "}
                          <Link
                            className="font-medium text-accent"
                            href={watchHref}
                          >
                            {isComment ? "Open the video" : "Watch"}
                          </Link>
                        </>
                      )}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {reasons.map((reason) => (
                        <span
                          className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium"
                          key={reason}
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                    <ul className="mt-3 grid gap-1 text-xs text-muted">
                      {group.slice(0, 5).map((report) => (
                        <li key={report.id}>
                          {report.reporter.name || report.reporter.email} ·{" "}
                          {timeAgo(report.createdAt)}
                          {report.details && (
                            <> — &ldquo;{report.details}&rdquo;</>
                          )}
                        </li>
                      ))}
                      {group.length > 5 && <li>and {group.length - 5} more</li>}
                    </ul>

                    {showClosed ? (
                      <p className="mt-3 text-xs">
                        <span className="font-semibold">
                          {first.status === "RESOLVED"
                            ? "Removed"
                            : "Dismissed"}
                        </span>
                        {first.resolvedBy &&
                          ` by ${first.resolvedBy.name || first.resolvedBy.email}`}
                        {first.resolvedAt && ` · ${timeAgo(first.resolvedAt)}`}
                      </p>
                    ) : (
                      <ReportActions
                        contentGone={contentGone}
                        kind={isComment ? "comment" : "video"}
                        reportId={first.id}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}

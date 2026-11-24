export function VideoGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      aria-label="Loading videos"
      className="grid grid-cols-1 gap-x-4 gap-y-8 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      role="status"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="animate-pulse" key={index}>
          <div className="aspect-video rounded-2xl bg-surface-muted" />
          <div className="mt-3 flex gap-3">
            <div className="size-9 shrink-0 rounded-full bg-surface-muted" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-full rounded bg-surface-muted" />
              <div className="h-3 w-2/3 rounded bg-surface-muted" />
              <div className="h-2.5 w-1/2 rounded bg-surface-muted" />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading videos</span>
    </div>
  );
}

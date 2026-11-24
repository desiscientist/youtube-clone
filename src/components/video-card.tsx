import Link from "next/link";
import { WatchLaterButton } from "@/components/watch-later-button";
import type { VideoCardData } from "@/lib/videos";

export function VideoCard({
  video,
  action,
  href,
}: {
  video: VideoCardData;
  /** Optional control shown beside the title, such as a remove button. */
  action?: React.ReactNode;
  /** Where the card links; defaults to the watch page. */
  href?: string;
}) {
  const watchHref =
    href ?? (video.isShort ? `/shorts/${video.id}` : `/watch?v=${video.id}`);
  return (
    <article className="group min-w-0">
      <div className="relative">
        <Link
          aria-label={`Watch ${video.title}`}
          className="relative block aspect-video overflow-hidden rounded-xl bg-surface-muted sm:rounded-2xl"
          href={watchHref}
        >
          <div
            aria-label={`${video.category} video thumbnail`}
            className="size-full bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.035]"
            role="img"
            style={{ backgroundImage: `url("${video.thumbnail}")` }}
          />
          {video.duration && (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
              {video.duration}
            </span>
          )}
          {video.progress !== undefined && (
            <span
              aria-label={`${Math.round(video.progress)}% watched`}
              className="absolute inset-x-0 bottom-0 h-1 bg-white/40"
              role="img"
            >
              <span
                className="block h-full bg-accent"
                style={{ width: `${video.progress}%` }}
              />
            </span>
          )}
        </Link>
        <WatchLaterButton
          className="absolute right-2 top-2 opacity-100 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100 [&[aria-pressed=true]]:opacity-100"
          videoId={video.id}
        />
      </div>
      <div className="mt-3 flex items-start gap-3">
        <Link
          aria-hidden="true"
          className="shrink-0"
          href={`/channel/${video.channelHandle}`}
          tabIndex={-1}
        >
          <ChannelAvatar
            avatar={video.channelAvatar}
            color={video.channelColor}
            initials={video.channelInitials}
            size={36}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            className="line-clamp-2 text-[15px] font-semibold leading-5 tracking-[-0.15px] hover:text-accent"
            href={watchHref}
          >
            {video.title}
          </Link>
          <Link
            className="mt-1.5 block truncate text-[13px] leading-5 text-muted hover:text-foreground"
            href={`/channel/${video.channelHandle}`}
          >
            {video.channel}
          </Link>
          <p className="text-[13px] leading-5 text-muted">
            {video.views} <span aria-hidden="true">·</span> {video.posted}
          </p>
        </div>
        {action}
      </div>
    </article>
  );
}

export function ChannelAvatar({
  avatar,
  color,
  initials,
  size,
}: {
  avatar: string | null;
  color: string;
  initials: string;
  size: number;
}) {
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className="rounded-full object-cover"
        height={size}
        src={avatar}
        style={{ width: size, height: size }}
        width={size}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-full font-semibold text-white"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size / 3)),
      }}
    >
      {initials}
    </span>
  );
}

/** Wide layout used by search results: thumbnail left, details right. */
export function VideoRow({
  video,
  snippet,
}: {
  video: VideoCardData;
  snippet?: string;
}) {
  const watchHref = video.isShort
    ? `/shorts/${video.id}`
    : `/watch?v=${video.id}`;
  return (
    <article className="group flex flex-col gap-3 sm:flex-row sm:gap-4">
      <div className="relative w-full shrink-0 sm:w-[360px]">
        <Link
          aria-label={`Watch ${video.title}`}
          className="relative block aspect-video overflow-hidden rounded-xl bg-surface-muted"
          href={watchHref}
        >
          <div
            className="size-full bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.035]"
            style={{ backgroundImage: `url("${video.thumbnail}")` }}
          />
          {(video.isShort || video.duration) && (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
              {video.isShort ? "SHORTS" : video.duration}
            </span>
          )}
          {video.progress !== undefined && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-white/40">
              <span
                className="block h-full bg-accent"
                style={{ width: `${video.progress}%` }}
              />
            </span>
          )}
        </Link>
        <WatchLaterButton
          className="absolute right-2 top-2 opacity-100 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100 [&[aria-pressed=true]]:opacity-100"
          videoId={video.id}
        />
      </div>
      <div className="min-w-0 flex-1">
        <Link
          className="line-clamp-2 text-lg font-semibold leading-6 hover:text-accent"
          href={watchHref}
        >
          {video.title}
        </Link>
        <p className="mt-1 text-xs text-muted">
          {video.views} <span aria-hidden="true">·</span> {video.posted}
        </p>
        <Link
          className="mt-3 flex items-center gap-2 text-xs text-muted hover:text-foreground"
          href={`/channel/${video.channelHandle}`}
        >
          <ChannelAvatar
            avatar={video.channelAvatar}
            color={video.channelColor}
            initials={video.channelInitials}
            size={24}
          />
          {video.channel}
        </Link>
        {snippet && (
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">
            {snippet}
          </p>
        )}
      </div>
    </article>
  );
}

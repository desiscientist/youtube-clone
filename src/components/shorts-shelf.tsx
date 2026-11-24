import Link from "next/link";
import { PlaySquare } from "lucide-react";
import type { VideoCardData } from "@/lib/videos";

/** A horizontal row of vertical Shorts thumbnails. */
export function ShortsShelf({
  shorts,
  title = "Shorts",
}: {
  shorts: VideoCardData[];
  title?: string;
}) {
  return (
    <section aria-label={title} className="mb-10 border-b border-border pb-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <PlaySquare className="text-accent" size={22} /> {title}
      </h2>
      <ul className="scrollbar-hidden -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {shorts.map((short) => (
          <li className="w-[160px] shrink-0 sm:w-[200px]" key={short.id}>
            <Link className="group block" href={`/shorts/${short.id}`}>
              <div className="aspect-[9/16] overflow-hidden rounded-xl bg-surface-muted">
                <div
                  aria-hidden="true"
                  className="size-full bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.035]"
                  style={{ backgroundImage: `url("${short.thumbnail}")` }}
                />
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 group-hover:text-accent">
                {short.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">{short.views}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

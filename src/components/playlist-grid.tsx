import Link from "next/link";
import { ListVideo } from "lucide-react";
import { FALLBACK_THUMBNAIL } from "@/lib/videos";

export function PlaylistGrid({
  playlists,
}: {
  playlists: {
    id: string;
    name: string;
    videoCount: number;
    thumbnail: string | null;
    detail?: string;
  }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {playlists.map((playlist) => (
        <Link
          className="group min-w-0"
          href={`/playlist/${playlist.id}`}
          key={playlist.id}
        >
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface-muted">
            {playlist.videoCount > 0 && (
              <div
                className="size-full bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.035]"
                style={{
                  backgroundImage: `url("${playlist.thumbnail || FALLBACK_THUMBNAIL}")`,
                }}
              />
            )}
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
              <ListVideo size={13} /> {playlist.videoCount}{" "}
              {playlist.videoCount === 1 ? "video" : "videos"}
            </span>
          </div>
          <p className="mt-3 line-clamp-2 text-[15px] font-semibold leading-5 group-hover:text-accent">
            {playlist.name}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {playlist.detail ?? "View full playlist"}
          </p>
        </Link>
      ))}
    </div>
  );
}

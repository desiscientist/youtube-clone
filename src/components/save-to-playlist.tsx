"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Lock, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { watchLaterQueryKey } from "@/components/watch-later-button";
import { redirectToLogin } from "@/lib/login-redirect";

type PlaylistOption = {
  id: string;
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
  videoCount: number;
  hasVideo: boolean;
};

export function SaveToPlaylist({
  videoId,
  signedIn,
}: {
  videoId: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const queryKey = ["playlists", videoId];

  const { data: playlists, isLoading } = useQuery({
    queryKey,
    enabled: open && signedIn,
    queryFn: async (): Promise<PlaylistOption[]> => {
      const response = await fetch(`/api/playlists?videoId=${videoId}`);
      if (!response.ok) throw new Error("Could not load playlists.");
      return ((await response.json()) as { playlists: PlaylistOption[] })
        .playlists;
    },
  });

  const toggleVideo = useMutation({
    mutationFn: async (playlist: PlaylistOption) => {
      const response = playlist.hasVideo
        ? await fetch(
            `/api/playlists/${playlist.id}/videos?videoId=${videoId}`,
            { method: "DELETE" },
          )
        : await fetch(`/api/playlists/${playlist.id}/videos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId }),
          });
      if (!response.ok) throw new Error("Could not update the playlist.");
    },
    onMutate: (playlist) => {
      queryClient.setQueryData<PlaylistOption[]>(queryKey, (current) =>
        current?.map((item) =>
          item.id === playlist.id
            ? {
                ...item,
                hasVideo: !item.hasVideo,
                videoCount: item.videoCount + (item.hasVideo ? -1 : 1),
              }
            : item,
        ),
      );
    },
    onError: () => {
      setError("Couldn't update that playlist. Try again.");
      queryClient.invalidateQueries({ queryKey });
    },
    // Keep the clock buttons on thumbnails in sync with Watch later.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: watchLaterQueryKey }),
  });

  const createPlaylist = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          videoId,
          visibility: isPublic ? "PUBLIC" : "PRIVATE",
        }),
      });
      const result = (await response.json()) as {
        playlist?: PlaylistOption;
        error?: string;
      };
      if (!response.ok || !result.playlist) {
        throw new Error(result.error || "Could not create the playlist.");
      }
      return result.playlist;
    },
    onSuccess: (playlist) => {
      queryClient.setQueryData<PlaylistOption[]>(queryKey, (current) => [
        playlist,
        ...(current ?? []),
      ]);
      setName("");
      setIsPublic(false);
      setCreating(false);
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (name.trim()) createPlaylist.mutate();
  }

  const saved = playlists?.some((playlist) => playlist.hasVideo) ?? false;

  return (
    <div className="relative" ref={container}>
      <Button
        aria-expanded={open}
        onClick={() =>
          signedIn ? setOpen((value) => !value) : redirectToLogin()
        }
        size="sm"
        variant="secondary"
      >
        <Bookmark className={saved ? "fill-current" : undefined} size={17} />
        {saved ? "Saved" : "Save"}
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-border bg-surface p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">Save video to…</h2>
            <Button
              aria-label="Close"
              onClick={() => setOpen(false)}
              size="icon-sm"
              variant="ghost"
            >
              <X size={17} />
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <p className="px-2 py-3 text-sm text-muted">Loading…</p>
            ) : playlists && playlists.length > 0 ? (
              playlists.map((playlist) => (
                <label
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-surface-muted"
                  key={playlist.id}
                >
                  <input
                    checked={playlist.hasVideo}
                    className="size-4 accent-[rgb(var(--accent))]"
                    onChange={() => {
                      setError(null);
                      toggleVideo.mutate(playlist);
                    }}
                    type="checkbox"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {playlist.name}
                  </span>
                  {playlist.visibility === "PRIVATE" && (
                    <Lock
                      aria-label="Private"
                      className="text-muted"
                      size={14}
                    />
                  )}
                </label>
              ))
            ) : (
              <p className="px-2 py-3 text-sm text-muted">
                You don&apos;t have any playlists yet.
              </p>
            )}
          </div>

          {error && <p className="px-2 pt-2 text-xs text-accent">{error}</p>}

          <div className="mt-2 border-t border-border pt-2">
            {creating ? (
              <form className="grid gap-2 px-1" onSubmit={submit}>
                <input
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  aria-label="Playlist name"
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-sky-500"
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Playlist name"
                  value={name}
                />
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    checked={isPublic}
                    className="accent-[rgb(var(--accent))]"
                    onChange={(event) => setIsPublic(event.target.checked)}
                    type="checkbox"
                  />
                  Public — anyone with the link can view it
                </label>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => setCreating(false)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={!name.trim() || createPlaylist.isPending}
                    size="sm"
                    type="submit"
                  >
                    Create
                  </Button>
                </div>
              </form>
            ) : (
              <button
                className="menu-item w-full"
                onClick={() => setCreating(true)}
                type="button"
              >
                <Plus size={17} /> Create new playlist
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

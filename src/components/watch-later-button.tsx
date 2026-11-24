"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Check, Clock3 } from "lucide-react";
import { redirectToLogin } from "@/lib/login-redirect";
import { cn } from "@/lib/utils";

export const watchLaterQueryKey = ["watch-later-ids"];

/** All cards on a page share one request for the Watch later list. */
export function useWatchLaterIds() {
  const { status } = useSession();
  return useQuery({
    queryKey: watchLaterQueryKey,
    enabled: status === "authenticated",
    queryFn: async (): Promise<string[]> => {
      const response = await fetch("/api/watch-later");
      if (!response.ok) return [];
      return ((await response.json()) as { videoIds: string[] }).videoIds;
    },
  });
}

/** Clock button on a thumbnail: one click adds or removes from Watch later. */
export function WatchLaterButton({
  videoId,
  className,
}: {
  videoId: string;
  className?: string;
}) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const { data: savedIds = [] } = useWatchLaterIds();
  const saved = savedIds.includes(videoId);

  const toggle = useMutation({
    mutationFn: async (save: boolean) => {
      const response = save
        ? await fetch("/api/watch-later", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId }),
          })
        : await fetch(`/api/watch-later?videoId=${videoId}`, {
            method: "DELETE",
          });
      if (!response.ok) throw new Error("Could not update Watch later.");
    },
    onMutate: (save) => {
      queryClient.setQueryData<string[]>(watchLaterQueryKey, (current = []) =>
        save ? [...current, videoId] : current.filter((id) => id !== videoId),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: watchLaterQueryKey });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });

  return (
    <button
      aria-label={saved ? "Remove from Watch later" : "Save to Watch later"}
      aria-pressed={saved}
      className={cn(
        "grid size-8 place-items-center rounded-lg bg-black/75 text-white transition hover:bg-black/90",
        className,
      )}
      onClick={(event) => {
        event.preventDefault();
        if (status !== "authenticated") return redirectToLogin();
        toggle.mutate(!saved);
      }}
      title={saved ? "Added to Watch later" : "Watch later"}
      type="button"
    >
      {saved ? <Check size={16} /> : <Clock3 size={16} />}
    </button>
  );
}

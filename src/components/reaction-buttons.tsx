"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { redirectToLogin } from "@/lib/login-redirect";
import { cn } from "@/lib/utils";

export type Reaction = "like" | "dislike" | "none";

/** Like/dislike state for a video, updated optimistically. */
export function useVideoReaction({
  videoId,
  signedIn,
  initialReaction,
  initialLikeCount,
}: {
  videoId: string;
  signedIn: boolean;
  initialReaction: Reaction;
  initialLikeCount: number;
}) {
  const [reaction, setReaction] = useState<Reaction>(initialReaction);
  const [likeCount, setLikeCount] = useState(initialLikeCount);

  async function choose(target: "like" | "dislike") {
    if (!signedIn) return redirectToLogin();
    const previous = { reaction, likeCount };
    const next: Reaction = reaction === target ? "none" : target;

    // Update right away; roll back if the server says no.
    setReaction(next);
    setLikeCount(
      likeCount + (next === "like" ? 1 : 0) - (reaction === "like" ? 1 : 0),
    );
    try {
      const response = await fetch(`/api/videos/${videoId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction: next }),
      });
      if (response.status === 401) return redirectToLogin();
      if (!response.ok) throw new Error("Reaction failed.");
      const result = (await response.json()) as { likeCount: number };
      setLikeCount(result.likeCount);
    } catch {
      setReaction(previous.reaction);
      setLikeCount(previous.likeCount);
    }
  }

  return { reaction, likeCount, choose };
}

export function ReactionButtons(props: {
  videoId: string;
  signedIn: boolean;
  initialReaction: Reaction;
  initialLikeCount: number;
}) {
  const { reaction, likeCount, choose } = useVideoReaction(props);

  return (
    <div className="flex h-9 overflow-hidden rounded-full bg-surface-muted">
      <Button
        aria-label="Like video"
        aria-pressed={reaction === "like"}
        className="rounded-none border-r border-border px-3"
        onClick={() => choose("like")}
        size="sm"
        variant="ghost"
      >
        <ThumbsUp
          className={cn(reaction === "like" && "fill-current")}
          size={17}
        />
        {likeCount > 0 ? likeCount.toLocaleString() : "Like"}
      </Button>
      <Button
        aria-label="Dislike video"
        aria-pressed={reaction === "dislike"}
        className="rounded-none px-3"
        onClick={() => choose("dislike")}
        size="icon"
        variant="ghost"
      >
        <ThumbsDown
          className={cn(reaction === "dislike" && "fill-current")}
          size={17}
        />
      </Button>
    </div>
  );
}

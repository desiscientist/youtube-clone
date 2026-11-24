"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Flag,
  Heart,
  Pencil,
  Pin,
  PinOff,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { MoreMenu, ReportDialog } from "@/components/report-dialog";
import { RichText } from "@/components/rich-text";
import { ChannelAvatar } from "@/components/video-card";
import { Button } from "@/components/ui/button";
import { redirectToLogin } from "@/lib/login-redirect";
import { cn } from "@/lib/utils";
import type { CommentData } from "@/app/api/videos/[videoId]/comments/route";

type CommentsResponse = { total: number; comments: CommentData[] };

export function CommentsSection({ videoId }: { videoId: string }) {
  const [sort, setSort] = useState<"top" | "new">("top");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["comments", videoId, sort],
    queryFn: async (): Promise<CommentsResponse> => {
      const response = await fetch(
        `/api/videos/${videoId}/comments?sort=${sort}`,
      );
      if (!response.ok) throw new Error("Could not load comments.");
      return response.json();
    },
  });

  return (
    <section aria-labelledby="comments-heading" className="mt-6">
      <div className="flex items-center gap-6">
        <h2 className="text-lg font-bold" id="comments-heading">
          {data ? `${data.total.toLocaleString()} ` : ""}
          {data?.total === 1 ? "Comment" : "Comments"}
        </h2>
        <label className="text-sm text-muted">
          <span className="sr-only">Sort comments</span>
          <select
            className="cursor-pointer rounded-lg bg-transparent px-2 py-1 font-medium text-foreground outline-none hover:bg-surface-muted"
            onChange={(event) => setSort(event.target.value as "top" | "new")}
            value={sort}
          >
            <option className="bg-surface" value="top">
              Top comments
            </option>
            <option className="bg-surface" value="new">
              Newest first
            </option>
          </select>
        </label>
      </div>
      <div className="mt-4">
        <CommentForm videoId={videoId} />
      </div>
      {isLoading ? (
        <p className="mt-6 text-sm text-muted">Loading comments…</p>
      ) : isError ? (
        <p className="mt-6 text-sm text-muted">Comments couldn&apos;t load.</p>
      ) : data && data.comments.length > 0 ? (
        <ul className="mt-6 grid gap-6">
          {data.comments.map((comment) => (
            <CommentItem comment={comment} key={comment.id} videoId={videoId} />
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-muted">
          No comments yet. Start the conversation.
        </p>
      )}
    </section>
  );
}

function CommentForm({
  videoId,
  parentId,
  onDone,
  autoFocus = false,
  initialContent = "",
}: {
  videoId: string;
  parentId?: string;
  onDone?: () => void;
  autoFocus?: boolean;
  /** e.g. "@handle " when replying to a reply. */
  initialContent?: string;
}) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [content, setContent] = useState(initialContent);
  const [focused, setFocused] = useState(autoFocus);
  const [error, setError] = useState<string | null>(null);

  const post = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentId }),
      });
      if (response.status === 401) {
        redirectToLogin();
        throw new Error("Sign in to comment.");
      }
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not post.");
    },
    onSuccess: () => {
      setContent("");
      setFocused(false);
      onDone?.();
      queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (content.trim()) post.mutate();
  }

  if (!session) {
    return (
      <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted">
        <button
          className="font-semibold text-accent"
          onClick={redirectToLogin}
          type="button"
        >
          Sign in
        </button>{" "}
        to join the conversation.
      </p>
    );
  }

  const name = session.user.name || session.user.email || "You";
  return (
    <form className="flex gap-3" onSubmit={submit}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-700 text-sm font-semibold text-white">
        {name.slice(0, 1).toLocaleUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <textarea
          aria-label={parentId ? "Write a reply" : "Add a comment"}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          className="block min-h-9 w-full resize-y border-b border-border bg-transparent pb-1 text-sm outline-none focus:border-foreground"
          maxLength={2000}
          onChange={(event) => setContent(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={parentId ? "Add a reply…" : "Add a comment…"}
          rows={focused ? 2 : 1}
          value={content}
        />
        {error && <p className="mt-1 text-xs text-accent">{error}</p>}
        {focused && (
          <div className="mt-2 flex justify-end gap-2">
            <Button
              onClick={() => {
                setContent("");
                setFocused(false);
                setError(null);
                onDone?.();
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={!content.trim() || post.isPending}
              size="sm"
              type="submit"
            >
              {parentId ? "Reply" : "Comment"}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  videoId,
  isReply = false,
}: {
  comment: CommentData;
  videoId: string;
  isReply?: boolean;
}) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["comments", videoId] });

  const remove = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not delete the comment.");
    },
    onSuccess: refresh,
  });

  const pin = useMutation({
    mutationFn: async (pinned: boolean) => {
      const response = await fetch(`/api/comments/${comment.id}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      });
      if (!response.ok) throw new Error("Could not pin the comment.");
    },
    onSuccess: refresh,
  });

  const menuItems = [
    ...(comment.canPin
      ? [
          {
            label: comment.pinned ? "Unpin" : "Pin",
            icon: comment.pinned ? <PinOff size={16} /> : <Pin size={16} />,
            onSelect: () => pin.mutate(!comment.pinned),
          },
        ]
      : []),
    ...(comment.canEdit
      ? [
          {
            label: "Edit",
            icon: <Pencil size={16} />,
            onSelect: () => setEditing(true),
          },
        ]
      : []),
    ...(comment.canDelete
      ? [
          {
            label: "Delete",
            icon: <Trash2 size={16} />,
            onSelect: () => {
              if (window.confirm("Delete this comment?")) remove.mutate();
            },
          },
        ]
      : []),
    // Anyone but the author can report a comment.
    ...(!comment.canEdit
      ? [
          {
            label: "Report",
            icon: <Flag size={16} />,
            onSelect: () =>
              status === "authenticated"
                ? setReporting(true)
                : redirectToLogin(),
          },
        ]
      : []),
  ];

  const avatarSize = isReply ? 28 : 36;
  const nameClass = cn(
    "font-semibold",
    // The creator's name is shown in a highlighted pill, like on YouTube.
    comment.isCreator && "rounded-full bg-surface-muted px-2 py-0.5",
  );
  const authorName = comment.author.handle ? (
    <Link
      className={cn(nameClass, "hover:text-accent")}
      href={`/channel/${comment.author.handle}`}
    >
      {comment.author.name}
    </Link>
  ) : (
    <span className={nameClass}>{comment.author.name}</span>
  );
  const mention =
    isReply && comment.author.handle ? `@${comment.author.handle} ` : "";

  return (
    <li className="group flex gap-3">
      <span className="shrink-0">
        <ChannelAvatar
          avatar={comment.author.image}
          color={comment.author.color}
          initials={comment.author.initials}
          size={avatarSize}
        />
      </span>
      <div className="min-w-0 flex-1">
        {comment.pinned && (
          <p className="mb-1 inline-flex items-center gap-1 text-xs text-muted">
            <Pin size={12} /> Pinned by the creator
          </p>
        )}
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[13px]">
            {authorName}
            <span className="ml-2 text-muted">
              {comment.posted}
              {comment.edited && " (edited)"}
            </span>
          </p>
          <MoreMenu
            className="-mr-2 -mt-1 opacity-100 sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100"
            items={menuItems}
            label="Comment actions"
          />
        </div>

        {editing ? (
          <EditCommentForm
            comment={comment}
            onDone={() => {
              setEditing(false);
              void refresh();
            }}
          />
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5">
            <RichText text={comment.content} />
          </p>
        )}

        <div className="mt-1 flex items-center gap-1">
          <CommentLikeButton comment={comment} videoId={videoId} />
          {comment.likedByCreator && (
            <span
              className="mr-1 inline-flex items-center"
              title="Liked by the creator"
            >
              <Heart className="fill-accent text-accent" size={14} />
              <span className="sr-only">Liked by the creator</span>
            </span>
          )}
          <Button
            className="h-8 text-xs"
            onClick={() => setReplying(true)}
            size="sm"
            variant="ghost"
          >
            Reply
          </Button>
        </div>

        {replying && (
          <div className="mt-2">
            <CommentForm
              autoFocus
              // A reply to a reply joins the same thread, addressed by name.
              initialContent={mention}
              onDone={() => {
                setReplying(false);
                setShowReplies(true);
              }}
              parentId={comment.id}
              videoId={videoId}
            />
          </div>
        )}

        {comment.replies.length > 0 && (
          <>
            <button
              aria-expanded={showReplies}
              className="mt-1 rounded-full px-3 py-1.5 text-sm font-semibold text-sky-600 hover:bg-sky-500/10 dark:text-sky-400"
              onClick={() => setShowReplies((value) => !value)}
              type="button"
            >
              {showReplies ? "Hide" : "View"} {comment.replies.length}{" "}
              {comment.replies.length === 1 ? "reply" : "replies"}
            </button>
            {showReplies && (
              <ul className="mt-3 grid gap-4">
                {comment.replies.map((reply) => (
                  <CommentItem
                    comment={reply}
                    isReply
                    key={reply.id}
                    videoId={videoId}
                  />
                ))}
              </ul>
            )}
          </>
        )}

        {reporting && (
          <ReportDialog
            onClose={() => setReporting(false)}
            target={{ commentId: comment.id }}
          />
        )}
      </div>
    </li>
  );
}

function EditCommentForm({
  comment,
  onDone,
}: {
  comment: CommentData;
  onDone: () => void;
}) {
  const [content, setContent] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(result.error || "Your edit couldn't be saved.");
      return;
    }
    onDone();
  }

  return (
    <form className="mt-1" onSubmit={save}>
      <textarea
        aria-label="Edit comment"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        className="block min-h-16 w-full resize-y border-b border-border bg-transparent pb-1 text-sm outline-none focus:border-foreground"
        maxLength={2000}
        onChange={(event) => setContent(event.target.value)}
        value={content}
      />
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onDone} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={saving || !content.trim()} size="sm" type="submit">
          Save
        </Button>
      </div>
    </form>
  );
}

function CommentLikeButton({
  comment,
  videoId,
}: {
  comment: CommentData;
  videoId: string;
}) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(comment.likedByViewer);
  const [count, setCount] = useState(comment.likeCount);

  async function toggle() {
    if (status !== "authenticated") return redirectToLogin();
    const next = !liked;
    setLiked(next);
    setCount((value) => value + (next ? 1 : -1));
    try {
      const response = await fetch(`/api/comments/${comment.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked: next }),
      });
      if (!response.ok) throw new Error("Could not like the comment.");
      const result = (await response.json()) as { likeCount: number };
      setCount(result.likeCount);
      // Refresh in the background so "Top comments" order and hearts update.
      void queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
    } catch {
      setLiked(!next);
      setCount((value) => value + (next ? -1 : 1));
    }
  }

  return (
    <Button
      aria-label={liked ? "Unlike comment" : "Like comment"}
      aria-pressed={liked}
      className="-ml-2 h-8 gap-1.5 px-2 text-xs"
      onClick={toggle}
      size="sm"
      variant="ghost"
    >
      <ThumbsUp className={cn(liked && "fill-current")} size={15} />
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </Button>
  );
}

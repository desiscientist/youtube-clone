"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  LoaderCircle,
  MessageSquare,
  Pencil,
  RotateCcw,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VIDEO_CATEGORIES, formatCount } from "@/lib/videos";

export type StudioVideo = {
  id: string;
  title: string;
  description: string;
  category: string;
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  status: "PROCESSING" | "READY" | "FAILED";
  processingError: string | null;
  thumbnail: string;
  duration: string;
  posted: string;
  views: number;
  likes: number;
  comments: number;
};

const visibilityLabels = {
  PUBLIC: "Public",
  UNLISTED: "Unlisted",
  PRIVATE: "Private",
} as const;

const statusStyles = {
  READY: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  PROCESSING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  FAILED: "bg-accent/15 text-accent",
} as const;

export function StudioVideoTable({ videos }: { videos: StudioVideo[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border">
      {videos.map((video) => (
        <li className="p-4" key={video.id}>
          <StudioRow
            editing={editingId === video.id}
            onEdit={(editing) => setEditingId(editing ? video.id : null)}
            video={video}
          />
        </li>
      ))}
    </ul>
  );
}

function StudioRow({
  video,
  editing,
  onEdit,
}: {
  video: StudioVideo;
  editing: boolean;
  onEdit: (editing: boolean) => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  /** Runs processing again on the saved original, e.g. after a failure. */
  async function retry() {
    setRetrying(true);
    setRetryError("");
    const response = await fetch(`/api/videos/${video.id}/process`, {
      method: "POST",
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setRetrying(false);
    if (!response.ok) {
      setRetryError(result.error || "Processing failed again.");
    }
    router.refresh();
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete "${video.title}"? Its comments, likes, and files will be removed. This can't be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    const response = await fetch(`/api/videos/${video.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!response.ok) {
      window.alert("The video couldn't be deleted. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-surface-muted sm:w-44"
          href={`/watch?v=${video.id}`}
        >
          <div
            className="size-full bg-cover bg-center"
            style={{ backgroundImage: `url("${video.thumbnail}")` }}
          />
          {video.duration && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1 text-[11px] font-medium text-white">
              {video.duration}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                className="line-clamp-2 font-semibold hover:text-accent"
                href={`/watch?v=${video.id}`}
              >
                {video.title}
              </Link>
              <p className="mt-1 line-clamp-1 text-sm text-muted">
                {video.description || "No description"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                aria-label={`Edit ${video.title}`}
                aria-pressed={editing}
                onClick={() => onEdit(!editing)}
                size="icon-sm"
                title="Edit details"
                variant="ghost"
              >
                <Pencil size={16} />
              </Button>
              <Button
                aria-label={`Delete ${video.title}`}
                disabled={deleting}
                onClick={remove}
                size="icon-sm"
                title="Delete video"
                variant="ghost"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium",
                statusStyles[video.status],
              )}
            >
              {video.status === "READY"
                ? "Ready"
                : video.status === "PROCESSING"
                  ? "Processing"
                  : "Failed"}
            </span>
            <span>{visibilityLabels[video.visibility]}</span>
            <span>{video.category}</span>
            <span>{video.posted}</span>
            <span className="inline-flex items-center gap-1">
              <Eye size={14} /> {formatCount(video.views)}
            </span>
            <span className="inline-flex items-center gap-1">
              <ThumbsUp size={14} /> {formatCount(video.likes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={14} /> {formatCount(video.comments)}
            </span>
          </div>
        </div>
      </div>
      {video.status === "FAILED" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-accent/10 p-3 text-sm">
          <p className="min-w-0 flex-1">
            Processing failed
            {video.processingError && (
              <span
                className="mt-0.5 block truncate text-xs text-muted"
                title={video.processingError}
              >
                {video.processingError}
              </span>
            )}
            {retryError && (
              <span className="mt-0.5 block text-xs">{retryError}</span>
            )}
          </p>
          <Button
            disabled={retrying}
            onClick={retry}
            size="sm"
            variant="secondary"
          >
            {retrying ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <RotateCcw size={16} />
            )}
            {retrying ? "Processing…" : "Retry processing"}
          </Button>
        </div>
      )}
      {editing && <EditForm onDone={() => onEdit(false)} video={video} />}
    </div>
  );
}

function EditForm({
  video,
  onDone,
}: {
  video: StudioVideo;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [category, setCategory] = useState(video.category);
  const [visibility, setVisibility] = useState(video.visibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, category, visibility }),
    });
    setSaving(false);
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(result.error || "Your changes couldn't be saved.");
      return;
    }
    onDone();
    router.refresh();
  }

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500";

  return (
    <form
      className="mt-4 grid gap-3 rounded-2xl bg-surface-muted p-4"
      onSubmit={save}
    >
      <label className="grid gap-1 text-xs font-medium text-muted">
        Title
        <input
          className={field}
          maxLength={100}
          onChange={(event) => setTitle(event.target.value)}
          required
          value={title}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted">
        Description
        <textarea
          className={cn(field, "min-h-24 resize-y")}
          maxLength={5000}
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-muted">
          Category
          <select
            className={field}
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            {VIDEO_CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          Visibility
          <select
            className={field}
            onChange={(event) =>
              setVisibility(event.target.value as StudioVideo["visibility"])
            }
            value={visibility}
          >
            <option value="PUBLIC">Public — anyone can find it</option>
            <option value="UNLISTED">
              Unlisted — only people with the link
            </option>
            <option value="PRIVATE">Private — only you</option>
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-accent">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button onClick={onDone} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={saving || !title.trim()} size="sm" type="submit">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

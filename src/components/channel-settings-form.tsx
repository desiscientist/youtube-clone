"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { ChannelAvatar } from "@/components/video-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChannelSettings = {
  name: string;
  handle: string;
  description: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  color: string;
  initials: string;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function ChannelSettingsForm({ channel }: { channel: ChannelSettings }) {
  const router = useRouter();
  const [name, setName] = useState(channel.name);
  const [handle, setHandle] = useState(channel.handle);
  const [savedHandle, setSavedHandle] = useState(channel.handle);
  const [description, setDescription] = useState(channel.description);
  const [avatarUrl, setAvatarUrl] = useState(channel.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState(channel.bannerUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  async function uploadImage(
    kind: "avatar" | "banner",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage({ ok: false, text: "Images must be 5 MB or smaller." });
      return;
    }
    setUploading(kind);
    setMessage(null);
    try {
      const response = await fetch(`/api/channels/me/${kind}`, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url) {
        throw new Error(result.error || "The image couldn't be uploaded.");
      }
      if (kind === "avatar") setAvatarUrl(result.url);
      else setBannerUrl(result.url);
      setMessage({ ok: true, text: `New ${kind} saved.` });
      router.refresh();
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Upload failed.",
      });
    } finally {
      setUploading(null);
    }
  }

  async function removeImage(kind: "avatar" | "banner") {
    setUploading(kind);
    const response = await fetch(`/api/channels/me/${kind}`, {
      method: "DELETE",
    });
    setUploading(null);
    if (!response.ok) {
      setMessage({ ok: false, text: `The ${kind} couldn't be removed.` });
      return;
    }
    if (kind === "avatar") setAvatarUrl(null);
    else setBannerUrl(null);
    router.refresh();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/channels/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, handle, description }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      channel?: { handle: string };
      error?: string;
    };
    setSaving(false);
    if (!response.ok || !result.channel) {
      setMessage({ ok: false, text: result.error || "Changes weren't saved." });
      return;
    }
    setHandle(result.channel.handle);
    setSavedHandle(result.channel.handle);
    setMessage({ ok: true, text: "Channel details saved." });
    router.refresh();
  }

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500";

  return (
    <div className="max-w-3xl">
      {/* Banner + avatar preview, laid out like the channel page. */}
      <section
        aria-label="Channel images"
        className="overflow-hidden rounded-2xl border border-border"
      >
        <div
          className="relative h-32 bg-cover bg-center sm:h-40"
          style={
            bannerUrl
              ? { backgroundImage: `url("${bannerUrl}")` }
              : {
                  backgroundImage: `linear-gradient(120deg, ${channel.color}, ${channel.color}55)`,
                }
          }
        >
          <div className="absolute bottom-3 right-3 flex gap-2">
            <Button
              className="bg-black/70 text-white hover:bg-black/85"
              disabled={uploading !== null}
              onClick={() => bannerInput.current?.click()}
              size="sm"
              variant="ghost"
            >
              <ImagePlus size={16} />
              {uploading === "banner"
                ? "Uploading…"
                : bannerUrl
                  ? "Change banner"
                  : "Add banner"}
            </Button>
            {bannerUrl && (
              <Button
                aria-label="Remove banner"
                className="bg-black/70 text-white hover:bg-black/85"
                disabled={uploading !== null}
                onClick={() => removeImage("banner")}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 p-4">
          <button
            aria-label={avatarUrl ? "Change avatar" : "Add avatar"}
            className="group relative shrink-0 rounded-full"
            disabled={uploading !== null}
            onClick={() => avatarInput.current?.click()}
            type="button"
          >
            <ChannelAvatar
              avatar={avatarUrl}
              color={channel.color}
              initials={channel.initials}
              size={80}
            />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera size={20} />
            </span>
          </button>
          <div className="text-sm">
            <p className="font-medium">
              {uploading === "avatar" ? "Uploading avatar…" : "Avatar"}
            </p>
            <p className="text-muted">
              Square images look best. JPEG, PNG, or WebP up to 5 MB. Banners
              look best at 2048 × 512.
            </p>
            {avatarUrl && (
              <button
                className="mt-1 text-xs font-medium text-accent"
                disabled={uploading !== null}
                onClick={() => removeImage("avatar")}
                type="button"
              >
                Remove avatar
              </button>
            )}
          </div>
        </div>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => uploadImage("avatar", event)}
          ref={avatarInput}
          type="file"
        />
        <input
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => uploadImage("banner", event)}
          ref={bannerInput}
          type="file"
        />
      </section>

      <form className="mt-6 grid gap-4" onSubmit={save}>
        <label className="grid gap-1 text-sm font-medium">
          Name
          <input
            className={field}
            maxLength={50}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Handle
          <span className="flex items-center rounded-xl border border-border bg-background focus-within:border-sky-500">
            <span className="pl-3 text-sm text-muted">@</span>
            <input
              className="w-full bg-transparent px-1 py-2 text-sm outline-none"
              maxLength={30}
              onChange={(event) =>
                setHandle(event.target.value.toLocaleLowerCase())
              }
              pattern="[a-z0-9][a-z0-9_\-]{2,29}"
              required
              title="3–30 characters: lowercase letters, numbers, - and _"
              value={handle}
            />
          </span>
          <span className="text-xs font-normal text-muted">
            Your channel lives at /channel/{handle || "…"}. Changing it breaks
            old links.
          </span>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Description
          <textarea
            className={cn(field, "min-h-28 resize-y")}
            maxLength={1000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Tell viewers what your channel is about"
            value={description}
          />
        </label>

        {message && (
          <p
            className={cn(
              "text-sm",
              message.ok
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-accent",
            )}
            role="status"
          >
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Link
            className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium hover:bg-surface-muted"
            href={`/channel/${savedHandle}`}
          >
            View channel
          </Link>
          <Button disabled={saving || !name.trim()} type="submit">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

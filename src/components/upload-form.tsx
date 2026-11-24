"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  FileVideo2,
  ImagePlus,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const categories = [
  "Music",
  "Gaming",
  "News",
  "Technology",
  "Travel",
  "Food",
  "Education",
  "Sports",
  "Lifestyle",
  "Other",
];
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
/** Video formats by file extension, for when the browser reports no type. */
const videoTypesByExtension: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  wmv: "video/x-ms-wmv",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  ogv: "video/ogg",
  mts: "video/mp2t",
  m2ts: "video/mp2t",
};
const supportedVideoTypes = new Set([
  ...Object.values(videoTypesByExtension),
  "video/avi",
]);
const VIDEO_FORMATS_LABEL =
  "MP4, MOV, WebM, MKV, AVI, M4V, 3GP, WMV, MPEG, or OGV";

/**
 * The file's video type. Windows often reports none for MKV and other
 * formats, so fall back to the extension.
 */
function videoTypeOf(file: File) {
  if (supportedVideoTypes.has(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLocaleLowerCase() ?? "";
  return videoTypesByExtension[extension] ?? null;
}
const supportedThumbnailTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type UploadStage =
  "idle" | "saving" | "uploading" | "processing" | "ready" | "failed";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function requestFileUpload(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader(
      "Content-Type",
      videoTypeOf(file) ?? "application/octet-stream",
    );
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onerror = () =>
      reject(new Error("Upload connection was interrupted."));
    request.onabort = () => reject(new Error("Upload was canceled."));
    request.onload = () => {
      const result = (() => {
        try {
          return JSON.parse(request.responseText) as { error?: string };
        } catch {
          return null;
        }
      })();
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            result?.error || `Upload failed with HTTP ${request.status}.`,
          ),
        );
      }
    };
    request.send(file);
  });
}

export function UploadForm() {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const captionsInputRef = useRef<HTMLInputElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [captionsFile, setCaptionsFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [category, setCategory] = useState("Other");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [stage, setStage] = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [uploadedVideoId, setUploadedVideoId] = useState("");
  const [dragging, setDragging] = useState(false);

  function chooseVideo(file: File | undefined) {
    if (!file) return;
    if (!videoTypeOf(file)) {
      setError(`Choose a video file: ${VIDEO_FORMATS_LABEL}.`);
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError("Video files must be 500 MB or smaller.");
      return;
    }
    setVideoFile(file);
    setError("");
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^.]+$/, "").slice(0, 100));
    }
  }

  function chooseThumbnail(file: File | undefined) {
    if (!file) return;
    if (!supportedThumbnailTypes.has(file.type)) {
      setError("Choose a JPEG, PNG, or WebP thumbnail image.");
      return;
    }
    if (file.size > MAX_THUMBNAIL_BYTES) {
      setError("Thumbnail images must be 5 MB or smaller.");
      return;
    }
    setThumbnailFile(file);
    setError("");
  }

  function onVideoInput(event: ChangeEvent<HTMLInputElement>) {
    chooseVideo(event.target.files?.[0]);
  }

  function onThumbnailInput(event: ChangeEvent<HTMLInputElement>) {
    chooseThumbnail(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    chooseVideo(event.dataTransfer.files[0]);
  }

  function resetForm() {
    setStage("idle");
    setUploadedVideoId("");
    setVideoFile(null);
    setThumbnailFile(null);
    setCaptionsFile(null);
    setProgress(0);
    setTitle("");
    setDescription("");
    setTagsInput("");
    setError("");
  }

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!videoFile) {
      setError("Choose a video file before uploading.");
      return;
    }
    setError("");
    setProgress(0);
    setStage("saving");

    try {
      const metadataResponse = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          tags: tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          visibility,
        }),
      });
      const metadata = (await metadataResponse.json()) as {
        videoId?: string;
        error?: string;
      };
      if (!metadataResponse.ok || !metadata.videoId) {
        throw new Error(metadata.error || "Could not create the video record.");
      }
      setUploadedVideoId(metadata.videoId);

      if (thumbnailFile) {
        const thumbnailResponse = await fetch(
          `/api/videos/${metadata.videoId}/thumbnail`,
          {
            method: "PUT",
            headers: { "Content-Type": thumbnailFile.type },
            body: thumbnailFile,
          },
        );
        const result = (await thumbnailResponse.json()) as { error?: string };
        if (!thumbnailResponse.ok) {
          throw new Error(
            result.error || "The thumbnail could not be uploaded.",
          );
        }
      }

      if (captionsFile) {
        const captionsResponse = await fetch(
          `/api/videos/${metadata.videoId}/captions`,
          {
            method: "PUT",
            headers: { "Content-Type": "text/vtt" },
            body: captionsFile,
          },
        );
        const result = (await captionsResponse.json()) as { error?: string };
        if (!captionsResponse.ok) {
          throw new Error(
            result.error || "The captions could not be uploaded.",
          );
        }
      }

      setStage("uploading");
      await requestFileUpload(
        `/api/videos/${metadata.videoId}/file`,
        videoFile,
        (value) => {
          setProgress(value);
          if (value >= 100) setStage("processing");
        },
      );
      setStage("ready");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload failed. Please try again.",
      );
      setStage("failed");
    }
  }

  async function retryProcessing() {
    if (!uploadedVideoId) return;
    setError("");
    setStage("processing");
    try {
      const response = await fetch(`/api/videos/${uploadedVideoId}/process`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Video processing failed.");
      }
      setStage("ready");
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Video processing could not be restarted.",
      );
      setStage("failed");
    }
  }

  const isBusy =
    stage === "saving" || stage === "uploading" || stage === "processing";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 pb-24 sm:px-8">
      <div className="mb-8">
        <p className="text-sm font-medium text-accent">Creator tools</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Upload a video
        </h1>
        <p className="mt-2 text-sm text-muted">
          Share something worth watching with the StreamBox community.
        </p>
      </div>

      {stage === "ready" ? (
        <section className="rounded-3xl border border-border bg-surface p-6 text-center sm:p-10">
          <CheckCircle2 className="mx-auto text-emerald-500" size={48} />
          <h2 className="mt-4 text-xl font-bold">Your video is ready</h2>
          <p className="mt-2 text-sm text-muted">
            Processing finished. You can watch the uploaded video now.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90"
              href={`/watch?v=${uploadedVideoId}`}
            >
              Watch video
            </Link>
            <Button onClick={resetForm} variant="secondary">
              Upload another
            </Button>
          </div>
        </section>
      ) : (
        <form
          className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]"
          onSubmit={submitUpload}
        >
          <section className="space-y-5 rounded-3xl border border-border bg-surface p-5 sm:p-7">
            <button
              className={cn(
                "flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors",
                dragging
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-muted",
              )}
              disabled={isBusy}
              onClick={() => videoInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              type="button"
            >
              <input
                accept={`video/*,${Object.keys(videoTypesByExtension)
                  .map((extension) => `.${extension}`)
                  .join(",")}`}
                className="hidden"
                onChange={onVideoInput}
                ref={videoInputRef}
                type="file"
              />
              {videoFile ? (
                <>
                  <FileVideo2 className="text-accent" size={40} />
                  <p className="mt-3 max-w-full truncate text-sm font-semibold">
                    {videoFile.name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatBytes(videoFile.size)} · Click to choose another file
                  </p>
                </>
              ) : (
                <>
                  <span className="grid size-14 place-items-center rounded-full bg-surface-muted">
                    <UploadCloud className="text-muted" size={27} />
                  </span>
                  <p className="mt-4 font-semibold">
                    Drag and drop a video file to upload
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    MP4, MOV, WebM, MKV, AVI and more · up to 500 MB
                  </p>
                  <span className="mt-4 inline-flex h-9 items-center rounded-full bg-surface-muted px-4 text-sm font-medium">
                    Choose file
                  </span>
                </>
              )}
            </button>

            <label className="block space-y-1.5 text-sm font-medium">
              Title <span className="text-muted">({title.length}/100)</span>
              <input
                className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                maxLength={100}
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </label>

            <label className="block space-y-1.5 text-sm font-medium">
              Description{" "}
              <span className="text-muted">({description.length}/5000)</span>
              <textarea
                className="min-h-32 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                maxLength={5000}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Tell viewers what your video is about"
                value={description}
              />
            </label>

            <label className="block space-y-1.5 text-sm font-medium">
              Tags{" "}
              <span className="text-muted">(comma separated, up to 10)</span>
              <input
                className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="travel, filmmaking, weekend"
                value={tagsInput}
              />
            </label>
          </section>

          <section className="h-fit space-y-5 rounded-3xl border border-border bg-surface p-5 sm:p-7">
            <div>
              <h2 className="font-semibold">Video settings</h2>
              <p className="mt-1 text-sm text-muted">
                Choose how your video appears on StreamBox.
              </p>
            </div>

            <label className="block space-y-1.5 text-sm font-medium">
              Category
              <select
                className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5 text-sm font-medium">
              Visibility
              <select
                className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                onChange={(event) => setVisibility(event.target.value)}
                value={visibility}
              >
                <option value="PUBLIC">Public — anyone can watch</option>
                <option value="UNLISTED">Unlisted — share with a link</option>
                <option value="PRIVATE">Private — only you can watch</option>
              </select>
            </label>

            <div>
              <p className="mb-2 text-sm font-medium">Thumbnail (optional)</p>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onThumbnailInput}
                ref={thumbnailInputRef}
                type="file"
              />
              {thumbnailFile ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-muted p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <ImagePlus className="shrink-0 text-muted" size={18} />
                    <span className="truncate text-sm">
                      {thumbnailFile.name}
                    </span>
                  </div>
                  <button
                    aria-label="Remove thumbnail"
                    className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-background"
                    onClick={() => setThumbnailFile(null)}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => thumbnailInputRef.current?.click()}
                  type="button"
                  variant="outline"
                >
                  <ImagePlus size={17} />
                  Choose thumbnail
                </Button>
              )}
              <p className="mt-2 text-xs text-muted">
                JPEG, PNG, or WebP · up to 5 MB. Otherwise a frame is generated
                automatically.
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Captions (optional)</p>
              <input
                accept=".vtt,text/vtt"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && file.size > 2 * 1024 * 1024) {
                    setError("Caption files must be 2 MB or smaller.");
                    return;
                  }
                  setCaptionsFile(file || null);
                  setError("");
                }}
                ref={captionsInputRef}
                type="file"
              />
              {captionsFile ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-muted p-3">
                  <span className="truncate text-sm">{captionsFile.name}</span>
                  <button
                    aria-label="Remove captions"
                    className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-background"
                    onClick={() => setCaptionsFile(null)}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => captionsInputRef.current?.click()}
                  type="button"
                  variant="outline"
                >
                  Add WebVTT captions
                </Button>
              )}
              <p className="mt-2 text-xs text-muted">
                WebVTT (.vtt) · up to 2 MB.
              </p>
            </div>

            {isBusy && (
              <div
                aria-live="polite"
                className="rounded-2xl bg-surface-muted p-4"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <LoaderCircle
                    className="animate-spin text-accent"
                    size={18}
                  />
                  {stage === "saving"
                    ? "Saving video details…"
                    : stage === "uploading"
                      ? `Uploading video… ${progress}%`
                      : "Generating thumbnails and video formats…"}
                </div>
                <div
                  aria-label="Upload progress"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={
                    stage === "uploading"
                      ? progress
                      : stage === "processing"
                        ? 100
                        : 0
                  }
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"
                  role="progressbar"
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width]"
                    style={{
                      width:
                        stage === "processing"
                          ? "100%"
                          : stage === "uploading"
                            ? `${progress}%`
                            : "4%",
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  Keep this page open while the upload is being processed.
                </p>
              </div>
            )}

            {error && (
              <div
                className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300"
                role="alert"
              >
                <AlertCircle className="mt-0.5 shrink-0" size={17} />
                <span>{error}</span>
              </div>
            )}

            {stage === "failed" && uploadedVideoId && (
              <Button
                className="w-full"
                onClick={retryProcessing}
                type="button"
                variant="secondary"
              >
                Retry video processing
              </Button>
            )}

            {stage === "failed" && (
              <Button
                className="w-full"
                onClick={resetForm}
                type="button"
                variant="outline"
              >
                Start a new upload
              </Button>
            )}

            <Button
              className="w-full"
              disabled={isBusy || !videoFile || stage === "failed"}
              type="submit"
            >
              <UploadCloud size={17} />
              Upload video
            </Button>
          </section>
        </form>
      )}
    </main>
  );
}

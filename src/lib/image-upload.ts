import { readFile, rename, rm, unlink } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { MAX_THUMBNAIL_BYTES, saveRequestBody } from "@/lib/storage/storage";

export const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type ImageUploadResult =
  | { ok: true; extension: string }
  | { ok: false; status: number; error: string };

/** True when the file's first bytes really are a JPEG, PNG, or WebP image. */
function hasImageSignature(header: Buffer) {
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng =
    header.length >= 8 &&
    header
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp =
    header.length >= 12 &&
    header.toString("ascii", 0, 4) === "RIFF" &&
    header.toString("ascii", 8, 12) === "WEBP";
  return isJpeg || isPng || isWebp;
}

/**
 * Streams an uploaded image (raw request body) to `pathFor(extension)`,
 * checking its type, size, and contents. Other extensions of the same image
 * are removed so only the newest file remains.
 */
export async function saveImageUpload(
  request: NextRequest,
  pathFor: (extension: string) => string,
): Promise<ImageUploadResult> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  const extension = contentType ? IMAGE_TYPES.get(contentType) : undefined;
  if (!extension) {
    return {
      ok: false,
      status: 415,
      error: "Images must be JPEG, PNG, or WebP.",
    };
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (!Number.isFinite(contentLength) || contentLength < 1) {
    return { ok: false, status: 411, error: "The upload is missing its size." };
  }
  if (contentLength > MAX_THUMBNAIL_BYTES) {
    return { ok: false, status: 413, error: "Images must be 5 MB or smaller." };
  }
  if (!request.body) {
    return { ok: false, status: 400, error: "The image is empty." };
  }

  // Write to a temporary name first so a bad upload never replaces a good image.
  const finalPath = pathFor(extension);
  const tempPath = `${finalPath}.upload`;
  await rm(tempPath, { force: true });
  try {
    const written = await saveRequestBody(
      request.body,
      tempPath,
      MAX_THUMBNAIL_BYTES,
    );
    const header = (await readFile(tempPath)).subarray(0, 12);
    if (written !== contentLength || !hasImageSignature(header)) {
      await unlink(tempPath);
      return {
        ok: false,
        status: 415,
        error: "That file isn't a valid JPEG, PNG, or WebP image.",
      };
    }
  } catch (error) {
    await rm(tempPath, { force: true });
    if (error instanceof Error && error.message === "UPLOAD_LIMIT_EXCEEDED") {
      return {
        ok: false,
        status: 413,
        error: "Images must be 5 MB or smaller.",
      };
    }
    throw error;
  }

  for (const other of IMAGE_TYPES.values()) {
    if (other !== extension) await rm(pathFor(other), { force: true });
  }
  await rm(finalPath, { force: true });
  await rename(tempPath, finalPath);
  return { ok: true, extension };
}

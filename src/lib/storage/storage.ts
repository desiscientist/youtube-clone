import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform, type TransformCallback } from "node:stream";

export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

const storageRoot = path.resolve(
  process.cwd(),
  process.env.LOCAL_STORAGE_DIR || "./storage",
);

export interface StorageAdapter {
  getVideoDirectory(videoId: string): string;
  getFilePath(videoId: string, ...segments: string[]): string;
  saveRequestBody(
    body: ReadableStream<Uint8Array>,
    destination: string,
    maxBytes: number,
  ): Promise<number>;
}

const localStorageAdapter: StorageAdapter = {
  getVideoDirectory(videoId) {
    if (!/^[a-zA-Z0-9_-]+$/.test(videoId)) {
      throw new Error("Invalid video identifier.");
    }
    return path.join(storageRoot, videoId);
  },

  getFilePath(videoId, ...segments) {
    const root = this.getVideoDirectory(videoId);
    const result = path.resolve(root, ...segments);
    if (!result.startsWith(`${root}${path.sep}`)) {
      throw new Error("Invalid storage path.");
    }
    return result;
  },

  async saveRequestBody(body, destination, maxBytes) {
    await mkdir(path.dirname(destination), { recursive: true });
    let bytesWritten = 0;
    const byteLimit = new Transform({
      transform(
        chunk: Buffer,
        _encoding: BufferEncoding,
        callback: TransformCallback,
      ) {
        bytesWritten += chunk.length;
        if (bytesWritten > maxBytes) {
          callback(new Error("UPLOAD_LIMIT_EXCEEDED"));
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(
        Readable.fromWeb(body as import("node:stream/web").ReadableStream),
        byteLimit,
        createWriteStream(destination, { flags: "wx" }),
      );
      if (bytesWritten === 0) throw new Error("EMPTY_UPLOAD");
      return bytesWritten;
    } catch (error) {
      const file = await stat(destination).catch(
        (statError: NodeJS.ErrnoException) => {
          if (statError.code !== "ENOENT") throw statError;
          return null;
        },
      );
      if (file) {
        const { unlink } = await import("node:fs/promises");
        await unlink(destination);
      }
      throw error;
    }
  },
};

export function getStorageAdapter() {
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver !== "local") {
    throw new Error(
      `The "${driver}" storage driver is configured but no adapter is installed.`,
    );
  }

  return localStorageAdapter;
}

export function getVideoDirectory(videoId: string) {
  return getStorageAdapter().getVideoDirectory(videoId);
}

export function getStoredFilePath(videoId: string, ...segments: string[]) {
  return getStorageAdapter().getFilePath(videoId, ...segments);
}

export function saveRequestBody(
  body: ReadableStream<Uint8Array>,
  destination: string,
  maxBytes: number,
) {
  return getStorageAdapter().saveRequestBody(body, destination, maxBytes);
}

import { spawn } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { notifySubscribersOfUpload } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getStoredFilePath } from "@/lib/storage/storage";

const RESOLUTIONS = [360, 720, 1080] as const;
/** Vertical or square videos up to 3 minutes become Shorts, as on YouTube. */
const MAX_SHORT_SECONDS = 180;

/** Reads the source video's displayed width and height from FFmpeg's log. */
function parseDimensions(ffmpegOutput: string) {
  // The first "Video:" stream line belongs to the input file.
  const match = ffmpegOutput.match(
    /Stream #0:\d+[^\n]*Video:[^\n]*?(\d{2,5})x(\d{2,5})/,
  );
  if (!match) return null;
  let width = Number(match[1]);
  let height = Number(match[2]);
  // Phones often store portrait video as landscape plus a rotation flag.
  const rotation = ffmpegOutput.match(/rotation of (-?\d+(?:\.\d+)?) degrees/);
  if (rotation && Math.abs(Math.round(Number(rotation[1]))) % 180 === 90) {
    [width, height] = [height, width];
  }
  return { width, height };
}

const MAX_PROCESSING_TIME_MS = 30 * 60 * 1000;

function runFfmpeg(args: string[]) {
  const binaryPath = ffmpegPath;
  if (!binaryPath) {
    throw new Error("FFmpeg is unavailable for this platform.");
  }

  return new Promise<string>((resolve, reject) => {
    const process = spawn(binaryPath, ["-hide_banner", "-y", ...args], {
      windowsHide: true,
    });
    let stderr = "";
    const timeout = setTimeout(() => {
      process.kill("SIGKILL");
    }, MAX_PROCESSING_TIME_MS);

    process.stderr.setEncoding("utf8");
    process.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-8000);
    });
    process.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    process.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(stderr);
      } else {
        reject(
          new Error(
            `FFmpeg exited with code ${code ?? "unknown"}: ${stderr.trim().slice(-1200)}`,
          ),
        );
      }
    });
  });
}

async function findThumbnail(videoId: string) {
  const directory = path.dirname(getStoredFilePath(videoId, "source"));
  const files = await readdir(directory);
  return files.find((file) => /^thumbnail\.(jpe?g|png|webp)$/.test(file));
}

async function transcodeResolution(
  source: string,
  output: string,
  height: number,
) {
  return runFfmpeg([
    "-i",
    source,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-vf",
    `scale=-2:min(${height}\\,ih)`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-max_muxing_queue_size",
    "1024",
    output,
  ]);
}

export async function processUploadedVideo(videoId: string) {
  const source = getStoredFilePath(videoId, "source");
  const outputDirectory = getStoredFilePath(videoId, "processed");
  await mkdir(outputDirectory, { recursive: true });

  try {
    const sourceInfo = await stat(source);
    if (sourceInfo.size === 0) throw new Error("The uploaded video is empty.");

    let duration: number | null = null;
    let dimensions: { width: number; height: number } | null = null;
    for (const height of RESOLUTIONS) {
      const output = await transcodeResolution(
        source,
        path.join(outputDirectory, `${height}p.mp4`),
        height,
      );
      if (dimensions === null) dimensions = parseDimensions(output);
      if (duration === null) {
        const durationMatch = output.match(
          /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/,
        );
        duration = durationMatch
          ? Math.round(
              Number(durationMatch[1]) * 3600 +
                Number(durationMatch[2]) * 60 +
                Number(durationMatch[3]),
            )
          : null;
      }
    }

    const thumbnail = await findThumbnail(videoId);
    if (!thumbnail) {
      await runFfmpeg([
        "-ss",
        "1",
        "-i",
        source,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        getStoredFilePath(videoId, "thumbnail.jpg"),
      ]);
    }

    await runFfmpeg([
      "-i",
      path.join(outputDirectory, "720p.mp4"),
      "-c",
      "copy",
      "-hls_time",
      "6",
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      path.join(outputDirectory, "segment%04d.ts"),
      path.join(outputDirectory, "master.m3u8"),
    ]);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        videoUrl: `/api/media/${videoId}/processed/1080p.mp4`,
        hlsUrl: `/api/media/${videoId}/processed/master.m3u8`,
        thumbnailUrl: thumbnail
          ? `/api/media/${videoId}/${thumbnail}`
          : `/api/media/${videoId}/thumbnail.jpg`,
        duration,
        isShort: Boolean(
          duration !== null &&
          duration <= MAX_SHORT_SECONDS &&
          dimensions &&
          dimensions.height >= dimensions.width,
        ),
        status: "READY",
        processingError: null,
      },
    });
    await notifySubscribersOfUpload(videoId).catch((error: unknown) => {
      console.error("Could not notify subscribers of the new video.", error);
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown video processing error.";
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        processingError: message.slice(0, 1000),
      },
    });
    throw error;
  }
}

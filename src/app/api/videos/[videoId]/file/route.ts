import { mkdir, open, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getStoredFilePath,
  MAX_VIDEO_BYTES,
  saveRequestBody,
} from "@/lib/storage/storage";
import { processUploadedVideo } from "@/lib/video-processing";

export const runtime = "nodejs";
export const maxDuration = 1800;

// Anything FFmpeg can read works; these are the common camera/phone formats.
const supportedVideoTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-m4v",
  "video/x-msvideo",
  "video/avi",
  "video/3gpp",
  "video/3gpp2",
  "video/x-ms-wmv",
  "video/mpeg",
  "video/ogg",
  "video/mp2t",
]);

export async function PUT(
  request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to upload a video." },
      { status: 401 },
    );
  }

  const video = await prisma.video.findFirst({
    where: { id: params.videoId, userId: session.user.id },
    select: { id: true, status: true },
  });
  if (!video) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }
  if (video.status === "READY") {
    return NextResponse.json(
      { error: "This video has already finished processing." },
      { status: 409 },
    );
  }

  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (!contentType || !supportedVideoTypes.has(contentType)) {
    return NextResponse.json(
      {
        error:
          "Choose a video file: MP4, MOV, WebM, MKV, AVI, M4V, 3GP, WMV, MPEG, or OGV.",
      },
      { status: 415 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (!Number.isFinite(contentLength) || contentLength < 1) {
    return NextResponse.json(
      { error: "The upload must include a valid content length." },
      { status: 411 },
    );
  }
  if (contentLength > MAX_VIDEO_BYTES) {
    return NextResponse.json(
      { error: "Video files must be 500 MB or smaller." },
      { status: 413 },
    );
  }
  if (!request.body) {
    return NextResponse.json(
      { error: "The upload body is empty." },
      { status: 400 },
    );
  }

  const destination = getStoredFilePath(video.id, "source");
  const lockPath = getStoredFilePath(video.id, "source.uploading");
  let lock;
  try {
    await mkdir(path.dirname(lockPath), { recursive: true });
    lock = await open(lockPath, "wx");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return NextResponse.json(
        { error: "An upload for this video is already in progress." },
        { status: 409 },
      );
    }
    console.error(`Could not lock video upload ${video.id}.`, error);
    return NextResponse.json(
      { error: "Unable to start the upload." },
      { status: 500 },
    );
  }

  try {
    await rm(destination, { force: true });
    const written = await saveRequestBody(
      request.body,
      destination,
      MAX_VIDEO_BYTES,
    );
    if (written !== contentLength) {
      await unlink(destination);
      return NextResponse.json(
        { error: "The uploaded file size did not match the request." },
        { status: 400 },
      );
    }

    await prisma.video.update({
      where: { id: video.id },
      data: { status: "PROCESSING", processingError: null },
    });

    await processUploadedVideo(video.id);
    return NextResponse.json({ id: video.id, status: "READY" });
  } catch (error) {
    console.error(`Video upload or processing failed for ${video.id}.`, error);
    if (error instanceof Error && error.message === "UPLOAD_LIMIT_EXCEEDED") {
      return NextResponse.json(
        { error: "Video files must be 500 MB or smaller." },
        { status: 413 },
      );
    }
    if (error instanceof Error && error.message === "EMPTY_UPLOAD") {
      return NextResponse.json(
        { error: "The uploaded file is empty." },
        { status: 400 },
      );
    }

    const currentVideo = await prisma.video.findUnique({
      where: { id: video.id },
      select: { status: true },
    });
    if (currentVideo?.status === "FAILED") {
      return NextResponse.json(
        {
          error:
            "Video processing failed. Your original upload is saved; you can retry processing.",
          status: "FAILED",
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Unable to save the upload. Please try again." },
      { status: 500 },
    );
  } finally {
    await lock?.close();
    await unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") {
        console.error(`Could not release upload lock ${video.id}.`, error);
      }
    });
  }
}

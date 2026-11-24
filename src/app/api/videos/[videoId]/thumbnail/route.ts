import { readFile, unlink } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getStoredFilePath,
  MAX_THUMBNAIL_BYTES,
  saveRequestBody,
} from "@/lib/storage/storage";

export const runtime = "nodejs";

const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function PUT(
  request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to upload a thumbnail." },
      { status: 401 },
    );
  }

  const video = await prisma.video.findFirst({
    where: { id: params.videoId, userId: session.user.id },
    select: { id: true },
  });
  if (!video) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (!contentType || !imageTypes.has(contentType)) {
    return NextResponse.json(
      { error: "Thumbnail must be a JPEG, PNG, or WebP image." },
      { status: 415 },
    );
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (!Number.isFinite(contentLength) || contentLength < 1) {
    return NextResponse.json(
      { error: "The thumbnail must include a valid content length." },
      { status: 411 },
    );
  }
  if (contentLength > MAX_THUMBNAIL_BYTES) {
    return NextResponse.json(
      { error: "Thumbnail images must be 5 MB or smaller." },
      { status: 413 },
    );
  }
  if (!request.body) {
    return NextResponse.json(
      { error: "The thumbnail is empty." },
      { status: 400 },
    );
  }

  try {
    const extension = imageTypes.get(contentType);
    if (!extension) {
      return NextResponse.json(
        { error: "Thumbnail must be a JPEG, PNG, or WebP image." },
        { status: 415 },
      );
    }
    const filePath = getStoredFilePath(video.id, `thumbnail.${extension}`);
    const written = await saveRequestBody(
      request.body,
      filePath,
      MAX_THUMBNAIL_BYTES,
    );
    if (written !== contentLength) {
      await unlink(filePath);
      return NextResponse.json(
        { error: "The thumbnail size did not match the request." },
        { status: 400 },
      );
    }

    const header = await readFile(filePath).then((file) =>
      file.subarray(0, 12),
    );
    const isJpeg =
      header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const isPng =
      header.length >= 8 &&
      header
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isWebp =
      header.length >= 12 &&
      header.toString("ascii", 0, 4) === "RIFF" &&
      header.toString("ascii", 8, 12) === "WEBP";
    if (!isJpeg && !isPng && !isWebp) {
      await unlink(filePath);
      return NextResponse.json(
        { error: "The selected file is not a valid JPEG, PNG, or WebP image." },
        { status: 415 },
      );
    }

    const updated = await prisma.video.update({
      where: { id: video.id },
      data: { thumbnailUrl: `/api/media/${video.id}/thumbnail.${extension}` },
      select: { thumbnailUrl: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(`Thumbnail upload failed for ${video.id}.`, error);
    return NextResponse.json(
      { error: "Unable to save the thumbnail. Please try again." },
      { status: 500 },
    );
  }
}

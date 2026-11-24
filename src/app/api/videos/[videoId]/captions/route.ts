import { readFile, unlink } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoredFilePath, saveRequestBody } from "@/lib/storage/storage";

export const runtime = "nodejs";

const MAX_CAPTION_BYTES = 2 * 1024 * 1024;

export async function PUT(
  request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to upload captions." },
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
  if (contentType !== "text/vtt" || !request.body) {
    return NextResponse.json(
      { error: "Captions must be a WebVTT (.vtt) file." },
      { status: 415 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (!Number.isFinite(contentLength) || contentLength < 1) {
    return NextResponse.json(
      { error: "The caption file must include a valid content length." },
      { status: 411 },
    );
  }
  if (contentLength > MAX_CAPTION_BYTES) {
    return NextResponse.json(
      { error: "Caption files must be 2 MB or smaller." },
      { status: 413 },
    );
  }

  const captionPath = getStoredFilePath(video.id, "captions.vtt");
  try {
    const written = await saveRequestBody(
      request.body,
      captionPath,
      MAX_CAPTION_BYTES,
    );
    if (written !== contentLength) {
      await unlink(captionPath);
      return NextResponse.json(
        { error: "The caption file size did not match the request." },
        { status: 400 },
      );
    }

    const content = await readFile(captionPath, "utf8");
    if (!/^(?:\uFEFF)?WEBVTT(?:[ \t].*)?(?:\r?\n|$)/.test(content)) {
      await unlink(captionPath);
      return NextResponse.json(
        { error: "The selected file is not a valid WebVTT caption file." },
        { status: 415 },
      );
    }

    const result = await prisma.video.update({
      where: { id: video.id },
      data: { captionsUrl: `/api/media/${video.id}/captions.vtt` },
      select: { captionsUrl: true },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Caption upload failed for ${video.id}.`, error);
    return NextResponse.json(
      { error: "Unable to save captions. Please try again." },
      { status: 500 },
    );
  }
}

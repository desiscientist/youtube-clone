import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoredFilePath } from "@/lib/storage/storage";

export const runtime = "nodejs";

const mimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  vtt: "text/vtt; charset=utf-8",
};

function isAllowedMediaPath(segments: string[]) {
  if (
    segments.length === 1 &&
    /^thumbnail\.(jpe?g|png|webp)$/.test(segments[0])
  ) {
    return true;
  }
  if (segments.length === 1 && segments[0] === "captions.vtt") return true;
  if (segments.length !== 2 || segments[0] !== "processed") return false;
  return (
    /^(360|720|1080)p\.mp4$/.test(segments[1]) ||
    segments[1] === "master.m3u8" ||
    /^segment\d{4}\.ts$/.test(segments[1])
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string; path: string[] } },
) {
  if (!isAllowedMediaPath(params.path)) {
    return NextResponse.json(
      { error: "Media file not found." },
      { status: 404 },
    );
  }

  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    select: { status: true, visibility: true, userId: true },
  });
  if (!video) {
    return NextResponse.json(
      { error: "Media file not found." },
      { status: 404 },
    );
  }

  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.id === video.userId;
  if (
    (video.visibility === "PRIVATE" && !isOwner) ||
    (video.status !== "READY" && !isOwner)
  ) {
    return NextResponse.json(
      { error: "Media file not found." },
      { status: 404 },
    );
  }

  let filePath: string;
  try {
    filePath = getStoredFilePath(params.videoId, ...params.path);
  } catch {
    return NextResponse.json(
      { error: "Media file not found." },
      { status: 404 },
    );
  }

  let fileInfo;
  try {
    fileInfo = await stat(filePath);
  } catch {
    return NextResponse.json(
      { error: "Media file not found." },
      { status: 404 },
    );
  }
  if (!fileInfo.isFile()) {
    return NextResponse.json(
      { error: "Media file not found." },
      { status: 404 },
    );
  }

  const range = request.headers.get("range");
  let start = 0;
  let end = fileInfo.size - 1;
  let status = 200;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileInfo.size}` },
      });
    }

    if (!match[1]) {
      const suffixLength = Number(match[2]);
      start = Math.max(0, fileInfo.size - suffixLength);
    } else {
      start = Number(match[1]);
      if (match[2]) end = Number(match[2]);
    }

    if (start > end || start >= fileInfo.size || end >= fileInfo.size) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileInfo.size}` },
      });
    }
    status = 206;
  }

  const extension = params.path.at(-1)?.split(".").at(-1)?.toLocaleLowerCase();
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control":
      video.visibility === "PRIVATE"
        ? "private, no-store"
        : "public, max-age=31536000, immutable",
    "Content-Length": String(end - start + 1),
    "Content-Type": mimeTypes[extension || ""] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  if (status === 206) {
    headers.set("Content-Range", `bytes ${start}-${end}/${fileInfo.size}`);
  }

  const stream = createReadStream(filePath, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status,
    headers,
  });
}

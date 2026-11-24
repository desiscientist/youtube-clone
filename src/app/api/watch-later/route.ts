import { NextResponse, type NextRequest } from "next/server";
import { findViewableVideo } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";
import { getOrCreateWatchLater } from "@/lib/watch-later";

/** IDs of every video in the viewer's Watch later list. */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ videoIds: [] });

  const items = await prisma.playlistVideo.findMany({
    where: { playlist: { userId, isWatchLater: true } },
    select: { videoId: true },
  });
  return NextResponse.json({ videoIds: items.map((item) => item.videoId) });
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to save videos.", 401);
  const limited = rateLimitResponse("playlist", userId);
  if (limited) return limited;

  const body = await readJsonObject(request);
  if (typeof body?.videoId !== "string") {
    return jsonError("Choose a video to save.", 400);
  }
  const video = await findViewableVideo(body.videoId, userId);
  if (!video) return jsonError("Video not found.", 404);

  const playlist = await getOrCreateWatchLater(userId);
  const last = await prisma.playlistVideo.findFirst({
    where: { playlistId: playlist.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await prisma.playlistVideo.createMany({
    data: {
      playlistId: playlist.id,
      videoId: video.id,
      position: (last?.position ?? -1) + 1,
    },
    skipDuplicates: true,
  });
  await prisma.playlist.update({
    where: { id: playlist.id },
    data: { updatedAt: new Date() },
  });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to manage Watch later.", 401);

  const videoId = request.nextUrl.searchParams.get("videoId");
  if (!videoId) return jsonError("Choose a video to remove.", 400);

  await prisma.playlistVideo.deleteMany({
    where: { videoId, playlist: { userId, isWatchLater: true } },
  });
  return NextResponse.json({ saved: false });
}

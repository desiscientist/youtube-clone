import { NextResponse, type NextRequest } from "next/server";
import { findViewableVideo } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";

type Params = { params: { playlistId: string } };

async function findOwnPlaylist(playlistId: string, userId: string) {
  return prisma.playlist.findFirst({
    where: { id: playlistId, userId },
    select: { id: true },
  });
}

/** Adds a video to the end of one of the viewer's playlists. */
export async function POST(request: NextRequest, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to save videos.", 401);
  const limited = rateLimitResponse("playlist", userId);
  if (limited) return limited;

  const playlist = await findOwnPlaylist(params.playlistId, userId);
  if (!playlist) return jsonError("Playlist not found.", 404);

  const body = await readJsonObject(request);
  if (typeof body?.videoId !== "string") {
    return jsonError("Choose a video to add.", 400);
  }
  const video = await findViewableVideo(body.videoId, userId);
  if (!video) return jsonError("Video not found.", 404);

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

  return NextResponse.json({ added: true });
}

/** Removes ?videoId= from one of the viewer's playlists. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to manage playlists.", 401);

  const playlist = await findOwnPlaylist(params.playlistId, userId);
  if (!playlist) return jsonError("Playlist not found.", 404);

  const videoId = request.nextUrl.searchParams.get("videoId");
  if (!videoId) return jsonError("Choose a video to remove.", 400);

  await prisma.playlistVideo.deleteMany({
    where: { playlistId: playlist.id, videoId },
  });
  return NextResponse.json({ removed: true });
}

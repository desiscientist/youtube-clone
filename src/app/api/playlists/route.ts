import { NextResponse, type NextRequest } from "next/server";
import { findViewableVideo } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";
import { getOrCreateWatchLater } from "@/lib/watch-later";

/** The viewer's playlists. With ?videoId=, each says whether it holds that video. */
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to see your playlists.", 401);

  const videoId = request.nextUrl.searchParams.get("videoId");
  await getOrCreateWatchLater(userId);
  const playlists = await prisma.playlist.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      visibility: true,
      isWatchLater: true,
      _count: { select: { videos: true } },
      videos: videoId
        ? { where: { videoId }, select: { id: true } }
        : { take: 0, select: { id: true } },
    },
    // Watch later always comes first, like on YouTube.
    orderBy: [{ isWatchLater: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({
    playlists: playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      visibility: playlist.visibility,
      isWatchLater: playlist.isWatchLater,
      videoCount: playlist._count.videos,
      hasVideo: playlist.videos.length > 0,
    })),
  });
}

/** Creates a playlist, optionally adding a first video to it. */
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to create playlists.", 401);
  const limited = rateLimitResponse("playlist", userId);
  if (limited) return limited;

  const body = await readJsonObject(request);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 100) {
    return jsonError(
      "Playlist names must be between 1 and 100 characters.",
      400,
    );
  }
  const visibility = body?.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";

  let videoId: string | null = null;
  if (typeof body?.videoId === "string") {
    const video = await findViewableVideo(body.videoId, userId);
    if (!video) return jsonError("Video not found.", 404);
    videoId = video.id;
  }

  const playlist = await prisma.playlist.create({
    data: {
      userId,
      name,
      visibility,
      ...(videoId && { videos: { create: { videoId, position: 0 } } }),
    },
    select: { id: true, name: true, visibility: true },
  });

  return NextResponse.json(
    {
      playlist: {
        ...playlist,
        videoCount: videoId ? 1 : 0,
        hasVideo: Boolean(videoId),
      },
    },
    { status: 201 },
  );
}

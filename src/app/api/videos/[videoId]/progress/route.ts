import { NextResponse, type NextRequest } from "next/server";
import { findViewableVideo } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";

/** Saves how far into the video the viewer is, so it can resume later. */
export async function POST(
  request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const userId = await getCurrentUserId();
  // Visitors have no history; succeed quietly so the player doesn't care.
  if (!userId) return NextResponse.json({ saved: false });

  const body = await readJsonObject(request);
  const seconds = body?.seconds;
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds < 0 ||
    seconds > 24 * 60 * 60
  ) {
    return jsonError("Progress must be a number of seconds.", 400);
  }

  const video = await findViewableVideo(params.videoId, userId);
  if (!video) return jsonError("Video not found.", 404);

  const progress = Math.floor(seconds);
  await prisma.watchHistory
    .upsert({
      where: { userId_videoId: { userId, videoId: video.id } },
      create: { userId, videoId: video.id, progress },
      update: { progress },
    })
    .catch((error: unknown) => {
      // Two saves racing to create the row: the other one won, which is fine.
      console.warn("Progress save collided with another save.", error);
    });

  return NextResponse.json({ saved: true });
}

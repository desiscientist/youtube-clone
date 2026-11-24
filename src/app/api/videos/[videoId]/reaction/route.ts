import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";

/** Sets the viewer's reaction to a video: "like", "dislike", or "none". */
export async function POST(
  request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to rate videos.", 401);
  const limited = rateLimitResponse("reaction", userId);
  if (limited) return limited;

  const body = await readJsonObject(request);
  const reaction = body?.reaction;
  if (reaction !== "like" && reaction !== "dislike" && reaction !== "none") {
    return jsonError('Reaction must be "like", "dislike", or "none".', 400);
  }

  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    select: { id: true, userId: true, visibility: true, status: true },
  });
  if (
    !video ||
    video.status !== "READY" ||
    (video.visibility === "PRIVATE" && video.userId !== userId)
  ) {
    return jsonError("Video not found.", 404);
  }

  const where = { userId, videoId: video.id };
  await prisma.$transaction(async (tx) => {
    await tx.like.deleteMany({ where });
    await tx.dislike.deleteMany({ where });
    // skipDuplicates keeps rapid double-clicks from hitting the unique index.
    if (reaction === "like") {
      await tx.like.createMany({ data: where, skipDuplicates: true });
    }
    if (reaction === "dislike") {
      await tx.dislike.createMany({ data: where, skipDuplicates: true });
    }
  });

  const likeCount = await prisma.like.count({ where: { videoId: video.id } });
  return NextResponse.json({ reaction, likeCount });
}

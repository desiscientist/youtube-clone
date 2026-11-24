import { NextResponse, type NextRequest } from "next/server";
import { findViewableVideo } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";

/** Likes ({ liked: true }) or un-likes ({ liked: false }) a comment. */
export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } },
) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to like comments.", 401);
  const limited = rateLimitResponse("reaction", userId);
  if (limited) return limited;

  const body = await readJsonObject(request);
  if (typeof body?.liked !== "boolean") {
    return jsonError("Send { liked: true } or { liked: false }.", 400);
  }

  const comment = await prisma.comment.findUnique({
    where: { id: params.commentId },
    select: { id: true, videoId: true },
  });
  if (!comment || !(await findViewableVideo(comment.videoId, userId))) {
    return jsonError("Comment not found.", 404);
  }

  if (body.liked) {
    await prisma.like.createMany({
      data: { userId, commentId: comment.id },
      skipDuplicates: true,
    });
  } else {
    await prisma.like.deleteMany({ where: { userId, commentId: comment.id } });
  }

  const likeCount = await prisma.like.count({
    where: { commentId: comment.id },
  });
  return NextResponse.json({ liked: body.liked, likeCount });
}

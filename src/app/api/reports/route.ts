import { NextResponse, type NextRequest } from "next/server";
import { findViewableVideo } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { isReportReason } from "@/lib/reports";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";

/** Reports a video ({ videoId }) or comment ({ commentId }) for review. */
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to report content.", 401);
  const limited = rateLimitResponse("report", userId);
  if (limited) return limited;

  const body = await readJsonObject(request);
  if (!body) return jsonError("The request body must be a JSON object.", 400);
  if (!isReportReason(body.reason)) return jsonError("Choose a reason.", 400);
  const details =
    typeof body.details === "string" ? body.details.trim().slice(0, 500) : "";

  let target: {
    videoId?: string;
    commentId?: string;
    targetType: "video" | "comment";
    targetLabel: string;
  };
  if (typeof body.videoId === "string") {
    const video = await findViewableVideo(body.videoId, userId);
    if (!video) return jsonError("Video not found.", 404);
    if (video.userId === userId) {
      return jsonError("You can't report your own video.", 400);
    }
    target = {
      videoId: video.id,
      targetType: "video",
      targetLabel: video.title,
    };
  } else if (typeof body.commentId === "string") {
    const comment = await prisma.comment.findUnique({
      where: { id: body.commentId },
      select: { id: true, userId: true, videoId: true, content: true },
    });
    if (!comment || !(await findViewableVideo(comment.videoId, userId))) {
      return jsonError("Comment not found.", 404);
    }
    if (comment.userId === userId) {
      return jsonError("You can't report your own comment.", 400);
    }
    target = {
      commentId: comment.id,
      // Keep the video too, so moderators can see the comment in context.
      videoId: comment.videoId,
      targetType: "comment",
      targetLabel: comment.content.slice(0, 300),
    };
  } else {
    return jsonError("Choose a video or comment to report.", 400);
  }

  // One open report per person per item; reporting again updates it.
  const existing = await prisma.report.findFirst({
    where: {
      reporterId: userId,
      status: "OPEN",
      ...(target.targetType === "comment"
        ? { commentId: target.commentId }
        : { videoId: target.videoId, commentId: null }),
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.report.update({
      where: { id: existing.id },
      data: { reason: body.reason, details },
    });
  } else {
    await prisma.report.create({
      data: { reporterId: userId, reason: body.reason, details, ...target },
    });
  }

  return NextResponse.json(
    { reported: true },
    { status: existing ? 200 : 201 },
  );
}

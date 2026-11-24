import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";

/**
 * The video's creator pins ({ pinned: true }) or unpins a top-level comment.
 * Only one comment per video can be pinned; pinning replaces the old one.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } },
) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to pin comments.", 401);

  const body = await readJsonObject(request);
  if (typeof body?.pinned !== "boolean") {
    return jsonError("Send { pinned: true } or { pinned: false }.", 400);
  }

  const comment = await prisma.comment.findUnique({
    where: { id: params.commentId },
    select: {
      id: true,
      parentId: true,
      videoId: true,
      video: { select: { userId: true } },
    },
  });
  if (!comment || comment.video.userId !== userId) {
    return jsonError("Comment not found.", 404);
  }
  if (comment.parentId) return jsonError("Replies can't be pinned.", 400);

  await prisma.$transaction([
    prisma.comment.updateMany({
      where: { videoId: comment.videoId, pinnedAt: { not: null } },
      data: { pinnedAt: null },
    }),
    ...(body.pinned
      ? [
          prisma.comment.update({
            where: { id: comment.id },
            data: { pinnedAt: new Date() },
          }),
        ]
      : []),
  ]);
  return NextResponse.json({ pinned: body.pinned });
}

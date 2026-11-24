import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";

/** The comment's author or the video's owner can delete a comment. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { commentId: string } },
) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to manage comments.", 401);

  const comment = await prisma.comment.findUnique({
    where: { id: params.commentId },
    select: { id: true, userId: true, video: { select: { userId: true } } },
  });
  if (!comment) return jsonError("Comment not found.", 404);
  if (comment.userId !== userId && comment.video.userId !== userId) {
    return jsonError("You can't delete this comment.", 403);
  }

  // Replies are removed with their parent through the cascade relation.
  await prisma.comment.delete({ where: { id: comment.id } });
  return NextResponse.json({ deleted: true });
}

/** The author edits their comment: { content }. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { commentId: string } },
) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to edit comments.", 401);

  const body = await readJsonObject(request);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (content.length < 1 || content.length > 2000) {
    return jsonError("Comments must be between 1 and 2000 characters.", 400);
  }

  const updated = await prisma.comment.updateMany({
    where: { id: params.commentId, userId },
    data: { content, editedAt: new Date() },
  });
  if (updated.count === 0) return jsonError("Comment not found.", 404);
  return NextResponse.json({ content });
}

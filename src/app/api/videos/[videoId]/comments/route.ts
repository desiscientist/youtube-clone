import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { findViewableVideo } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";
import { colorFor, initials, timeAgo } from "@/lib/videos";

type Params = { params: { videoId: string } };

const MAX_COMMENT_LENGTH = 2000;

const authorSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  channel: { select: { handle: true, name: true, avatarUrl: true } },
} satisfies Prisma.UserSelect;

/**
 * Loads the author, like count, and whether the viewer or the video's
 * creator liked it (only those two users' likes are fetched).
 */
function commentInclude(viewerId: string | null, creatorId: string) {
  return {
    user: { select: authorSelect },
    _count: { select: { likes: true } },
    likes: {
      where: { userId: { in: viewerId ? [viewerId, creatorId] : [creatorId] } },
      select: { userId: true },
    },
  } satisfies Prisma.CommentInclude;
}

type CommentRow = Prisma.CommentGetPayload<{
  include: ReturnType<typeof commentInclude>;
}>;

export type CommentData = {
  id: string;
  content: string;
  posted: string;
  author: {
    name: string;
    handle: string | null;
    image: string | null;
    initials: string;
    color: string;
  };
  canDelete: boolean;
  /** Only the author can edit; only the video's creator can pin. */
  canEdit: boolean;
  canPin: boolean;
  pinned: boolean;
  edited: boolean;
  likeCount: number;
  likedByViewer: boolean;
  /** The video's creator liked this comment (shown as a heart). */
  likedByCreator: boolean;
  isCreator: boolean;
  replies: CommentData[];
};

function serialize(
  comment: CommentRow,
  viewerId: string | null,
  videoOwnerId: string,
  replies: CommentData[] = [],
): CommentData {
  const name =
    comment.user.channel?.name ||
    comment.user.name ||
    comment.user.email.split("@")[0];
  return {
    id: comment.id,
    content: comment.content,
    posted: timeAgo(comment.createdAt),
    author: {
      name,
      handle: comment.user.channel?.handle ?? null,
      image: comment.user.channel?.avatarUrl || comment.user.image,
      initials: initials(name),
      color: colorFor(name),
    },
    canDelete:
      viewerId !== null &&
      (comment.userId === viewerId || videoOwnerId === viewerId),
    canEdit: viewerId !== null && comment.userId === viewerId,
    canPin: viewerId === videoOwnerId && comment.parentId === null,
    pinned: comment.pinnedAt !== null,
    edited: comment.editedAt !== null,
    likeCount: comment._count.likes,
    likedByViewer:
      viewerId !== null &&
      comment.likes.some((like) => like.userId === viewerId),
    likedByCreator: comment.likes.some((like) => like.userId === videoOwnerId),
    isCreator: comment.userId === videoOwnerId,
    replies,
  };
}

/** Top-level comments with replies. ?sort=top (most liked) or ?sort=new. */
export async function GET(request: NextRequest, { params }: Params) {
  const viewerId = await getCurrentUserId();
  const video = await findViewableVideo(params.videoId, viewerId);
  if (!video) return jsonError("Video not found.", 404);

  const sort =
    request.nextUrl.searchParams.get("sort") === "new" ? "new" : "top";
  const include = commentInclude(viewerId, video.userId);
  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: { videoId: video.id, parentId: null },
      include: {
        ...include,
        replies: { include, orderBy: { createdAt: "asc" } },
      },
      // A pinned comment always comes first.
      orderBy: [
        { pinnedAt: { sort: "desc", nulls: "last" } },
        ...(sort === "top"
          ? [
              { likes: { _count: "desc" as const } },
              { createdAt: "desc" as const },
            ]
          : [{ createdAt: "desc" as const }]),
      ],
      take: 100,
    }),
    prisma.comment.count({ where: { videoId: video.id } }),
  ]);

  return NextResponse.json({
    total,
    comments: comments.map((comment) =>
      serialize(
        comment,
        viewerId,
        video.userId,
        comment.replies.map((reply) =>
          serialize(reply, viewerId, video.userId),
        ),
      ),
    ),
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to comment.", 401);
  const limited = rateLimitResponse("comment", userId);
  if (limited) return limited;

  const video = await findViewableVideo(params.videoId, userId);
  if (!video) return jsonError("Video not found.", 404);

  const body = await readJsonObject(request);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (content.length < 1 || content.length > MAX_COMMENT_LENGTH) {
    return jsonError(
      `Comments must be between 1 and ${MAX_COMMENT_LENGTH} characters.`,
      400,
    );
  }

  let parent: { id: string; userId: string } | null = null;
  if (body?.parentId !== undefined && body.parentId !== null) {
    if (typeof body.parentId !== "string") {
      return jsonError("Invalid reply target.", 400);
    }
    const found = await prisma.comment.findFirst({
      where: { id: body.parentId, videoId: video.id },
      select: { id: true, userId: true, parentId: true },
    });
    if (!found) return jsonError("The comment you replied to is gone.", 404);
    // Keep threads one level deep: replying to a reply joins its thread.
    parent = found.parentId
      ? await prisma.comment.findUnique({
          where: { id: found.parentId },
          select: { id: true, userId: true },
        })
      : found;
    if (!parent) return jsonError("The comment you replied to is gone.", 404);
  }

  const comment = await prisma.comment.create({
    data: { userId, videoId: video.id, parentId: parent?.id, content },
    include: commentInclude(userId, video.userId),
  });

  const authorName =
    comment.user.channel?.name || comment.user.name || "Someone";
  const recipient = parent ? parent.userId : video.userId;
  if (recipient !== userId) {
    await prisma.notification.create({
      data: {
        userId: recipient,
        actorId: userId,
        videoId: video.id,
        commentId: comment.id,
        type: parent ? "COMMENT_REPLY" : "NEW_COMMENT",
        message: parent
          ? `${authorName} replied to your comment: "${content.slice(0, 80)}"`
          : `${authorName} commented on "${video.title}": "${content.slice(0, 80)}"`,
      },
    });
  }

  return NextResponse.json(
    { comment: serialize(comment, userId, video.userId) },
    { status: 201 },
  );
}

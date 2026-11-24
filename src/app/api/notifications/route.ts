import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, jsonError } from "@/lib/session";
import { FALLBACK_THUMBNAIL, timeAgo } from "@/lib/videos";

export type NotificationData = {
  id: string;
  message: string;
  posted: string;
  unread: boolean;
  href: string;
  thumbnail: string | null;
};

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to see notifications.", 401);

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      include: {
        video: { select: { id: true, thumbnailUrl: true } },
        channel: { select: { handle: true } },
        actor: { select: { channel: { select: { handle: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  const data: NotificationData[] = notifications.map((notification) => {
    const actorHandle = notification.actor?.channel?.handle;
    let href = "/";
    if (notification.video) href = `/watch?v=${notification.video.id}`;
    else if (notification.type === "NEW_SUBSCRIBER" && actorHandle) {
      href = `/channel/${actorHandle}`;
    } else if (notification.channel) {
      href = `/channel/${notification.channel.handle}`;
    }
    return {
      id: notification.id,
      message: notification.message,
      posted: timeAgo(notification.createdAt),
      unread: notification.readAt === null,
      href,
      thumbnail: notification.video
        ? notification.video.thumbnailUrl || FALLBACK_THUMBNAIL
        : null,
    };
  });

  return NextResponse.json({ notifications: data, unreadCount });
}

/** Marks every notification as read. */
export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to manage notifications.", 401);

  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ unreadCount: 0 });
}

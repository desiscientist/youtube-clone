import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentUserId, jsonError } from "@/lib/session";

type Params = { params: { channelId: string } };

async function subscriberCount(channelId: string) {
  return prisma.subscription.count({ where: { channelId } });
}

export async function POST(_request: NextRequest, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to subscribe.", 401);
  const limited = rateLimitResponse("subscribe", userId);
  if (limited) return limited;

  const channel = await prisma.channel.findUnique({
    where: { id: params.channelId },
    select: { id: true, userId: true },
  });
  if (!channel) return jsonError("Channel not found.", 404);
  if (channel.userId === userId) {
    return jsonError("You can't subscribe to your own channel.", 400);
  }

  const created = await prisma.subscription.createMany({
    data: { userId, channelId: channel.id },
    skipDuplicates: true,
  });
  if (created.count > 0) {
    const subscriber = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    await prisma.notification.create({
      data: {
        userId: channel.userId,
        actorId: userId,
        channelId: channel.id,
        type: "NEW_SUBSCRIBER",
        message: `${subscriber?.name || "Someone"} subscribed to your channel`,
      },
    });
  }

  return NextResponse.json({
    subscribed: true,
    subscriberCount: await subscriberCount(channel.id),
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to manage subscriptions.", 401);

  await prisma.subscription.deleteMany({
    where: { userId, channelId: params.channelId },
  });

  return NextResponse.json({
    subscribed: false,
    subscriberCount: await subscriberCount(params.channelId),
  });
}

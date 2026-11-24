import { NextResponse, type NextRequest } from "next/server";
import {
  channelImagePath,
  channelImageUrl,
  isChannelImageKind,
} from "@/lib/channel-media";
import { IMAGE_TYPES, saveImageUpload } from "@/lib/image-upload";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, jsonError } from "@/lib/session";
import { rm } from "node:fs/promises";

export const runtime = "nodejs";

type Params = { params: { kind: string } };

async function findOwnChannel(userId: string) {
  return prisma.channel.findUnique({ where: { userId }, select: { id: true } });
}

/** Uploads a new avatar or banner (raw image body). */
export async function PUT(request: NextRequest, { params }: Params) {
  if (!isChannelImageKind(params.kind)) return jsonError("Not found.", 404);
  const kind = params.kind;

  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to edit your channel.", 401);
  const channel = await findOwnChannel(userId);
  if (!channel) return jsonError("You don't have a channel yet.", 404);

  try {
    const result = await saveImageUpload(request, (extension) =>
      channelImagePath(channel.id, kind, extension),
    );
    if (!result.ok) return jsonError(result.error, result.status);

    const url = channelImageUrl(channel.id, kind, result.extension);
    await prisma.channel.update({
      where: { id: channel.id },
      data: kind === "avatar" ? { avatarUrl: url } : { bannerUrl: url },
    });
    return NextResponse.json({ url });
  } catch (error) {
    console.error(`Channel ${kind} upload failed.`, error);
    return jsonError("The image couldn't be saved. Please try again.", 500);
  }
}

/** Removes the avatar or banner, going back to the default look. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  if (!isChannelImageKind(params.kind)) return jsonError("Not found.", 404);
  const kind = params.kind;

  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to edit your channel.", 401);
  const channel = await findOwnChannel(userId);
  if (!channel) return jsonError("You don't have a channel yet.", 404);

  await prisma.channel.update({
    where: { id: channel.id },
    data: kind === "avatar" ? { avatarUrl: null } : { bannerUrl: null },
  });
  for (const extension of IMAGE_TYPES.values()) {
    await rm(channelImagePath(channel.id, kind, extension), { force: true });
  }
  return NextResponse.json({ url: null });
}

import { rm } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { notifySubscribersOfUpload } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";
import { getVideoDirectory } from "@/lib/storage/storage";
import { mergeHashtags } from "@/lib/rich-text";
import { VIDEO_CATEGORIES } from "@/lib/videos";

type Params = { params: { videoId: string } };

const categories = new Set<string>(VIDEO_CATEGORIES);

async function findOwnVideo(videoId: string, userId: string) {
  return prisma.video.findFirst({
    where: { id: videoId, userId },
    select: { id: true, visibility: true },
  });
}

/** Lets the owner edit a video's details. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to edit videos.", 401);

  const video = await findOwnVideo(params.videoId, userId);
  if (!video) return jsonError("Video not found.", 404);

  const body = await readJsonObject(request);
  if (!body) return jsonError("The request body must be a JSON object.", 400);

  const data: Prisma.VideoUpdateInput = {};
  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 1 || title.length > 100) {
      return jsonError("Title must be between 1 and 100 characters.", 400);
    }
    data.title = title;
  }
  if (body.description !== undefined) {
    if (
      typeof body.description !== "string" ||
      body.description.length > 5000
    ) {
      return jsonError(
        "Description must be no more than 5,000 characters.",
        400,
      );
    }
    data.description = body.description.trim();
    // Keep tags in sync with the #hashtags in the new description.
    const current = await prisma.video.findUnique({
      where: { id: video.id },
      select: { tags: true, description: true },
    });
    const oldHashtags = new Set(mergeHashtags([], current?.description ?? ""));
    const manualTags = (current?.tags ?? []).filter(
      (tag) => !oldHashtags.has(tag),
    );
    data.tags = mergeHashtags(manualTags, data.description);
  }
  if (body.category !== undefined) {
    if (typeof body.category !== "string" || !categories.has(body.category)) {
      return jsonError("Choose a valid category.", 400);
    }
    data.category = body.category;
  }
  if (body.visibility !== undefined) {
    if (
      body.visibility !== "PUBLIC" &&
      body.visibility !== "UNLISTED" &&
      body.visibility !== "PRIVATE"
    ) {
      return jsonError("Choose public, unlisted, or private visibility.", 400);
    }
    data.visibility = body.visibility;
  }

  const updated = await prisma.video.update({
    where: { id: video.id },
    data,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      visibility: true,
    },
  });

  // Switching a video to public tells subscribers about it (once per video).
  if (video.visibility !== "PUBLIC" && updated.visibility === "PUBLIC") {
    await notifySubscribersOfUpload(updated.id).catch((error: unknown) => {
      console.error("Could not notify subscribers of the video.", error);
    });
  }

  return NextResponse.json({ video: updated });
}

/** Deletes the owner's video and its stored files. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to delete videos.", 401);

  const video = await findOwnVideo(params.videoId, userId);
  if (!video) return jsonError("Video not found.", 404);

  await prisma.video.delete({ where: { id: video.id } });
  await rm(getVideoDirectory(video.id), { recursive: true, force: true }).catch(
    (error: unknown) => {
      console.error("Could not remove the video's stored files.", error);
    },
  );

  return NextResponse.json({ deleted: true });
}

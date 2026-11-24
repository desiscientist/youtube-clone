import { prisma } from "@/lib/prisma";

/**
 * Returns the video if this viewer may see it: ready and not private,
 * or owned by the viewer.
 */
export async function findViewableVideo(
  videoId: string,
  userId: string | null,
) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      title: true,
      userId: true,
      channelId: true,
      status: true,
      visibility: true,
    },
  });
  if (!video) return null;
  const isOwner = userId !== null && video.userId === userId;
  if (
    !isOwner &&
    (video.status !== "READY" || video.visibility === "PRIVATE")
  ) {
    return null;
  }
  return video;
}

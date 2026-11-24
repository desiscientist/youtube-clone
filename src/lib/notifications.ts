import { prisma } from "@/lib/prisma";

/** Tells every subscriber of the channel that a new video is available. */
export async function notifySubscribersOfUpload(videoId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      title: true,
      userId: true,
      visibility: true,
      status: true,
      channel: {
        select: {
          id: true,
          name: true,
          subscribers: { select: { userId: true } },
        },
      },
    },
  });
  if (!video || video.status !== "READY" || video.visibility !== "PUBLIC") {
    return;
  }

  const alreadySent = await prisma.notification.findFirst({
    where: { videoId: video.id, type: "NEW_VIDEO" },
    select: { id: true },
  });
  if (alreadySent) return;

  const recipients = video.channel.subscribers
    .map((subscription) => subscription.userId)
    .filter((userId) => userId !== video.userId);
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      actorId: video.userId,
      channelId: video.channel.id,
      videoId: video.id,
      type: "NEW_VIDEO",
      message: `${video.channel.name} uploaded: ${video.title}`,
    })),
  });
}

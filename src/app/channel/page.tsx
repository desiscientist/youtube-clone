import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/** "Your channel" shortcut: sends the viewer to their own channel page. */
export default async function OwnChannelPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?callbackUrl=%2Fchannel");

  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: { handle: true },
  });
  if (!channel) notFound();
  redirect(`/channel/${channel.handle}`);
}

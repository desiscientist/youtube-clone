import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getOrCreateWatchLater } from "@/lib/watch-later";

/** Sidebar shortcut to the viewer's Watch later playlist. */
export default async function WatchLaterPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?callbackUrl=%2Ffeed%2Fwatch-later");

  const playlist = await getOrCreateWatchLater(userId);
  redirect(`/playlist/${playlist.id}`);
}

import { getServerSession } from "next-auth";
import { isAdminEmail } from "@/lib/admin-emails";
import { authOptions } from "@/lib/auth";

/** The signed-in admin's user id, or null if the viewer isn't an admin. */
export async function getAdminUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminEmail(session.user.email)) return null;
  return session.user.id;
}

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, jsonError } from "@/lib/session";

/** Clears the viewer's watch history, or one entry with ?videoId=. */
export async function DELETE(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to manage your history.", 401);

  const videoId = request.nextUrl.searchParams.get("videoId");
  await prisma.watchHistory.deleteMany({
    where: { userId, ...(videoId && { videoId }) },
  });
  return NextResponse.json({ cleared: true });
}

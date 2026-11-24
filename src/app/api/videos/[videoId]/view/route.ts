import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VIEW_COOKIE = "streambox-viewer";
const VIEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(
  _request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const session = await getServerSession(authOptions);
  const cookieStore = cookies();
  let sessionId = cookieStore.get(VIEW_COOKIE)?.value;
  const setViewerCookie = !sessionId;
  if (!sessionId) sessionId = randomUUID();

  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    select: { id: true, userId: true, visibility: true, status: true },
  });
  if (!video || video.status !== "READY") {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  const isOwner = session?.user?.id === video.userId;
  if (video.visibility === "PRIVATE" && !isOwner) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  // Every play moves the video to the top of the viewer's history, even when
  // it doesn't count as a new view.
  if (session?.user?.id) {
    await prisma.watchHistory
      .upsert({
        where: {
          userId_videoId: { userId: session.user.id, videoId: video.id },
        },
        create: { userId: session.user.id, videoId: video.id },
        update: { watchedAt: new Date() },
      })
      .catch((error: unknown) => {
        console.error("Could not update watch history.", error);
      });
  }

  const viewerId = session?.user?.id || sessionId;
  const cutoff = new Date(Date.now() - VIEW_WINDOW_MS);
  const counted = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${viewerId}), hashtext(${video.id}))
    `;

    const existing = await transaction.view.findFirst({
      where: {
        videoId: video.id,
        viewedAt: { gte: cutoff },
        ...(session?.user?.id ? { userId: session.user.id } : { sessionId }),
      },
      select: { id: true },
    });
    if (existing) return false;

    await transaction.view.create({
      data: {
        videoId: video.id,
        userId: session?.user?.id,
        sessionId,
      },
    });
    await transaction.video.update({
      where: { id: video.id },
      data: { viewCount: { increment: 1 } },
    });
    return true;
  });

  const response = NextResponse.json({ counted });
  if (setViewerCookie) {
    response.cookies.set(VIEW_COOKIE, sessionId, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to view upload status." },
      { status: 401 },
    );
  }

  const video = await prisma.video.findFirst({
    where: { id: params.videoId, userId: session.user.id },
    select: { id: true, status: true, processingError: true },
  });
  if (!video) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: video.id,
    status: video.status,
    error:
      video.status === "FAILED"
        ? "Video processing failed. Your original upload is saved; you can retry processing."
        : null,
  });
}

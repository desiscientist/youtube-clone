import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoredFilePath } from "@/lib/storage/storage";
import { processUploadedVideo } from "@/lib/video-processing";

export const runtime = "nodejs";
export const maxDuration = 1800;

export async function POST(
  _request: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to process this video." },
      { status: 401 },
    );
  }

  const video = await prisma.video.findFirst({
    where: { id: params.videoId, userId: session.user.id },
    select: { id: true, status: true },
  });
  if (!video) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }
  if (video.status === "READY") {
    return NextResponse.json({ id: video.id, status: "READY" });
  }

  try {
    const { stat } = await import("node:fs/promises");
    await stat(getStoredFilePath(video.id, "source"));
  } catch {
    return NextResponse.json(
      {
        error: "The original upload is missing. Please upload the video again.",
      },
      { status: 409 },
    );
  }

  await prisma.video.update({
    where: { id: video.id },
    data: { status: "PROCESSING", processingError: null },
  });

  try {
    await processUploadedVideo(video.id);
    return NextResponse.json({ id: video.id, status: "READY" });
  } catch (error) {
    console.error(`Video reprocessing failed for ${video.id}.`, error);
    return NextResponse.json(
      {
        error:
          "Video processing failed again. Check the FFmpeg installation and upload format.",
        status: "FAILED",
      },
      { status: 422 },
    );
  }
}

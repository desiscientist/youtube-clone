import { rm } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonError, readJsonObject } from "@/lib/session";
import { getVideoDirectory } from "@/lib/storage/storage";

/**
 * Admin decision on a report: { action: "dismiss" } keeps the content;
 * { action: "remove" } deletes the reported video or comment. Either way,
 * every open report about the same item is closed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { reportId: string } },
) {
  const adminId = await getAdminUserId();
  if (!adminId) return jsonError("Not found.", 404);

  const body = await readJsonObject(request);
  const action = body?.action;
  if (action !== "dismiss" && action !== "remove") {
    return jsonError('Action must be "dismiss" or "remove".', 400);
  }

  const report = await prisma.report.findUnique({
    where: { id: params.reportId },
    select: { id: true, targetType: true, videoId: true, commentId: true },
  });
  if (!report) return jsonError("Report not found.", 404);

  const sameTarget =
    report.targetType === "comment"
      ? { commentId: report.commentId }
      : { videoId: report.videoId, targetType: "video" };
  // Close the reports first: removing the content clears their link to it.
  await prisma.report.updateMany({
    where: { status: "OPEN", ...sameTarget },
    data: {
      status: action === "remove" ? "RESOLVED" : "DISMISSED",
      resolvedById: adminId,
      resolvedAt: new Date(),
    },
  });

  if (action === "remove") {
    if (report.targetType === "comment" && report.commentId) {
      await prisma.comment.deleteMany({ where: { id: report.commentId } });
    } else if (report.targetType === "video" && report.videoId) {
      await prisma.video.deleteMany({ where: { id: report.videoId } });
      await rm(getVideoDirectory(report.videoId), {
        recursive: true,
        force: true,
      }).catch((error: unknown) => {
        console.error("Could not remove the video's stored files.", error);
      });
    }
  }

  return NextResponse.json({ done: true });
}

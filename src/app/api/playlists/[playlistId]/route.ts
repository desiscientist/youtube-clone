import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";

type Params = { params: { playlistId: string } };

/** Renames a playlist or changes its visibility. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to manage playlists.", 401);

  const body = await readJsonObject(request);
  if (!body) return jsonError("The request body must be a JSON object.", 400);

  const data: { name?: string; visibility?: "PUBLIC" | "PRIVATE" } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 100) {
      return jsonError(
        "Playlist names must be between 1 and 100 characters.",
        400,
      );
    }
    data.name = name;
  }
  if (body.visibility !== undefined) {
    if (body.visibility !== "PUBLIC" && body.visibility !== "PRIVATE") {
      return jsonError("Visibility must be PUBLIC or PRIVATE.", 400);
    }
    data.visibility = body.visibility;
  }

  const updated = await prisma.playlist.updateMany({
    // Watch later can't be renamed or made public.
    where: { id: params.playlistId, userId, isWatchLater: false },
    data,
  });
  if (updated.count === 0) return jsonError("Playlist not found.", 404);
  return NextResponse.json({ updated: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to manage playlists.", 401);

  const deleted = await prisma.playlist.deleteMany({
    where: { id: params.playlistId, userId, isWatchLater: false },
  });
  if (deleted.count === 0) return jsonError("Playlist not found.", 404);
  return NextResponse.json({ deleted: true });
}

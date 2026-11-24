import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, jsonError, readJsonObject } from "@/lib/session";

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

/** Updates the viewer's channel name, handle, or description. */
export async function PATCH(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Sign in to edit your channel.", 401);

  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: { id: true, handle: true },
  });
  if (!channel) return jsonError("You don't have a channel yet.", 404);

  const body = await readJsonObject(request);
  if (!body) return jsonError("The request body must be a JSON object.", 400);

  const data: { name?: string; handle?: string; description?: string } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 50) {
      return jsonError("Channel names must be 1–50 characters.", 400);
    }
    data.name = name;
  }
  if (body.description !== undefined) {
    if (
      typeof body.description !== "string" ||
      body.description.length > 1000
    ) {
      return jsonError("Descriptions can be up to 1,000 characters.", 400);
    }
    data.description = body.description.trim();
  }
  if (body.handle !== undefined) {
    const handle =
      typeof body.handle === "string"
        ? body.handle.trim().replace(/^@/, "").toLocaleLowerCase()
        : "";
    if (!HANDLE_PATTERN.test(handle)) {
      return jsonError(
        "Handles are 3–30 characters: lowercase letters, numbers, - and _, starting with a letter or number.",
        400,
      );
    }
    if (handle !== channel.handle) {
      const taken = await prisma.channel.findUnique({
        where: { handle },
        select: { id: true },
      });
      if (taken) return jsonError(`@${handle} is already taken.`, 409);
      data.handle = handle;
    }
  }

  try {
    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data,
      select: { name: true, handle: true, description: true },
    });
    return NextResponse.json({ channel: updated });
  } catch (error) {
    // Someone claimed the handle between our check and the update.
    if ((error as { code?: string }).code === "P2002") {
      return jsonError("That handle was just taken. Try another.", 409);
    }
    throw error;
  }
}

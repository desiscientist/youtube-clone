import { readFile } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { channelImagePath } from "@/lib/channel-media";

export const runtime = "nodejs";

const mimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Serves a channel's avatar or banner. Channel images are always public. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { channelId: string; file: string } },
) {
  const match = /^(avatar|banner)\.(jpg|png|webp)$/.exec(params.file);
  if (!match || !/^[a-zA-Z0-9_-]+$/.test(params.channelId)) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
  const [, kind, extension] = match;

  try {
    const file = await readFile(
      channelImagePath(
        params.channelId,
        kind as "avatar" | "banner",
        extension,
      ),
    );
    return new Response(file, {
      headers: {
        "Content-Type": mimeTypes[extension],
        // URLs carry a ?v= version, so each one can be cached for good.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}

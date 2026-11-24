import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { VideoVisibility } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimitResponse } from "@/lib/rate-limit";
import { mergeHashtags } from "@/lib/rich-text";
import { VIDEO_CATEGORIES } from "@/lib/videos";

type CreateVideoInput = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
  visibility?: unknown;
};

const categories = new Set<string>(VIDEO_CATEGORIES);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to upload a video." },
      { status: 401 },
    );
  }
  const limited = rateLimitResponse("upload", session.user.id);
  if (limited) return limited;

  let input: CreateVideoInput;
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "The request body must be a JSON object." },
        { status: 400 },
      );
    }
    input = body as CreateVideoInput;
  } catch {
    return NextResponse.json(
      { error: "The request body must be valid JSON." },
      { status: 400 },
    );
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const category =
    typeof input.category === "string" ? input.category.trim() : "";
  const tags = Array.isArray(input.tags)
    ? input.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
  const visibility =
    input.visibility === "UNLISTED" || input.visibility === "PRIVATE"
      ? input.visibility
      : input.visibility === "PUBLIC"
        ? input.visibility
        : null;

  if (title.length < 1 || title.length > 100) {
    return NextResponse.json(
      { error: "Title must be between 1 and 100 characters." },
      { status: 400 },
    );
  }
  if (description.length > 5000) {
    return NextResponse.json(
      { error: "Description must be no more than 5,000 characters." },
      { status: 400 },
    );
  }
  if (!categories.has(category)) {
    return NextResponse.json(
      { error: "Choose a valid category." },
      { status: 400 },
    );
  }
  if (tags.length > 10 || tags.some((tag) => tag.length > 30)) {
    return NextResponse.json(
      { error: "Use up to 10 tags, each no longer than 30 characters." },
      { status: 400 },
    );
  }
  if (!visibility) {
    return NextResponse.json(
      { error: "Choose public, unlisted, or private visibility." },
      { status: 400 },
    );
  }

  const channel = await prisma.channel.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!channel) {
    return NextResponse.json(
      {
        error:
          "Your creator channel is not available. Sign out and sign in again.",
      },
      { status: 409 },
    );
  }

  const video = await prisma.video.create({
    data: {
      userId: session.user.id,
      channelId: channel.id,
      title,
      description,
      category,
      // #hashtags in the description become searchable tags too.
      tags: mergeHashtags(tags, description),
      visibility: visibility as VideoVisibility,
      status: "PROCESSING",
    },
    select: { id: true },
  });

  return NextResponse.json({ videoId: video.id }, { status: 201 });
}

import { NextResponse, type NextRequest } from "next/server";
import { recommendVideos } from "@/lib/recommendations";
import { getCurrentUserId } from "@/lib/session";
import { VIDEO_CATEGORIES } from "@/lib/videos";

const categories = new Set<string>(VIDEO_CATEGORIES);

/** One page of the home feed: ?offset=24&category=Music. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const offset = Math.max(
    0,
    Math.min(10_000, Number(params.get("offset")) || 0),
  );
  const category = params.get("category");

  const result = await recommendVideos({
    userId: await getCurrentUserId(),
    category: category && categories.has(category) ? category : undefined,
    offset,
  });
  return NextResponse.json(result);
}

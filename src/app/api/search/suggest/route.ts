import { NextResponse, type NextRequest } from "next/server";
import { searchSuggestions } from "@/lib/search";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  return NextResponse.json({ suggestions: await searchSuggestions(q) });
}

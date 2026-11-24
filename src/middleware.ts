import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  if (token) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/studio/:path*",
    "/upload/:path*",
    "/feed/history",
    "/feed/liked",
    "/feed/playlists",
    "/feed/subscriptions",
    "/feed/watch-later",
  ],
};

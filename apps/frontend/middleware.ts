import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Since matcher only runs for /workspaces, always redirect
  return NextResponse.redirect(
    new URL(`/auto${request.nextUrl.search}`, request.url),
    308,
  );
}

export const config = {
  matcher: "/workspaces/:path*",
};

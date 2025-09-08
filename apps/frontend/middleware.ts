import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect all workspace routes to /auto
  if (pathname.startsWith("/workspaces")) {
    return NextResponse.redirect(new URL("/auto", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/workspaces/:path*",
};

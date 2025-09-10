import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow dossier routes to pass through without redirect
  if (pathname.includes('/dossier/')) {
    return NextResponse.next();
  }
  
  // Redirect other workspace routes to auto
  return NextResponse.redirect(
    new URL(`/auto${request.nextUrl.search}`, request.url),
    308,
  );
}

export const config = {
  matcher: "/workspaces/:path*",
};

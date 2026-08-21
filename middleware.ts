import type { NextRequest } from "next/server"
import { middleware as runMiddleware } from "@/lib/middleware"

export async function middleware(req: NextRequest) {
  return runMiddleware(req)
}

export const config = {
  matcher: [
    /*
     * Skip static assets, API routes, and the OAuth PKCE callback
     * (callback must keep the code-verifier cookie untouched).
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}

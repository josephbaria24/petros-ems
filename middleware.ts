import type { NextRequest } from "next/server"
import { middleware as runMiddleware } from "@/lib/middleware"

export async function middleware(req: NextRequest) {
  return runMiddleware(req)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

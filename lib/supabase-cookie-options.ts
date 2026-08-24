import type { NextResponse } from "next/server"

type CookieToSet = {
  name: string
  value: string
  options?: {
    path?: string
    domain?: string
    maxAge?: number
    expires?: Date
    httpOnly?: boolean
    secure?: boolean
    sameSite?: "lax" | "strict" | "none"
  }
}

/** Normalize cookies so Set-Cookie survives OAuth redirects on HTTPS and localhost. */
export function applyAuthCookies(response: NextResponse, cookiesToSet: CookieToSet[], isLocal: boolean) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, {
      ...options,
      path: options?.path ?? "/",
      sameSite: options?.sameSite ?? "lax",
      secure: isLocal ? false : (options?.secure ?? true),
    })
  })
}

export function copyResponseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie)
  })
}

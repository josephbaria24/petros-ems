"use client"

/** Remove leftover Supabase cookies/storage so PKCE can be saved and requests stay under the 431 header limit. */
export function clearSupabaseAuthStorage() {
  if (typeof document !== "undefined") {
    const names = document.cookie.split(";").map((part) => part.split("=")[0]?.trim())
    for (const name of names) {
      if (!name) continue
      if (
        name.startsWith("sb-") ||
        name.includes("-auth-token") ||
        name.includes("code-verifier")
      ) {
        document.cookie = `${name}=; Max-Age=0; path=/`
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
      }
    }
  }

  if (typeof localStorage !== "undefined") {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key) keys.push(key)
    }
    for (const key of keys) {
      if (key.startsWith("sb-") || key.includes("supabase")) {
        localStorage.removeItem(key)
      }
    }
  }

  if (typeof sessionStorage !== "undefined") {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i)
      if (key) keys.push(key)
    }
    for (const key of keys) {
      if (key.startsWith("sb-") || key.includes("supabase")) {
        sessionStorage.removeItem(key)
      }
    }
  }
}

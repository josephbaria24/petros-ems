//app\api\logout\route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options)
          } catch (error) {
            // Handle cookie setting errors
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch (error) {
            // Handle cookie removal errors
          }
        },
      },
    }
  )

  // Sign out from Supabase
  await supabase.auth.signOut()

  // Create response
  const response = NextResponse.json({ success: true }, { status: 200 })
  
  // Explicitly delete all Supabase auth cookies
  const cookieOptions = {
    path: '/',
    maxAge: 0,
  }
  
  // Delete common Supabase cookie names
  response.cookies.set('sb-access-token', '', cookieOptions)
  response.cookies.set('sb-refresh-token', '', cookieOptions)
  
  // Get all cookies that start with 'sb-' and delete them
  const allCookies = cookieStore.getAll()
  allCookies.forEach(cookie => {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', cookieOptions)
    }
  })

  return response
}
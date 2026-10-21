"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-client"
import { LoginForm } from "@/components/login-form"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        router.replace("/dashboard")
      } else {
        setCheckingSession(false)
      }
    }

    void checkSession()
  }, [router])

  if (checkingSession) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d1040]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFCC00]" />
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0d1040] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 15% 10%, rgba(255,204,0,0.18), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 85%, rgba(70,90,220,0.35), transparent 50%), linear-gradient(160deg, #0d1040 0%, #1A1D66 48%, #12153f 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col justify-center gap-8 px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:px-10 lg:py-12">
        <section className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-lg">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 shadow-lg shadow-black/20 ring-1 ring-white/40">
              <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-[#FFCC00]">
                Petrosphere Incorporated
              </p>
              <p className="truncate text-sm font-medium text-white/85">Training Management System</p>
            </div>
          </div>

          <h1 className="font-[family-name:var(--font-welcome)] text-[2.6rem] leading-[1.05] tracking-tight text-white sm:text-5xl">
            Welcome back
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">
            Sign in to manage schedules, certificates, and trainees in one place.
          </p>

          <div className="mt-8 rounded-3xl border border-white/15 bg-white/8 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-6">
            <p className="mb-4 text-sm font-medium text-white/90">Staff sign-in</p>
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-[11px] text-white/40 lg:text-left">
            © {new Date().getFullYear()} Petrosphere Incorporated
          </p>
        </section>

        <section className="relative mx-auto hidden w-full max-w-lg lg:block">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/12 to-white/[0.03] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#FFCC00]/20 blur-3xl" />
            <div className="absolute -bottom-16 -left-8 h-48 w-48 rounded-full bg-[#6b7cff]/25 blur-3xl" />

            <img
              src="/login.svg"
              alt="Training workflows illustration"
              className="relative z-10 mx-auto w-full max-w-md drop-shadow-xl"
            />

            <div className="relative z-10 mt-6 flex items-center gap-3 rounded-2xl border border-white/15 bg-[#1A1D66]/70 px-4 py-3 backdrop-blur">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#FFCC00] shadow-[0_0_12px_rgba(255,204,0,0.8)]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">Training Management System</p>
                <p className="truncate text-xs text-white/65">Schedules · Certificates · Trainees</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

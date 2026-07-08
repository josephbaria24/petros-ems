// app/layout.tsx
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { Dancing_Script } from "next/font/google"
import "./globals.css"
import "sileo/styles.css"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import AppShell from "@/components/app-shell"

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-welcome",
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: "Training Management System",
  description: "PETROSPHERE training scheduler and management platform",
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={dancingScript.variable} suppressHydrationWarning>
      <body className={GeistSans.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell>{children}</AppShell>
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
// app/layout.tsx
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner" // ✅ Fixed import
import AppShell from "@/components/app-shell"

const poppins = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Training Management System",
  description: "Professional training scheduler and management platform",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={poppins.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell>{children}</AppShell>
          <Toaster richColors position="top-right" /> {/* ✅ Optional config */}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

// app/layout.tsx
import type { Metadata, Viewport } from "next"
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
  applicationName: "Petrosphere TMS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Petrosphere TMS",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1A1D66" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1D66" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
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
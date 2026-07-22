/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Next.js 16 defaults to Turbopack — use turbopack config (not webpack)
  turbopack: {
    resolveAlias: {
      // Browser-only background removal (avoid Node onnxruntime/sharp)
      sharp: { browser: "./lib/empty-module.js" },
      "onnxruntime-node": { browser: "./lib/empty-module.js" },
    },
  },
  // Proxy IMG.LY model/wasm assets same-origin (CDN has no CORS ACAO headers)
  async rewrites() {
    return [
      {
        source: "/bg-removal-data/:path*",
        destination:
          "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/:path*",
      },
    ]
  },
}

export default nextConfig

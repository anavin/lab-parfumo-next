import type { NextConfig } from "next";

/**
 * Security headers — applied to every HTTP response.
 * Helps Chrome/Firefox treat the site as "legitimate" (less likely to
 * trigger Safe Browsing's deceptive-site warning on shared *.vercel.app).
 */
const securityHeaders = [
  // HSTS: enforce HTTPS for 1 year (Vercel serves HTTPS by default)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Block content sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Cross-origin referrer policy
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features we don't use
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Cross-origin opener / embedder
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // อนุญาตให้ส่งรูปได้สูงสุด 30 MB ต่อ request (~6 รูป × 5 MB)
      bodySizeLimit: "30mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

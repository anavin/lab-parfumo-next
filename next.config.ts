import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
};

export default nextConfig;

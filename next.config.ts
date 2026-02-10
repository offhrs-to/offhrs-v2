import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    localPatterns: [
      { pathname: '/categories/**' },
      { pathname: '/logo.png' },
    ],
  },
};

export default nextConfig;

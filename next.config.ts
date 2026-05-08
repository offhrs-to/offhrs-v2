import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent bundling of Cal.com Atoms server-side (uses browser-only APIs)
  serverExternalPackages: ['@calcom/atoms'],
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


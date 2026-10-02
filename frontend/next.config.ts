import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photos are admin-managed via ecobel-accounting-system and
    // may live on any storage host, plus the local API in dev — this
    // just allows next/image to optimize whatever image_url it's given.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
};

export default nextConfig;

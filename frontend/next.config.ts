import type { NextConfig } from "next";

// Product photos are stored in Supabase Storage and the API sends their full
// URLs (see backend app/product_images.py). Only that one host may go through
// the image optimizer — never "any https host", which would let anyone use
// this site to fetch and resize arbitrary images.
const productImageBase = process.env.NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL;
const productImages = productImageBase ? new URL(productImageBase) : null;
const isLocalImageHost = !!productImages && ["localhost", "127.0.0.1", "::1"].includes(productImages.hostname);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: productImages
      ? [{
          protocol: productImages.protocol.replace(":", "") as "http" | "https",
          hostname: productImages.hostname,
          port: productImages.port,
          pathname: `${productImages.pathname.replace(/\/$/, "")}/**`,
        }]
      : [],
    // Storage keys are unique per upload, so a photo URL never changes
    // content — resized copies can be cached for a long time.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Only for a storage server on this machine (local development).
    dangerouslyAllowLocalIP: isLocalImageHost,
  },
};

export default nextConfig;

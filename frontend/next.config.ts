import type { NextConfig } from "next";

const isProductionBuild = process.env.NODE_ENV === "production";

// A production build must know its public URL (canonical links, sitemap,
// structured data), its API, and where product photos live — never fall back
// to localhost or silently show every product without its photo.
// (Local `npm run build` gets them from .env.local.)
if (isProductionBuild) {
  for (const name of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_API_BASE", "NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL"]) {
    if (!process.env[name]) throw new Error(`${name} must be set for a production build (see frontend/.env.local.example).`);
  }
}

// Product photos are stored in Supabase Storage and the API sends their full
// URLs (see backend app/product_images.py). Only that one host may go through
// the image optimizer — never "any https host", which would let anyone use
// this site to fetch and resize arbitrary images.
const productImageBase = process.env.NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL;
const productImages = productImageBase ? new URL(productImageBase) : null;
const isLocalImageHost = !!productImages && ["localhost", "127.0.0.1", "::1"].includes(productImages.hostname);
const apiOrigin = process.env.NEXT_PUBLIC_API_BASE ? new URL(process.env.NEXT_PUBLIC_API_BASE).origin : null;
const siteIsHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

// Content-Security-Policy (production builds; dev mode needs eval). Scripts
// and styles only from this site — 'unsafe-inline' is required by Next's
// inline bootstrap without per-request nonces — but no third-party scripts,
// and data can only be sent to this site and the storefront API.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${productImages ? ` ${productImages.origin}` : ""}`,
  "font-src 'self'",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProductionBuild ? [{ key: "Content-Security-Policy", value: csp }] : []),
  ...(isProductionBuild && siteIsHttps ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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

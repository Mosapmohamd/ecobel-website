import type { Metadata } from "next";
import { Markazi_Text, Tajawal } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { AuthProvider } from "@/lib/auth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnnouncementBar from "@/components/AnnouncementBar";
import PromoBar from "@/components/PromoBar";
import JsonLd from "@/components/JsonLd";
import MetaPixel from "@/components/MetaPixel";
import ConsentBanner from "@/components/ConsentBanner";
import { validPixelId } from "@/lib/metaPixel";
import { ToastProvider } from "@/lib/toast";
import { getAnnouncementBar, getCategories } from "@/lib/server-api";
import { PROMO_DISMISS_KEY, SITE_CONTACT } from "@/lib/constants";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";

// Self-hosted at build time by next/font: no render-blocking request to
// Google Fonts, no layout shift while the Arabic faces load.
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});
const markazi = Markazi_Text({
  subsets: ["arabic", "latin"],
  weight: ["600", "700"],
  variable: "--font-markazi",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Eco Bel — متجر العناية بالبشرة والشعر",
    template: "%s | Eco Bel",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "ar_EG",
    siteName: SITE_NAME,
    title: "Eco Bel — متجر العناية بالبشرة والشعر",
    description: DEFAULT_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

// Meta Pixel: on only when NEXT_PUBLIC_META_PIXEL_ID holds a Pixel ID
// (lib/metaPixel.ts) — and then only after the visitor opts in (lib/consent.ts).
const META_PIXEL_ID = validPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetched once on the server for the header menu and footer (cached
  // briefly; categories carry no prices). null → they load it themselves.
  const [categories, announcement] = await Promise.all([getCategories(), getAnnouncementBar()]);

  return (
    // suppressHydrationWarning: the inline script below may add an attribute
    // to <html> before React hydrates.
    <html lang="ar" dir="rtl" className={`h-full ${tajawal.variable} ${markazi.variable}`} suppressHydrationWarning>
      <head>
        {/* Public marker for the admin's Integrations check (Pixel ID is public; tracking is opt-in). */}
        {META_PIXEL_ID && <meta name="ecobel-meta-pixel" content={META_PIXEL_ID} data-consent="opt-in" />}
        {/* Before first paint: hide the promo bar if it was dismissed this session (no flash, no shift). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem(${JSON.stringify(PROMO_DISMISS_KEY)})==='1')document.documentElement.setAttribute('data-promo-dismissed','')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="skip-link">تخطي إلى المحتوى</a>
        {META_PIXEL_ID && (
          <>
            {/* Before the page content, so a route's PageView goes out before its other events. */}
            <MetaPixel />
            {/* No <noscript> beacon: a visitor without JavaScript can't consent, so nothing is sent for them. */}
          </>
        )}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": absoluteUrl("/#organization"),
                name: SITE_NAME,
                url: SITE_URL,
                logo: absoluteUrl("/logo/ecobel-logo-black.png"),
                telephone: SITE_CONTACT.phone,
                address: { "@type": "PostalAddress", addressLocality: SITE_CONTACT.address, addressCountry: "EG" },
                sameAs: Object.values(SITE_CONTACT.social),
              },
              {
                "@type": "WebSite",
                "@id": absoluteUrl("/#website"),
                name: SITE_NAME,
                url: SITE_URL,
                inLanguage: "ar",
                publisher: { "@id": absoluteUrl("/#organization") },
                potentialAction: {
                  "@type": "SearchAction",
                  target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/products?q={search_term_string}") },
                  "query-input": "required name=search_term_string",
                },
              },
            ],
          }}
        />
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                {/* Above the promo bar, which holds the phone number. */}
                <AnnouncementBar settings={announcement} />
                <PromoBar />
                <Header initialCategories={categories} />
                <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
                <Footer initialCategories={categories} privacyControls={!!META_PIXEL_ID} />
                {META_PIXEL_ID && <ConsentBanner />}
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

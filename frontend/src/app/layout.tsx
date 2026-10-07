import type { Metadata } from "next";
import { Markazi_Text, Tajawal } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { AuthProvider } from "@/lib/auth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PromoBar from "@/components/PromoBar";
import { ToastProvider } from "@/lib/toast";

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
  title: "Eco Bel — متجر العناية بالبشرة والشعر",
  description: "منتجات طبيعية للعناية بالبشرة والشعر — شحن لكل المحافظات، دفع عند الاستلام.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`h-full ${tajawal.variable} ${markazi.variable}`}>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                <PromoBar />
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

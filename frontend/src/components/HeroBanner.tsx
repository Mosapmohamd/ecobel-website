import Link from 'next/link';
import ProductImage from './ProductImage';

export default function HeroBanner({
  imageUrl,
  imageAlt,
}: {
  imageUrl?: string | null;
  imageAlt?: string;
}) {
  return (
    <section style={{ background: 'var(--parchment)' }}>
      <div className="mx-auto max-w-6xl px-5 py-14 md:py-20 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 max-w-lg">
          <div className="text-sm font-bold mb-4" style={{ color: 'var(--sage)' }}>
            مكونات طبيعية · تركيبات آمنة
          </div>
          <h1
            className="text-5xl md:text-6xl leading-[1.1]"
            style={{ color: 'var(--ink)' }}
          >
            جمالك يبدأ من عناية نقية
          </h1>
          <p className="mt-5 text-[16.5px] leading-relaxed" style={{ color: 'var(--muted-strong)' }}>
            منتجات Eco Bel للعناية بالبشرة والشعر، مصنوعة من مكونات طبيعية لنتائج فعّالة تدوم.
          </p>
          <Link href="/products" className="btn btn-primary mt-8">
            تسوقي الآن
          </Link>
        </div>

        <div className="flex-1 w-full flex justify-center">
          {imageUrl ? (
            <div
              className="relative w-full max-w-sm aspect-[4/5] rounded-sm overflow-hidden"
              style={{ boxShadow: '0 20px 48px -20px rgba(36,37,34,0.35)' }}
            >
              <ProductImage src={imageUrl} alt={imageAlt ?? 'Eco Bel'} sizes="(max-width: 768px) 90vw, 420px" />
            </div>
          ) : (
            <div
              className="relative w-full max-w-sm aspect-[4/5] rounded-sm overflow-hidden"
              style={{
                background:
                  'radial-gradient(circle at 25% 20%, var(--gold-soft) 0%, transparent 55%), radial-gradient(circle at 80% 85%, var(--parchment-2) 0%, transparent 55%), linear-gradient(160deg, #fff 0%, var(--parchment) 100%)',
              }}
            >
              {/* No product photo yet — a composed arrangement of real,
                  already-stated brand facts (natural ingredients, the
                  wordmark) instead of an invented product graphic. */}
              <div
                className="absolute flex flex-col items-center justify-center rounded-full text-center"
                style={{
                  top: '12%',
                  insetInlineEnd: '10%',
                  width: '42%',
                  aspectRatio: '1',
                  background: 'var(--cream)',
                  boxShadow: '0 16px 32px -16px rgba(36,37,34,0.25)',
                }}
              >
                <span className="text-3xl font-bold" style={{ color: 'var(--forest)', fontFamily: 'var(--font-display)' }}>100%</span>
                <span className="text-[12px] font-bold mt-0.5" style={{ color: 'var(--forest-deep)' }}>طبيعي</span>
              </div>

              <div
                className="absolute flex items-center justify-center rounded-full"
                style={{
                  bottom: '22%',
                  insetInlineStart: '12%',
                  width: '24%',
                  aspectRatio: '1',
                  background: 'var(--parchment-2)',
                }}
              >
                <svg width="34%" height="34%" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.6">
                  <path d="M12 21c-4-2-7-6-7-11a9 9 0 0 1 9-5c0 6-2 11-2 16Z" />
                  <path d="M12 21c4-2 7-6 7-11" />
                </svg>
              </div>

              <div className="absolute inset-x-0 bottom-[8%] flex items-center justify-center">
                <span
                  className="text-3xl sm:text-4xl"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--forest)', opacity: 0.55 }}
                >
                  Eco Bel
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

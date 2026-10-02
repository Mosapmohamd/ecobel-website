import Link from 'next/link';
import ProductImage from './ProductImage';
import Icon from './Icon';

export default function HeroBanner({
  imageUrl,
  imageAlt,
}: {
  imageUrl?: string | null;
  imageAlt?: string;
}) {
  return (
    <section style={{ background: 'linear-gradient(180deg, var(--parchment) 0%, var(--cream) 100%)' }}>
      <div className="mx-auto max-w-6xl px-5 py-12 lg:py-20 flex flex-col md:flex-row items-center gap-10 lg:gap-14">
        <div className="flex-1 max-w-xl">
          <span
            className="inline-flex items-center gap-1.5 badge mb-5"
            style={{ background: 'var(--parchment-2)', color: 'var(--forest)' }}
          >
            <Icon name="leaf" size={13} />
            مكونات طبيعية · تركيبات آمنة
          </span>
          <h1 className="text-[40px] leading-[1.3] lg:text-[56px] lg:leading-[1.25] font-bold" style={{ color: 'var(--ink)' }}>
            جمالك يبدأ من عناية نقية
          </h1>
          <p className="mt-5 text-[17px] leading-[1.8]" style={{ color: 'var(--muted-strong)' }}>
            منتجات Eco Bel للعناية بالبشرة والشعر، مصنوعة من مكونات طبيعية لنتائج فعّالة تدوم.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/products" className="btn btn-primary px-8">
              تسوقي التشكيلة الآن
              <Icon name="arrowLeft" size={18} />
            </Link>
            <Link href="/about" className="text-[14.5px] font-bold link-underline py-1">
              تعرفي على قصتنا
            </Link>
          </div>
        </div>

        <div className="flex-1 w-full flex justify-center">
          <div className="relative w-full max-w-md">
            {imageUrl ? (
              <div className="relative w-full aspect-[4/5] rounded overflow-hidden border" style={{ borderColor: 'var(--line)' }}>
                <ProductImage src={imageUrl} alt={imageAlt ?? 'Eco Bel'} sizes="(max-width: 768px) 90vw, 450px" />
              </div>
            ) : (
              <div
                className="relative w-full aspect-[4/5] rounded overflow-hidden border flex items-center justify-center"
                style={{
                  borderColor: 'var(--line)',
                  background:
                    'radial-gradient(circle at 25% 20%, var(--parchment-2) 0%, transparent 55%), linear-gradient(160deg, #fff 0%, var(--parchment) 100%)',
                }}
              >
                {/* No product photo yet — the wordmark instead of an
                    invented product graphic. */}
                <span className="text-5xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--forest)', opacity: 0.5 }}>
                  Eco Bel
                </span>
              </div>
            )}

            {/* Floating seal card, overlapping the image edge like the Stitch hero. */}
            <div
              className="absolute -bottom-5 right-4 sm:-right-6 flex items-center gap-3 rounded border bg-white px-4 py-3"
              style={{ borderColor: 'var(--line)', boxShadow: '0 4px 16px -2px rgba(43,35,32,0.08)' }}
            >
              <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--parchment)', color: 'var(--ok)' }}>
                <Icon name="leaf" size={18} />
              </span>
              <div>
                <div className="text-[14px] font-bold">طبيعي 100%</div>
                <div className="text-[12px]" style={{ color: 'var(--muted)' }}>علامة مصرية</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

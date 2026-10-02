'use client';

import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { catalogApi, type Product, type Offer } from '@/lib/api';
import { useCart } from '@/lib/cart';
import ProductCard from '@/components/ProductCard';
import ProductImage from '@/components/ProductImage';
import ReviewsSection from '@/components/ReviewsSection';
import Icon, { type IconName } from '@/components/Icon';
import { useWishlist } from '@/lib/wishlist';
import { categoryLabel } from '@/lib/categories';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';

const GUARANTEES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'truck', title: 'شحن لكل المحافظات', text: `مجاني للطلبات فوق ${FREE_SHIPPING_THRESHOLD.toLocaleString('ar-EG')} ج.م` },
  { icon: 'cash', title: 'الدفع عند الاستلام', text: 'ادفعي لما الطلب يوصلك' },
  { icon: 'return', title: 'استبدال خلال 14 يوم', text: 'استبدال سهل بدون تعقيد' },
  { icon: 'leaf', title: 'مكونات طبيعية 100%', text: 'تركيبات آمنة بدون مواد ضارة' },
];

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [offer, setOffer] = useState<Offer | undefined>(undefined);
  const [related, setRelated] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const { has, toggle } = useWishlist();

  useEffect(() => {
    setProduct(null);
    setError(null);
    setQuantity(1);
    catalogApi
      .product(id)
      .then(setProduct)
      .catch(() => setError('المنتج غير موجود'));
    catalogApi.offers().then((offers) => setOffer(offers.find((o) => o.product_id === id))).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!product) return;
    catalogApi
      .products({ categoryId: product.category_id })
      .then((list) => setRelated(list.filter((p) => p.id !== product.id).slice(0, 4)))
      .catch(() => {});
  }, [product]);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 text-center">
        <p style={{ color: 'var(--muted)' }}>{error}</p>
        <Link href="/products" className="btn btn-secondary mt-4 inline-flex">الرجوع للمنتجات</Link>
      </div>
    );
  }

  if (!product) {
    return <div className="mx-auto max-w-6xl px-5 py-16" style={{ color: 'var(--muted)' }}>جاري التحميل...</div>;
  }

  const wished = has(product.id);
  const price = offer?.offer_price ?? product.sale_price;
  const percentOff = offer ? Math.round((1 - offer.offer_price / product.sale_price) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:py-10">
      <nav aria-label="مسار التصفح" className="text-[13px] mb-6 flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--muted)' }}>
        <Link href="/" className="hover:text-[var(--forest)] transition-colors">الرئيسية</Link>
        <Icon name="chevronLeft" size={14} />
        <Link href={`/products?category=${product.category_id}`} className="hover:text-[var(--forest)] transition-colors">
          {categoryLabel(product.category_name)}
        </Link>
        <Icon name="chevronLeft" size={14} />
        <span className="line-clamp-1" style={{ color: 'var(--ink)' }}>{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14 items-start">
        <div className="md:sticky md:top-24">
          <div className="relative aspect-square rounded overflow-hidden border" style={{ borderColor: 'var(--line)', background: 'var(--parchment)' }}>
            <ProductImage src={product.image_url} alt={product.name} sizes="(max-width: 768px) 100vw, 50vw" />
            <div className="absolute top-3 right-3 flex flex-col items-start gap-2">
              {offer && (
                <span className="badge" style={{ background: 'var(--rose)', color: '#fff' }}>
                  خصم {percentOff.toLocaleString('ar-EG')}%
                </span>
              )}
              <span className="badge flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--ok)' }}>
                <Icon name="leaf" size={13} />
                طبيعي 100%
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[12.5px] font-bold" style={{ color: 'var(--sage)' }}>{categoryLabel(product.category_name)}</div>
          <h1 className="text-[28px] lg:text-[36px] leading-[1.35] mt-1">{product.name}</h1>

          <div className="mt-3">
            {product.stock_status === 'ok' && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: 'var(--ok)' }}>
                <Icon name="checkCircle" size={16} />
                متوفر وجاهز للشحن
              </span>
            )}
            {product.stock_status === 'low' && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: 'var(--rose)' }}>
                <Icon name="box" size={16} />
                كمية محدودة — اطلبيه قبل ما يخلص
              </span>
            )}
            {product.stock_status === 'out' && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: 'var(--error)' }}>
                <Icon name="close" size={16} />
                نفدت الكمية
              </span>
            )}
          </div>

          <div className="mt-5 pb-5 border-b flex items-baseline flex-wrap gap-3" style={{ borderColor: 'var(--line)' }}>
            <span className="text-[30px] font-bold" style={{ color: offer ? 'var(--rose)' : 'var(--ink)' }}>
              {price.toLocaleString('ar-EG')} ج.م
            </span>
            {offer && (
              <>
                <span className="text-[16px] line-through" style={{ color: 'var(--muted)' }}>
                  {product.sale_price.toLocaleString('ar-EG')} ج.م
                </span>
                <span className="badge" style={{ background: 'var(--parchment-2)', color: 'var(--rose)' }}>
                  وفّري {(product.sale_price - offer.offer_price).toLocaleString('ar-EG')} ج.م
                </span>
              </>
            )}
          </div>

          {product.description && (
            <p className="mt-5 text-[15.5px] leading-[1.9] whitespace-pre-line" style={{ color: 'var(--muted-strong)' }}>
              {product.description}
            </p>
          )}

          {product.stock_status !== 'out' && (
            <div className="mt-7 flex items-stretch gap-3">
              <div className="flex items-center border rounded flex-none" style={{ borderColor: 'var(--line)' }}>
                <button
                  className="w-11 h-12 flex items-center justify-center disabled:opacity-40"
                  aria-label="زيادة الكمية"
                  disabled={quantity >= product.quantity}
                  onClick={() => setQuantity((q) => Math.min(product.quantity, q + 1))}
                >
                  <Icon name="plus" size={16} />
                </button>
                <span className="w-9 text-center font-bold">{quantity.toLocaleString('ar-EG')}</span>
                <button
                  className="w-11 h-12 flex items-center justify-center disabled:opacity-40"
                  aria-label="تقليل الكمية"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Icon name="minus" size={16} />
                </button>
              </div>
              <button
                className="btn btn-primary flex-1"
                onClick={() => {
                  add(offer ? { ...product, sale_price: offer.offer_price } : product, quantity);
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1800);
                }}
              >
                {added ? (
                  <>
                    <Icon name="check" size={18} strokeWidth={2.5} />
                    تمت الإضافة للسلة
                  </>
                ) : (
                  <>
                    <Icon name="bag" size={18} />
                    أضيفي للسلة — {(price * quantity).toLocaleString('ar-EG')} ج.م
                  </>
                )}
              </button>
              <button
                className="btn btn-secondary flex-none !px-0 w-12"
                aria-label={wished ? 'إزالة من المفضلة' : 'أضيفي للمفضلة'}
                aria-pressed={wished}
                onClick={() => toggle(product)}
                style={wished ? { color: 'var(--rose)', borderColor: 'var(--rose)' } : undefined}
              >
                <Icon name="heart" size={20} style={{ fill: wished ? 'currentColor' : 'none' }} />
              </button>
            </div>
          )}

          <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GUARANTEES.map((g) => (
              <div key={g.title} className="flex items-center gap-3 rounded border p-3" style={{ borderColor: 'var(--line)', background: 'var(--parchment)' }}>
                <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-none" style={{ color: 'var(--ok)' }}>
                  <Icon name={g.icon} size={18} />
                </span>
                <div>
                  <div className="text-[13.5px] font-bold">{g.title}</div>
                  <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{g.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ReviewsSection productId={product.id} />

      {related.length > 0 && (
        <section className="mt-20">
          <div className="flex items-end justify-between mb-8 gap-4">
            <div>
              <span className="kicker">قد يعجبك أيضًا</span>
              <h2 className="text-[28px] leading-tight">منتجات مشابهة</h2>
            </div>
            <Link
              href={`/products?category=${product.category_id}`}
              className="text-[13.5px] font-bold link-underline flex-none"
              style={{ color: 'var(--forest)' }}
            >
              كل {categoryLabel(product.category_name)}
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

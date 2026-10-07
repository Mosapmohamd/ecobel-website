'use client';

import { useCallback, useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { catalogApi, reviewApi, type Product, type ReviewSummary } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';
import { useToast } from '@/lib/toast';
import ProductCard from '@/components/ProductCard';
import ProductImage from '@/components/ProductImage';
import ReviewsSection, { Stars } from '@/components/ReviewsSection';
import Icon, { type IconName } from '@/components/Icon';
import { egp, FREE_SHIPPING_THRESHOLD } from '@/lib/constants';

/** Store-wide policies (the same ones the trust strip states). */
const GUARANTEES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'truck', title: 'شحن لكل المحافظات', text: `مجاني للطلبات فوق ${FREE_SHIPPING_THRESHOLD.toLocaleString('ar-EG')} ج.م` },
  { icon: 'cash', title: 'الدفع عند الاستلام', text: 'ادفعي لما الطلب يوصلك' },
  { icon: 'return', title: 'استبدال خلال 14 يوم', text: 'استبدال سهل بدون تعقيد' },
  { icon: 'leaf', title: 'مكونات طبيعية', text: 'تركيبات آمنة بدون مواد ضارة' },
];

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [state, setState] = useState<{ id: string; product: Product | null; error: string | null } | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<{ id: string; summary: ReviewSummary } | null>(null);
  const [qty, setQty] = useState<{ id: string; value: number }>({ id, value: 1 });
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    catalogApi
      .product(id)
      .then((product) => !cancelled && setState({ id, product, error: null }))
      .catch((err) => !cancelled && setState({ id, product: null, error: err instanceof Error ? err.message : 'المنتج غير موجود' }));
    catalogApi.related(id).then((r) => !cancelled && setRelated(r)).catch(() => !cancelled && setRelated([]));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadReviews = useCallback(() => {
    reviewApi.list(id).then((summary) => setReviews({ id, summary })).catch(() => {});
  }, [id]);
  useEffect(loadReviews, [loadReviews]);

  const current = state?.id === id ? state : null;
  const summary = reviews?.id === id ? reviews.summary : null;
  const quantity = qty.id === id ? qty.value : 1;

  if (current?.error || (current && !current.product)) {
    return (
      <div className="page-container py-16 text-center">
        <p className="text-body text-ink-muted">{current.error ?? 'المنتج غير موجود'}</p>
        <Link href="/products" className="btn btn-secondary mt-4 inline-flex">الرجوع للمنتجات</Link>
      </div>
    );
  }

  const product = current?.product;
  if (!product) {
    return (
      <div className="page-container py-12" aria-busy="true">
        <span className="sr-only" role="status">جاري التحميل...</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14 animate-pulse motion-reduce:animate-none" aria-hidden="true">
          <div className="aspect-square rounded bg-surface-tint" />
          <div className="flex flex-col gap-4">
            <div className="h-4 w-1/4 rounded bg-surface-muted" />
            <div className="h-9 w-3/4 rounded bg-surface-muted" />
            <div className="h-24 rounded bg-surface-tint" />
            <div className="h-12 rounded bg-surface-muted" />
          </div>
        </div>
      </div>
    );
  }

  const wished = has(product.id);
  const onOffer = product.price < product.sale_price;
  const percentOff = onOffer ? Math.round((1 - product.price / product.sale_price) * 100) : 0;
  const available = product.max_quantity > 0;
  const setQuantity = (value: number) => setQty({ id, value: Math.max(1, Math.min(product.max_quantity, value)) });

  return (
    <div>
      <section className="border-b border-line bg-surface-tint">
        <nav aria-label="مسار التصفح" className="page-container py-4 flex flex-wrap items-center gap-1.5 text-body-sm text-ink-muted">
          <Link href="/" className="hover:text-primary transition-colors">الرئيسية</Link>
          <Icon name="chevronLeft" size={14} />
          <Link href={`/products?category=${product.category_id}`} className="hover:text-primary transition-colors">{product.category_name}</Link>
          <Icon name="chevronLeft" size={14} />
          <span className="text-ink line-clamp-1" aria-current="page">{product.name}</span>
        </nav>
      </section>

      <div className="page-container py-8 lg:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14 items-start">
          <div className="md:sticky md:top-28">
            <div className="relative aspect-square rounded overflow-hidden border border-line bg-surface-tint">
              <ProductImage src={product.image_url} alt={product.name} sizes="(max-width: 767px) 100vw, 580px" preload />
              {percentOff > 0 && (
                <span className="absolute top-3 right-3 badge bg-sale text-surface">خصم {percentOff.toLocaleString('ar-EG')}%</span>
              )}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href={`/products?category=${product.category_id}`} className="text-label font-bold text-primary hover:underline">
                {product.category_name}
              </Link>
              {available ? (
                <span className={`badge ${product.stock_status === 'low' ? 'bg-surface-muted text-sale' : 'bg-success/15 text-success-strong'}`}>
                  <Icon name={product.stock_status === 'low' ? 'box' : 'checkCircle'} size={13} />
                  {product.stock_status === 'low' ? 'كمية محدودة' : 'متوفر وجاهز للشحن'}
                </span>
              ) : (
                <span className="badge bg-error/10 text-error">
                  <Icon name="close" size={13} />
                  نفدت الكمية
                </span>
              )}
            </div>
            <h1 className="mt-2 text-headline-md lg:text-headline-lg">{product.name}</h1>

            {summary && summary.review_count > 0 && (
              <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-body-sm">
                <Stars value={summary.average_rating} />
                <span className="font-bold">{summary.average_rating.toFixed(1)}</span>
                <span className="text-ink-muted underline">{summary.review_count.toLocaleString('ar-EG')} تقييم</span>
              </a>
            )}

            <div className="mt-6 rounded bg-surface-tint p-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className={`text-headline-md font-bold ${onOffer ? 'text-sale' : 'text-ink'}`}>{egp(product.price)}</span>
                {onOffer && (
                  <>
                    <span className="text-body line-through text-ink-muted">{egp(product.sale_price)}</span>
                    <span className="badge bg-sale text-surface">وفّري {egp(product.sale_price - product.price)}</span>
                  </>
                )}
              </div>
              {product.offer && <p className="mt-1 text-body-sm font-bold text-sale">{product.offer.title}</p>}
            </div>

            {product.description && (
              <p className="mt-6 text-body-lg text-ink-secondary whitespace-pre-line">{product.description}</p>
            )}

            {available ? (
              <div className="mt-7 flex items-stretch gap-3">
                <div className="flex items-center border border-line rounded flex-none">
                  <button
                    type="button"
                    className="w-11 h-12 flex items-center justify-center disabled:opacity-40"
                    aria-label="زيادة الكمية"
                    disabled={quantity >= product.max_quantity}
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Icon name="plus" size={16} />
                  </button>
                  <span className="w-9 text-center font-bold" aria-live="polite">{quantity.toLocaleString('ar-EG')}</span>
                  <button
                    type="button"
                    className="w-11 h-12 flex items-center justify-center disabled:opacity-40"
                    aria-label="تقليل الكمية"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity(quantity - 1)}
                  >
                    <Icon name="minus" size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-primary flex-1 min-w-0"
                  onClick={() => {
                    add(product.id, quantity);
                    setAdded(true);
                    setTimeout(() => setAdded(false), 1800);
                    toast.show(`تمت إضافة ${product.name} للسلة`, { action: { label: 'عرض السلة', href: '/cart' } });
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
                      <span className="truncate">أضيفي للسلة — {egp(product.price * quantity)}</span>
                    </>
                  )}
                </button>
                <WishlistButton wished={wished} name={product.name} onToggle={() => toggle(product.id)} />
              </div>
            ) : (
              <div className="mt-7 flex items-stretch gap-3">
                <p className="flex-1 notice notice-info">المنتج ده نفد حاليًا — ضيفيه للمفضلة عشان ترجعيله بسهولة.</p>
                <WishlistButton wished={wished} name={product.name} onToggle={() => toggle(product.id)} />
              </div>
            )}

            <ul className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GUARANTEES.map((g) => (
                <li key={g.title} className="flex items-center gap-3 rounded bg-surface-tint p-3">
                  <span className="w-9 h-9 rounded-full bg-surface flex items-center justify-center flex-none text-success">
                    <Icon name={g.icon} size={18} />
                  </span>
                  <span>
                    <span className="block text-label font-bold">{g.title}</span>
                    <span className="block text-label-sm text-ink-muted">{g.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16">
          <ReviewsSection productId={product.id} summary={summary} onSubmitted={loadReviews} />
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="section bg-surface-tint">
          <div className="page-container">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="kicker">من نفس الفئة</span>
                <h2 id="related-title" className="text-headline-md lg:text-headline-lg">منتجات مشابهة</h2>
              </div>
              <Link href={`/products?category=${product.category_id}`} className="text-label font-bold text-primary link-underline">
                كل {product.category_name}
              </Link>
            </div>
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function WishlistButton({ wished, name, onToggle }: { wished: boolean; name: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`btn btn-secondary flex-none !px-0 w-12 ${wished ? '!text-sale !border-sale' : ''}`}
      aria-label={wished ? `إزالة ${name} من المفضلة` : `إضافة ${name} للمفضلة`}
      aria-pressed={wished}
      onClick={onToggle}
    >
      <Icon name="heart" size={20} style={{ fill: wished ? 'currentColor' : 'none' }} />
    </button>
  );
}

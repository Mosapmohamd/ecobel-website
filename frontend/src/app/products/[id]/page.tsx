'use client';

import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { catalogApi, type Product, type Offer } from '@/lib/api';
import { useCart } from '@/lib/cart';
import ProductCard from '@/components/ProductCard';
import ProductImage from '@/components/ProductImage';
import ReviewsSection from '@/components/ReviewsSection';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [offer, setOffer] = useState<Offer | undefined>(undefined);
  const [related, setRelated] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { add } = useCart();

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

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <nav className="text-[13px] mb-6 flex items-center gap-2 flex-wrap" style={{ color: 'var(--muted)' }}>
        <Link href="/" className="hover:underline">الرئيسية</Link>
        <span>/</span>
        <Link href={`/products?category=${product.category_id}`} className="hover:underline">{product.category_name}</Link>
        <span>/</span>
        <span style={{ color: 'var(--ink)' }}>{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="relative aspect-square rounded overflow-hidden">
          <ProductImage src={product.image_url} alt={product.name} sizes="(max-width: 768px) 100vw, 50vw" />
        </div>

        <div>
          <div className="text-[13px] font-bold" style={{ color: 'var(--sage)' }}>{product.category_name}</div>
          <h1 className="text-3xl mt-2">{product.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-extrabold" style={{ color: 'var(--forest)' }}>
              {(offer?.offer_price ?? product.sale_price).toLocaleString('ar-EG')} ج.م
            </span>
            {offer && (
              <span className="text-[15px] line-through" style={{ color: 'var(--muted)' }}>
                {product.sale_price.toLocaleString('ar-EG')} ج.م
              </span>
            )}
            {offer && (
              <span className="badge" style={{ background: 'var(--rose)', color: '#fff' }}>
                خصم {Math.round((1 - offer.offer_price / product.sale_price) * 100)}%
              </span>
            )}
          </div>

          <div className="mt-3">
            {product.stock_status === 'ok' && <span className="badge" style={{ background: 'rgba(91,140,90,0.14)', color: 'var(--ok)' }}>متوفر</span>}
            {product.stock_status === 'low' && <span className="badge" style={{ background: 'rgba(201,134,42,0.15)', color: '#c9862a' }}>كمية محدودة</span>}
            {product.stock_status === 'out' && <span className="badge" style={{ background: 'rgba(179,38,30,0.14)', color: 'var(--error)' }}>نفذت الكمية</span>}
          </div>

          {product.description && (
            <p className="mt-5 text-[14.5px] leading-relaxed" style={{ color: 'var(--muted-strong)' }}>
              {product.description}
            </p>
          )}

          {product.stock_status !== 'out' && (
            <div className="mt-8 flex items-center gap-4">
              <div className="flex items-center border rounded" style={{ borderColor: 'var(--line)' }}>
                <button className="px-3 py-2" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
                <span className="px-4">{quantity}</span>
                <button className="px-3 py-2" onClick={() => setQuantity((q) => Math.min(product.quantity, q + 1))}>+</button>
              </div>
              <button
                className="btn btn-primary flex-1"
                onClick={() => {
                  add(offer ? { ...product, sale_price: offer.offer_price } : product, quantity);
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1800);
                }}
              >
                {added ? 'تمت الإضافة ✓' : 'أضيفي للسلة'}
              </button>
            </div>
          )}

          <div className="mt-8 grid grid-cols-2 gap-3 p-4 border rounded text-[13px]" style={{ borderColor: 'var(--line)', background: 'var(--cream)' }}>
            <div className="flex items-center gap-2"><span>🚚</span><span>شحن لكل المحافظات</span></div>
            <div className="flex items-center gap-2"><span>💵</span><span>الدفع عند الاستلام</span></div>
            <div className="flex items-center gap-2"><span>↩️</span><span>استبدال خلال 14 يوم</span></div>
            <div className="flex items-center gap-2"><span>🌿</span><span>مكونات طبيعية 100%</span></div>
          </div>
        </div>
      </div>

      <ReviewsSection productId={product.id} />

      {related.length > 0 && (
        <div className="mt-20">
          <h2 className="text-2xl mb-6">منتجات مشابهة</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

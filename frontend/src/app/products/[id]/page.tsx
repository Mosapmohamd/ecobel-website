'use client';

import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { catalogApi, type Product } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { ProductGlyph } from '@/components/ProductCard';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { add } = useCart();

  useEffect(() => {
    catalogApi
      .product(id)
      .then(setProduct)
      .catch(() => setError('المنتج غير موجود'));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 text-center">
        <p style={{ color: '#8a8074' }}>{error}</p>
        <Link href="/products" className="btn btn-secondary mt-4 inline-flex">الرجوع للمنتجات</Link>
      </div>
    );
  }

  if (!product) {
    return <div className="mx-auto max-w-6xl px-5 py-16" style={{ color: '#8a8074' }}>جاري التحميل...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 grid grid-cols-1 md:grid-cols-2 gap-12">
      <div className="aspect-square rounded-lg flex items-center justify-center" style={{ background: 'var(--parchment-2)' }}>
        <ProductGlyph name={product.name} />
      </div>

      <div>
        <div className="text-[13px] font-bold" style={{ color: 'var(--sage)' }}>{product.category_name}</div>
        <h1 className="text-3xl mt-2">{product.name}</h1>
        <div className="mt-4 text-2xl font-extrabold" style={{ color: 'var(--forest)' }}>
          {product.sale_price.toLocaleString('ar-EG')} ج.م
        </div>

        <div className="mt-3">
          {product.stock_status === 'ok' && <span className="badge" style={{ background: 'rgba(91,140,90,0.14)', color: 'var(--ok)' }}>متوفر</span>}
          {product.stock_status === 'low' && <span className="badge" style={{ background: 'rgba(201,134,42,0.15)', color: '#c9862a' }}>كمية محدودة</span>}
          {product.stock_status === 'out' && <span className="badge" style={{ background: 'rgba(201,123,138,0.18)', color: 'var(--rose)' }}>نفذت الكمية</span>}
        </div>

        {product.stock_status !== 'out' && (
          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center border rounded-md" style={{ borderColor: 'var(--line)' }}>
              <button className="px-3 py-2" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
              <span className="px-4">{quantity}</span>
              <button className="px-3 py-2" onClick={() => setQuantity((q) => Math.min(product.quantity, q + 1))}>+</button>
            </div>
            <button
              className="btn btn-primary flex-1"
              onClick={() => {
                add(product, quantity);
                setAdded(true);
                setTimeout(() => setAdded(false), 1800);
              }}
            >
              {added ? 'تمت الإضافة ✓' : 'أضيفي للسلة'}
            </button>
          </div>
        )}

        <div className="mt-10 pt-6 border-t text-[13.5px]" style={{ borderColor: 'var(--line)', color: '#8a8074' }}>
          <p>🚚 شحن لكل المحافظات — مجانًا فوق 1000 جنيه</p>
          <p className="mt-1">💵 الدفع عند الاستلام</p>
        </div>
      </div>
    </div>
  );
}

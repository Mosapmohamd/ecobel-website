'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { ProductGlyph } from '@/components/ProductCard';

export default function CartPage() {
  const { lines, remove, setQuantity, subtotal } = useCart();

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-20 text-center">
        <h1 className="text-2xl mb-3">السلة فاضية</h1>
        <p style={{ color: '#8a8074' }} className="mb-6">لسه ما ضفتيش حاجة للسلة.</p>
        <Link href="/products" className="btn btn-primary">تسوقي الآن</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl mb-8">سلة المشتريات</h1>

      <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
        {lines.map((line) => (
          <div key={line.product.id} className="flex items-center gap-4 p-4 border-b last:border-b-0" style={{ borderColor: 'var(--line)' }}>
            <div className="w-16 h-16 rounded-md flex items-center justify-center flex-none" style={{ background: 'var(--parchment-2)' }}>
              <ProductGlyph name={line.product.name} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{line.product.name}</div>
              <div className="text-sm" style={{ color: '#8a8074' }}>{line.product.sale_price.toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div className="flex items-center border rounded-md flex-none" style={{ borderColor: 'var(--line)' }}>
              <button className="px-2 py-1" onClick={() => setQuantity(line.product.id, line.quantity - 1)}>−</button>
              <span className="px-3">{line.quantity}</span>
              <button
                className="px-2 py-1"
                onClick={() => setQuantity(line.product.id, Math.min(line.product.quantity, line.quantity + 1))}
              >
                +
              </button>
            </div>
            <div className="w-24 text-left font-bold flex-none">
              {(line.product.sale_price * line.quantity).toLocaleString('ar-EG')} ج.م
            </div>
            <button onClick={() => remove(line.product.id)} aria-label="حذف" className="flex-none" style={{ color: 'var(--rose)' }}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-between items-center">
        <Link href="/products" className="text-sm font-bold" style={{ color: 'var(--forest)' }}>← إضافة منتجات أكتر</Link>
        <div className="text-left">
          <div className="text-sm" style={{ color: '#8a8074' }}>الإجمالي (قبل الشحن)</div>
          <div className="text-xl font-extrabold" style={{ color: 'var(--forest)' }}>{subtotal.toLocaleString('ar-EG')} ج.م</div>
        </div>
      </div>

      <Link href="/checkout" className="btn btn-primary w-full mt-6">إتمام الطلب</Link>
    </div>
  );
}

'use client';

import { useCart } from '@/lib/cart';
import { ProductGlyph } from './ProductCard';
import type { Offer } from '@/lib/api';

export default function OfferCard({ offer }: { offer: Offer }) {
  const { add } = useCart();
  const percentOff = Math.round((1 - offer.offer_price / offer.original_price) * 100);

  return (
    <div className="rounded-lg overflow-hidden border flex flex-col relative" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
      <span
        className="absolute top-2 right-2 badge z-10"
        style={{ background: 'var(--rose)', color: '#fff' }}
      >
        خصم {percentOff}%
      </span>
      <div className="aspect-square flex items-center justify-center" style={{ background: 'var(--parchment-2)' }}>
        <ProductGlyph name={offer.product_name} />
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="text-[11.5px] font-bold" style={{ color: 'var(--sage)' }}>{offer.title}</div>
        <div className="text-[15px] font-bold mt-1 leading-snug">{offer.product_name}</div>
        <div className="mt-auto pt-3 flex items-center gap-2">
          <span className="font-extrabold" style={{ color: 'var(--rose)' }}>
            {offer.offer_price.toLocaleString('ar-EG')} ج.م
          </span>
          <span className="text-[13px] line-through" style={{ color: '#8a8074' }}>
            {offer.original_price.toLocaleString('ar-EG')} ج.م
          </span>
        </div>
        <button
          className="btn btn-primary mt-3 w-full"
          onClick={() => add({
            id: offer.product_id,
            name: offer.product_name,
            category_id: '', category_name: '', sku: null,
            sale_price: offer.offer_price, quantity: 999, stock_status: 'ok',
            image_url: offer.image_url, description: null,
          }, 1)}
        >
          أضيفي للسلة
        </button>
      </div>
    </div>
  );
}

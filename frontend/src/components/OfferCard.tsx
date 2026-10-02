'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart';
import ProductImage from './ProductImage';
import Icon from './Icon';
import type { Offer } from '@/lib/api';

export default function OfferCard({ offer }: { offer: Offer }) {
  const { add } = useCart();
  const percentOff = Math.round((1 - offer.offer_price / offer.original_price) * 100);

  return (
    <div className="card card-hover group overflow-hidden flex flex-col relative">
      <Link href={`/products/${offer.product_id}`} className="relative block">
        <div className="relative aspect-square overflow-hidden" style={{ background: 'var(--parchment)' }}>
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
            <ProductImage src={offer.image_url} alt={offer.product_name} />
          </div>
        </div>
        <span className="absolute top-2.5 right-2.5 badge" style={{ background: 'var(--rose)', color: '#fff' }}>
          -{percentOff.toLocaleString('ar-EG')}%
        </span>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <div className="text-[11px] font-bold" style={{ color: 'var(--sage)' }}>{offer.title}</div>
        <Link
          href={`/products/${offer.product_id}`}
          className="text-[15px] font-bold mt-1 leading-snug line-clamp-2 transition-colors hover:text-[var(--forest)]"
        >
          {offer.product_name}
        </Link>
        <div className="mt-auto pt-3 flex items-baseline gap-2">
          <span className="text-[16px] font-bold" style={{ color: 'var(--rose)' }}>
            {offer.offer_price.toLocaleString('ar-EG')} ج.م
          </span>
          <span className="text-[13px] line-through" style={{ color: 'var(--muted)' }}>
            {offer.original_price.toLocaleString('ar-EG')} ج.م
          </span>
        </div>
        <button
          className="btn btn-primary btn-sm mt-3 w-full"
          onClick={() => add({
            id: offer.product_id,
            name: offer.product_name,
            category_id: '', category_name: '', sku: null,
            sale_price: offer.offer_price, quantity: 999, stock_status: 'ok',
            image_url: offer.image_url, description: null,
          }, 1)}
        >
          <Icon name="bag" size={17} />
          أضيفي للسلة
        </button>
      </div>
    </div>
  );
}

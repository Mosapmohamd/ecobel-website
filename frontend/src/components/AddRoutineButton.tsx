'use client';

import type { Routine } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useToast } from '@/lib/toast';
import Icon from './Icon';

/** Adds every product in a routine to the cart (one of each) — real
 * catalog products, priced by the server like any other cart line. */
export default function AddRoutineButton({ routine, className = '' }: { routine: Routine; className?: string }) {
  const { addMany } = useCart();
  const toast = useToast();

  if (!routine.is_available) {
    return (
      <button type="button" className={`btn btn-primary ${className}`} disabled>
        الروتين غير متاح حاليًا
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn btn-primary ${className}`}
      onClick={() => {
        addMany(routine.items.map((it) => ({ productId: it.product.id, quantity: 1 })));
        toast.show(`تمت إضافة روتين "${routine.name}" للسلة`, { action: { label: 'عرض السلة', href: '/cart' } });
      }}
    >
      <Icon name="bag" size={18} />
      أضيفي الروتين كامل للسلة
    </button>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';

const DISMISS_KEY = 'ecobel_promo_dismissed';

export default function PromoBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) !== '1') {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  return (
    <div className="relative py-2.5 flex items-center justify-center gap-6 text-sm font-semibold px-10" style={{ background: 'var(--forest)', color: 'var(--cream)' }}>
      <span>🚚 شحن لكل المحافظات — مجاني فوق {FREE_SHIPPING_THRESHOLD.toLocaleString('ar-EG')} ج.م</span>
      <span className="hidden sm:inline" style={{ color: 'rgba(255,255,255,0.85)' }} dir="ltr">01508582006</span>
      <button
        onClick={dismiss}
        aria-label="إغلاق"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-lg leading-none"
        style={{ color: 'var(--cream)' }}
      >
        ✕
      </button>
    </div>
  );
}

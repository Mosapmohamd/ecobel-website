'use client';

import { useEffect, useState } from 'react';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import Icon from './Icon';

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
    <div style={{ background: 'var(--berry)', color: 'var(--cream)' }}>
      <div className="mx-auto max-w-6xl px-5 py-2 flex items-center justify-between gap-4 text-[12.5px] font-medium">
        <span className="hidden sm:flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
          <Icon name="phone" size={14} />
          <span dir="ltr">01508582006</span>
        </span>
        <span className="flex items-center gap-1.5 mx-auto sm:mx-0">
          <Icon name="truck" size={15} />
          شحن لكل المحافظات — مجاني للطلبات فوق {FREE_SHIPPING_THRESHOLD.toLocaleString('ar-EG')} ج.م
        </span>
        <button onClick={dismiss} aria-label="إغلاق" className="flex-none opacity-80 hover:opacity-100 transition-opacity">
          <Icon name="close" size={15} />
        </button>
      </div>
    </div>
  );
}

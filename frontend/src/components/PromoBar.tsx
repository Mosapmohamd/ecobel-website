'use client';

import { useState, useSyncExternalStore } from 'react';
import { FREE_SHIPPING_THRESHOLD, PROMO_DISMISS_KEY, SITE_CONTACT } from '@/lib/constants';
import Icon from './Icon';


function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(PROMO_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}
const noSubscribe = () => () => {};

export default function PromoBar() {
  // Dismissal lasts for the browser session. The bar is in the server HTML
  // (so it paints immediately — it's often the largest text on screen); for
  // someone who already closed it, an inline script in the root layout hides
  // it with CSS before first paint, and React then removes it here.
  const storedDismissed = useSyncExternalStore(noSubscribe, readDismissed, () => false);
  const [dismissed, setDismissed] = useState(false);

  if (storedDismissed || dismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(PROMO_DISMISS_KEY, '1');
    } catch {
      // storage unavailable — dismissal just won't persist
    }
    setDismissed(true);
  }

  return (
    <div className="promo-bar bg-brand-deep text-surface">
      <div className="page-container py-2 flex items-center justify-between gap-4 text-label font-medium">
        <a href={SITE_CONTACT.phoneHref} className="hidden sm:flex items-center gap-1.5 text-surface/85 hover:text-surface transition-colors">
          <Icon name="phone" size={14} />
          <span dir="ltr">{SITE_CONTACT.phone}</span>
        </a>
        <span className="flex items-center gap-1.5 mx-auto sm:mx-0 text-center">
          <Icon name="truck" size={15} className="flex-none" />
          شحن لكل المحافظات — مجاني للطلبات فوق {FREE_SHIPPING_THRESHOLD.toLocaleString('ar-EG')} ج.م
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="إغلاق شريط العروض"
          className="flex-none -my-1 w-8 h-8 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
        >
          <Icon name="close" size={15} />
        </button>
      </div>
    </div>
  );
}

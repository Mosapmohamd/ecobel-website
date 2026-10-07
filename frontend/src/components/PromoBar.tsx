'use client';

import { useState, useSyncExternalStore } from 'react';
import { FREE_SHIPPING_THRESHOLD, SITE_CONTACT } from '@/lib/constants';
import Icon from './Icon';

const DISMISS_KEY = 'ecobel_promo_dismissed';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}
const noSubscribe = () => () => {};

export default function PromoBar() {
  // Dismissal lasts for the browser session. The server render (and the
  // first client paint) treat it as dismissed, so the bar never flashes
  // in and back out for someone who already closed it.
  const storedDismissed = useSyncExternalStore(noSubscribe, readDismissed, () => true);
  const [dismissed, setDismissed] = useState(false);

  if (storedDismissed || dismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // storage unavailable — dismissal just won't persist
    }
    setDismissed(true);
  }

  return (
    <div className="bg-brand-deep text-surface">
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

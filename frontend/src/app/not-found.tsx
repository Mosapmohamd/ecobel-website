import type { Metadata } from 'next';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { ROUTINES_PATH } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'الصفحة غير موجودة',
  robots: { index: false, follow: true },
};

/** 404 — unknown URLs, and products/routines that don't exist (or were removed). */
export default function NotFound() {
  return (
    <div className="page-container py-20 text-center">
      <span className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center bg-surface-tint text-primary">
        <Icon name="search" size={30} />
      </span>
      <h1 className="text-headline-md mb-2">الصفحة دي مش موجودة</h1>
      <p className="text-body text-ink-muted mb-7">
        يمكن الرابط اتغيّر أو المنتج مبقاش متاح. جرّبي تتصفحي المنتجات أو الروتينات.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/products" className="btn btn-primary">كل المنتجات</Link>
        <Link href={ROUTINES_PATH} className="btn btn-secondary">الروتينات</Link>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { ROUTINES_PATH } from '@/lib/constants';
import Icon from './Icon';

/** Last homepage section: one clear next step before the footer. */
export default function ClosingCta() {
  return (
    <section aria-labelledby="home-closing-cta" className="section bg-surface">
      <div className="page-container">
        <div className="rounded bg-brand-deep text-surface px-6 py-10 sm:px-10 lg:px-14 lg:py-14 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-xl">
            <span className="block text-label font-bold text-surface-muted mb-2">عناية طبيعية كل يوم</span>
            <h2 id="home-closing-cta" className="text-headline-md lg:text-headline-lg text-surface">ابدئي روتينك الطبيعي النهارده</h2>
            <p className="mt-3 text-body-lg text-surface/80">
              اختاري منتجاتك أو روتين جاهز متكامل، وادفعي عند الاستلام.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-none">
            <Link href="/products" className="btn btn-on-dark">
              تسوقي كل المنتجات
              <Icon name="arrowLeft" size={18} />
            </Link>
            <Link href={ROUTINES_PATH} className="btn btn-outline-on-dark">
              اكتشفي الروتينات
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

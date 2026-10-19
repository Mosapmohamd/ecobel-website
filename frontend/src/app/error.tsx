'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';

/** Unexpected error while rendering a page: an Arabic message and a retry —
 * never the technical details. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page-container py-20 text-center" role="alert">
      <span className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center bg-surface-tint text-error">
        <Icon name="alert" size={30} />
      </span>
      <h1 className="text-headline-md mb-2">حصلت مشكلة غير متوقعة</h1>
      <p className="text-body text-ink-muted mb-7">حاولي تاني بعد لحظات، ولو المشكلة فضلت كلمينا.</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button type="button" className="btn btn-primary" onClick={reset}>حاولي تاني</button>
        <Link href="/" className="btn btn-secondary">الرئيسية</Link>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { catalogApi, type Routine } from '@/lib/api';
import RoutineCard from '@/components/RoutineCard';
import Icon from '@/components/Icon';
import { ROUTINES_LABEL } from '@/lib/constants';

/** The routines catalog — every active routine (the homepage shows only
 * the two staff feature). */
export default function RoutinesClient({ initialRoutines }: { initialRoutines: Routine[] | null }) {
  const [routines, setRoutines] = useState<Routine[] | null>(initialRoutines);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initialRoutines && attempt === 0) return; // rendered on the server
    let cancelled = false;
    catalogApi
      .routines()
      .then((r) => {
        if (cancelled) return;
        setRoutines(r);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'تعذر تحميل الروتينات'));
    return () => {
      cancelled = true;
    };
  }, [attempt, initialRoutines]);

  return (
    <div>
      <section className="border-b border-line bg-surface-tint">
        <div className="page-container py-8">
          <nav aria-label="مسار التصفح" className="flex items-center gap-1.5 text-body-sm text-ink-muted mb-3">
            <Link href="/" className="hover:text-primary transition-colors">الرئيسية</Link>
            <Icon name="chevronLeft" size={14} />
            <span className="text-ink" aria-current="page">{ROUTINES_LABEL}</span>
          </nav>
          <h1 className="text-headline-md lg:text-headline-lg">روتين العناية المتكامل</h1>
          <p className="mt-2 text-body text-ink-muted max-w-2xl">
            خطوات متناغمة من منتجات Eco Bel — افتحي أي روتين عشان تشوفي منتجاته، أو أضيفيه كامل للسلة بضغطة واحدة.
          </p>
          {routines && (
            <p className="mt-1 text-body-sm text-ink-muted" role="status">{routines.length.toLocaleString('ar-EG')} روتين</p>
          )}
        </div>
      </section>

      <div className="page-container py-10">
        {error ? (
          <div role="alert" className="notice notice-error flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>
              حاولي تاني
            </button>
          </div>
        ) : routines === null ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8" aria-busy="true">
            <span className="sr-only" role="status">جاري تحميل الروتينات...</span>
            {[0, 1].map((i) => (
              <div key={i} className="card p-6 h-[420px] animate-pulse motion-reduce:animate-none bg-surface-tint" aria-hidden="true" />
            ))}
          </div>
        ) : routines.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-body text-ink-muted mb-5">مفيش روتينات متاحة حاليًا.</p>
            <Link href="/products" className="btn btn-secondary">تصفّحي كل المنتجات</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {routines.map((r) => <RoutineCard key={r.id} routine={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}

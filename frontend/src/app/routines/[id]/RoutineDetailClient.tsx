'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { catalogApi, type Routine } from '@/lib/api';
import ProductImage from '@/components/ProductImage';
import RoutineCard, { stepsLabel } from '@/components/RoutineCard';
import AddRoutineButton from '@/components/AddRoutineButton';
import Icon from '@/components/Icon';
import { egp, ROUTINES_LABEL, ROUTINES_PATH } from '@/lib/constants';

/** The routine page's interactive part; the server passes what it already
 * fetched (anything missing is loaded here, as before). */
export default function RoutineDetailClient({
  id,
  initialRoutine,
  initialRoutines,
}: {
  id: string;
  initialRoutine: Routine | null;
  initialRoutines: Routine[] | null;
}) {
  const [state, setState] = useState<{ id: string; routine: Routine | null; error: string | null } | null>(
    initialRoutine ? { id, routine: initialRoutine, error: null } : null,
  );
  const [others, setOthers] = useState<Routine[]>((initialRoutines ?? []).filter((r) => r.id !== id).slice(0, 2));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!initialRoutine || attempt > 0) {
      catalogApi
        .routine(id)
        .then((routine) => !cancelled && setState({ id, routine, error: null }))
        .catch((err) => !cancelled && setState({ id, routine: null, error: err instanceof Error ? err.message : 'الروتين غير موجود' }));
    }
    if (!initialRoutines) {
      catalogApi.routines().then((all) => !cancelled && setOthers(all.filter((r) => r.id !== id).slice(0, 2))).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [id, initialRoutine, initialRoutines, attempt]);

  const current = state?.id === id ? state : null;

  if (current?.error || (current && !current.routine)) {
    return (
      <div className="page-container py-16 text-center">
        <p role="alert" className="text-body text-ink-muted">{current.error ?? 'الروتين غير موجود'}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {current.error && (
            <button type="button" className="btn btn-primary" onClick={() => { setState(null); setAttempt((a) => a + 1); }}>
              حاولي تاني
            </button>
          )}
          <Link href={ROUTINES_PATH} className="btn btn-secondary inline-flex">كل الروتينات</Link>
        </div>
      </div>
    );
  }

  const routine = current?.routine;
  if (!routine) {
    return (
      <div className="page-container py-12" aria-busy="true">
        <span className="sr-only" role="status">جاري التحميل...</span>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse motion-reduce:animate-none" aria-hidden="true">
          <div className="aspect-square rounded bg-surface-tint" />
          <div className="flex flex-col gap-4">
            <div className="h-8 w-2/3 rounded bg-surface-muted" />
            <div className="h-4 w-full rounded bg-surface-muted" />
            <div className="h-40 rounded bg-surface-tint" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="border-b border-line bg-surface-tint">
        <nav aria-label="مسار التصفح" className="page-container py-4 flex flex-wrap items-center gap-1.5 text-body-sm text-ink-muted">
          <Link href="/" className="hover:text-primary transition-colors">الرئيسية</Link>
          <Icon name="chevronLeft" size={14} />
          <Link href={ROUTINES_PATH} className="hover:text-primary transition-colors">{ROUTINES_LABEL}</Link>
          <Icon name="chevronLeft" size={14} />
          <span className="text-ink line-clamp-1" aria-current="page">{routine.name}</span>
        </nav>
      </section>

      <div className="page-container py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-start">
        {/* Image area: the routine's products side by side. */}
        <div className="lg:sticky lg:top-28 grid grid-cols-2 gap-3">
          {routine.items.map((it, i) => (
            <Link
              key={it.product.id}
              href={`/products/${it.product.id}`}
              className={`relative aspect-square rounded overflow-hidden border border-line bg-surface-tint ${routine.items.length === 3 && i === 0 ? 'col-span-2 aspect-[2/1]' : ''}`}
              aria-label={it.product.name}
            >
              <ProductImage src={it.product.image_url} alt="" sizes="(max-width: 1024px) 50vw, 25vw" />
            </Link>
          ))}
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 text-label font-bold text-success-strong">
            <Icon name="checkCircle" size={16} />
            روتين من {stepsLabel(routine.items.length)}
          </span>
          <h1 className="mt-2 text-headline-md lg:text-headline-lg">{routine.name}</h1>
          {routine.description && <p className="mt-3 text-body-lg text-ink-secondary">{routine.description}</p>}

          <div className="mt-6 rounded bg-surface-tint p-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-headline-md font-bold text-primary">{egp(routine.total)}</span>
              {routine.savings > 0 && (
                <>
                  <span className="text-body line-through text-ink-muted">{egp(routine.regular_total)}</span>
                  <span className="badge bg-brand-deep text-surface">وفّري {egp(routine.savings)}</span>
                </>
              )}
            </div>
            <p className="mt-1 text-body-sm text-ink-muted">سعر منتجات الروتين كاملة بالأسعار الحالية.</p>
            {!routine.is_available && (
              <p role="status" className="mt-3 text-body-sm font-bold text-error">
                منتج أو أكتر في الروتين ده مش متاح دلوقتي، فمش هينفع تضيفيه كامل للسلة.
              </p>
            )}
          </div>

          <h2 className="mt-8 mb-4 text-headline-sm">منتجات الروتين</h2>
          <ol className="flex flex-col gap-3">
            {routine.items.map((it, i) => {
              const available = it.product.max_quantity > 0;
              return (
                <li key={it.product.id} className="card flex items-center gap-4 p-3">
                  <span className="w-7 h-7 flex-none rounded-full bg-surface-muted text-primary text-label font-bold flex items-center justify-center">
                    {(i + 1).toLocaleString('ar-EG')}
                  </span>
                  <Link href={`/products/${it.product.id}`} className="relative w-16 h-16 flex-none rounded overflow-hidden bg-surface-tint" tabIndex={-1} aria-hidden="true">
                    <ProductImage src={it.product.image_url} alt="" sizes="64px" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <span className="block text-label-sm text-ink-muted">{it.product.category_name}</span>
                    <Link href={`/products/${it.product.id}`} className="block font-bold text-body leading-snug hover:text-primary transition-colors">
                      {it.product.name}
                    </Link>
                    {!available && <span className="block text-body-sm text-error">غير متاح حاليًا</span>}
                  </div>
                  <span className="flex-none text-left">
                    <span className={`block font-bold ${it.price < it.regular_price ? 'text-brand-deep' : ''}`}>{egp(it.price)}</span>
                    {it.price < it.regular_price && <span className="block text-body-sm line-through text-ink-muted">{egp(it.regular_price)}</span>}
                  </span>
                </li>
              );
            })}
          </ol>

          <AddRoutineButton routine={routine} className="w-full mt-6" />
          <Link href={ROUTINES_PATH} className="mt-4 inline-flex items-center gap-1.5 text-label font-bold text-primary link-underline">
            كمّلي تصفح الروتينات
            <Icon name="arrowLeft" size={15} />
          </Link>
        </div>
      </div>

      {others.length > 0 && (
        <section aria-labelledby="other-routines" className="section bg-surface-tint">
          <div className="page-container">
            <h2 id="other-routines" className="mb-8 text-headline-md lg:text-headline-lg">روتينات تانية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {others.map((r) => <RoutineCard key={r.id} routine={r} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

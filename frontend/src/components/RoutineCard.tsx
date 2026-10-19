'use client';

import Link from 'next/link';
import { egp, ROUTINES_PATH } from '@/lib/constants';
import type { Routine } from '@/lib/api';
import ProductImage from './ProductImage';
import Icon from './Icon';
import AddRoutineButton from './AddRoutineButton';

/** "روتين من ٣ خطوات" / "روتين من خطوتين" — Arabic dual and plural. */
export function stepsLabel(n: number): string {
  if (n === 1) return 'خطوة واحدة';
  if (n === 2) return 'خطوتين';
  if (n <= 10) return `${n.toLocaleString('ar-EG')} خطوات`;
  return `${n.toLocaleString('ar-EG')} خطوة`;
}

/** Routine tile — homepage featured routines and the routines catalog. */
export default function RoutineCard({ routine }: { routine: Routine }) {
  const href = `${ROUTINES_PATH}/${routine.id}`;

  return (
    <article className="card card-hover p-5 sm:p-6 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-label font-bold text-success-strong">
          <Icon name="checkCircle" size={16} />
          روتين من {stepsLabel(routine.items.length)}
        </span>
        {routine.savings > 0 && (
          <span className="badge bg-surface-muted text-brand-deep">وفّري {egp(routine.savings)}</span>
        )}
      </div>

      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="grid gap-2 mt-4"
        style={{ gridTemplateColumns: `repeat(${Math.min(routine.items.length, 3) || 1}, minmax(0, 1fr))` }}
      >
        {routine.items.slice(0, 3).map((it) => (
          <span key={it.product.id} className="relative block aspect-square rounded overflow-hidden bg-surface-tint">
            <ProductImage src={it.product.image_url} alt="" sizes="(max-width: 768px) 30vw, 180px" />
          </span>
        ))}
      </Link>

      <h3 className="mt-5 text-headline-sm leading-snug">
        <Link href={href} className="transition-colors hover:text-primary">{routine.name}</Link>
      </h3>
      {routine.description && <p className="mt-1.5 text-body-sm text-ink-muted line-clamp-2">{routine.description}</p>}

      <ol className="mt-4 flex flex-col gap-2.5">
        {routine.items.map((it, i) => (
          <li key={it.product.id} className="flex items-center gap-3 text-body-sm">
            <span className="w-6 h-6 flex-none rounded-full bg-surface-muted text-primary text-label-sm font-bold flex items-center justify-center">
              {(i + 1).toLocaleString('ar-EG')}
            </span>
            <span className="flex-1 min-w-0">{it.product.name}</span>
            <span className={`flex-none ${it.price < it.regular_price ? 'text-brand-deep' : 'text-ink-muted'}`}>{egp(it.price)}</span>
          </li>
        ))}
      </ol>

      <div className="mt-auto pt-5">
        <div className="pt-4 mb-4 border-t border-line flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="block text-label text-ink-muted">سعر الروتين كامل</span>
            <span className="text-headline-sm font-bold text-primary">{egp(routine.total)}</span>
            {routine.savings > 0 && <span className="mr-2 text-body-sm line-through text-ink-muted">{egp(routine.regular_total)}</span>}
          </div>
          <Link href={href} className="text-label font-bold text-primary link-underline">تفاصيل الروتين</Link>
        </div>
        <AddRoutineButton routine={routine} className="w-full" />
      </div>
    </article>
  );
}

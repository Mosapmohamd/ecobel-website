'use client';

import { useEffect, useMemo, useState } from 'react';
import { reviewApi, type Review } from '@/lib/api';
import { Stars } from './ReviewsSection';

type Status = 'loading' | 'ready' | 'empty' | 'error';

/** Homepage social proof — pulls a few real approved reviews from the
 * existing per-product review endpoint. Fetches independently of the rest
 * of the homepage so a slow/failed request never blocks page render, and
 * renders nothing (not an error, not a fake empty-state banner) unless it
 * has real reviews to show. */
export default function HomeReviews({ productIds }: { productIds: string[] }) {
  const ids = useMemo(() => productIds.slice(0, 3), [productIds]);
  const [status, setStatus] = useState<Status>(ids.length === 0 ? 'empty' : 'loading');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;

    Promise.allSettled(ids.map((id) => reviewApi.list(id)))
      .then((results) => {
        if (cancelled) return;
        const summaries = results
          .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof reviewApi.list>>> => r.status === 'fulfilled')
          .map((r) => r.value);

        const allReviews = summaries.flatMap((s) => s.reviews);
        const weightedTotal = summaries.reduce((sum, s) => sum + s.review_count, 0);
        const weightedAverage = weightedTotal > 0
          ? summaries.reduce((sum, s) => sum + s.average_rating * s.review_count, 0) / weightedTotal
          : 0;

        const withComments = allReviews.filter((r) => r.comment && r.comment.trim().length > 0);
        const picked = (withComments.length > 0 ? withComments : allReviews).slice(0, 3);

        if (picked.length === 0) {
          setStatus('empty');
          return;
        }
        setReviews(picked);
        setAverage(weightedAverage);
        setTotal(weightedTotal);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [ids]);

  if (status !== 'ready') return null;

  return (
    <section style={{ background: 'var(--parchment)' }}>
      <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
        <div>
          <span className="kicker">عميلاتنا بيحكوا</span>
          <h2 className="text-[28px] lg:text-[34px] leading-tight">آراء حقيقية من عميلاتنا</h2>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-2">
            <Stars value={average} size={18} />
            <span className="text-[14px] font-bold">{average.toFixed(1)}</span>
            <span className="text-[13px]" style={{ color: 'var(--muted)' }}>({total.toLocaleString('ar-EG')} تقييم)</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {reviews.map((r) => (
          <div key={r.id} className="card p-6">
            <Stars value={r.rating} />
            {r.comment && (
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                {r.comment}
              </p>
            )}
            <div className="mt-4 pt-3 border-t text-[13.5px] font-bold" style={{ borderColor: 'var(--line)' }}>
              {r.customer_name}
            </div>
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}

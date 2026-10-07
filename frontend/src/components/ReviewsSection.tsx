'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { reviewApi, type ReviewSummary } from '@/lib/api';
import Icon from './Icon';

/** Star row. Rounds to the nearest half-star visually via the label, and
 * to the nearest whole star in the glyphs. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span role="img" aria-label={`${value.toLocaleString('ar-EG', { maximumFractionDigits: 1 })} من ٥ نجوم`} className="text-accent" style={{ fontSize: size, letterSpacing: 1 }}>
      <span aria-hidden="true">{'★'.repeat(full)}</span>
      <span aria-hidden="true" className="text-line">{'★'.repeat(5 - full)}</span>
    </span>
  );
}

/** Product-page reviews: approved reviews only (server-side), and the
 * form only for customers who actually ordered the product. */
export default function ReviewsSection({
  productId,
  summary,
  onSubmitted,
}: {
  productId: string;
  summary: ReviewSummary | null;
  onSubmitted: () => void;
}) {
  const { customer, token } = useAuth();
  const eligibilityKey = token ? `${productId}|${token}` : null;
  const [eligibility, setEligibility] = useState<{ key: string; canReview: boolean; reason: string | null } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !eligibilityKey) return;
    let cancelled = false;
    reviewApi
      .eligibility(productId, token)
      .then((res) => !cancelled && setEligibility({ key: eligibilityKey, canReview: res.can_review, reason: res.reason }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productId, token, eligibilityKey]);

  const current = eligibility?.key === eligibilityKey ? eligibility : null;
  const canReview = !!current?.canReview && !submitted;
  const reason = current?.reason ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await reviewApi.create(productId, { rating, comment: comment || undefined }, token);
      setSubmitted(true);
      setShowForm(false);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حصل خطأ أثناء إرسال التقييم');
    } finally {
      setSubmitting(false);
    }
  }

  // The star breakdown is computed from the returned reviews, so it's only
  // shown when they're the full set.
  const hasFullSet = !!summary && summary.review_count > 0 && summary.reviews.length === summary.review_count;
  const distribution = [5, 4, 3, 2, 1].map((n) => ({
    n,
    pct: hasFullSet && summary ? Math.round((summary.reviews.filter((r) => Math.round(r.rating) === n).length / summary.review_count) * 100) : 0,
  }));

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-28">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-8 pb-6 border-b border-line">
        <div>
          <span className="kicker">تجارب حقيقية</span>
          <h2 id="reviews-title" className="text-headline-md lg:text-headline-lg">تقييمات العملاء</h2>
        </div>
        {!customer && (
          <Link href="/account/login" className="text-label font-bold text-primary link-underline">
            سجّلي دخولك عشان تقيّمي
          </Link>
        )}
        {customer && canReview && !showForm && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(true)}>اكتبي تقييمك</button>
        )}
        {customer && !canReview && reason && !submitted && <span className="text-body-sm text-ink-muted">{reason}</span>}
        {submitted && (
          <span role="status" className="inline-flex items-center gap-1.5 text-body-sm font-bold text-success-strong">
            <Icon name="checkCircle" size={16} />
            تم إرسال تقييمك، هيظهر بعد المراجعة
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
        <div className="rounded bg-surface-tint p-6">
          {summary && summary.review_count > 0 ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[44px] font-bold leading-none text-primary">{summary.average_rating.toFixed(1)}</span>
                <span className="text-body-sm text-ink-muted">من 5</span>
              </div>
              <div className="mt-2"><Stars value={summary.average_rating} size={18} /></div>
              <div className="text-body-sm mt-1 text-ink-muted">{summary.review_count.toLocaleString('ar-EG')} تقييم</div>
              {hasFullSet && (
                <div className="mt-5 flex flex-col gap-2">
                  {distribution.map(({ n, pct }) => (
                    <div key={n} className="flex items-center gap-2 text-body-sm">
                      <span className="w-14 flex-none">{n.toLocaleString('ar-EG')} نجوم</span>
                      <span className="flex-1 h-1.5 rounded-sm overflow-hidden bg-line">
                        <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-10 text-left flex-none text-ink-muted">{pct.toLocaleString('ar-EG')}%</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-body-sm text-ink-muted">{summary ? 'مفيش تقييمات لسه — كوني أول من يقيّم.' : 'جاري تحميل التقييمات...'}</p>
          )}
        </div>

        <div>
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-5 rounded border border-line bg-surface">
              <h3 className="text-headline-sm mb-4">شاركينا تجربتك</h3>
              {error && <div role="alert" className="notice notice-error mb-3">{error}</div>}
              <div className="mb-4">
                <span id="review-rating-label" className="block text-label font-bold mb-2">تقييمك</span>
                <div role="group" aria-labelledby="review-rating-label" className="flex gap-1 text-2xl text-accent">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setRating(n)}
                      aria-label={`${n.toLocaleString('ar-EG')} من ٥`}
                      aria-pressed={n === rating}
                      className="w-10 h-10 flex items-center justify-center rounded"
                    >
                      {n <= rating ? '★' : <span className="text-line">★</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field mb-4">
                <label htmlFor="review-comment">تعليقك (اختياري)</label>
                <textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'جاري الإرسال...' : 'إرسال التقييم'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>إلغاء</button>
              </div>
            </form>
          )}

          {summary && summary.reviews.length > 0 && (
            <ul className="flex flex-col gap-4">
              {summary.reviews.map((r) => (
                <li key={r.id} className="card p-5">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="font-bold text-label-lg">{r.customer_name}</span>
                    <span className="text-label-sm text-ink-muted">{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <Stars value={r.rating} />
                  {r.comment && <p className="mt-2 text-body text-ink-secondary">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { reviewApi, type ReviewSummary } from '@/lib/api';

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 1, color: 'var(--gold)' }}>
      {'★'.repeat(Math.round(value))}
      <span style={{ color: 'var(--line)' }}>{'★'.repeat(5 - Math.round(value))}</span>
    </span>
  );
}

export default function ReviewsSection({ productId }: { productId: string }) {
  const { customer, token } = useAuth();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadSummary() {
    reviewApi.list(productId).then(setSummary).catch(() => {});
  }
  useEffect(loadSummary, [productId]);

  useEffect(() => {
    if (token) {
      reviewApi.eligibility(productId, token).then((res) => {
        setCanReview(res.can_review);
        setReason(res.reason);
      }).catch(() => {});
    } else {
      setCanReview(false);
      setReason(null);
    }
  }, [productId, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await reviewApi.create(productId, { rating, comment: comment || undefined }, token);
      setSubmitted(true);
      setShowForm(false);
      setCanReview(false);
      loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حصل خطأ أثناء إرسال التقييم');
    } finally {
      setSubmitting(false);
    }
  }

  // Star breakdown is computed from the returned reviews, so it's only
  // shown when they're the full set — never a partial sample presented as
  // the product's whole distribution.
  const hasFullSet = !!summary && summary.review_count > 0 && summary.reviews.length === summary.review_count;
  const distribution = [5, 4, 3, 2, 1].map((n) => ({
    n,
    pct: hasFullSet && summary
      ? Math.round((summary.reviews.filter((r) => Math.round(r.rating) === n).length / summary.review_count) * 100)
      : 0,
  }));

  return (
    <section className="mt-16 pt-12 border-t" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
        <div>
          <span className="kicker">تجارب حقيقية</span>
          <h2 className="text-[28px] leading-tight">تقييمات العملاء</h2>
        </div>
        {!customer && (
          <Link href="/account/login" className="text-[13.5px] font-bold link-underline" style={{ color: 'var(--forest)' }}>
            سجّلي دخولك عشان تقيّمي
          </Link>
        )}
        {customer && canReview && !showForm && !submitted && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(true)}>اكتبي تقييمك</button>
        )}
        {customer && !canReview && reason && !submitted && (
          <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{reason}</span>
        )}
        {submitted && (
          <span className="text-[13px] font-bold" style={{ color: 'var(--ok)' }}>تم إرسال تقييمك، هيظهر بعد المراجعة ✓</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 items-start">
        <div className="rounded border p-6" style={{ background: 'var(--parchment)', borderColor: 'var(--line)' }}>
          {summary && summary.review_count > 0 ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-[44px] font-bold leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  {summary.average_rating.toFixed(1)}
                </span>
                <span className="text-[13px]" style={{ color: 'var(--muted)' }}>من 5</span>
              </div>
              <div className="mt-2"><Stars value={summary.average_rating} size={18} /></div>
              <div className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
                {summary.review_count.toLocaleString('ar-EG')} تقييم
              </div>
              {hasFullSet && (
                <div className="mt-5 flex flex-col gap-2">
                  {distribution.map(({ n, pct }) => (
                    <div key={n} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-12 flex-none">{n.toLocaleString('ar-EG')} نجوم</span>
                      <span className="flex-1 h-1.5 rounded-sm overflow-hidden" style={{ background: 'var(--line)' }}>
                        <span className="block h-full" style={{ width: `${pct}%`, background: 'var(--forest)' }} />
                      </span>
                      <span className="w-9 text-left flex-none" style={{ color: 'var(--muted)' }}>{pct.toLocaleString('ar-EG')}%</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>مفيش تقييمات لسه — كوني أول من يقيّم.</p>
          )}
        </div>

        <div>
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-5 rounded border" style={{ borderColor: 'var(--line)', background: 'var(--cream)' }}>
              <h3 className="text-[20px] mb-4">شاركينا تجربتك</h3>
              {error && (
                <div className="rounded p-3 mb-3 text-[13px]" style={{ background: 'rgba(186,26,26,0.08)', color: 'var(--error)' }}>
                  {error}
                </div>
              )}
              <div className="mb-4">
                <label className="block text-[13px] font-bold mb-2">تقييمك</label>
                <div className="flex gap-1 text-2xl" style={{ color: 'var(--gold)' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} نجوم`}>
                      {n <= rating ? '★' : <span style={{ color: 'var(--line)' }}>★</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field mb-4">
                <label>تعليقك (اختياري)</label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} />
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary" disabled={submitting}>{submitting ? 'جاري الإرسال...' : 'إرسال التقييم'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>إلغاء</button>
              </div>
            </form>
          )}

          {summary && summary.reviews.length > 0 && (
            <div className="flex flex-col gap-4">
              {summary.reviews.map((r) => (
                <div key={r.id} className="card p-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[14.5px]">{r.customer_name}</span>
                    <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <Stars value={r.rating} />
                  {r.comment && <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--muted-strong)' }}>{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

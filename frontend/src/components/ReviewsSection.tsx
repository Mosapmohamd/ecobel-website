'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { reviewApi, type ReviewSummary } from '@/lib/api';

function Stars({ value, size = 16 }: { value: number; size?: number }) {
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

  return (
    <div className="mt-16 pt-10 border-t" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-2xl mb-1">تقييمات العملاء</h2>
          {summary && summary.review_count > 0 ? (
            <div className="flex items-center gap-2">
              <Stars value={summary.average_rating} size={18} />
              <span className="text-[14px] font-bold">{summary.average_rating.toFixed(1)}</span>
              <span className="text-[13px]" style={{ color: '#8a8074' }}>({summary.review_count.toLocaleString('ar-EG')} تقييم)</span>
            </div>
          ) : (
            <p className="text-[13.5px]" style={{ color: '#8a8074' }}>مفيش تقييمات لسه — كوني أول من يقيّم.</p>
          )}
        </div>

        {!customer && (
          <Link href="/account/login" className="text-[13px] font-bold" style={{ color: 'var(--forest)' }}>
            سجّلي دخولك عشان تقيّمي
          </Link>
        )}
        {customer && canReview && !showForm && !submitted && (
          <button className="btn btn-secondary" onClick={() => setShowForm(true)}>أضيفي تقييمك</button>
        )}
        {customer && !canReview && reason && !submitted && (
          <span className="text-[13px]" style={{ color: '#8a8074' }}>{reason}</span>
        )}
        {submitted && (
          <span className="text-[13px] font-bold" style={{ color: 'var(--ok)' }}>تم إرسال تقييمك، هيظهر بعد المراجعة ✓</span>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-5 rounded border" style={{ borderColor: 'var(--line)', background: 'var(--cream)' }}>
          {error && (
            <div className="rounded p-3 mb-3 text-[13px]" style={{ background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }}>
              {error}
            </div>
          )}
          <div className="mb-4">
            <label className="block text-[13px] font-bold mb-2" style={{ color: 'var(--forest)' }}>تقييمك</label>
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
        <div className="flex flex-col gap-5">
          {summary.reviews.map((r) => (
            <div key={r.id} className="pb-5 border-b" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-[14px]">{r.customer_name}</span>
                <span className="text-[12px]" style={{ color: '#8a8074' }}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
              </div>
              <Stars value={r.rating} />
              {r.comment && <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: '#4a453e' }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

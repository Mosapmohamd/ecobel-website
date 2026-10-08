'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useCart, type CartLine } from '@/lib/cart';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { orderApi, catalogApi, type Order } from '@/lib/api';
import { egp } from '@/lib/constants';
import ProductImage from '@/components/ProductImage';
import ConfirmDialog from '@/components/ConfirmDialog';
import FieldError, { errorProps } from '@/components/FieldError';
import Icon from '@/components/Icon';
import { focusFirstError, validateFullName, validatePhone, validateRequired, type FieldErrors } from '@/lib/validation';

// Cart and checkout live on one page (Stitch "السلة وإتمام الطلب"):
// delivery form on one side, cart lines + order summary on the other.
// /checkout redirects here.

type CheckoutField = 'name' | 'phone' | 'city' | 'address';
const CHECKOUT_FIELDS: CheckoutField[] = ['name', 'phone', 'city', 'address'];

function validateCheckout(f: Record<CheckoutField, string>): FieldErrors<CheckoutField> {
  return {
    name: validateFullName(f.name),
    phone: validatePhone(f.phone),
    city: validateRequired(f.city, 'اختاري المحافظة'),
    address: f.address.trim().length < 5 ? 'اكتبي عنوان التوصيل بالتفصيل (الشارع، رقم العمارة، الدور)' : null,
  };
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded border p-5 sm:p-6 ${className}`} style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}>
      {children}
    </section>
  );
}

function Steps({ current }: { current: 1 | 2 }) {
  const steps = ['السلة والبيانات', 'تأكيد الطلب'];
  return (
    <ol className="flex items-center gap-3 text-[13px] font-bold">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-[12.5px]"
              style={{
                background: active || done ? 'var(--color-primary)' : 'var(--color-surface-muted)',
                color: active || done ? 'var(--color-surface)' : 'var(--color-ink-muted)',
              }}
            >
              {done ? <Icon name="check" size={14} strokeWidth={2.5} /> : n.toLocaleString('ar-EG')}
            </span>
            <span style={{ color: active ? 'var(--color-ink)' : 'var(--color-ink-muted)' }}>{label}</span>
            {i < steps.length - 1 && <span className="w-8 h-px mx-1" style={{ background: 'var(--color-line)' }} />}
          </li>
        );
      })}
    </ol>
  );
}

export default function CartPage() {
  const { lines, remove, restore, setQuantity, clear, quote, quoting, quoteError, retryQuote, checkout, setCheckout } = useCart();
  const { customer, token } = useAuth();
  const toast = useToast();
  // Every number below comes from the server quote — the same pricing
  // checkout charges — never from prices remembered in the browser.
  const subtotal = quote?.subtotal ?? 0;
  const quoteLine = (productId: string) => quote?.lines.find((q) => q.product_id === productId);

  // Removing a line is instant and reversible — an undo toast instead of
  // an "are you sure?" modal, which would just slow down a common action.
  function removeWithUndo(line: CartLine, name: string) {
    const index = lines.findIndex((l) => l.productId === line.productId);
    remove(line.productId);
    toast.show(`تم حذف ${name} من السلة`, {
      tone: 'info',
      action: { label: 'تراجع', onClick: () => restore(line, index) },
      duration: 6000,
    });
  }

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  // Prefill the delivery form once per signed-in customer (adjusting state
  // during render, not in an effect).
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (customer && prefilledFor !== customer.id) {
    setPrefilledFor(customer.id);
    setName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address || '');
  }

  const [rates, setRates] = useState<{ city: string; fee: number }[] | null>(null);
  const [ratesError, setRatesError] = useState(false);
  const [ratesAttempt, setRatesAttempt] = useState(0);
  useEffect(() => {
    catalogApi
      .shippingRates()
      .then((r) => {
        setRates(r);
        setRatesError(false);
      })
      .catch(() => setRatesError(true));
  }, [ratesAttempt]);

  // City and coupon travel with the cart quote, so the discount, shipping
  // and total below are the server's — exactly what the order will charge.
  const city = checkout.city;
  const [couponInput, setCouponInput] = useState(checkout.couponCode);
  const appliedCoupon = quote?.coupon && quote.coupon.code === checkout.couponCode.trim().toUpperCase() ? quote.coupon : null;
  const checkingCoupon = !!checkout.couponCode && quoting && !appliedCoupon;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<CheckoutField>>({});
  // Re-checks one field (on blur, or as it's corrected after an error).
  const recheck = (field: CheckoutField, value: string) =>
    setFieldErrors((prev) => ({ ...prev, [field]: validateCheckout({ name, phone, city, address, [field]: value })[field] }));
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const closeConfirmClear = useCallback(() => setConfirmClear(false), []);

  const discount = quote?.discount ?? 0;
  const shippingFee = quote?.shipping_fee ?? null;
  const total = quote?.total ?? subtotal;
  const threshold = quote?.free_shipping_threshold ?? 0;
  const netAfterDiscount = subtotal - discount;
  const freeShipping = !!quote && netAfterDiscount >= threshold;
  const remainingForFree = Math.max(0, threshold - netAfterDiscount);
  const freeProgress = threshold ? Math.min(100, Math.round((netAfterDiscount / threshold) * 100)) : 0;
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  function handleApplyCoupon() {
    const code = couponInput.trim();
    if (code) setCheckout({ couponCode: code });
  }

  function handleRemoveCoupon() {
    setCouponInput('');
    setCheckout({ couponCode: '' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = validateCheckout({ name, phone, city, address });
    setFieldErrors(errors);
    if (focusFirstError(errors, CHECKOUT_FIELDS, 'co-')) return;

    setSubmitting(true);
    try {
      const order = await orderApi.create({
        customer_name: name.trim().replace(/\s+/g, ' '),
        customer_phone: phone.trim(),
        city,
        shipping_address: address.trim(),
        items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        coupon_code: appliedCoupon?.valid ? appliedCoupon.code : undefined,
        note: note.trim() || undefined,
      }, token || undefined);
      setConfirmedOrder(order);
      clear();
      setCouponInput('');
      setCheckout({ couponCode: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حصل خطأ أثناء إرسال الطلب');
      // Stock or prices may have moved since the last quote — refresh it so
      // the affected lines are flagged right where the customer is looking.
      retryQuote();
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedOrder) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <div className="flex justify-center mb-8"><Steps current={2} /></div>
        <Panel className="text-center !p-10">
          <span className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface-tint)', color: 'var(--color-success)' }}>
            <Icon name="checkCircle" size={34} />
          </span>
          <h1 className="text-[30px] mb-2">تم استلام طلبك بنجاح!</h1>
          <p className="text-[14px] mb-1" style={{ color: 'var(--color-ink-muted)' }}>رقم طلبك</p>
          <p className="text-[22px] font-bold mb-4" style={{ color: 'var(--color-primary)' }} dir="ltr">{confirmedOrder.order_number}</p>
          <p className="text-[14px] leading-relaxed mb-8" style={{ color: 'var(--color-ink-secondary)' }}>
            شكرًا لثقتك في Eco Bel. احتفظي برقم الطلب مع رقم تليفونك عشان تقدري تتابعي حالة الطلب.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/track?order_number=${confirmedOrder.order_number}&phone=${confirmedOrder.customer_phone}`}
              className="btn btn-primary"
            >
              تتبعي طلبك
            </Link>
            <Link href="/products" className="btn btn-secondary">استمري في التسوق</Link>
          </div>
        </Panel>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="page-container py-20 text-center">
        <span className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface-tint)', color: 'var(--color-primary)' }}>
          <Icon name="bag" size={30} />
        </span>
        <h1 className="text-[28px] mb-2">السلة فاضية</h1>
        <p style={{ color: 'var(--color-ink-muted)' }} className="mb-7">لسه ما ضفتيش حاجة للسلة.</p>
        <Link href="/products" className="btn btn-primary">تسوقي الآن</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: 'var(--color-surface-tint)', borderColor: 'var(--color-line)' }} className="border-b">
        <div className="page-container py-10 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <span className="kicker">خطوة واحدة نحو العناية الطبيعية</span>
            <h1 className="text-[30px] lg:text-[40px] leading-tight">سلة المشتريات وإتمام الطلب</h1>
            <p className="mt-2 text-[14.5px]" style={{ color: 'var(--color-ink-muted)' }}>
              راجعي منتجاتك، أكدي عنوان التوصيل، وادفعي عند الاستلام.
            </p>
          </div>
          <Steps current={1} />
        </div>
      </div>

      <div className="page-container py-10 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-8 items-start">
        {/* Delivery details */}
        <div className="flex flex-col gap-6 order-2 lg:order-1">
          <Panel>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-full flex items-center justify-center flex-none" style={{ background: 'var(--color-surface-tint)', color: 'var(--color-primary)' }}>
                <Icon name="truck" size={20} />
              </span>
              <div>
                <h2 className="text-[22px] leading-tight">بيانات التوصيل</h2>
                <p className="text-[13px]" style={{ color: 'var(--color-ink-muted)' }}>اكتبي العنوان بالتفصيل عشان الشحنة توصل أسرع.</p>
              </div>
            </div>

            {error && (
              <div role="alert" className="notice notice-error mb-5">
                {error}
              </div>
            )}

            <form id="checkout-form" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="field sm:col-span-2">
                <label htmlFor="co-name">الاسم بالكامل (ثلاثي)</label>
                <input
                  id="co-name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (fieldErrors.name) recheck('name', e.target.value); }}
                  onBlur={() => name && recheck('name', name)}
                  placeholder="مثال: سارة أحمد محمد"
                  autoComplete="name"
                  aria-required="true"
                  {...errorProps('co-name-err', fieldErrors.name)}
                />
                <FieldError id="co-name-err" message={fieldErrors.name} />
              </div>
              <div className="field">
                <label htmlFor="co-phone">رقم التليفون</label>
                <input
                  id="co-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); if (fieldErrors.phone) recheck('phone', e.target.value); }}
                  onBlur={() => phone && recheck('phone', phone)}
                  placeholder="01xxxxxxxxx"
                  autoComplete="tel"
                  inputMode="numeric"
                  aria-required="true"
                  dir="ltr"
                  {...errorProps('co-phone-err', fieldErrors.phone)}
                />
                <FieldError id="co-phone-err" message={fieldErrors.phone} />
              </div>
              <div className="field">
                <label htmlFor="co-city">المحافظة</label>
                <select
                  id="co-city"
                  value={city}
                  onChange={(e) => { setCheckout({ city: e.target.value }); if (fieldErrors.city) recheck('city', e.target.value); }}
                  aria-required="true"
                  disabled={!rates || rates.length === 0}
                  {...errorProps('co-city-err', fieldErrors.city || quote?.city_error || (ratesError && !rates ? ' ' : null))}
                >
                  <option value="">
                    {rates === null ? 'جاري تحميل المحافظات...' : rates.length === 0 ? 'التوصيل متوقف حاليًا' : 'اختاري محافظتك...'}
                  </option>
                  {rates?.map((r) => (
                    <option key={r.city} value={r.city}>{r.city} — شحن {egp(r.fee)}</option>
                  ))}
                </select>
                {ratesError && !rates ? (
                  <p id="co-city-err" role="alert" className="text-[12px] mt-1 text-error">
                    تعذر تحميل المحافظات.{' '}
                    <button type="button" className="font-bold underline" onClick={() => setRatesAttempt((n) => n + 1)}>حاولي تاني</button>
                  </p>
                ) : (
                  <FieldError id="co-city-err" message={fieldErrors.city || quote?.city_error} />
                )}
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="co-address">عنوان التوصيل بالتفصيل</label>
                <textarea
                  id="co-address"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); if (fieldErrors.address) recheck('address', e.target.value); }}
                  rows={3}
                  aria-required="true"
                  placeholder="الشارع، رقم العمارة، الدور، علامة مميزة..."
                  {...errorProps('co-address-err', fieldErrors.address)}
                />
                <FieldError id="co-address-err" message={fieldErrors.address} />
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="co-note">ملاحظات للتوصيل (اختياري)</label>
                <textarea id="co-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              </div>
            </form>
          </Panel>

          <Panel>
            <h2 className="text-[20px] mb-4">طريقة الدفع</h2>
            <div className="flex items-start gap-3 rounded border p-4" style={{ borderColor: 'var(--color-primary)', background: 'var(--color-surface-tint)' }}>
              <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-none" style={{ background: 'var(--color-primary)', color: 'var(--color-surface)' }}>
                <Icon name="check" size={12} strokeWidth={3} />
              </span>
              <div>
                <div className="font-bold text-[15px]">الدفع عند الاستلام</div>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>هتدفعي كاش للمندوب لما الطلب يوصلك.</p>
              </div>
            </div>
          </Panel>
        </div>

        {/* Cart + summary */}
        <div className="flex flex-col gap-6 order-1 lg:order-2 lg:sticky lg:top-24">
          <Panel>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[22px] leading-tight">
                محتويات السلة{' '}
                <span className="text-[14px] font-normal" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-body)' }}>
                  ({itemCount.toLocaleString('ar-EG')} قطعة)
                </span>
              </h2>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="text-[13px] font-bold transition-colors text-ink-muted hover:text-error"
                >
                  إفراغ السلة
                </button>
                <Link href="/products" className="text-[13px] font-bold link-underline" style={{ color: 'var(--color-primary)' }}>
                  متابعة التسوق
                </Link>
              </div>
            </div>

            {quote && (
            <div className="rounded p-3 mb-4" style={{ background: 'var(--color-surface-tint)' }}>
              <div className="flex items-center gap-2 text-[13px] mb-2">
                <Icon name="truck" size={16} style={{ color: 'var(--color-primary)' }} />
                {freeShipping ? (
                  <span className="font-bold" style={{ color: 'var(--color-success)' }}>طلبك مؤهل للشحن المجاني!</span>
                ) : (
                  <span>
                    أضيفي بـ <strong style={{ color: 'var(--color-primary)' }}>{egp(remainingForFree)}</strong> كمان للشحن المجاني
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-sm overflow-hidden" style={{ background: 'var(--color-line)' }}>
                <div className="h-full transition-all" style={{ width: `${freeProgress}%`, background: freeShipping ? 'var(--color-success)' : 'var(--color-primary)' }} />
              </div>
            </div>
            )}

            {quoteError && (
              <div role="alert" className="notice notice-error mb-3 flex flex-wrap items-center justify-between gap-2">
                <span>{quoteError}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={retryQuote}>حاولي تاني</button>
              </div>
            )}
            <ul className="flex flex-col" aria-busy={quoting || undefined}>
              {lines.map((line) => {
                const q = quoteLine(line.productId);
                const product = q?.product;
                const name = product?.name ?? 'منتج';
                const maxQty = product?.max_quantity ?? 0;
                if (!q) {
                  return (
                    <li key={line.productId} className="flex gap-3 py-4 border-b border-line last:border-b-0 animate-pulse motion-reduce:animate-none" aria-hidden="true">
                      <span className="w-20 h-20 rounded bg-surface-tint flex-none" />
                      <span className="flex-1 flex flex-col gap-2 pt-1">
                        <span className="h-4 w-3/4 rounded bg-surface-muted" />
                        <span className="h-4 w-1/3 rounded bg-surface-muted" />
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={line.productId} className="flex gap-3 py-4 border-b border-line last:border-b-0">
                    <Link href={`/products/${line.productId}`} tabIndex={-1} aria-hidden="true" className="relative w-20 h-20 rounded overflow-hidden flex-none border border-line bg-surface-tint">
                      <ProductImage src={product?.image_url} alt="" sizes="80px" />
                    </Link>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/products/${line.productId}`} className="font-bold text-body leading-snug line-clamp-2">{name}</Link>
                        <button
                          type="button"
                          onClick={() => removeWithUndo(line, name)}
                          aria-label={`حذف ${name}`}
                          className="flex-none p-1 transition-colors text-ink-muted hover:text-error"
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                      {q.issue && (
                        <p role="alert" className="mt-1 text-body-sm text-error">
                          {q.issue === 'insufficient_stock'
                            ? `المتاح حاليًا ${maxQty.toLocaleString('ar-EG')} بس`
                            : q.issue === 'out_of_stock'
                              ? 'نفد من المخزون — احذفيه عشان تكملي الطلب'
                              : 'المنتج ده مبقاش متاح — احذفيه عشان تكملي الطلب'}
                          {q.issue === 'insufficient_stock' && (
                            <button type="button" className="mr-2 font-bold underline" onClick={() => setQuantity(line.productId, maxQty)}>
                              خلّي الكمية {maxQty.toLocaleString('ar-EG')}
                            </button>
                          )}
                        </p>
                      )}
                      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center border border-line rounded">
                          <button
                            type="button"
                            className="w-9 h-9 flex items-center justify-center disabled:opacity-40"
                            aria-label={`زيادة كمية ${name}`}
                            disabled={line.quantity >= maxQty}
                            onClick={() => setQuantity(line.productId, line.quantity + 1)}
                          >
                            <Icon name="plus" size={14} />
                          </button>
                          <span className="w-8 text-center text-body font-bold">{line.quantity.toLocaleString('ar-EG')}</span>
                          <button
                            type="button"
                            className="w-9 h-9 flex items-center justify-center"
                            aria-label={line.quantity === 1 ? `حذف ${name}` : `تقليل كمية ${name}`}
                            onClick={() => (line.quantity === 1 ? removeWithUndo(line, name) : setQuantity(line.productId, line.quantity - 1))}
                          >
                            <Icon name="minus" size={14} />
                          </button>
                        </div>
                        {!q.issue && (
                          <span className="text-left">
                            <span className={`block font-bold text-body ${q.unit_price < q.regular_unit_price ? 'text-brand-deep' : ''}`}>{egp(q.line_total)}</span>
                            {q.unit_price < q.regular_unit_price && (
                              <span className="block text-body-sm line-through text-ink-muted">{egp(q.regular_unit_price * q.quantity)}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel>
            <label htmlFor="co-coupon" className="block text-[13px] font-bold mb-2">كود الخصم</label>
            {appliedCoupon?.valid ? (
              <div role="status" className="flex items-center justify-between gap-2 rounded border px-3 py-2.5" style={{ borderColor: 'var(--color-success)', background: 'var(--color-surface-tint)' }}>
                <span className="flex items-center gap-2 text-[13.5px] min-w-0">
                  <Icon name="check" size={15} strokeWidth={2.5} style={{ color: 'var(--color-success)' }} />
                  <span className="font-bold truncate" dir="ltr">{appliedCoupon.code}</span>
                  <span style={{ color: 'var(--color-success)' }}>-{egp(discount)}</span>
                </span>
                <button type="button" className="text-[13px] font-bold underline flex-none text-ink-muted hover:text-error" onClick={handleRemoveCoupon}>
                  إزالة
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    id="co-coupon"
                    className="input flex-1"
                    placeholder="اكتبي الكود هنا"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyCoupon(); } }}
                    aria-invalid={appliedCoupon ? !appliedCoupon.valid : undefined}
                    aria-describedby={appliedCoupon && !appliedCoupon.valid ? 'co-coupon-err' : undefined}
                    autoComplete="off"
                    dir="ltr"
                  />
                  <button type="button" className="btn btn-secondary flex-none" onClick={handleApplyCoupon} disabled={checkingCoupon || !couponInput.trim()}>
                    {checkingCoupon ? 'جاري التحقق...' : 'تطبيق'}
                  </button>
                </div>
                {appliedCoupon && !appliedCoupon.valid && (
                  <p id="co-coupon-err" role="alert" className="text-[12.5px] mt-2 text-error">{appliedCoupon.reason}</p>
                )}
              </>
            )}

            <div className="mt-5 pt-4 border-t flex flex-col gap-2.5 text-[14px]" style={{ borderColor: 'var(--color-line)' }}>
              <div className="flex justify-between"><span style={{ color: 'var(--color-ink-secondary)' }}>المجموع الفرعي</span><span>{egp(subtotal)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between" style={{ color: 'var(--color-success)' }}><span>الخصم</span><span>-{egp(discount)}</span></div>
              )}
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-ink-secondary)' }}>الشحن{city ? ` (${city})` : ''}</span>
                <span>
                  {shippingFee === 0 ? (
                    <span style={{ color: 'var(--color-success)' }}>مجاني</span>
                  ) : shippingFee === null ? (
                    <span style={{ color: 'var(--color-ink-muted)' }}>حسب المحافظة</span>
                  ) : (
                    egp(shippingFee)
                  )}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-3 mt-1 border-t" style={{ borderColor: 'var(--color-line)' }}>
                <span className="font-bold">الإجمالي النهائي</span>
                <span className="text-[24px] font-bold" style={{ color: 'var(--color-primary)' }}>{egp(total)}</span>
              </div>
            </div>

            <button
              type="submit"
              form="checkout-form"
              className="btn btn-primary w-full mt-5"
              disabled={submitting || quoting || !quote || quote.has_issues || (!!city && quote.shipping_fee === null)}
            >
              {submitting ? 'جاري إرسال الطلب...' : (
                <>
                  {quote?.shipping_fee === null ? 'تأكيد الطلب' : <>تأكيد الطلب — {egp(total)}</>}
                  <Icon name="arrowLeft" size={18} />
                </>
              )}
            </button>
            {quote?.has_issues ? (
              <p className="text-[12px] mt-2 text-center text-error">في منتجات في السلة محتاجة تعديل قبل تأكيد الطلب.</p>
            ) : !city && (
              <p className="text-[12px] mt-2 text-center" style={{ color: 'var(--color-ink-muted)' }}>اختاري المحافظة في بيانات التوصيل لتأكيد الطلب.</p>
            )}

            <div className="mt-5 pt-4 border-t grid grid-cols-3 gap-2 text-center text-[12px]" style={{ borderColor: 'var(--color-line)', color: 'var(--color-ink-secondary)' }}>
              <span className="flex flex-col items-center gap-1"><Icon name="leaf" size={18} style={{ color: 'var(--color-success)' }} />مكونات طبيعية</span>
              <span className="flex flex-col items-center gap-1"><Icon name="return" size={18} style={{ color: 'var(--color-success)' }} />استبدال 14 يوم</span>
              <span className="flex flex-col items-center gap-1"><Icon name="cash" size={18} style={{ color: 'var(--color-success)' }} />الدفع عند الاستلام</span>
            </div>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        tone="warning"
        title="إفراغ السلة؟"
        message={`هنشيل كل المنتجات (${itemCount.toLocaleString('ar-EG')} قطعة) من السلة.`}
        confirmLabel="إفراغ السلة"
        cancelLabel="رجوع"
        onConfirm={() => {
          clear();
          setConfirmClear(false);
        }}
        onCancel={closeConfirmClear}
      />
    </div>
  );
}

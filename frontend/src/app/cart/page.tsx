'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { useAuth } from '@/lib/auth';
import { couponApi, orderApi, catalogApi, type Order } from '@/lib/api';
import { FREE_SHIPPING_THRESHOLD, DEFAULT_SHIPPING_FEE } from '@/lib/constants';
import ProductImage from '@/components/ProductImage';
import Icon from '@/components/Icon';

// Cart and checkout live on one page (Stitch "السلة وإتمام الطلب"):
// delivery form on one side, cart lines + order summary on the other.
// /checkout redirects here.

function validateName(value: string): string | null {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 3) return 'الاسم لازم يكون ثلاثي (اسم أول، أب، جد) مفصول بمسافات';
  return null;
}

function validatePhone(value: string): string | null {
  if (!/^01\d{9}$/.test(value.trim())) return 'رقم التليفون لازم يبدأ بـ 01 ويتكون من 11 رقم';
  return null;
}

const egp = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`;

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded border p-5 sm:p-6 ${className}`} style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
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
                background: active || done ? 'var(--forest)' : 'var(--parchment-2)',
                color: active || done ? 'var(--cream)' : 'var(--muted)',
              }}
            >
              {done ? <Icon name="check" size={14} strokeWidth={2.5} /> : n.toLocaleString('ar-EG')}
            </span>
            <span style={{ color: active ? 'var(--ink)' : 'var(--muted)' }}>{label}</span>
            {i < steps.length - 1 && <span className="w-8 h-px mx-1" style={{ background: 'var(--line)' }} />}
          </li>
        );
      })}
    </ol>
  );
}

export default function CartPage() {
  const { lines, remove, setQuantity, subtotal, clear } = useCart();
  const { customer, token } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [prefilled, setPrefilled] = useState(false);

  const [rates, setRates] = useState<{ city: string; fee: number }[]>([]);
  useEffect(() => {
    catalogApi.shippingRates().then(setRates).catch(() => {});
  }, []);

  useEffect(() => {
    if (customer && !prefilled) {
      setName(customer.name);
      setPhone(customer.phone);
      setAddress(customer.address || '');
      setPrefilled(true);
    }
  }, [customer, prefilled]);

  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState<{ valid: boolean; reason?: string; discount: number; forSubtotal: number } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  // A coupon is validated against a specific subtotal — if the cart changes
  // afterwards it no longer applies until it's re-checked against the new total.
  const coupon = couponStatus && couponStatus.forSubtotal === subtotal ? couponStatus : null;
  const discount = coupon?.valid ? coupon.discount : 0;
  const netAfterDiscount = subtotal - discount;
  const cityFee = rates.find((r) => r.city === city.trim())?.fee;
  const freeShipping = netAfterDiscount >= FREE_SHIPPING_THRESHOLD;
  const shippingFee = freeShipping ? 0 : (cityFee ?? DEFAULT_SHIPPING_FEE);
  const total = netAfterDiscount + shippingFee;
  const remainingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - netAfterDiscount);
  const freeProgress = Math.min(100, Math.round((netAfterDiscount / FREE_SHIPPING_THRESHOLD) * 100));
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCheckingCoupon(true);
    setCouponStatus(null);
    try {
      const res = await couponApi.validate(couponCode.trim(), subtotal);
      setCouponStatus({ valid: res.valid, reason: res.reason, discount: res.discount_amount, forSubtotal: subtotal });
    } catch {
      setCouponStatus({ valid: false, reason: 'تعذر التحقق من الكوبون', discount: 0, forSubtotal: subtotal });
    } finally {
      setCheckingCoupon(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const nameErr = validateName(name);
    const phoneErr = validatePhone(phone);
    setNameError(nameErr);
    setPhoneError(phoneErr);
    if (nameErr || phoneErr) return;
    if (!city) {
      setError('اختاري المحافظة قبل تأكيد الطلب');
      return;
    }

    setSubmitting(true);
    try {
      const order = await orderApi.create({
        customer_name: name.trim().replace(/\s+/g, ' '),
        customer_phone: phone.trim(),
        city,
        shipping_address: address,
        items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        coupon_code: coupon?.valid ? couponCode.trim() : undefined,
        note: note || undefined,
      }, token || undefined);
      setConfirmedOrder(order);
      clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حصل خطأ أثناء إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedOrder) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <div className="flex justify-center mb-8"><Steps current={2} /></div>
        <Panel className="text-center !p-10">
          <span className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--parchment)', color: 'var(--ok)' }}>
            <Icon name="checkCircle" size={34} />
          </span>
          <h1 className="text-[30px] mb-2">تم استلام طلبك بنجاح!</h1>
          <p className="text-[14px] mb-1" style={{ color: 'var(--muted)' }}>رقم طلبك</p>
          <p className="text-[22px] font-bold mb-4" style={{ color: 'var(--forest)' }} dir="ltr">{confirmedOrder.order_number}</p>
          <p className="text-[14px] leading-relaxed mb-8" style={{ color: 'var(--muted-strong)' }}>
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
      <div className="mx-auto max-w-6xl px-5 py-20 text-center">
        <span className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--parchment)', color: 'var(--forest)' }}>
          <Icon name="bag" size={30} />
        </span>
        <h1 className="text-[28px] mb-2">السلة فاضية</h1>
        <p style={{ color: 'var(--muted)' }} className="mb-7">لسه ما ضفتيش حاجة للسلة.</p>
        <Link href="/products" className="btn btn-primary">تسوقي الآن</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: 'var(--parchment)' }} className="border-b">
        <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col md:flex-row md:items-end md:justify-between gap-5" style={{ borderColor: 'var(--line)' }}>
          <div>
            <span className="kicker">خطوة واحدة نحو العناية الطبيعية</span>
            <h1 className="text-[30px] lg:text-[40px] leading-tight">سلة المشتريات وإتمام الطلب</h1>
            <p className="mt-2 text-[14.5px]" style={{ color: 'var(--muted)' }}>
              راجعي منتجاتك، أكدي عنوان التوصيل، وادفعي عند الاستلام.
            </p>
          </div>
          <Steps current={1} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-8 items-start">
        {/* Delivery details */}
        <div className="flex flex-col gap-6 order-2 lg:order-1">
          <Panel>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-full flex items-center justify-center flex-none" style={{ background: 'var(--parchment)', color: 'var(--forest)' }}>
                <Icon name="truck" size={20} />
              </span>
              <div>
                <h2 className="text-[22px] leading-tight">بيانات التوصيل</h2>
                <p className="text-[13px]" style={{ color: 'var(--muted)' }}>اكتبي العنوان بالتفصيل عشان الشحنة توصل أسرع.</p>
              </div>
            </div>

            {error && (
              <div className="rounded p-3 mb-5 text-[13.5px]" style={{ background: 'rgba(186,26,26,0.08)', color: 'var(--error)' }}>
                {error}
              </div>
            )}

            <form id="checkout-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="field sm:col-span-2">
                <label htmlFor="co-name">الاسم بالكامل (ثلاثي)</label>
                <input
                  id="co-name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null); }}
                  onBlur={() => setNameError(validateName(name))}
                  placeholder="مثال: سارة أحمد محمد"
                  style={nameError ? { borderColor: 'var(--rose)' } : undefined}
                  required
                />
                {nameError && <p className="text-[12px] mt-1" style={{ color: 'var(--error)' }}>{nameError}</p>}
              </div>
              <div className="field">
                <label htmlFor="co-phone">رقم التليفون</label>
                <input
                  id="co-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(null); }}
                  onBlur={() => setPhoneError(validatePhone(phone))}
                  placeholder="01xxxxxxxxx"
                  style={phoneError ? { borderColor: 'var(--rose)' } : undefined}
                  required
                  dir="ltr"
                />
                {phoneError && <p className="text-[12px] mt-1" style={{ color: 'var(--error)' }}>{phoneError}</p>}
              </div>
              <div className="field">
                <label htmlFor="co-city">المحافظة</label>
                <select id="co-city" value={city} onChange={(e) => setCity(e.target.value)} required disabled={rates.length === 0}>
                  <option value="">{rates.length === 0 ? 'لا توجد محافظات متاحة حاليًا' : 'اختاري محافظتك...'}</option>
                  {rates.map((r) => (
                    <option key={r.city} value={r.city}>{r.city} — شحن {egp(r.fee)}</option>
                  ))}
                </select>
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="co-address">عنوان التوصيل بالتفصيل</label>
                <textarea id="co-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={3} required placeholder="الشارع، رقم العمارة، الدور، علامة مميزة..." />
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="co-note">ملاحظات للتوصيل (اختياري)</label>
                <textarea id="co-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              </div>
            </form>
          </Panel>

          <Panel>
            <h2 className="text-[20px] mb-4">طريقة الدفع</h2>
            <div className="flex items-start gap-3 rounded border p-4" style={{ borderColor: 'var(--forest)', background: 'var(--parchment)' }}>
              <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-none" style={{ background: 'var(--forest)', color: 'var(--cream)' }}>
                <Icon name="check" size={12} strokeWidth={3} />
              </span>
              <div>
                <div className="font-bold text-[15px]">الدفع عند الاستلام</div>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--muted)' }}>هتدفعي كاش للمندوب لما الطلب يوصلك.</p>
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
                <span className="text-[14px] font-normal" style={{ color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
                  ({itemCount.toLocaleString('ar-EG')} قطعة)
                </span>
              </h2>
              <Link href="/products" className="text-[13px] font-bold link-underline" style={{ color: 'var(--forest)' }}>
                متابعة التسوق
              </Link>
            </div>

            <div className="rounded p-3 mb-4" style={{ background: 'var(--parchment)' }}>
              <div className="flex items-center gap-2 text-[13px] mb-2">
                <Icon name="truck" size={16} style={{ color: 'var(--forest)' }} />
                {freeShipping ? (
                  <span className="font-bold" style={{ color: 'var(--ok)' }}>طلبك مؤهل للشحن المجاني!</span>
                ) : (
                  <span>
                    أضيفي بـ <strong style={{ color: 'var(--forest)' }}>{egp(remainingForFree)}</strong> كمان للشحن المجاني
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-sm overflow-hidden" style={{ background: 'var(--line)' }}>
                <div className="h-full transition-all" style={{ width: `${freeProgress}%`, background: freeShipping ? 'var(--ok)' : 'var(--forest)' }} />
              </div>
            </div>

            <ul className="flex flex-col">
              {lines.map((line) => (
                <li key={line.product.id} className="flex gap-3 py-4 border-b last:border-b-0" style={{ borderColor: 'var(--line)' }}>
                  <Link href={`/products/${line.product.id}`} className="relative w-20 h-20 rounded overflow-hidden flex-none border" style={{ borderColor: 'var(--line)', background: 'var(--parchment)' }}>
                    <ProductImage src={line.product.image_url} alt={line.product.name} sizes="80px" />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/products/${line.product.id}`} className="font-bold text-[14px] leading-snug line-clamp-2">{line.product.name}</Link>
                      <button
                        onClick={() => remove(line.product.id)}
                        aria-label={`حذف ${line.product.name}`}
                        className="flex-none p-1 transition-colors text-[var(--muted)] hover:text-[var(--error)]"
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    </div>
                    <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center border rounded" style={{ borderColor: 'var(--line)' }}>
                        <button
                          className="w-8 h-8 flex items-center justify-center disabled:opacity-40"
                          aria-label="زيادة الكمية"
                          disabled={line.quantity >= line.product.quantity}
                          onClick={() => setQuantity(line.product.id, Math.min(line.product.quantity, line.quantity + 1))}
                        >
                          <Icon name="plus" size={14} />
                        </button>
                        <span className="w-8 text-center text-[14px] font-bold">{line.quantity.toLocaleString('ar-EG')}</span>
                        <button
                          className="w-8 h-8 flex items-center justify-center"
                          aria-label="تقليل الكمية"
                          onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                        >
                          <Icon name="minus" size={14} />
                        </button>
                      </div>
                      <span className="font-bold text-[15px]">{egp(line.product.sale_price * line.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <label htmlFor="co-coupon" className="block text-[13px] font-bold mb-2">كود الخصم</label>
            <div className="flex gap-2">
              <input
                id="co-coupon"
                className="input flex-1"
                placeholder="اكتبي الكود هنا"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyCoupon(); } }}
              />
              <button type="button" className="btn btn-secondary flex-none" onClick={handleApplyCoupon} disabled={checkingCoupon || !couponCode.trim()}>
                {checkingCoupon ? '...' : 'تطبيق'}
              </button>
            </div>
            {coupon && (
              <p className="text-[12.5px] mt-2" style={{ color: coupon.valid ? 'var(--ok)' : 'var(--error)' }}>
                {coupon.valid ? `تم تطبيق الخصم: -${egp(coupon.discount)}` : coupon.reason}
              </p>
            )}
            {couponStatus && !coupon && (
              <p className="text-[12.5px] mt-2" style={{ color: 'var(--muted)' }}>السلة اتغيرت — اضغطي تطبيق تاني عشان نحسب الخصم.</p>
            )}

            <div className="mt-5 pt-4 border-t flex flex-col gap-2.5 text-[14px]" style={{ borderColor: 'var(--line)' }}>
              <div className="flex justify-between"><span style={{ color: 'var(--muted-strong)' }}>المجموع الفرعي</span><span>{egp(subtotal)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between" style={{ color: 'var(--ok)' }}><span>الخصم</span><span>-{egp(discount)}</span></div>
              )}
              <div className="flex justify-between">
                <span style={{ color: 'var(--muted-strong)' }}>الشحن{city ? ` (${city})` : ''}</span>
                <span>{shippingFee === 0 ? <span style={{ color: 'var(--ok)' }}>مجاني</span> : egp(shippingFee)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-3 mt-1 border-t" style={{ borderColor: 'var(--line)' }}>
                <span className="font-bold">الإجمالي النهائي</span>
                <span className="text-[24px] font-bold" style={{ color: 'var(--forest)' }}>{egp(total)}</span>
              </div>
              {!city && !freeShipping && (
                <p className="text-[12px]" style={{ color: 'var(--muted)' }}>مصاريف الشحن بتتحدد حسب المحافظة.</p>
              )}
            </div>

            <button
              type="submit"
              form="checkout-form"
              className="btn btn-primary w-full mt-5"
              disabled={submitting || !!nameError || !!phoneError || !city}
            >
              {submitting ? 'جاري إرسال الطلب...' : (
                <>
                  تأكيد الطلب — {egp(total)}
                  <Icon name="arrowLeft" size={18} />
                </>
              )}
            </button>
            {!city && (
              <p className="text-[12px] mt-2 text-center" style={{ color: 'var(--muted)' }}>اختاري المحافظة في بيانات التوصيل لتأكيد الطلب.</p>
            )}

            <div className="mt-5 pt-4 border-t grid grid-cols-3 gap-2 text-center text-[12px]" style={{ borderColor: 'var(--line)', color: 'var(--muted-strong)' }}>
              <span className="flex flex-col items-center gap-1"><Icon name="leaf" size={18} style={{ color: 'var(--ok)' }} />مكونات طبيعية</span>
              <span className="flex flex-col items-center gap-1"><Icon name="return" size={18} style={{ color: 'var(--ok)' }} />استبدال 14 يوم</span>
              <span className="flex flex-col items-center gap-1"><Icon name="cash" size={18} style={{ color: 'var(--ok)' }} />الدفع عند الاستلام</span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { useAuth } from '@/lib/auth';
import { couponApi, orderApi, catalogApi, type Order } from '@/lib/api';

import { FREE_SHIPPING_THRESHOLD, DEFAULT_SHIPPING_FEE } from '@/lib/constants';

function validateName(value: string): string | null {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 3) return 'الاسم لازم يكون ثلاثي (اسم أول، أب، جد) مفصول بمسافات';
  return null;
}

function validatePhone(value: string): string | null {
  if (!/^01\d{9}$/.test(value.trim())) return 'رقم التليفون لازم يبدأ بـ 01 ويتكون من 11 رقم';
  return null;
}

export default function CheckoutPage() {
  const { lines, subtotal, clear } = useCart();
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
  const [couponStatus, setCouponStatus] = useState<{ valid: boolean; reason?: string; discount: number } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const discount = couponStatus?.valid ? couponStatus.discount : 0;
  const netAfterDiscount = subtotal - discount;
  const cityFee = rates.find((r) => r.city === city.trim())?.fee;
  const shippingFee = netAfterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : (cityFee ?? DEFAULT_SHIPPING_FEE);
  const total = netAfterDiscount + shippingFee;

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCheckingCoupon(true);
    setCouponStatus(null);
    try {
      const res = await couponApi.validate(couponCode.trim(), subtotal);
      setCouponStatus({ valid: res.valid, reason: res.reason, discount: res.discount_amount });
    } catch {
      setCouponStatus({ valid: false, reason: 'تعذر التحقق من الكوبون', discount: 0 });
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
        coupon_code: couponStatus?.valid ? couponCode.trim() : undefined,
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
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-3xl mb-3">تم استلام طلبك!</h1>
        <p style={{ color: '#8a8074' }} className="mb-6">
          رقم الطلب: <strong style={{ color: 'var(--forest)' }}>{confirmedOrder.order_number}</strong>
          <br />
          احتفظي بالرقم ده مع رقم تليفونك عشان تقدري تتابعي حالة الطلب.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href={`/track?order_number=${confirmedOrder.order_number}&phone=${confirmedOrder.customer_phone}`}
            className="btn btn-primary"
          >
            تتبعي طلبك
          </Link>
          <Link href="/products" className="btn btn-secondary">استمري في التسوق</Link>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-20 text-center">
        <p style={{ color: '#8a8074' }} className="mb-6">السلة فاضية — ضيفي منتجات الأول.</p>
        <Link href="/products" className="btn btn-primary">تسوقي الآن</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-10">
      <form onSubmit={handleSubmit}>
        <h1 className="text-3xl mb-8">إتمام الطلب</h1>

        {error && (
          <div className="rounded p-3 mb-5 text-[13.5px]" style={{ background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }}>
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="field">
            <label>الاسم بالكامل (ثلاثي)</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null); }}
              onBlur={() => setNameError(validateName(name))}
              placeholder="مثال: سارة أحمد محمد"
              required
            />
            {nameError && <p className="text-[12px] mt-1" style={{ color: 'var(--rose)' }}>{nameError}</p>}
          </div>
          <div className="field">
            <label>رقم التليفون</label>
            <input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(null); }}
              onBlur={() => setPhoneError(validatePhone(phone))}
              placeholder="01xxxxxxxxx"
              required
              dir="ltr"
            />
            {phoneError && <p className="text-[12px] mt-1" style={{ color: 'var(--rose)' }}>{phoneError}</p>}
          </div>
          <div className="field">
            <label>المحافظة</label>
            <select value={city} onChange={(e) => setCity(e.target.value)} required disabled={rates.length === 0}>
              <option value="">{rates.length === 0 ? 'لا توجد محافظات متاحة حاليًا' : 'اختاري محافظتك...'}</option>
              {rates.map((r) => (
                <option key={r.city} value={r.city}>{r.city} — شحن {r.fee.toLocaleString('ar-EG')} ج.م</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>عنوان التوصيل بالتفصيل</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} required />
          </div>
          <div className="field">
            <label>ملاحظات (اختياري)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="mt-8 p-4 rounded" style={{ background: 'var(--parchment-2)' }}>
          <div className="font-bold mb-2">💵 الدفع عند الاستلام</div>
          <p className="text-[13.5px]" style={{ color: '#8a8074' }}>هتدفعي كاش للمندوب لما الطلب يوصلك.</p>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full mt-8"
          disabled={submitting || !!nameError || !!phoneError || !city}
        >
          {submitting ? 'جاري إرسال الطلب...' : `تأكيد الطلب — ${total.toLocaleString('ar-EG')} ج.م`}
        </button>
      </form>

      <aside>
        <div className="rounded border p-5" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
          <h2 className="text-xl mb-4">ملخص الطلب</h2>

          <div className="flex flex-col gap-2 mb-4 text-[13.5px]">
            {lines.map((l) => (
              <div key={l.product.id} className="flex justify-between">
                <span>{l.product.name} × {l.quantity}</span>
                <span>{(l.product.sale_price * l.quantity).toLocaleString('ar-EG')} ج.م</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            <input
              placeholder="كود الخصم"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="flex-1"
              style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 13.5 }}
            />
            <button type="button" className="btn btn-secondary" onClick={handleApplyCoupon} disabled={checkingCoupon}>
              {checkingCoupon ? '...' : 'تطبيق'}
            </button>
          </div>
          {couponStatus && (
            <p className="text-[12.5px] mb-3" style={{ color: couponStatus.valid ? 'var(--ok)' : 'var(--rose)' }}>
              {couponStatus.valid ? `تم تطبيق الخصم: -${couponStatus.discount.toLocaleString('ar-EG')} ج.م` : couponStatus.reason}
            </p>
          )}

          <div className="border-t pt-3 flex flex-col gap-2 text-[14px]" style={{ borderColor: 'var(--line)' }}>
            <div className="flex justify-between"><span>الإجمالي الفرعي</span><span>{subtotal.toLocaleString('ar-EG')} ج.م</span></div>
            {discount > 0 && (
              <div className="flex justify-between" style={{ color: 'var(--ok)' }}><span>الخصم</span><span>-{discount.toLocaleString('ar-EG')} ج.م</span></div>
            )}
            <div className="flex justify-between">
              <span>الشحن{city ? ` (${city})` : ''}</span>
              <span>{shippingFee === 0 ? 'مجاني' : `${shippingFee} ج.م`}</span>
            </div>
            <div className="flex justify-between font-extrabold text-base pt-2 border-t" style={{ borderColor: 'var(--line)', color: 'var(--forest)' }}>
              <span>الإجمالي</span><span>{total.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

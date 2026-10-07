'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import FieldError, { errorProps } from '@/components/FieldError';
import { focusFirstError, validateName, validateNewPassword, validateOptionalEmail, validatePhone, type FieldErrors } from '@/lib/validation';

type Field = 'name' | 'phone' | 'email' | 'password';
const FIELDS: Field[] = ['name', 'phone', 'email', 'password'];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Field>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errors: FieldErrors<Field> = {
      name: validateName(name),
      phone: validatePhone(phone),
      email: validateOptionalEmail(email),
      password: validateNewPassword(password),
    };
    setFieldErrors(errors);
    if (focusFirstError(errors, FIELDS, 'reg-')) return;
    setLoading(true);
    try {
      await register({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, address: address.trim() || undefined, password });
      router.push('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حصل خطأ أثناء إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-14"><div className="card p-6 sm:p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/ecobel-mark-black.png" alt="Eco Bel" className="mx-auto mb-6" style={{ height: 56, width: 'auto' }} />
      <h1 className="text-[30px] mb-8 text-center">حساب جديد</h1>
      {error && (
        <div role="alert" className="notice notice-error mb-5">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="field">
          <label htmlFor="reg-name">الاسم بالكامل</label>
          <input id="reg-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-required="true" {...errorProps('reg-name-err', fieldErrors.name)} />
          <FieldError id="reg-name-err" message={fieldErrors.name} />
        </div>
        <div className="field">
          <label htmlFor="reg-phone">رقم التليفون</label>
          <input id="reg-phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} aria-required="true" dir="ltr" {...errorProps('reg-phone-err', fieldErrors.phone)} />
          <FieldError id="reg-phone-err" message={fieldErrors.phone} />
        </div>
        <div className="field">
          <label htmlFor="reg-email">البريد الإلكتروني (اختياري)</label>
          <input id="reg-email" autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" {...errorProps('reg-email-err', fieldErrors.email)} />
          <FieldError id="reg-email-err" message={fieldErrors.email} />
        </div>
        <div className="field">
          <label htmlFor="reg-address">العنوان (اختياري)</label>
          <input id="reg-address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="reg-password">كلمة المرور</label>
          <input id="reg-password" autoComplete="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-required="true" {...errorProps('reg-password-err', fieldErrors.password)} />
          <FieldError id="reg-password-err" message={fieldErrors.password ?? null} />
          {!fieldErrors.password && <p className="text-[12px] mt-1 text-ink-muted">6 حروف أو أرقام على الأقل</p>}
        </div>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}</button>
      </form>
      <p className="mt-5 text-[13.5px] text-center" style={{ color: 'var(--color-ink-muted)' }}>
        عندك حساب بالفعل؟ <Link href="/account/login" className="font-bold" style={{ color: 'var(--color-primary)' }}>سجّلي دخول</Link>
      </p>
    </div>
    </div>
  );
}

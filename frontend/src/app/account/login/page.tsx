'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import FieldError, { errorProps } from '@/components/FieldError';
import { focusFirstError, validateRequired, type FieldErrors } from '@/lib/validation';

type Field = 'phone' | 'password';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Field>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errors: FieldErrors<Field> = {
      phone: validateRequired(identifier, 'اكتبي رقم التليفون'),
      password: validateRequired(password, 'اكتبي كلمة المرور'),
    };
    setFieldErrors(errors);
    if (focusFirstError(errors, ['phone', 'password'], 'login-')) return;
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      router.push('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بيانات الدخول غير صحيحة');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-14"><div className="card p-6 sm:p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/ecobel-mark-black.png" alt="Eco Bel" className="mx-auto mb-6" style={{ height: 56, width: 'auto' }} />
      <h1 className="text-[30px] mb-8 text-center">تسجيل الدخول</h1>
      {error && (
        <div role="alert" className="notice notice-error mb-5">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="field">
          <label htmlFor="login-phone">رقم التليفون</label>
          <input id="login-phone" type="tel" inputMode="numeric" autoComplete="tel" value={identifier} onChange={(e) => setIdentifier(e.target.value)} aria-required="true" dir="ltr" {...errorProps('login-phone-err', fieldErrors.phone)} />
          <FieldError id="login-phone-err" message={fieldErrors.phone} />
        </div>
        <div className="field">
          <label htmlFor="login-password">كلمة المرور</label>
          <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-required="true" {...errorProps('login-password-err', fieldErrors.password)} />
          <FieldError id="login-password-err" message={fieldErrors.password} />
        </div>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'جاري الدخول...' : 'تسجيل الدخول'}</button>
      </form>
      <p className="mt-5 text-[13.5px] text-center" style={{ color: 'var(--color-ink-muted)' }}>
        معندكيش حساب؟ <Link href="/account/register" className="font-bold" style={{ color: 'var(--color-primary)' }}>سجّلي دلوقتي</Link>
      </p>
    </div>
    </div>
  );
}

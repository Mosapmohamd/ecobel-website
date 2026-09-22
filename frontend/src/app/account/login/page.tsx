'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
      router.push('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بيانات الدخول غير صحيحة');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="text-3xl mb-8">تسجيل الدخول</h1>
      {error && (
        <div className="rounded-md p-3 mb-5 text-[13.5px]" style={{ background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="field">
          <label>رقم التليفون</label>
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required dir="ltr" />
        </div>
        <div className="field">
          <label>كلمة المرور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'جاري الدخول...' : 'تسجيل الدخول'}</button>
      </form>
      <p className="mt-5 text-[13.5px] text-center" style={{ color: '#8a8074' }}>
        معندكيش حساب؟ <Link href="/account/register" className="font-bold" style={{ color: 'var(--forest)' }}>سجّلي دلوقتي</Link>
      </p>
    </div>
  );
}

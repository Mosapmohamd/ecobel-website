'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ name, phone, email: email || undefined, address: address || undefined, password });
      router.push('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حصل خطأ أثناء إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="text-3xl mb-8">حساب جديد</h1>
      {error && (
        <div className="rounded p-3 mb-5 text-[13.5px]" style={{ background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="field">
          <label>الاسم بالكامل</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>رقم التليفون</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" />
        </div>
        <div className="field">
          <label>البريد الإلكتروني (اختياري)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        </div>
        <div className="field">
          <label>العنوان (اختياري)</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="field">
          <label>كلمة المرور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}</button>
      </form>
      <p className="mt-5 text-[13.5px] text-center" style={{ color: '#8a8074' }}>
        عندك حساب بالفعل؟ <Link href="/account/login" className="font-bold" style={{ color: 'var(--forest)' }}>سجّلي دخول</Link>
      </p>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStaffAuth } from '@/lib/staffAuth';

export default function AdminLoginPage() {
  const { login } = useStaffAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'اسم المستخدم أو كلمة المرور غير صحيحة');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-xl p-8 w-full max-w-sm"
        style={{ background: 'var(--forest-deep)' }}
      >
        <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 13 }} className="mb-1">Eco Bel</div>
        <h1 className="text-2xl mb-6" style={{ color: 'var(--cream)' }}>دخول لوحة التحكم</h1>

        {error && (
          <div className="rounded-md p-3 mb-4 text-[13px]" style={{ background: 'rgba(201,123,138,0.2)', color: '#f0c1c9' }}>
            {error}
          </div>
        )}

        <div className="field mb-4" style={{ color: 'var(--cream)' }}>
          <label style={{ color: 'var(--gold-soft)' }}>اسم المستخدم</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus dir="ltr" />
        </div>
        <div className="field mb-6">
          <label style={{ color: 'var(--gold-soft)' }}>كلمة المرور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button className="btn btn-gold w-full" disabled={loading}>
          {loading ? 'جاري الدخول...' : 'دخول'}
        </button>
      </form>
    </div>
  );
}

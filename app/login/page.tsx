'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/');
  }

  return (
    <div className="card">
      <h2 style={{ textAlign: 'center', marginBottom: 4 }}>Biriwa Technical Institute</h2>
      <p style={{ textAlign: 'center', color: '#666', marginTop: 0 }}>Sign in to your account</p>
      <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email"
          placeholder="name@bti.edu.gh"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

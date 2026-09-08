'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AddStudentPage() {
  const [form, setForm] = useState({
    admission_number: '',
    full_name: '',
    date_of_birth: '',
    gender: '',
    guardian_name: '',
    guardian_phone: '',
    address: '',
    admission_date: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.admission_number || !form.full_name || !form.admission_date) {
      setError('Admission number, full name, and admission date are required.');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      setError('Could not find your school profile.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('students').insert({
      school_id: profile.school_id,
      admission_number: form.admission_number,
      full_name: form.full_name,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      guardian_name: form.guardian_name || null,
      guardian_phone: form.guardian_phone || null,
      address: form.address || null,
      admission_date: form.admission_date,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push('/students');
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px' }}>
      <h2>Add student</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="text"
          placeholder="Admission number *"
          value={form.admission_number}
          onChange={(e) => updateField('admission_number', e.target.value)}
        />
        <input
          type="text"
          placeholder="Full name *"
          value={form.full_name}
          onChange={(e) => updateField('full_name', e.target.value)}
        />
        <label style={{ fontSize: 13, color: '#666' }}>Date of birth</label>
        <input
          type="date"
          value={form.date_of_birth}
          onChange={(e) => updateField('date_of_birth', e.target.value)}
        />
        <input
          type="text"
          placeholder="Gender"
          value={form.gender}
          onChange={(e) => updateField('gender', e.target.value)}
        />
        <input
          type="text"
          placeholder="Guardian name"
          value={form.guardian_name}
          onChange={(e) => updateField('guardian_name', e.target.value)}
        />
        <input
          type="text"
          placeholder="Guardian phone"
          value={form.guardian_phone}
          onChange={(e) => updateField('guardian_phone', e.target.value)}
        />
        <input
          type="text"
          placeholder="Address"
          value={form.address}
          onChange={(e) => updateField('address', e.target.value)}
        />
        <label style={{ fontSize: 13, color: '#666' }}>Admission date *</label>
        <input
          type="date"
          value={form.admission_date}
          onChange={(e) => updateField('admission_date', e.target.value)}
        />
        {error && <p style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save student'}
        </button>
      </form>
    </div>
  );
          }

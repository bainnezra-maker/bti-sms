'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const houses = ['House 1', 'House 2', 'House 3', 'House 4'];

export default function AddStudentPage() {
  const router = useRouter();
  const supabase = createClient();
  const emptyForm = () => ({
    full_name: '', date_of_birth: '', gender: '', guardian_name: '',
    guardian_phone: '', address: '',
    admission_date: new Date().toISOString().slice(0, 10),
    jhs_aggregate: '', resident: '', house: '',
    health_insurance_number: '', health_insurance_expiry_date: '',
  });

  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function updateField(field: keyof typeof form, value: string) {
    setForm(previous => {
      const next = { ...previous, [field]: value };
      if (field === 'resident' && value !== 'Boarding') next.house = '';
      return next;
    });
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      if (!form.full_name.trim()) throw new Error('Student full name is required.');
      if (!form.admission_date) throw new Error('Admission date is required.');
      if (!form.resident) throw new Error('Please select whether the student is Day or Boarding.');
      if (form.resident === 'Boarding' && !form.house) throw new Error('Please select a house for the Boarding student.');

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('You are not logged in.');

      const { data: profile, error: profileError } = await supabase
        .from('users').select('school_id, role, is_active').eq('id', user.id).single();
      if (profileError || !profile?.school_id) throw new Error('Your account is not linked to a school.');
      if (profile.is_active === false || profile.role !== 'admin') throw new Error('Only an active Administrator can register students.');

      const { error: studentError } = await supabase.from('students').insert({
        school_id: profile.school_id,
        full_name: form.full_name.trim(),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        guardian_name: form.guardian_name.trim() || null,
        guardian_phone: form.guardian_phone.trim() || null,
        address: form.address.trim() || null,
        admission_date: form.admission_date,
        jhs_aggregate: form.jhs_aggregate.trim() === '' ? null : Number(form.jhs_aggregate),
        resident: form.resident,
        house: form.resident === 'Boarding' ? form.house : null,
        health_insurance_number: form.health_insurance_number.trim() || null,
        health_insurance_expiry_date: form.health_insurance_expiry_date || null,
      });
      if (studentError) throw new Error(studentError.message);

      setSuccess('Student registered successfully.');
      setForm(emptyForm());
      setTimeout(() => router.push('/students'), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register student.');
    } finally { setSaving(false); }
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Link href="/students" className="hover:text-blue-600">Students</Link>
              <i className="fa-solid fa-chevron-right text-xs" /><span>Add Student</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Register Student</h1>
            <p className="mt-1 text-sm text-slate-500">Enter the student's basic, residence, health insurance and guardian information.</p>
          </div>
          <Link href="/students" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <i className="fa-solid fa-arrow-left" /> Back to Students
          </Link>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><i className="fa-solid fa-circle-exclamation mr-2" />{error}</div>}
        {success && <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"><i className="fa-solid fa-circle-check mr-2" />{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900"><i className="fa-solid fa-user text-blue-600" /> Student Information</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2"><label className="mb-2 block text-sm font-semibold text-slate-700">Full Name *</label><input value={form.full_name} onChange={e=>updateField('full_name',e.target.value)} required placeholder="Enter student's full name" className={inputClass}/></div>
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e=>updateField('date_of_birth',e.target.value)} className={inputClass}/></div>
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Gender</label><select value={form.gender} onChange={e=>updateField('gender',e.target.value)} className={inputClass}><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Resident *</label><select value={form.resident} onChange={e=>updateField('resident',e.target.value)} required className={inputClass}><option value="">Select residence</option><option value="Day">Day</option><option value="Boarding">Boarding</option></select></div>
              {form.resident === 'Boarding' && <div><label className="mb-2 block text-sm font-semibold text-slate-700">House *</label><select value={form.house} onChange={e=>updateField('house',e.target.value)} required className={inputClass}><option value="">Select house</option>{houses.map(h=><option key={h} value={h}>{h}</option>)}</select></div>}
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Admission Date *</label><input type="date" value={form.admission_date} onChange={e=>updateField('admission_date',e.target.value)} required className={inputClass}/></div>
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">JHS Aggregate</label><input type="number" step="0.01" value={form.jhs_aggregate} onChange={e=>updateField('jhs_aggregate',e.target.value)} placeholder="e.g. 18" className={inputClass}/></div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900"><i className="fa-solid fa-shield-heart text-emerald-600" /> Health Insurance</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Health Insurance Number</label><input value={form.health_insurance_number} onChange={e=>updateField('health_insurance_number',e.target.value)} placeholder="Enter NHIS / insurance number" className={inputClass}/></div>
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Expiry Date</label><input type="date" value={form.health_insurance_expiry_date} onChange={e=>updateField('health_insurance_expiry_date',e.target.value)} className={inputClass}/></div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900"><i className="fa-solid fa-user-group text-blue-600" /> Guardian Information</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Guardian Name</label><input value={form.guardian_name} onChange={e=>updateField('guardian_name',e.target.value)} placeholder="Guardian full name" className={inputClass}/></div>
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Guardian Telephone</label><input type="tel" value={form.guardian_phone} onChange={e=>updateField('guardian_phone',e.target.value)} placeholder="e.g. 024 XXX XXXX" className={inputClass}/></div>
              <div className="md:col-span-2"><label className="mb-2 block text-sm font-semibold text-slate-700">Address</label><textarea value={form.address} onChange={e=>updateField('address',e.target.value)} rows={3} placeholder="Residential address" className={inputClass}/></div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link href="/students" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">Cancel</Link>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Registering...</> : <><i className="fa-solid fa-user-plus" /> Register Student</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

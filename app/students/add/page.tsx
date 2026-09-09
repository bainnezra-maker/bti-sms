'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function AddStudentPage() {
  const supabase = createClient();
  const router = useRouter();

  const [form, setForm] = useState({
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

  function updateField(field: string, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError('');

    if (!form.full_name.trim() || !form.admission_date) {
      setError(
        'Full name and admission date are required.'
      );
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
      setError('Could not find your school profile.');
      setLoading(false);
      return;
    }

    /*
     * Admission number is intentionally NOT supplied here.
     *
     * The Supabase database trigger automatically generates:
     *
     * BTI/2026/0001
     * BTI/2026/0002
     * BTI/2026/0003
     *
     * based on the student's admission date.
     */
    const { error: insertError } = await supabase
      .from('students')
      .insert({
        school_id: profile.school_id,
        full_name: form.full_name.trim(),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        guardian_name: form.guardian_name.trim() || null,
        guardian_phone: form.guardian_phone.trim() || null,
        address: form.address.trim() || null,
        admission_date: form.admission_date,
      });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push('/students');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-6">
          <Link
            href="/students"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to Students
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Register New Student
          </h1>

          <p className="mt-1 text-slate-500">
            Enter the student's information below.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
        >
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">
              Student Information
            </h2>

            <p className="text-sm text-slate-500">
              Basic identification and admission details.
            </p>
          </div>

          {/* Automatic Admission Number Notice */}
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              Admission Number
            </p>

            <p className="mt-1 text-sm text-blue-700">
              The system will automatically generate the student's
              unique admission number after registration.
            </p>

            <p className="mt-2 text-xs text-blue-600">
              Example: BTI/2026/0001
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* Full Name */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Full Name *
              </label>

              <input
                type="text"
                value={form.full_name}
                onChange={(e) =>
                  updateField('full_name', e.target.value)
                }
                placeholder="Student full name"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Date of Birth
              </label>

              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) =>
                  updateField('date_of_birth', e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Gender
              </label>

              <select
                value={form.gender}
                onChange={(e) =>
                  updateField('gender', e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Guardian Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Guardian Name
              </label>

              <input
                type="text"
                value={form.guardian_name}
                onChange={(e) =>
                  updateField('guardian_name', e.target.value)
                }
                placeholder="Parent / guardian name"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Guardian Phone */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Guardian Phone
              </label>

              <input
                type="tel"
                value={form.guardian_phone}
                onChange={(e) =>
                  updateField('guardian_phone', e.target.value)
                }
                placeholder="e.g. 024 000 0000"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Address
              </label>

              <textarea
                value={form.address}
                onChange={(e) =>
                  updateField('address', e.target.value)
                }
                placeholder="Student's residential address"
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Admission Date */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Admission Date *
              </label>

              <input
                type="date"
                value={form.admission_date}
                onChange={(e) =>
                  updateField('admission_date', e.target.value)
                }
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />

              <p className="mt-1 text-xs text-slate-400">
                The admission year will be used for the automatic
                admission number.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/students"
              className="rounded-xl border border-slate-300 px-6 py-3 text-center font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Registering...'
                : 'Register Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

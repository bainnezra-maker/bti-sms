'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AddStudentPage() {
  const router = useRouter();
  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    guardian_name: '',
    guardian_phone: '',
    address: '',
    admission_date: new Date().toISOString().slice(0, 10),
    jhs_aggregate: '',
    resident: '',
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!form.full_name.trim()) {
        throw new Error('Student full name is required.');
      }

      if (!form.admission_date) {
        throw new Error('Admission date is required.');
      }

      if (!form.resident) {
        throw new Error(
          'Please select whether the student is Day or Boarding.'
        );
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('You are not logged in.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.school_id) {
        throw new Error('Your account is not linked to a school.');
      }

      const { error: studentError } = await supabase
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
          jhs_aggregate:
            form.jhs_aggregate.trim() === ''
              ? null
              : Number(form.jhs_aggregate),
          resident: form.resident,
        });

      if (studentError) {
        throw new Error(studentError.message);
      }

      setSuccess('Student registered successfully.');

      setForm({
        full_name: '',
        date_of_birth: '',
        gender: '',
        guardian_name: '',
        guardian_phone: '',
        address: '',
        admission_date: new Date().toISOString().slice(0, 10),
        jhs_aggregate: '',
        resident: '',
      });

      setTimeout(() => {
        router.push('/students');
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to register student.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Link href="/students" className="hover:text-blue-600">
                Students
              </Link>

              <i className="fa-solid fa-chevron-right text-xs" />

              <span>Add Student</span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Register Student
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Enter the student's basic information and guardian details.
            </p>
          </div>

          <Link
            href="/students"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <i className="fa-solid fa-arrow-left" />
            Back to Students
          </Link>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <i className="fa-solid fa-circle-exclamation mr-2" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <i className="fa-solid fa-circle-check mr-2" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">
                <i className="fa-solid fa-user text-blue-600" />
                Student Information
              </h2>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Full Name *
                  </label>

                  <input
                    value={form.full_name}
                    onChange={(e) =>
                      updateField('full_name', e.target.value)
                    }
                    placeholder="Enter student's full name"
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Date of Birth
                  </label>

                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) =>
                      updateField('date_of_birth', e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Gender
                  </label>

                  <select
                    value={form.gender}
                    onChange={(e) =>
                      updateField('gender', e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Resident *
                  </label>

                  <select
                    value={form.resident}
                    onChange={(e) =>
                      updateField('resident', e.target.value)
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select residence</option>
                    <option value="Day">Day</option>
                    <option value="Boarding">Boarding</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Admission Date *
                  </label>

                  <input
                    type="date"
                    value={form.admission_date}
                    onChange={(e) =>
                      updateField('admission_date', e.target.value)
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    JHS Aggregate
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    value={form.jhs_aggregate}
                    onChange={(e) =>
                      updateField('jhs_aggregate', e.target.value)
                    }
                    placeholder="e.g. 18"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">
                <i className="fa-solid fa-user-group text-blue-600" />
                Guardian Information
              </h2>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Guardian Name
                  </label>

                  <input
                    value={form.guardian_name}
                    onChange={(e) =>
                      updateField('guardian_name', e.target.value)
                    }
                    placeholder="Guardian full name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Guardian Telephone
                  </label>

                  <input
                    type="tel"
                    value={form.guardian_phone}
                    onChange={(e) =>
                      updateField('guardian_phone', e.target.value)
                    }
                    placeholder="e.g. 024 XXX XXXX"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Address
                  </label>

                  <textarea
                    value={form.address}
                    onChange={(e) =>
                      updateField('address', e.target.value)
                    }
                    rows={3}
                    placeholder="Residential address"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/students"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-user-plus" />
                    Register Student
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

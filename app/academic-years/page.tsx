'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string | null;
};

export default function AcademicYearsPage() {
  const supabase = createClient();

  const [years, setYears] = useState<AcademicYear[]>([]);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadYears();
  }, []);

  async function getSchoolId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.school_id) {
      setError('School profile could not be found.');
      return null;
    }

    return profile.school_id as string;
  }

  async function loadYears() {
    setLoading(true);
    setError('');

    const schoolId = await getSchoolId();

    if (!schoolId) {
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('academic_years')
      .select(
        'id, name, start_date, end_date, is_current, created_at'
      )
      .eq('school_id', schoolId)
      .order('start_date', {
        ascending: false,
        nullsFirst: false,
      })
      .order('name', {
        ascending: false,
      });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setYears((data || []) as AcademicYear[]);
    }

    setLoading(false);
  }

  function resetForm() {
    setName('');
    setStartDate('');
    setEndDate('');
    setEditingId(null);
  }

  function editYear(year: AcademicYear) {
    setEditingId(year.id);
    setName(year.name || '');
    setStartDate(year.start_date || '');
    setEndDate(year.end_date || '');

    setError('');
    setMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function saveYear(e: React.FormEvent) {
    e.preventDefault();

    setError('');
    setMessage('');

    const cleanName = name.trim();

    if (!cleanName) {
      setError(
        'Please enter an academic year, for example 2027/2028.'
      );
      return;
    }

    if (!startDate || !endDate) {
      setError(
        'Please enter both the start date and end date.'
      );
      return;
    }

    if (endDate <= startDate) {
      setError(
        'The end date must be after the start date.'
      );
      return;
    }

    const schoolId = await getSchoolId();

    if (!schoolId) return;

    setSaving(true);

    if (editingId) {
      const { error: updateError } = await supabase
        .from('academic_years')
        .update({
          name: cleanName,
          start_date: startDate,
          end_date: endDate,
        })
        .eq('id', editingId)
        .eq('school_id', schoolId);

      if (updateError) {
        setError(updateError.message);
      } else {
        setMessage(
          'Academic year updated successfully.'
        );

        resetForm();
        await loadYears();
      }
    } else {
      const { error: insertError } = await supabase
        .from('academic_years')
        .insert({
          school_id: schoolId,
          name: cleanName,
          start_date: startDate,
          end_date: endDate,
          is_current: false,
        });

      if (insertError) {
        setError(insertError.message);
      } else {
        setMessage(
          'Academic year created successfully.'
        );

        resetForm();
        await loadYears();
      }
    }

    setSaving(false);
  }

  async function makeCurrent(id: string) {
    setError('');
    setMessage('');

    const schoolId = await getSchoolId();

    if (!schoolId) return;

    const { error: clearError } = await supabase
      .from('academic_years')
      .update({
        is_current: false,
      })
      .eq('school_id', schoolId);

    if (clearError) {
      setError(clearError.message);
      return;
    }

    const { error: currentError } = await supabase
      .from('academic_years')
      .update({
        is_current: true,
      })
      .eq('id', id)
      .eq('school_id', schoolId);

    if (currentError) {
      setError(currentError.message);
      return;
    }

    setMessage(
      'Academic year is now the current academic year.'
    );

    await loadYears();
  }

  async function deleteYear(id: string) {
    setError('');
    setMessage('');

    const year = years.find(
      (item) => item.id === id
    );

    if (!year) return;

    if (year.is_current) {
      setError(
        'You cannot delete the current academic year. Make another year current first.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete academic year ${year.name}? Only delete a year if it has no historical records.`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from('academic_years')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage(
      'Academic year deleted successfully.'
    );

    setYears((current) =>
      current.filter(
        (item) => item.id !== id
      )
    );
  }

  const filteredYears = years.filter((year) =>
    year.name
      .toLowerCase()
      .includes(
        search.toLowerCase().trim()
      )
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <div className="mb-2 text-4xl">
            📅
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            Academic Years
          </h1>

          <p className="mt-1 text-slate-500">
            Create and manage academic years used throughout BTI-SMS.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="text-lg font-bold text-slate-900">
              {editingId
                ? 'Edit Academic Year'
                : 'Add Academic Year'}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Example: 2027/2028
            </p>

            <form
              onSubmit={saveYear}
              className="mt-5 space-y-4"
            >

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Academic Year
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="e.g. 2027/2028"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Start Date
                </label>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(e.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  End Date
                </label>

                <input
                  type="date"
                  value={endDate}
                  onChange={(e) =>
                    setEndDate(e.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving
                  ? 'Saving...'
                  : editingId
                  ? 'Save Changes'
                  : 'Add Academic Year'}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}

            </form>
          </div>

          {/* Records */}
          <div className="lg:col-span-2">

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Academic Years
                  </h2>

                  <p className="text-sm text-slate-500">
                    {years.length} record
                    {years.length !== 1
                      ? 's'
                      : ''}
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  className="rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500"
                />

              </div>

              {loading ? (
                <p className="py-10 text-center text-slate-500">
                  Loading...
                </p>
              ) : filteredYears.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mb-2 text-4xl">
                    📭
                  </div>

                  <p className="text-slate-500">
                    No academic years found.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">

                  {filteredYears.map(
                    (year) => (
                      <div
                        key={year.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                          <div>
                            <div className="flex flex-wrap items-center gap-2">

                              <h3 className="text-lg font-bold text-slate-900">
                                {year.name}
                              </h3>

                              {year.is_current && (
                                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                                  CURRENT
                                </span>
                              )}

                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                              {year.start_date ||
                                '—'}{' '}
                              →{' '}
                              {year.end_date ||
                                '—'}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">

                            <button
                              onClick={() =>
                                editYear(year)
                              }
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>

                            {!year.is_current && (
                              <button
                                onClick={() =>
                                  makeCurrent(
                                    year.id
                                  )
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                              >
                                Make Current
                              </button>
                            )}

                            <button
                              onClick={() =>
                                deleteYear(
                                  year.id
                                )
                              }
                              className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>

                          </div>

                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type AcademicYear = {
  id: string;
  name: string;
  is_current?: boolean;
};

type Semester = {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

const SEMESTER_OPTIONS = [
  'Semester 1',
  'Semester 2',
];

export default function TermsPage() {
  const supabase = createClient();

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);

  const [academicYearId, setAcademicYearId] =
    useState('');

  const [name, setName] =
    useState('Semester 1');

  const [startDate, setStartDate] =
    useState('');

  const [endDate, setEndDate] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  async function loadData() {
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
      setError(
        'School profile could not be found.'
      );
      setLoading(false);
      return;
    }

    const {
      data: yearData,
      error: yearError,
    } = await supabase
      .from('academic_years')
      .select(
        'id, name, is_current'
      )
      .eq(
        'school_id',
        profile.school_id
      )
      .order('name', {
        ascending: false,
      });

    if (yearError) {
      setError(yearError.message);
      setLoading(false);
      return;
    }

    const loadedYears =
      yearData || [];

    setYears(loadedYears);

    const currentYear =
      loadedYears.find(
        (year) => year.is_current
      );

    if (currentYear) {
      setAcademicYearId(
        currentYear.id
      );
    } else if (loadedYears[0]) {
      setAcademicYearId(
        loadedYears[0].id
      );
    }

    if (loadedYears.length > 0) {
      await loadSemesters(
        loadedYears.map(
          (year) => year.id
        )
      );
    }

    setLoading(false);
  }

  async function loadSemesters(
    yearIds: string[]
  ) {
    if (!yearIds.length) {
      setSemesters([]);
      return;
    }

    const {
      data,
      error: semesterError,
    } = await supabase
      .from('terms')
      .select(`
        id,
        academic_year_id,
        name,
        start_date,
        end_date,
        is_current
      `)
      .in(
        'academic_year_id',
        yearIds
      )
      .order('start_date');

    if (semesterError) {
      setError(
        semesterError.message
      );
      return;
    }

    /*
     * Only display Semester 1 and Semester 2.
     * Existing Term 1/2/3 records are hidden
     * from the new interface.
     */
    const filtered =
      (data || []).filter(
        (item) =>
          item.name ===
            'Semester 1' ||
          item.name ===
            'Semester 2'
      );

    setSemesters(filtered);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addSemester(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError('');

    if (!academicYearId) {
      setError(
        'Please create an academic year first.'
      );
      return;
    }

    setSaving(true);

    /*
     * Prevent duplicate Semester 1 or
     * Semester 2 for the same academic year.
     */
    const {
      data: existingSemester,
      error: checkError,
    } = await supabase
      .from('terms')
      .select('id')
      .eq(
        'academic_year_id',
        academicYearId
      )
      .eq('name', name)
      .maybeSingle();

    if (checkError) {
      setError(
        checkError.message
      );
      setSaving(false);
      return;
    }

    if (existingSemester) {
      setError(
        `${name} already exists for this academic year.`
      );
      setSaving(false);
      return;
    }

    const {
      error: insertError,
    } = await supabase
      .from('terms')
      .insert({
        academic_year_id:
          academicYearId,
        name,
        start_date:
          startDate || null,
        end_date:
          endDate || null,
        is_current: false,
      });

    if (insertError) {
      setError(
        insertError.message
      );
      setSaving(false);
      return;
    }

    setName('Semester 1');
    setStartDate('');
    setEndDate('');

    await loadData();

    setSaving(false);
  }

  async function deleteSemester(
    id: string
  ) {
    if (
      !window.confirm(
        'Delete this semester?'
      )
    ) {
      return;
    }

    const {
      error: deleteError,
    } = await supabase
      .from('terms')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(
        deleteError.message
      );
      return;
    }

    setSemesters(
      (current) =>
        current.filter(
          (semester) =>
            semester.id !== id
        )
    );
  }

  async function makeCurrent(
    semester: Semester
  ) {
    setError('');

    /*
     * First remove current status from
     * all semesters in this academic year.
     */
    const {
      error: resetError,
    } = await supabase
      .from('terms')
      .update({
        is_current: false,
      })
      .eq(
        'academic_year_id',
        semester.academic_year_id
      );

    if (resetError) {
      setError(
        resetError.message
      );
      return;
    }

    /*
     * Make the selected semester current.
     */
    const {
      error: currentError,
    } = await supabase
      .from('terms')
      .update({
        is_current: true,
      })
      .eq(
        'id',
        semester.id
      );

    if (currentError) {
      setError(
        currentError.message
      );
      return;
    }

    setSemesters(
      (current) =>
        current.map(
          (item) => ({
            ...item,
            is_current:
              item.id ===
              semester.id,
          })
        )
    );
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <p className="text-slate-500">
          Loading semesters...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600">
            Academic Management
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Semesters
          </h1>

          <p className="mt-1 text-slate-500">
            Manage Semester 1 and Semester 2 for each academic year.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Add semester */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="mb-5 text-lg font-bold text-slate-900">
              Add Semester
            </h2>

            <form
              onSubmit={addSemester}
              className="space-y-4"
            >

              {/* Academic Year */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Academic Year
                </label>

                <select
                  value={academicYearId}
                  onChange={(e) =>
                    setAcademicYearId(
                      e.target.value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="">
                    Select academic year
                  </option>

                  {years.map(
                    (year) => (
                      <option
                        key={year.id}
                        value={year.id}
                      >
                        {year.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Semester */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Semester
                </label>

                <select
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target.value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                >
                  {SEMESTER_OPTIONS.map(
                    (semester) => (
                      <option
                        key={semester}
                        value={semester}
                      >
                        {semester}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Start date */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Start Date
                </label>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(
                      e.target.value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {/* End date */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  End Date
                </label>

                <input
                  type="date"
                  value={endDate}
                  onChange={(e) =>
                    setEndDate(
                      e.target.value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving
                  ? 'Saving...'
                  : 'Add Semester'}
              </button>

            </form>
          </div>

          {/* Semester list */}
          <div className="lg:col-span-2">

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Academic Semesters
                </h2>

                <p className="text-sm text-slate-500">
                  Each academic year uses only two semesters.
                </p>
              </div>

              <div className="space-y-3">

                {semesters.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="mb-2 text-4xl">
                      🗓️
                    </div>

                    <p className="text-slate-500">
                      No semesters created yet.
                    </p>
                  </div>
                ) : (
                  semesters.map(
                    (semester) => (
                      <div
                        key={semester.id}
                        className="flex flex-col gap-4 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >

                        <div>
                          <div className="flex flex-wrap items-center gap-2">

                            <h3 className="font-bold text-slate-900">
                              {semester.name}
                            </h3>

                            {semester.is_current && (
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                Current
                              </span>
                            )}

                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {years.find(
                              (year) =>
                                year.id ===
                                semester.academic_year_id
                            )?.name ||
                              'Academic year'}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {semester.start_date ||
                              'No start date'}
                            {' → '}
                            {semester.end_date ||
                              'No end date'}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">

                          {!semester.is_current && (
                            <button
                              onClick={() =>
                                makeCurrent(
                                  semester
                                )
                              }
                              className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                            >
                              Make Current
                            </button>
                          )}

                          <button
                            onClick={() =>
                              deleteSemester(
                                semester.id
                              )
                            }
                            className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>

                        </div>

                      </div>
                    )
                  )
                )}

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

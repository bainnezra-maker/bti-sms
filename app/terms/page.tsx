'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type AcademicYear = {
  id: string;
  name: string;
};

type Term = {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

export default function TermsPage() {
  const supabase = createClient();

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);

  const [academicYearId, setAcademicYearId] = useState('');
  const [name, setName] = useState('Term 1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

    const { data: profile } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      setError('School profile could not be found.');
      setLoading(false);
      return;
    }

    const { data: yearData, error: yearError } =
      await supabase
        .from('academic_years')
        .select('id, name')
        .eq('school_id', profile.school_id)
        .order('name', { ascending: false });

    if (yearError) {
      setError(yearError.message);
      setLoading(false);
      return;
    }

    setYears(yearData || []);

    const currentYear = yearData?.find(
      (year: any) => year.is_current
    );

    if (currentYear) {
      setAcademicYearId(currentYear.id);
    } else if (yearData?.[0]) {
      setAcademicYearId(yearData[0].id);
    }

    if (yearData && yearData.length > 0) {
      await loadTerms(yearData.map((year) => year.id));
    }

    setLoading(false);
  }

  async function loadTerms(yearIds: string[]) {
    if (!yearIds.length) {
      setTerms([]);
      return;
    }

    const { data, error: termError } = await supabase
      .from('terms')
      .select('*')
      .in('academic_year_id', yearIds)
      .order('start_date');

    if (termError) {
      setError(termError.message);
      return;
    }

    setTerms(data || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addTerm(e: React.FormEvent) {
    e.preventDefault();

    setError('');

    if (!academicYearId) {
      setError('Please create an academic year first.');
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase
      .from('terms')
      .insert({
        academic_year_id: academicYearId,
        name,
        start_date: startDate || null,
        end_date: endDate || null,
        is_current: false,
      });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setName('Term 1');
    setStartDate('');
    setEndDate('');

    await loadData();

    setSaving(false);
  }

  async function deleteTerm(id: string) {
    if (!window.confirm('Delete this term?')) return;

    const { error: deleteError } = await supabase
      .from('terms')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setTerms((current) =>
      current.filter((term) => term.id !== id)
    );
  }

  async function makeCurrent(term: Term) {
    const { error: resetError } = await supabase
      .from('terms')
      .update({ is_current: false })
      .eq('academic_year_id', term.academic_year_id);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    const { error: currentError } = await supabase
      .from('terms')
      .update({ is_current: true })
      .eq('id', term.id);

    if (currentError) {
      setError(currentError.message);
      return;
    }

    setTerms((current) =>
      current.map((item) => ({
        ...item,
        is_current: item.id === term.id,
      }))
    );
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <p className="text-slate-500">Loading terms...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600">
            Academic Management
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Terms
          </h1>

          <p className="mt-1 text-slate-500">
            Manage academic terms and the current term.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="mb-5 text-lg font-bold">
              Add Term
            </h2>

            <form onSubmit={addTerm} className="space-y-4">

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Academic Year
                </label>

                <select
                  value={academicYearId}
                  onChange={(e) =>
                    setAcademicYearId(e.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">
                    Select academic year
                  </option>

                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Term
                </label>

                <select
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option>Term 1</option>
                  <option>Term 2</option>
                  <option>Term 3</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Start Date
                </label>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  End Date
                </label>

                <input
                  type="date"
                  value={endDate}
                  onChange={(e) =>
                    setEndDate(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                {saving ? 'Saving...' : 'Add Term'}
              </button>

            </form>
          </div>

          <div className="lg:col-span-2">

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <h2 className="mb-5 text-lg font-bold">
                Academic Terms
              </h2>

              <div className="space-y-3">

                {terms.length === 0 ? (
                  <div className="py-10 text-center text-slate-500">
                    No terms created yet.
                  </div>
                ) : (
                  terms.map((term) => (
                    <div
                      key={term.id}
                      className="flex flex-col gap-4 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold">
                            {term.name}
                          </h3>

                          {term.is_current && (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                              Current
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {years.find(
                            (year) =>
                              year.id === term.academic_year_id
                          )?.name || 'Academic year'}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {term.start_date || 'No start date'}
                          {' → '}
                          {term.end_date || 'No end date'}
                        </p>
                      </div>

                      <div className="flex gap-2">

                        {!term.is_current && (
                          <button
                            onClick={() => makeCurrent(term)}
                            className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700"
                          >
                            Make Current
                          </button>
                        )}

                        <button
                          onClick={() =>
                            deleteTerm(term.id)
                          }
                          className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>

                      </div>

                    </div>
                  ))
                )}

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

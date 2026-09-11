'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type AcademicYear = {
  id: string;
  name: string;
  is_current: boolean;
};

type Programme = {
  id: string;
  name: string;
  code: string | null;
};

type ClassRecord = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
  academic_year_id: string | null;
};

export default function ClassesPage() {
  const supabase = createClient();

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);

  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [programmeId, setProgrammeId] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function getSchoolId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return null;
    }

    const { data: profile, error: profileError } =
      await supabase
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

  async function loadData() {
    setLoading(true);
    setError('');

    const schoolId = await getSchoolId();

    if (!schoolId) {
      setLoading(false);
      return;
    }

    const [
      classesResult,
      yearsResult,
      programmesResult,
    ] = await Promise.all([
      supabase
        .from('classes')
        .select(
          'id, name, level, programme_id, academic_year_id'
        )
        .eq('school_id', schoolId)
        .order('name'),

      supabase
        .from('academic_years')
        .select('id, name, is_current')
        .eq('school_id', schoolId)
        .order('start_date', {
          ascending: false,
          nullsFirst: false,
        }),

      supabase
        .from('programmes')
        .select('id, name, code')
        .eq('school_id', schoolId)
        .order('name'),
    ]);

    if (classesResult.error) {
      setError(classesResult.error.message);
    } else {
      setClasses(
        (classesResult.data || []) as ClassRecord[]
      );
    }

    if (yearsResult.error) {
      setError(yearsResult.error.message);
    } else {
      setAcademicYears(
        yearsResult.data || []
      );
    }

    if (programmesResult.error) {
      setError(programmesResult.error.message);
    } else {
      setProgrammes(
        programmesResult.data || []
      );
    }

    setLoading(false);
  }

  function resetForm() {
    setName('');
    setLevel('');
    setProgrammeId('');
    setEditingId(null);

    const currentYear = academicYears.find(
      (year) => year.is_current
    );

    setAcademicYearId(
      currentYear?.id || ''
    );
  }

  function cancelEdit() {
    setName('');
    setLevel('');
    setProgrammeId('');
    setEditingId(null);

    const currentYear = academicYears.find(
      (year) => year.is_current
    );

    setAcademicYearId(
      currentYear?.id || ''
    );

    setError('');
    setMessage('');
  }

  function editClass(record: ClassRecord) {
    setEditingId(record.id);
    setName(record.name || '');
    setLevel(record.level || '');

    /*
     * IMPORTANT:
     * When editing an existing class, always use the
     * academic year stored on that class.
     */
    setAcademicYearId(
      record.academic_year_id || ''
    );

    setProgrammeId(
      record.programme_id || ''
    );

    setError('');
    setMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function saveClass(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError('');
    setMessage('');

    if (!name.trim()) {
      setError(
        'Please enter the class name.'
      );
      return;
    }

    if (!academicYearId) {
      setError(
        'Please select the academic year for this class.'
      );
      return;
    }

    const schoolId = await getSchoolId();

    if (!schoolId) {
      return;
    }

    setSaving(true);

    const payload = {
      school_id: schoolId,
      name: name.trim(),
      level: level.trim() || null,
      academic_year_id: academicYearId,
      programme_id: programmeId || null,
    };

    try {
      if (editingId) {
        /*
         * UPDATE EXISTING CLASS
         *
         * We use .select() so Supabase returns the
         * actual updated database row.
         */
        const {
          data: updatedRows,
          error: updateError,
        } = await supabase
          .from('classes')
          .update(payload)
          .eq('id', editingId)
          .eq('school_id', schoolId)
          .select(
            'id, name, level, programme_id, academic_year_id'
          );

        if (updateError) {
          setError(
            `Unable to update class: ${updateError.message}`
          );
          return;
        }

        /*
         * If no row comes back, the update was not actually
         * permitted or the class was not found.
         */
        if (!updatedRows || updatedRows.length === 0) {
          setError(
            'The class could not be updated. Please check that your account has permission to update classes.'
          );
          return;
        }

        const updatedClass =
          updatedRows[0] as ClassRecord;

        /*
         * Update the visible list immediately using the
         * exact record returned from Supabase.
         */
        setClasses((current) =>
          current.map((item) =>
            item.id === updatedClass.id
              ? updatedClass
              : item
          )
        );

        setMessage(
          `Class "${updatedClass.name}" updated successfully to ${
            getYearName(updatedClass.academic_year_id)
          }.`
        );

        /*
         * Clear editing mode but deliberately do NOT
         * reload stale form values.
         */
        setName('');
        setLevel('');
        setProgrammeId('');
        setEditingId(null);

        const currentYear =
          academicYears.find(
            (year) => year.is_current
          );

        setAcademicYearId(
          currentYear?.id || ''
        );

        /*
         * Refresh from database as a final confirmation.
         */
        await loadData();
      } else {
        /*
         * CREATE NEW CLASS
         */
        const {
          data: insertedRows,
          error: insertError,
        } = await supabase
          .from('classes')
          .insert(payload)
          .select(
            'id, name, level, programme_id, academic_year_id'
          );

        if (insertError) {
          setError(
            `Unable to create class: ${insertError.message}`
          );
          return;
        }

        if (!insertedRows || insertedRows.length === 0) {
          setError(
            'The class could not be created.'
          );
          return;
        }

        const newClass =
          insertedRows[0] as ClassRecord;

        setClasses((current) => [
          ...current,
          newClass,
        ]);

        setMessage(
          `Class "${newClass.name}" created successfully.`
        );

        resetForm();

        await loadData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteClass(id: string) {
    const record = classes.find(
      (item) => item.id === id
    );

    if (!record) {
      return;
    }

    const confirmed = window.confirm(
      `Delete class ${record.name}?`
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setMessage('');

    const { error: deleteError } =
      await supabase
        .from('classes')
        .delete()
        .eq('id', id);

    if (deleteError) {
      setError(
        deleteError.message
      );
      return;
    }

    setMessage(
      'Class deleted successfully.'
    );

    setClasses((current) =>
      current.filter(
        (item) => item.id !== id
      )
    );
  }

  const filteredClasses =
    classes.filter((record) => {
      const yearName =
        academicYears.find(
          (year) =>
            year.id ===
            record.academic_year_id
        )?.name || '';

      const programmeName =
        programmes.find(
          (programme) =>
            programme.id ===
            record.programme_id
        )?.name || '';

      const text =
        `${record.name} ${
          record.level || ''
        } ${yearName} ${programmeName}`
          .toLowerCase();

      return text.includes(
        search
          .toLowerCase()
          .trim()
      );
    });

  function getYearName(
    id: string | null
  ) {
    return (
      academicYears.find(
        (year) =>
          year.id === id
      )?.name || 'Not assigned'
    );
  }

  function getProgrammeName(
    id: string | null
  ) {
    return (
      programmes.find(
        (programme) =>
          programme.id === id
      )?.name ||
      'All programmes'
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <div className="mb-2 text-4xl">
            🏫
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            Classes
          </h1>

          <p className="mt-1 text-slate-500">
            Create and manage classes by academic year and programme.
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

          {/* FORM */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="text-lg font-bold text-slate-900">
              {editingId
                ? 'Edit Class'
                : 'Add Class'}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Assign each class to an academic year.
            </p>

            <form
              onSubmit={saveClass}
              className="mt-5 space-y-4"
            >

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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="">
                    Select academic year
                  </option>

                  {academicYears.map(
                    (year) => (
                      <option
                        key={year.id}
                        value={year.id}
                      >
                        {year.name}
                        {year.is_current
                          ? ' (Current)'
                          : ''}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Programme
                </label>

                <select
                  value={programmeId}
                  onChange={(e) =>
                    setProgrammeId(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="">
                    All programmes / Not specified
                  </option>

                  {programmes.map(
                    (programme) => (
                      <option
                        key={programme.id}
                        value={programme.id}
                      >
                        {programme.name}
                        {programme.code
                          ? ` (${programme.code})`
                          : ''}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Class Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Form 1 Electrical A"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Level
                </label>

                <input
                  type="text"
                  value={level}
                  onChange={(e) =>
                    setLevel(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Form 1"
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
                  : editingId
                  ? 'Save Changes'
                  : 'Add Class'}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="w-full rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}

            </form>
          </div>

          {/* CLASS LIST */}
          <div className="lg:col-span-2">

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Class List
                  </h2>

                  <p className="text-sm text-slate-500">
                    {classes.length} class
                    {classes.length !== 1
                      ? 'es'
                      : ''}
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Search classes..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  className="rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500"
                />

              </div>

              {loading ? (
                <p className="py-10 text-center text-slate-500">
                  Loading...
                </p>
              ) : filteredClasses.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mb-2 text-4xl">
                    📭
                  </div>

                  <p className="text-slate-500">
                    No classes found.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">

                  {filteredClasses.map(
                    (record) => (
                      <div
                        key={record.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                          <div>

                            <h3 className="text-lg font-bold text-slate-900">
                              {record.name}
                            </h3>

                            <div className="mt-2 flex flex-wrap gap-2">

                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                Academic Year:{' '}
                                {getYearName(
                                  record.academic_year_id
                                )}
                              </span>

                              {record.level && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {record.level}
                                </span>
                              )}

                              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                {getProgrammeName(
                                  record.programme_id
                                )}
                              </span>

                            </div>

                          </div>

                          <div className="flex flex-wrap gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                editClass(
                                  record
                                )
                              }
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteClass(
                                  record.id
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

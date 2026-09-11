'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

type Programme = {
  id: string;
  name: string;
  code: string | null;
};

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
  academic_year_id: string | null;
};

type Student = {
  id: string;
  admission_number: string;
  full_name: string;
};

type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  programme_id: string | null;
  status: string | null;
  students: Student | null;
};

const supabase = createClient();

export default function PromotionPage() {
  const [academicYears, setAcademicYears] =
    useState<AcademicYear[]>([]);

  const [programmes, setProgrammes] =
    useState<Programme[]>([]);

  const [classes, setClasses] =
    useState<ClassItem[]>([]);

  const [fromYear, setFromYear] =
    useState('');

  const [toYear, setToYear] =
    useState('');

  const [programmeId, setProgrammeId] =
    useState('');

  const [fromClassId, setFromClassId] =
    useState('');

  const [toClassId, setToClassId] =
    useState('');

  const [enrollments, setEnrollments] =
    useState<Enrollment[]>([]);

  const [selectedStudents, setSelectedStudents] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [promoting, setPromoting] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const [search, setSearch] =
    useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setMessage('');
    setError('');

    const [
      academicYearsResult,
      programmesResult,
      classesResult,
    ] = await Promise.all([
      supabase
        .from('academic_years')
        .select(
          'id, name, start_date, end_date, is_current'
        )
        .order('start_date', {
          ascending: false,
          nullsFirst: false,
        })
        .order('name', {
          ascending: false,
        }),

      supabase
        .from('programmes')
        .select(
          'id, name, code'
        )
        .order('name'),

      supabase
        .from('classes')
        .select(
          'id, name, level, programme_id, academic_year_id'
        )
        .order('name'),
    ]);

    if (academicYearsResult.error) {
      setError(
        academicYearsResult.error.message
      );
    }

    if (programmesResult.error) {
      setError(
        programmesResult.error.message
      );
    }

    if (classesResult.error) {
      setError(
        classesResult.error.message
      );
    }

    const years =
      (academicYearsResult.data ||
        []) as AcademicYear[];

    setAcademicYears(years);

    setProgrammes(
      (programmesResult.data ||
        []) as Programme[]
    );

    setClasses(
      (classesResult.data ||
        []) as ClassItem[]
    );

    /*
     * The CURRENT academic year is the year
     * students are being promoted FROM.
     *
     * The next academic year is the
     * destination.
     */
    const currentYear =
      years.find(
        (year) =>
          year.is_current
      );

    if (currentYear) {
      setFromYear(
        currentYear.id
      );

      const nextYear =
        years
          .filter(
            (year) =>
              year.id !==
              currentYear.id
          )
          .sort((a, b) => {
            const aDate =
              a.start_date ||
              '';

            const bDate =
              b.start_date ||
              '';

            return aDate.localeCompare(
              bDate
            );
          })
          .find((year) => {
            if (
              !currentYear.start_date ||
              !year.start_date
            ) {
              return false;
            }

            return (
              year.start_date >
              currentYear.start_date
            );
          });

      if (nextYear) {
        setToYear(
          nextYear.id
        );
      }
    }

    setLoading(false);
  }

  const fromClasses =
    useMemo(() => {
      return classes.filter(
        (item) => {
          const yearMatches =
            item.academic_year_id ===
              fromYear ||
            item.academic_year_id ===
              null;

          const programmeMatches =
            !programmeId ||
            item.programme_id ===
              programmeId;

          return (
            yearMatches &&
            programmeMatches
          );
        }
      );
    }, [
      classes,
      fromYear,
      programmeId,
    ]);

  const toClasses =
    useMemo(() => {
      return classes.filter(
        (item) => {
          const yearMatches =
            item.academic_year_id ===
            toYear;

          const programmeMatches =
            !programmeId ||
            item.programme_id ===
              programmeId;

          return (
            yearMatches &&
            programmeMatches
          );
        }
      );
    }, [
      classes,
      toYear,
      programmeId,
    ]);

  const filteredEnrollments =
    useMemo(() => {
      const term =
        search
          .toLowerCase()
          .trim();

      if (!term) {
        return enrollments;
      }

      return enrollments.filter(
        (item) => {
          const student =
            item.students;

          return (
            student?.full_name
              .toLowerCase()
              .includes(term) ||
            student?.admission_number
              .toLowerCase()
              .includes(term)
          );
        }
      );
    }, [
      enrollments,
      search,
    ]);

  async function loadStudents() {
    setError('');
    setMessage('');

    if (!fromYear) {
      setError(
        'Please select the current academic year.'
      );
      return;
    }

    if (!fromClassId) {
      setError(
        'Please select the current class.'
      );
      return;
    }

    setLoading(true);
    setSelectedStudents([]);

    const {
      data,
      error: loadError,
    } = await supabase
      .from('enrollments')
      .select(`
        id,
        student_id,
        class_id,
        academic_year_id,
        programme_id,
        status,
        students (
          id,
          admission_number,
          full_name
        )
      `)
      .eq(
        'academic_year_id',
        fromYear
      )
      .eq(
        'class_id',
        fromClassId
      )
      .eq(
        'status',
        'active'
      )
      .order(
        'created_at'
      );

    if (loadError) {
      setError(
        loadError.message
      );
      setEnrollments([]);
    } else {
      const normalized:
        Enrollment[] =
        (data || []).map(
          (item: any) => ({
            id: item.id,
            student_id:
              item.student_id,
            class_id:
              item.class_id,
            academic_year_id:
              item.academic_year_id,
            programme_id:
              item.programme_id,
            status:
              item.status,
            students:
              Array.isArray(
                item.students
              )
                ? item.students[0] ||
                  null
                : item.students ||
                  null,
          })
        );

      setEnrollments(
        normalized
      );

      if (
        normalized.length ===
        0
      ) {
        setMessage(
          'No active students were found in this class for the selected academic year.'
        );
      }
    }

    setLoading(false);
  }

  function toggleStudent(
    studentId: string
  ) {
    setSelectedStudents(
      (current) =>
        current.includes(
          studentId
        )
          ? current.filter(
              (id) =>
                id !==
                studentId
            )
          : [
              ...current,
              studentId,
            ]
    );
  }

  function selectAll() {
    setSelectedStudents(
      filteredEnrollments
        .map(
          (item) =>
            item.student_id
        )
        .filter(Boolean)
    );
  }

  function clearAll() {
    setSelectedStudents([]);
  }

  async function promoteStudents() {
    setError('');
    setMessage('');

    if (!fromYear || !toYear) {
      setError(
        'Please select both academic years.'
      );
      return;
    }

    if (fromYear === toYear) {
      setError(
        'The current and destination academic years cannot be the same.'
      );
      return;
    }

    if (!toClassId) {
      setError(
        'Please select the destination class.'
      );
      return;
    }

    if (
      selectedStudents.length ===
      0
    ) {
      setError(
        'Please select at least one student.'
      );
      return;
    }

    const destinationClass =
      classes.find(
        (item) =>
          item.id ===
          toClassId
      );

    if (!destinationClass) {
      setError(
        'The selected destination class could not be found.'
      );
      return;
    }

    const fromYearName =
      academicYears.find(
        (year) =>
          year.id ===
          fromYear
      )?.name || '';

    const toYearName =
      academicYears.find(
        (year) =>
          year.id ===
          toYear
      )?.name || '';

    const confirmed =
      window.confirm(
        `Promote ${selectedStudents.length} student(s) from ${fromYearName} to ${toYearName} — ${destinationClass.name}?`
      );

    if (!confirmed) {
      return;
    }

    setPromoting(true);

    const rows =
      selectedStudents.map(
        (studentId) => ({
          student_id:
            studentId,
          class_id:
            toClassId,
          academic_year_id:
            toYear,
          programme_id:
            destinationClass.programme_id ||
            programmeId ||
            null,
          enrollment_date:
            new Date()
              .toISOString()
              .slice(0, 10),
          status:
            'active',
        })
      );

    const {
      error: insertError,
    } = await supabase
      .from('enrollments')
      .upsert(rows, {
        onConflict:
          'student_id,academic_year_id',
      });

    if (insertError) {
      setError(
        `Promotion failed: ${insertError.message}`
      );
      setPromoting(false);
      return;
    }

    setMessage(
      `${selectedStudents.length} student(s) successfully promoted to ${toYearName} — ${destinationClass.name}.`
    );

    setSelectedStudents([]);

    setPromoting(false);
  }

  const fromYearName =
    academicYears.find(
      (item) =>
        item.id ===
        fromYear
    )?.name || '';

  const toYearName =
    academicYears.find(
      (item) =>
        item.id ===
        toYear
    )?.name || '';

  const fromClassName =
    classes.find(
      (item) =>
        item.id ===
        fromClassId
    )?.name || '';

  const toClassName =
    classes.find(
      (item) =>
        item.id ===
        toClassId
    )?.name || '';

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-8 lg:pt-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Student Promotion
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Promote students to the next academic year while preserving all previous records.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="font-semibold text-blue-900">
            Promotion preserves history
          </p>

          <p className="mt-1 text-sm text-blue-800">
            The student's previous enrollment, assessments, attendance and report cards remain unchanged. A new enrollment is created for the destination academic year.
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

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Current Academic Year
              </label>

              <select
                value={fromYear}
                onChange={(e) => {
                  setFromYear(
                    e.target.value
                  );
                  setFromClassId('');
                  setEnrollments([]);
                  setSelectedStudents([]);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                <option value="">
                  Select current academic year
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
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Destination Academic Year
              </label>

              <select
                value={toYear}
                onChange={(e) => {
                  setToYear(
                    e.target.value
                  );
                  setToClassId('');
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                <option value="">
                  Select destination academic year
                </option>

                {academicYears.map(
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

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Programme
              </label>

              <select
                value={programmeId}
                onChange={(e) => {
                  setProgrammeId(
                    e.target.value
                  );
                  setFromClassId('');
                  setToClassId('');
                  setEnrollments([]);
                  setSelectedStudents([]);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                <option value="">
                  All programmes
                </option>

                {programmes.map(
                  (programme) => (
                    <option
                      key={
                        programme.id
                      }
                      value={
                        programme.id
                      }
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
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Current Class
              </label>

              <select
                value={fromClassId}
                onChange={(e) => {
                  setFromClassId(
                    e.target.value
                  );
                  setEnrollments([]);
                  setSelectedStudents([]);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                <option value="">
                  Select current class
                </option>

                {fromClasses.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="md:col-span-2">

              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Promote To Class
              </label>

              <select
                value={toClassId}
                onChange={(e) =>
                  setToClassId(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                <option value="">
                  Select destination class
                </option>

                {toClasses.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name}
                    </option>
                  )
                )}
              </select>

            </div>

          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">

            <p className="text-sm font-semibold text-slate-700">
              Promotion pathway
            </p>

            <p className="mt-1 text-sm text-slate-600">
              {fromYearName || 'Current year'}{' '}
              →{' '}
              {toYearName || 'Destination year'}
            </p>

            {fromClassName &&
              toClassName && (
                <p className="mt-1 text-sm font-medium text-green-700">
                  {fromClassName} →{' '}
                  {toClassName}
                </p>
              )}

          </div>

          <button
            onClick={loadStudents}
            disabled={loading}
            className="mt-5 rounded-xl bg-slate-800 px-5 py-3 font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {loading
              ? 'Loading...'
              : 'Load Students'}
          </button>

        </div>

        {enrollments.length >
          0 && (
          <div className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

            <div className="border-b border-slate-200 p-5">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Students to Promote
                  </h2>

                  <p className="text-sm text-slate-600">
                    {fromYearName} —{' '}
                    {fromClassName}
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Search student..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 lg:max-w-xs"
                />

              </div>

              <div className="mt-4 flex flex-wrap gap-2">

                <button
                  onClick={
                    selectAll
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Select All
                </button>

                <button
                  onClick={
                    clearAll
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear All
                </button>

                <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                  Selected:{' '}
                  {
                    selectedStudents.length
                  }
                </span>

              </div>

            </div>

            <div className="overflow-x-auto">

              <table className="min-w-full divide-y divide-slate-200">

                <thead className="bg-slate-50">
                  <tr>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Select
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Student
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Admission No.
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">

                  {filteredEnrollments.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="hover:bg-slate-50"
                      >

                        <td className="px-4 py-3">

                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(
                              item.student_id
                            )}
                            onChange={() =>
                              toggleStudent(
                                item.student_id
                              )
                            }
                            className="h-5 w-5"
                          />

                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                          {item.students
                            ?.full_name ||
                            'Student unavailable'}
                        </td>

                        <td className="px-4 py-3 text-sm text-slate-700">
                          {item.students
                            ?.admission_number ||
                            '—'}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

            <div className="border-t border-slate-200 p-5">

              <button
                onClick={
                  promoteStudents
                }
                disabled={
                  promoting ||
                  selectedStudents.length ===
                    0 ||
                  !toYear ||
                  !toClassId
                }
                className="w-full rounded-xl bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {promoting
                  ? 'Promoting...'
                  : `Promote ${selectedStudents.length} Student${
                      selectedStudents.length ===
                      1
                        ? ''
                        : 's'
                    }`}
              </button>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}

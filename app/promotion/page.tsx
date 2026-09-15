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

const FORM_OPTIONS = [
  {
    value: 'Form 1',
    label: 'Form 1 → Form 2',
    destination: 'Form 2',
  },
  {
    value: 'Form 2',
    label: 'Form 2 → Form 3',
    destination: 'Form 3',
  },
  {
    value: 'Form 3',
    label: 'Form 3 → Graduated',
    destination: 'Graduated',
  },
];

function normalizeForm(value: string | null) {
  if (!value) return '';

  const text = value.toLowerCase().trim();

  if (
    text === 'form 1' ||
    text === 'form one' ||
    text === '1' ||
    text.includes('form 1')
  ) {
    return 'Form 1';
  }

  if (
    text === 'form 2' ||
    text === 'form two' ||
    text === '2' ||
    text.includes('form 2')
  ) {
    return 'Form 2';
  }

  if (
    text === 'form 3' ||
    text === 'form three' ||
    text === '3' ||
    text.includes('form 3')
  ) {
    return 'Form 3';
  }

  return value;
}

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

  const [fromForm, setFromForm] =
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
        .select('id, name, code')
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
        `Academic years could not be loaded: ${academicYearsResult.error.message}`
      );
    }

    if (programmesResult.error) {
      setError(
        `Programmes could not be loaded: ${programmesResult.error.message}`
      );
    }

    if (classesResult.error) {
      setError(
        `Classes could not be loaded: ${classesResult.error.message}`
      );
    }

    const years =
      (academicYearsResult.data || []) as AcademicYear[];

    const programmeData =
      (programmesResult.data || []) as Programme[];

    const classData =
      (classesResult.data || []) as ClassItem[];

    setAcademicYears(years);
    setProgrammes(programmeData);
    setClasses(classData);

    const currentYear =
      years.find(
        (year) => year.is_current
      );

    if (currentYear) {
      setFromYear(currentYear.id);

      const nextYear =
        years
          .filter(
            (year) =>
              year.id !== currentYear.id
          )
          .filter(
            (year) =>
              !!year.start_date &&
              !!currentYear.start_date
          )
          .sort((a, b) =>
            (a.start_date || '').localeCompare(
              b.start_date || ''
            )
          )
          .find(
            (year) =>
              (year.start_date || '') >
              (currentYear.start_date || '')
          );

      if (nextYear) {
        setToYear(nextYear.id);
      }
    }

    setLoading(false);
  }

  const fromYearName =
    academicYears.find(
      (year) => year.id === fromYear
    )?.name || '';

  const toYearName =
    academicYears.find(
      (year) => year.id === toYear
    )?.name || '';

  const selectedProgramme =
    programmes.find(
      (programme) =>
        programme.id === programmeId
    );

  const selectedForm =
    FORM_OPTIONS.find(
      (form) => form.value === fromForm
    );

  const destinationForm =
    selectedForm?.destination || '';

  const filteredEnrollments =
    useMemo(() => {
      const term =
        search.toLowerCase().trim();

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
    }, [enrollments, search]);

  const formCounts =
    useMemo(() => {
      const counts: Record<string, number> = {
        'Form 1': 0,
        'Form 2': 0,
        'Form 3': 0,
      };

      classes
        .filter(
          (item) =>
            item.academic_year_id ===
            fromYear
        )
        .forEach((item) => {
          const form =
            normalizeForm(item.level);

          if (
            form &&
            form in counts
          ) {
            counts[form] += 1;
          }
        });

      return counts;
    }, [classes, fromYear]);

  async function loadStudents() {
    setError('');
    setMessage('');
    setSearch('');
    setSelectedStudents([]);

    if (!fromYear) {
      setError(
        'Please select the current academic year.'
      );
      return;
    }

    if (!toYear) {
      setError(
        'Please select the destination academic year.'
      );
      return;
    }

    if (fromYear === toYear) {
      setError(
        'The current and destination academic years cannot be the same.'
      );
      return;
    }

    if (!fromForm) {
      setError(
        'Please select the Form to promote.'
      );
      return;
    }

    setLoading(true);

    /*
     * First find all classes in the selected
     * academic year that belong to the selected Form.
     *
     * This means the administrator does not have
     * to choose individual classes.
     */
    const sourceClasses =
      classes.filter((item) => {
        const form =
          normalizeForm(item.level);

        const yearMatches =
          item.academic_year_id ===
          fromYear;

        const formMatches =
          form === fromForm;

        const programmeMatches =
          !programmeId ||
          item.programme_id ===
            programmeId;

        return (
          yearMatches &&
          formMatches &&
          programmeMatches
        );
      });

    if (sourceClasses.length === 0) {
      setError(
        `No ${fromForm} classes were found for the selected academic year${
          selectedProgramme
            ? ` and programme ${selectedProgramme.name}`
            : ''
        }.`
      );

      setEnrollments([]);
      setLoading(false);
      return;
    }

    const sourceClassIds =
      sourceClasses.map(
        (item) => item.id
      );

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
      .in(
        'class_id',
        sourceClassIds
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
        `Students could not be loaded: ${loadError.message}`
      );

      setEnrollments([]);
      setLoading(false);
      return;
    }

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
        `No active students were found in ${fromForm} for the selected academic year.`
      );
    }

    setLoading(false);
  }

  function toggleStudent(
    studentId: string
  ) {
    setSelectedStudents(
      (current) =>
        current.includes(studentId)
          ? current.filter(
              (id) =>
                id !== studentId
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

  /*
   * Find the destination class automatically.
   *
   * The administrator only selects the Form.
   * We then use:
   *
   * Programme + Destination Form +
   * Destination Academic Year
   *
   * to find the appropriate class.
   */
  function findDestinationClass(
    programmeIdForStudent: string | null
  ) {
    const candidates =
      classes.filter((item) => {
        const yearMatches =
          item.academic_year_id ===
          toYear;

        const formMatches =
          normalizeForm(item.level) ===
          destinationForm;

        const programmeMatches =
          programmeIdForStudent
            ? item.programme_id ===
              programmeIdForStudent
            : !programmeIdForStudent
              ? true
              : false;

        return (
          yearMatches &&
          formMatches &&
          programmeMatches
        );
      });

    /*
     * If there is only one matching class,
     * it is unambiguous.
     */
    if (candidates.length === 1) {
      return candidates[0];
    }

    /*
     * If several classes exist, prefer the first
     * matching class. This keeps the promotion
     * process Form-based without forcing the admin
     * to choose a class.
     */
    if (candidates.length > 1) {
      return candidates[0];
    }

    return null;
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

    if (!fromForm) {
      setError(
        'Please select the Form to promote.'
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

    const confirmed =
      window.confirm(
        `Promote ${selectedStudents.length} student(s) from ${fromForm} to ${destinationForm} for ${toYearName}?`
      );

    if (!confirmed) {
      return;
    }

    setPromoting(true);

    /*
     * FORM 3 → GRADUATED
     *
     * No new class is required.
     * We simply mark the current active
     * enrollment as graduated.
     */
    if (fromForm === 'Form 3') {
      let successCount = 0;
      let failureMessage = '';

      for (const studentId of selectedStudents) {
        const currentEnrollment =
          enrollments.find(
            (item) =>
              item.student_id ===
              studentId
          );

        if (!currentEnrollment) {
          continue;
        }

        const {
          error: updateError,
        } = await supabase
          .from('enrollments')
          .update({
            status:
              'graduated',
          })
          .eq(
            'id',
            currentEnrollment.id
          );

        if (updateError) {
          failureMessage =
            updateError.message;
          break;
        }

        successCount++;
      }

      if (failureMessage) {
        setError(
          `Graduation was partially completed. ${successCount} student(s) were processed before the error: ${failureMessage}`
        );
      } else {
        setMessage(
          `${successCount} Form 3 student(s) have been successfully marked as graduated.`
        );
      }

      setSelectedStudents([]);
      setPromoting(false);

      await loadStudents();

      return;
    }

    /*
     * FORM 1 → FORM 2
     * FORM 2 → FORM 3
     */
    const rows: {
      student_id: string;
      class_id: string;
      academic_year_id: string;
      programme_id: string | null;
      enrollment_date: string;
      status: string;
    }[] = [];

    const missingDestinationStudents: string[] = [];

    for (const studentId of selectedStudents) {
      const enrollment =
        enrollments.find(
          (item) =>
            item.student_id ===
            studentId
        );

      if (!enrollment) {
        continue;
      }

      const studentProgrammeId =
        enrollment.programme_id ||
        classes.find(
          (item) =>
            item.id ===
            enrollment.class_id
        )?.programme_id ||
        null;

      const destinationClass =
        findDestinationClass(
          studentProgrammeId
        );

      if (!destinationClass) {
        const studentName =
          enrollment.students
            ?.full_name ||
          enrollment.student_id;

        missingDestinationStudents.push(
          studentName
        );

        continue;
      }

      rows.push({
        student_id:
          studentId,
        class_id:
          destinationClass.id,
        academic_year_id:
          toYear,
        programme_id:
          studentProgrammeId ||
          destinationClass.programme_id ||
          null,
        enrollment_date:
          new Date()
            .toISOString()
            .slice(0, 10),
        status:
          'active',
      });
    }

    if (
      missingDestinationStudents.length >
      0
    ) {
      setError(
        `No destination ${destinationForm} class could be found for: ${missingDestinationStudents
          .slice(0, 5)
          .join(', ')}${
          missingDestinationStudents.length >
          5
            ? ` and ${
                missingDestinationStudents.length -
                5
              } more student(s)`
            : ''
        }. Please make sure the destination Form classes exist for their programmes.`
      );

      setPromoting(false);
      return;
    }

    if (rows.length === 0) {
      setError(
        'No students could be prepared for promotion.'
      );

      setPromoting(false);
      return;
    }

    /*
     * Insert the new academic-year enrollments.
     *
     * We intentionally do NOT modify the old
     * enrollment. This preserves the student's
     * academic history.
     */
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
      `${rows.length} student(s) successfully promoted from ${fromForm} to ${destinationForm} for ${toYearName}. Previous academic records remain unchanged.`
    );

    setSelectedStudents([]);

    setPromoting(false);

    /*
     * Refresh the list so the administrator
     * can immediately see the updated state.
     */
    await loadStudents();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-8 lg:pt-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl text-white shadow-lg">
              <i className="fa-solid fa-arrow-up" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Student Promotion
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                Promote students by Form while preserving their complete academic history.
              </p>
            </div>
          </div>
        </div>

        {/* Information */}
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex gap-3">
            <i className="fa-solid fa-circle-info mt-1 text-blue-600" />

            <div>
              <p className="font-semibold text-blue-900">
                Form-based promotion
              </p>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                Select Form 1, Form 2 or Form 3. You no longer need to select individual classes. BTI-SMS uses the existing Form and programme information to determine the students to promote.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm">
                  Form 1 → Form 2
                </span>

                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm">
                  Form 2 → Form 3
                </span>

                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-purple-700 shadow-sm">
                  Form 3 → Graduated
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Errors */}
        {error && (
          <div className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            <i className="fa-solid fa-circle-exclamation mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success */}
        {message && (
          <div className="mb-5 flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
            <i className="fa-solid fa-circle-check mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {/* Selection panel */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">

          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <i className="fa-solid fa-filter" />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">
                Promotion Setup
              </h2>

              <p className="text-xs text-slate-500">
                Select the academic years, programme and Form.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            {/* Current year */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Current Academic Year
              </label>

              <select
                value={fromYear}
                onChange={(e) => {
                  setFromYear(e.target.value);
                  setEnrollments([]);
                  setSelectedStudents([]);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

            {/* Destination year */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Destination Academic Year
              </label>

              <select
                value={toYear}
                onChange={(e) => {
                  setToYear(e.target.value);
                  setEnrollments([]);
                  setSelectedStudents([]);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

            {/* Programme */}
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

                  setEnrollments([]);
                  setSelectedStudents([]);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  All programmes
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

            {/* Form */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Promote From Form
              </label>

              <select
                value={fromForm}
                onChange={(e) => {
                  setFromForm(
                    e.target.value
                  );

                  setEnrollments([]);
                  setSelectedStudents([]);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select Form
                </option>

                {FORM_OPTIONS.map(
                  (form) => (
                    <option
                      key={form.value}
                      value={form.value}
                    >
                      {form.label}
                    </option>
                  )
                )}
              </select>
            </div>

          </div>

          {/* Form pathway */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">

            <div className="grid gap-4 sm:grid-cols-3">

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  From
                </p>

                <p className="mt-1 text-lg font-bold text-slate-900">
                  {fromForm || '—'}
                </p>

                <p className="text-xs text-slate-500">
                  {fromYearName || 'Current year'}
                </p>
              </div>

              <div className="flex items-center justify-center">
                <i className="fa-solid fa-arrow-right text-xl text-blue-600" />
              </div>

              <div className="sm:text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  To
                </p>

                <p className="mt-1 text-lg font-bold text-green-700">
                  {destinationForm || '—'}
                </p>

                <p className="text-xs text-slate-500">
                  {toYearName || 'Destination year'}
                </p>
              </div>

            </div>

          </div>

          {/* Form availability */}
          {fromYear && (
            <div className="mt-5 grid grid-cols-3 gap-3">

              {['Form 1', 'Form 2', 'Form 3'].map(
                (form) => (
                  <div
                    key={form}
                    className={`rounded-xl border p-4 ${
                      fromForm === form
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-500">
                      {form}
                    </p>

                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {formCounts[form] || 0}
                    </p>

                    <p className="text-xs text-slate-500">
                      class / classes
                    </p>
                  </div>
                )
              )}

            </div>
          )}

          {/* Load students */}
          <button
            onClick={loadStudents}
            disabled={
              loading ||
              !fromYear ||
              !toYear ||
              !fromForm
            }
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i
              className={`fa-solid ${
                loading
                  ? 'fa-spinner fa-spin'
                  : 'fa-users'
              }`}
            />

            {loading
              ? 'Loading Students...'
              : 'Load Students'}
          </button>

        </div>

        {/* Student list */}
        {enrollments.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

            <div className="border-b border-slate-200 p-5">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div>
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-user-graduate text-blue-600" />

                    <h2 className="text-lg font-bold text-slate-900">
                      Students to Promote
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-slate-600">
                    {fromForm} →{' '}
                    {destinationForm} •{' '}
                    {fromYearName} →{' '}
                    {toYearName}
                  </p>

                  {selectedProgramme && (
                    <p className="mt-1 text-xs font-semibold text-blue-600">
                      Programme: {selectedProgramme.name}
                    </p>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Search name or admission number..."
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 lg:max-w-sm"
                />

              </div>

              <div className="mt-4 flex flex-wrap gap-2">

                <button
                  onClick={selectAll}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <i className="fa-solid fa-check-double" />
                  Select All
                </button>

                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <i className="fa-solid fa-xmark" />
                  Clear All
                </button>

                <span className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                  <i className="fa-solid fa-user-check" />
                  Selected: {selectedStudents.length}
                </span>

                <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                  <i className="fa-solid fa-users" />
                  Total: {enrollments.length}
                </span>

              </div>

            </div>

            <div className="overflow-x-auto">

              <table className="min-w-full divide-y divide-slate-200">

                <thead className="bg-slate-50">
                  <tr>

                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Select
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Student
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Admission No.
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Current Form
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">

                  {filteredEnrollments.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className={`transition hover:bg-slate-50 ${
                          selectedStudents.includes(
                            item.student_id
                          )
                            ? 'bg-blue-50/60'
                            : ''
                        }`}
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
                            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />

                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">

                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                              <i className="fa-solid fa-user" />
                            </div>

                            <span className="text-sm font-semibold text-slate-900">
                              {item.students
                                ?.full_name ||
                                'Student unavailable'}
                            </span>

                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm font-medium text-slate-700">
                          {item.students
                            ?.admission_number ||
                            '—'}
                        </td>

                        <td className="px-4 py-3">

                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                            {fromForm}
                          </span>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

              {filteredEnrollments.length ===
                0 && (
                <div className="p-10 text-center">
                  <i className="fa-solid fa-user-slash text-3xl text-slate-300" />

                  <p className="mt-3 font-semibold text-slate-700">
                    No students match your search.
                  </p>
                </div>
              )}

            </div>

            {/* Action */}
            <div className="border-t border-slate-200 bg-slate-50 p-5">

              <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">

                <div className="flex gap-3">
                  <i className="fa-solid fa-arrow-right-arrow-left mt-1 text-green-600" />

                  <div>
                    <p className="text-sm font-bold text-green-900">
                      Promotion action
                    </p>

                    <p className="mt-1 text-sm text-green-800">
                      {fromForm} students will move to{' '}
                      <strong>
                        {destinationForm}
                      </strong>{' '}
                      for the{' '}
                      <strong>
                        {toYearName}
                      </strong>{' '}
                      academic year.
                    </p>

                    <p className="mt-1 text-xs text-green-700">
                      Previous academic records will remain unchanged.
                    </p>
                  </div>
                </div>

              </div>

              <button
                onClick={promoteStudents}
                disabled={
                  promoting ||
                  selectedStudents.length === 0
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <i
                  className={`fa-solid ${
                    promoting
                      ? 'fa-spinner fa-spin'
                      : fromForm === 'Form 3'
                        ? 'fa-graduation-cap'
                        : 'fa-arrow-up'
                  }`}
                />

                {promoting
                  ? 'Processing...'
                  : fromForm === 'Form 3'
                    ? `Graduate ${selectedStudents.length} Student${
                        selectedStudents.length === 1
                          ? ''
                          : 's'
                      }`
                    : `Promote ${selectedStudents.length} Student${
                        selectedStudents.length === 1
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

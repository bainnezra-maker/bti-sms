'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [programmeId, setProgrammeId] = useState('');
  const [fromClassId, setFromClassId] = useState('');
  const [toClassId, setToClassId] = useState('');

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setMessage('');

    const [
      academicYearsResult,
      programmesResult,
      classesResult,
    ] = await Promise.all([
      supabase
        .from('academic_years')
        .select('id, name, is_current')
        .order('name', { ascending: false }),

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
      setMessage(academicYearsResult.error.message);
    }

    if (programmesResult.error) {
      setMessage(programmesResult.error.message);
    }

    if (classesResult.error) {
      setMessage(classesResult.error.message);
    }

    setAcademicYears(academicYearsResult.data || []);
    setProgrammes(programmesResult.data || []);
    setClasses(classesResult.data || []);

    const currentYear = (academicYearsResult.data || []).find(
      (year) => year.is_current
    );

    if (currentYear) {
      setToYear(currentYear.id);

      const currentIndex = (academicYearsResult.data || []).findIndex(
        (year) => year.id === currentYear.id
      );

      if (currentIndex >= 0) {
        const previousYear =
          (academicYearsResult.data || [])[currentIndex + 1];

        if (previousYear) {
          setFromYear(previousYear.id);
        }
      }
    }

    setLoading(false);
  }

  const fromClasses = useMemo(() => {
    return classes.filter(
      (item) =>
        item.academic_year_id === fromYear &&
        (!programmeId || item.programme_id === programmeId)
    );
  }, [classes, fromYear, programmeId]);

  const toClasses = useMemo(() => {
    return classes.filter(
      (item) =>
        item.academic_year_id === toYear &&
        (!programmeId || item.programme_id === programmeId)
    );
  }, [classes, toYear, programmeId]);

  const filteredEnrollments = useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return enrollments;

    return enrollments.filter((item) => {
      const student = item.students;

      return (
        student?.full_name.toLowerCase().includes(term) ||
        student?.admission_number.toLowerCase().includes(term)
      );
    });
  }, [enrollments, search]);

  async function loadStudents() {
    if (!fromYear || !fromClassId) {
      setMessage('Please select the current academic year and class.');
      return;
    }

    setLoading(true);
    setMessage('');
    setSelectedStudents([]);

    const { data, error } = await supabase
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
      .eq('academic_year_id', fromYear)
      .eq('class_id', fromClassId)
      .eq('status', 'active')
      .order('created_at');

    if (error) {
      setMessage(error.message);
      setEnrollments([]);
    } else {
      /*
       * Supabase returns the related students record as an array
       * in this query. Normalize it into a single Student object
       * so it matches our Enrollment type.
       */
      const normalizedEnrollments: Enrollment[] = (data || []).map(
        (item: any) => ({
          id: item.id,
          student_id: item.student_id,
          class_id: item.class_id,
          academic_year_id: item.academic_year_id,
          programme_id: item.programme_id,
          status: item.status,
          students: Array.isArray(item.students)
            ? item.students[0] || null
            : item.students || null,
        })
      );

      setEnrollments(normalizedEnrollments);
    }

    setLoading(false);
  }

  function toggleStudent(studentId: string) {
    setSelectedStudents((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  }

  function selectAll() {
    setSelectedStudents(
      filteredEnrollments
        .map((item) => item.student_id)
        .filter(Boolean)
    );
  }

  function clearAll() {
    setSelectedStudents([]);
  }

  async function promoteStudents() {
    if (!toYear || !toClassId) {
      setMessage('Please select the destination academic year and class.');
      return;
    }

    if (!selectedStudents.length) {
      setMessage('Please select at least one student.');
      return;
    }

    if (fromYear === toYear) {
      setMessage(
        'The current and destination academic years cannot be the same.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Promote ${selectedStudents.length} student(s) to the selected class?`
    );

    if (!confirmed) return;

    setPromoting(true);
    setMessage('');

    const destinationClass = classes.find(
      (item) => item.id === toClassId
    );

    const rows = selectedStudents.map((studentId) => ({
      student_id: studentId,
      class_id: toClassId,
      academic_year_id: toYear,
      programme_id:
        destinationClass?.programme_id || programmeId || null,
      enrollment_date: new Date().toISOString().split('T')[0],
      status: 'active',
    }));

    const { error } = await supabase
      .from('enrollments')
      .upsert(rows, {
        onConflict: 'student_id,academic_year_id',
      });

    if (error) {
      setMessage(`Promotion failed: ${error.message}`);
      setPromoting(false);
      return;
    }

    setMessage(
      `${selectedStudents.length} student(s) successfully promoted.`
    );

    setSelectedStudents([]);

    await loadStudents();

    setPromoting(false);
  }

  const fromYearName =
    academicYears.find((item) => item.id === fromYear)?.name || '';

  const toYearName =
    academicYears.find((item) => item.id === toYear)?.name || '';

  const fromClassName =
    classes.find((item) => item.id === fromClassId)?.name || '';

  const toClassName =
    classes.find((item) => item.id === toClassId)?.name || '';

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Student Promotion
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Promote students to the next academic year while preserving
            their previous academic history.
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">

          <div className="grid gap-4 md:grid-cols-2">

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Current Academic Year
              </label>

              <select
                value={fromYear}
                onChange={(e) => {
                  setFromYear(e.target.value);
                  setFromClassId('');
                  setEnrollments([]);
                  setSelectedStudents([]);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                <option value="">Select current academic year</option>

                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Destination Academic Year
              </label>

              <select
                value={toYear}
                onChange={(e) => {
                  setToYear(e.target.value);
                  setToClassId('');
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                <option value="">Select destination academic year</option>

                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Programme
              </label>

              <select
                value={programmeId}
                onChange={(e) => {
                  setProgrammeId(e.target.value);
                  setFromClassId('');
                  setToClassId('');
                  setEnrollments([]);
                  setSelectedStudents([]);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                <option value="">Select programme</option>

                {programmes.map((programme) => (
                  <option key={programme.id} value={programme.id}>
                    {programme.name}
                    {programme.code
                      ? ` (${programme.code})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Current Class
              </label>

              <select
                value={fromClassId}
                onChange={(e) => {
                  setFromClassId(e.target.value);
                  setEnrollments([]);
                  setSelectedStudents([]);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                <option value="">Select current class</option>

                {fromClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Promote To Class
              </label>

              <select
                value={toClassId}
                onChange={(e) => setToClassId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                <option value="">Select destination class</option>

                {toClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={loadStudents}
              disabled={loading}
              className="rounded-lg bg-slate-800 px-5 py-2.5 font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load Students'}
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        {enrollments.length > 0 && (
          <div className="mt-6 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">

            <div className="border-b border-slate-200 p-4 sm:p-6">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Students
                  </h2>

                  <p className="text-sm text-slate-600">
                    {fromYearName} — {fromClassName}
                  </p>

                  {toClassName && (
                    <p className="text-sm font-medium text-green-700">
                      Destination: {toYearName} — {toClassName}
                    </p>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Search student..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 lg:max-w-xs"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">

                <button
                  onClick={selectAll}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Select All
                </button>

                <button
                  onClick={clearAll}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Clear All
                </button>

                <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                  Selected: {selectedStudents.length}
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
                      Admission No.
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Student Name
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">

                  {filteredEnrollments.map((item) => {
                    const student = item.students;

                    if (!student) return null;

                    const checked = selectedStudents.includes(
                      student.id
                    );

                    return (
                      <tr
                        key={student.id}
                        className={checked ? 'bg-blue-50' : ''}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleStudent(student.id)
                            }
                            className="h-5 w-5"
                          />
                        </td>

                        <td className="px-4 py-3 text-sm font-medium text-slate-700">
                          {student.admission_number}
                        </td>

                        <td className="px-4 py-3 text-sm text-slate-900">
                          {student.full_name}
                        </td>
                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>

            <div className="border-t border-slate-200 p-4 sm:p-6">

              <button
                onClick={promoteStudents}
                disabled={
                  promoting ||
                  selectedStudents.length === 0 ||
                  !toYear ||
                  !toClassId
                }
                className="w-full rounded-lg bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {promoting
                  ? 'Promoting Students...'
                  : `Promote Selected (${selectedStudents.length})`}
              </button>

            </div>

          </div>
        )}

        {!loading &&
          fromClassId &&
          enrollments.length === 0 && (
            <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
              <p className="font-medium text-slate-700">
                No active students found in the selected class.
              </p>
            </div>
          )}

      </div>
    </div>
  );
}

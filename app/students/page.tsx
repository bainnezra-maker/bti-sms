'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  admission_number: string;
  full_name: string;
  gender: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  admission_date: string;
  jhs_aggregate: number | null;
  status: string;
};

type Programme = {
  id: string;
  name: string;
};

type SchoolClass = {
  id: string;
  name: string;
  programme_id: string | null;
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
};

type Enrollment = {
  student_id: string;
  class_id: string;
  academic_year_id: string;
  status: string | null;
};

type StudentAcademicInfo = {
  classId: string;
  className: string;
  programmeId: string | null;
  programmeName: string;
  academicYearName: string;
};

export default function StudentsPage() {
  const supabase = createClient();

  const [students, setStudents] = useState<Student[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [search, setSearch] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadStudents() {
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      setError('School profile could not be found.');
      setLoading(false);
      return;
    }

    const schoolId = profile.school_id;

    const [
      studentsResult,
      programmesResult,
      classesResult,
      academicYearsResult,
      enrollmentsResult,
    ] = await Promise.all([
      supabase
        .from('students')
        .select(
          'id, admission_number, full_name, gender, guardian_name, guardian_phone, admission_date, jhs_aggregate, status'
        )
        .eq('school_id', schoolId)
        .order('full_name'),

      supabase
        .from('programmes')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name'),

      supabase
        .from('classes')
        .select('id, name, programme_id')
        .eq('school_id', schoolId)
        .order('name'),

      supabase
        .from('academic_years')
        .select('id, name, start_date')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false }),

      supabase
        .from('enrollments')
        .select('student_id, class_id, academic_year_id, status')
        .eq('status', 'active'),
    ]);

    if (studentsResult.error) {
      setError(studentsResult.error.message);
      setLoading(false);
      return;
    }

    if (programmesResult.error) {
      setError(programmesResult.error.message);
      setLoading(false);
      return;
    }

    if (classesResult.error) {
      setError(classesResult.error.message);
      setLoading(false);
      return;
    }

    if (academicYearsResult.error) {
      setError(academicYearsResult.error.message);
      setLoading(false);
      return;
    }

    if (enrollmentsResult.error) {
      setError(enrollmentsResult.error.message);
      setLoading(false);
      return;
    }

    setStudents(studentsResult.data ?? []);
    setProgrammes(programmesResult.data ?? []);
    setClasses(classesResult.data ?? []);
    setAcademicYears(academicYearsResult.data ?? []);
    setEnrollments(enrollmentsResult.data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    loadStudents();
  }, []);

  const programmeMap = useMemo(() => {
    return new Map(
      programmes.map((programme) => [programme.id, programme])
    );
  }, [programmes]);

  const classMap = useMemo(() => {
    return new Map(
      classes.map((schoolClass) => [schoolClass.id, schoolClass])
    );
  }, [classes]);

  const academicYearMap = useMemo(() => {
    return new Map(
      academicYears.map((year) => [year.id, year])
    );
  }, [academicYears]);

  /*
   * Determine each student's current active academic information.
   * The newest academic year is preferred if more than one active
   * enrollment exists.
   */
  const currentAcademicInfo = useMemo(() => {
    const infoMap = new Map<string, StudentAcademicInfo>();

    const sortedEnrollments = [...enrollments].sort((a, b) => {
      const yearA =
        academicYearMap.get(a.academic_year_id)?.start_date ?? '';

      const yearB =
        academicYearMap.get(b.academic_year_id)?.start_date ?? '';

      return yearB.localeCompare(yearA);
    });

    for (const enrollment of sortedEnrollments) {
      if (infoMap.has(enrollment.student_id)) {
        continue;
      }

      const schoolClass = classMap.get(enrollment.class_id);

      const programmeId = schoolClass?.programme_id ?? null;

      const programme = programmeId
        ? programmeMap.get(programmeId)
        : undefined;

      const academicYear = academicYearMap.get(
        enrollment.academic_year_id
      );

      infoMap.set(enrollment.student_id, {
        classId: enrollment.class_id,
        className: schoolClass?.name ?? '',
        programmeId,
        programmeName: programme?.name ?? '',
        academicYearName: academicYear?.name ?? '',
      });
    }

    return infoMap;
  }, [
    enrollments,
    academicYearMap,
    classMap,
    programmeMap,
  ]);

  /*
   * When a programme is selected, only classes belonging
   * to that programme appear in the Class dropdown.
   */
  const availableClasses = useMemo(() => {
    if (programmeFilter === 'all') {
      return classes;
    }

    return classes.filter(
      (schoolClass) =>
        schoolClass.programme_id === programmeFilter
    );
  }, [classes, programmeFilter]);

  const filteredStudents = useMemo(() => {
    const query = search.toLowerCase().trim();

    return students.filter((student) => {
      const academicInfo =
        currentAcademicInfo.get(student.id);

      const matchesSearch =
        !query ||
        student.full_name
          .toLowerCase()
          .includes(query) ||
        student.admission_number
          .toLowerCase()
          .includes(query);

      const matchesProgramme =
        programmeFilter === 'all' ||
        academicInfo?.programmeId === programmeFilter;

      const matchesClass =
        classFilter === 'all' ||
        academicInfo?.classId === classFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        student.status === statusFilter;

      return (
        matchesSearch &&
        matchesProgramme &&
        matchesClass &&
        matchesStatus
      );
    });
  }, [
    students,
    search,
    programmeFilter,
    classFilter,
    statusFilter,
    currentAcademicInfo,
  ]);

  const activeCount = students.filter(
    (student) => student.status === 'active'
  ).length;

  const graduatedCount = students.filter(
    (student) => student.status === 'graduated'
  ).length;

  const otherCount =
    students.length -
    activeCount -
    graduatedCount;

  async function deleteStudent(
    id: string,
    name: string
  ) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${name}? This cannot be undone.`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (deleteError) {
      alert(deleteError.message);
      return;
    }

    setStudents((current) =>
      current.filter(
        (student) => student.id !== id
      )
    );
  }

  function clearFilters() {
    setSearch('');
    setProgrammeFilter('all');
    setClassFilter('all');
    setStatusFilter('all');
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-500">
            Loading students...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-blue-600">
              Student Information System
            </p>

            <h1 className="text-3xl font-bold text-slate-900">
              Students
            </h1>

            <p className="mt-1 text-slate-500">
              Search, filter and manage student records.
            </p>
          </div>

          <Link
            href="/students/add"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            + Add Student
          </Link>
        </div>

        {/* Statistics */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Students
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {students.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Active Students
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {activeCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Other Status
            </p>

            <p className="mt-2 text-3xl font-bold text-orange-500">
              {graduatedCount + otherCount}
            </p>
          </div>

        </div>

        {/* Search and Filters */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">

            {/* Search */}
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Search Student
              </label>

              <input
                type="text"
                placeholder="Name or admission number..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Programme */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Programme
              </label>

              <select
                value={programmeFilter}
                onChange={(event) => {
                  setProgrammeFilter(
                    event.target.value
                  );
                  setClassFilter('all');
                }}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="all">
                  All Programmes
                </option>

                {programmes.map((programme) => (
                  <option
                    key={programme.id}
                    value={programme.id}
                  >
                    {programme.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Class */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Class
              </label>

              <select
                value={classFilter}
                onChange={(event) =>
                  setClassFilter(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="all">
                  All Classes
                </option>

                {availableClasses.map((schoolClass) => (
                  <option
                    key={schoolClass.id}
                    value={schoolClass.id}
                  >
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="all">
                  All Students
                </option>

                <option value="active">
                  Active
                </option>

                <option value="graduated">
                  Graduated
                </option>

                <option value="withdrawn">
                  Withdrawn
                </option>

                <option value="suspended">
                  Suspended
                </option>

                <option value="transferred">
                  Transferred
                </option>
              </select>
            </div>

            {/* Clear */}
            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear Filters
              </button>
            </div>

          </div>

          {/* Filter Summary */}
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">

            <span>
              Showing{' '}
              <strong className="text-slate-900">
                {filteredStudents.length}
              </strong>{' '}
              of{' '}
              <strong className="text-slate-900">
                {students.length}
              </strong>{' '}
              students
            </span>

            <span>
              {search ||
              programmeFilter !== 'all' ||
              classFilter !== 'all' ||
              statusFilter !== 'all'
                ? 'Filters are active'
                : 'No filters applied'}
            </span>

          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Student List */}
        {filteredStudents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">

            <div className="mb-3 text-5xl">
              👨‍🎓
            </div>

            <h2 className="text-xl font-semibold text-slate-900">
              No students found
            </h2>

            <p className="mt-2 text-slate-500">
              Try another search or change your filters.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Clear Filters
            </button>

          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {filteredStudents.map((student) => {
              const academicInfo =
                currentAcademicInfo.get(
                  student.id
                );

              return (
                <div
                  key={student.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                >

                  {/* Student Header */}
                  <div className="flex items-start justify-between gap-4">

                    <div className="flex items-center gap-4">

                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl">
                        👨‍🎓
                      </div>

                      <div>
                        <h2 className="font-bold text-slate-900">
                          {student.full_name}
                        </h2>

                        <p className="text-sm text-slate-500">
                          {student.admission_number}
                        </p>
                      </div>

                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        student.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : student.status === 'graduated'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {student.status}
                    </span>

                  </div>

                  {/* Student Information */}
                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">

                    <div>
                      <p className="text-xs text-slate-400">
                        Programme
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {academicInfo?.programmeName ||
                          'Not enrolled'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Class
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {academicInfo?.className ||
                          'Not enrolled'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Academic Year
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {academicInfo?.academicYearName ||
                          'Not enrolled'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Gender
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {student.gender ||
                          'Not provided'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        JHS Aggregate
                      </p>

                      <p className="mt-1 text-sm font-semibold text-blue-700">
                        {student.jhs_aggregate !== null &&
                        student.jhs_aggregate !== undefined
                          ? student.jhs_aggregate
                          : 'Not provided'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Admission Date
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {student.admission_date ||
                          'Not provided'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Guardian
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {student.guardian_name ||
                          'Not provided'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Guardian Phone
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {student.guardian_phone ||
                          'Not provided'}
                      </p>
                    </div>

                  </div>

                  {/* Actions */}
                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">

                    <Link
                      href={`/students/${student.id}`}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    >
                      View Profile
                    </Link>

                    <button
                      type="button"
                      onClick={() =>
                        deleteStudent(
                          student.id,
                          student.full_name
                        )
                      }
                      className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </div>
    </div>
  );
}

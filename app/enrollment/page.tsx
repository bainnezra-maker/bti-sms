'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
};

type Programme = {
  id: string;
  name: string;
};

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
};

type AcademicYear = {
  id: string;
  name: string;
  is_current?: boolean;
};

type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  programme_id: string | null;
  enrollment_date: string;
  status: string;
  student?: Student;
  class?: ClassItem;
  programme?: Programme;
  academic_year?: AcademicYear;
};

export default function EnrollmentPage() {
  const supabase = createClient();

  const [students, setStudents] = useState<Student[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [studentId, setStudentId] = useState('');
  const [programmeId, setProgrammeId] = useState('');
  const [classId, setClassId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentResults, setShowStudentResults] = useState(false);

  const [enrollmentDate, setEnrollmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadEnrollments(
    studentList: Student[],
    programmeList: Programme[],
    classList: ClassItem[],
    yearList: AcademicYear[]
  ) {
    const { data: enrollmentData, error: enrollmentError } =
      await supabase
        .from('enrollments')
        .select(
          'id, student_id, class_id, academic_year_id, programme_id, enrollment_date, status'
        )
        .order('enrollment_date', { ascending: false });

    if (enrollmentError) {
      setError(
        `Could not load enrollments: ${enrollmentError.message}`
      );
      return;
    }

    const combined: Enrollment[] = (enrollmentData || []).map(
      (item: any) => {
        const student = studentList.find(
          (s) => s.id === item.student_id
        );

        const programme = programmeList.find(
          (p) => p.id === item.programme_id
        );

        const classItem = classList.find(
          (c) => c.id === item.class_id
        );

        const academicYear = yearList.find(
          (y) => y.id === item.academic_year_id
        );

        return {
          id: item.id,
          student_id: item.student_id,
          class_id: item.class_id,
          academic_year_id: item.academic_year_id,
          programme_id: item.programme_id,
          enrollment_date: item.enrollment_date,
          status: item.status,
          student,
          programme,
          class: classItem,
          academic_year: academicYear,
        };
      }
    );

    setEnrollments(combined);
  }

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
      setError('School profile could not be found.');
      setLoading(false);
      return;
    }

    const schoolId = profile.school_id;

    const [
      studentsResult,
      programmesResult,
      classesResult,
      yearsResult,
    ] = await Promise.all([
      supabase
        .from('students')
        .select('id, full_name, admission_number')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('full_name'),

      supabase
        .from('programmes')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name'),

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
        .order('name', { ascending: false }),
    ]);

    if (studentsResult.error) {
      setError(
        `Students error: ${studentsResult.error.message}`
      );
    }

    if (programmesResult.error) {
      setError(
        `Programmes error: ${programmesResult.error.message}`
      );
    }

    if (classesResult.error) {
      setError(
        `Classes error: ${classesResult.error.message}`
      );
    }

    if (yearsResult.error) {
      setError(
        `Academic years error: ${yearsResult.error.message}`
      );
    }

    const studentList = studentsResult.data || [];
    const programmeList = programmesResult.data || [];
    const classList = classesResult.data || [];
    const yearList = yearsResult.data || [];

    setStudents(studentList);
    setProgrammes(programmeList);
    setClasses(classList);
    setAcademicYears(yearList);

    const currentYear = yearList.find(
      (year: AcademicYear) => year.is_current
    );

    if (currentYear && !academicYearId) {
      setAcademicYearId(currentYear.id);
    }

    await loadEnrollments(
      studentList,
      programmeList,
      classList,
      yearList
    );

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedStudent = students.find(
    (student) => student.id === studentId
  );

  const matchingStudents = useMemo(() => {
    const query = studentSearch.toLowerCase().trim();

    if (!query) {
      return [];
    }

    return students
      .filter((student) => {
        const name = student.full_name.toLowerCase();
        const admissionNumber =
          student.admission_number.toLowerCase();

        return (
          name.includes(query) ||
          admissionNumber.includes(query)
        );
      })
      .slice(0, 10);
  }, [students, studentSearch]);

  function selectStudent(student: Student) {
    setStudentId(student.id);
    setStudentSearch('');
    setShowStudentResults(false);
    setError('');
  }

  function clearStudent() {
    setStudentId('');
    setStudentSearch('');
    setShowStudentResults(false);
  }

  async function addEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!studentId || !classId || !academicYearId) {
      setError(
        'Please select a student, class and academic year.'
      );
      return;
    }

    const alreadyEnrolled = enrollments.some(
      (item) =>
        item.student_id === studentId &&
        item.academic_year_id === academicYearId
    );

    if (alreadyEnrolled) {
      const student = students.find(
        (item) => item.id === studentId
      );

      const year = academicYears.find(
        (item) => item.id === academicYearId
      );

      setError(
        `${student?.full_name || 'This student'} is already enrolled for ${year?.name || 'this academic year'}.`
      );
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase
      .from('enrollments')
      .insert({
        student_id: studentId,
        class_id: classId,
        academic_year_id: academicYearId,
        programme_id: programmeId || null,
        enrollment_date: enrollmentDate,
        status: 'active',
      });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setStudentId('');
    setStudentSearch('');
    setShowStudentResults(false);
    setProgrammeId('');
    setClassId('');

    await loadEnrollments(
      students,
      programmes,
      classes,
      academicYears
    );

    setSaving(false);
  }

  async function deleteEnrollment(id: string) {
    if (!window.confirm('Delete this enrollment?')) {
      return;
    }

    const { error: deleteError } = await supabase
      .from('enrollments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setEnrollments((current) =>
      current.filter((item) => item.id !== id)
    );
  }

  const filteredEnrollments = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) {
      return enrollments;
    }

    return enrollments.filter((item) =>
      [
        item.student?.full_name,
        item.student?.admission_number,
        item.class?.name,
        item.programme?.name,
        item.academic_year?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [enrollments, search]);

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <p className="text-slate-500">
          Loading enrollment system...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600">
            Academic Management
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Student Enrollment
          </h1>

          <p className="mt-1 text-slate-500">
            Assign students to programmes, classes and academic years.
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* NEW ENROLLMENT */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="mb-5 text-lg font-bold text-slate-900">
              New Enrollment
            </h2>

            <form
              onSubmit={addEnrollment}
              className="space-y-4"
            >

              {/* SEARCHABLE STUDENT */}
              <div className="relative">
                <label className="mb-2 block text-sm font-medium">
                  Student
                </label>

                {selectedStudent ? (
                  <div className="flex items-center justify-between rounded-xl border border-blue-300 bg-blue-50 px-4 py-3">

                    <div>
                      <p className="font-semibold text-slate-900">
                        {selectedStudent.full_name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {selectedStudent.admission_number}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={clearStudent}
                      className="ml-3 rounded-lg px-2 py-1 text-lg font-bold text-slate-500 hover:bg-white hover:text-red-600"
                      aria-label="Clear student"
                    >
                      ×
                    </button>

                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => {
                        setStudentSearch(e.target.value);
                        setShowStudentResults(true);
                      }}
                      onFocus={() => {
                        if (studentSearch.trim()) {
                          setShowStudentResults(true);
                        }
                      }}
                      placeholder="Type student name or admission number..."
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    {showStudentResults &&
                      studentSearch.trim() && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">

                          {matchingStudents.length === 0 ? (
                            <div className="p-4 text-sm text-slate-500">
                              No student found.
                            </div>
                          ) : (
                            matchingStudents.map((student) => (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() =>
                                  selectStudent(student)
                                }
                                className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-blue-50"
                              >
                                <p className="font-semibold text-slate-900">
                                  {student.full_name}
                                </p>

                                <p className="text-xs text-slate-500">
                                  {student.admission_number}
                                </p>
                              </button>
                            ))
                          )}

                        </div>
                      )}
                  </>
                )}

                <p className="mt-1 text-xs text-slate-400">
                  Type at least part of the student's name or admission number.
                </p>
              </div>

              {/* PROGRAMME */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Programme
                </label>

                <select
                  value={programmeId}
                  onChange={(e) =>
                    setProgrammeId(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">
                    Select programme
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

              {/* CLASS */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Class
                </label>

                <select
                  value={classId}
                  onChange={(e) =>
                    setClassId(e.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">
                    Select class
                  </option>

                  {classes.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name}
                      {item.level
                        ? ` — ${item.level}`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* ACADEMIC YEAR */}
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

                  {academicYears.map((year) => (
                    <option
                      key={year.id}
                      value={year.id}
                    >
                      {year.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ENROLLMENT DATE */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Enrollment Date
                </label>

                <input
                  type="date"
                  value={enrollmentDate}
                  onChange={(e) =>
                    setEnrollmentDate(e.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              {/* BUTTON */}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving
                  ? 'Saving...'
                  : 'Enroll Student'}
              </button>

            </form>
          </div>

          {/* ENROLLED STUDENTS */}
          <div className="lg:col-span-2">

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Enrolled Students
                  </h2>

                  <p className="text-sm text-slate-500">
                    {filteredEnrollments.length}{' '}
                    enrollment
                    {filteredEnrollments.length !== 1
                      ? 's'
                      : ''}
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Search enrollment..."
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  className="rounded-xl border border-slate-300 px-4 py-2.5"
                />

              </div>

              <div className="space-y-3">

                {filteredEnrollments.length === 0 ? (
                  <div className="py-10 text-center text-slate-500">
                    No enrollments found.
                  </div>
                ) : (
                  filteredEnrollments.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-100 p-4"
                    >

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                          <h3 className="font-bold text-slate-900">
                            {item.student?.full_name ||
                              'Unknown Student'}
                          </h3>

                          <p className="text-sm text-slate-500">
                            {item.student
                              ?.admission_number ||
                              'No admission number'}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs">

                            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                  

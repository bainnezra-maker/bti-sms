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
  const [enrollmentDate, setEnrollmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const [search, setSearch] = useState('');
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
  .select('id, name, level, programme_id, academic_year_id')
  .eq('school_id', schoolId)
  .order('name'),

      supabase
        .from('academic_years')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name', { ascending: false }),
    ]);

    if (studentsResult.error) {
      setError(studentsResult.error.message);
    } else {
      setStudents(studentsResult.data || []);
    }

    if (programmesResult.error) {
      setError(programmesResult.error.message);
    } else {
      setProgrammes(programmesResult.data || []);
    }

    if (classesResult.error) {
      setError(classesResult.error.message);
    } else {
      setClasses(classesResult.data || []);
    }

    if (yearsResult.error) {
      setError(yearsResult.error.message);
    } else {
      setAcademicYears(yearsResult.data || []);

      const currentYear = yearsResult.data?.find(
        (year: any) => year.is_current
      );

      if (currentYear) {
        setAcademicYearId(currentYear.id);
      }
    }

    await loadEnrollments(schoolId);

    setLoading(false);
  }

  async function loadEnrollments(schoolId: string) {
  const studentIds = students.map((student) => student.id);

  if (studentIds.length === 0) {
    setEnrollments([]);
    return;
  }

  const { data, error: enrollmentError } = await supabase
    .from('enrollments')
    .select(`
      id,
      student_id,
      class_id,
      academic_year_id,
      programme_id,
      enrollment_date,
      status,
      student:students (
        id,
        full_name,
        admission_number
      ),
      class:classes (
        id,
        name,
        level
      ),
      programme:programmes (
        id,
        name
      ),
      academic_year:academic_years (
        id,
        name
      )
    `)
    .in('student_id', studentIds);

  if (enrollmentError) {
    setError(enrollmentError.message);
    return;
  }

  setEnrollments((data as any) || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!studentId || !classId || !academicYearId) {
      setError('Please select a student, class and academic year.');
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
    setProgrammeId('');
    setClassId('');
    setEnrollmentDate(
      new Date().toISOString().split('T')[0]
    );

    await loadData();
    setSaving(false);
  }

  async function deleteEnrollment(id: string) {
    if (!window.confirm('Delete this enrollment?')) return;

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

    if (!query) return enrollments;

    return enrollments.filter((item: any) =>
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
        <p className="text-slate-500">Loading enrollment system...</p>
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
            Student Enrollment
          </h1>

          <p className="mt-1 text-slate-500">
            Assign students to programmes, classes and academic years.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="mb-5 text-lg font-bold text-slate-900">
              New Enrollment
            </h2>

            <form onSubmit={addEnrollment} className="space-y-4">

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Student
                </label>

                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">Select student</option>

                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name} — {student.admission_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Programme
                </label>

                <select
                  value={programmeId}
                  onChange={(e) => setProgrammeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">Select programme</option>

                  {programmes.map((programme) => (
                    <option key={programme.id} value={programme.id}>
                      {programme.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Class
                </label>

                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">Select class</option>

                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.level ? ` — ${item.level}` : ''}
                    </option>
                  ))}
                </select>
              </div>

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
                  <option value="">Select academic year</option>

                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </div>

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

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Enroll Student'}
              </button>

            </form>
          </div>

          <div className="lg:col-span-2">

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Enrolled Students
                  </h2>

                  <p className="text-sm text-slate-500">
                    {filteredEnrollments.length} enrollment
                    {filteredEnrollments.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Search enrollment..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5"
                />

              </div>

              <div className="space-y-3">

                {filteredEnrollments.length === 0 ? (
                  <div className="py-10 text-center text-slate-500">
                    No enrollments found.
                  </div>
                ) : (
                  filteredEnrollments.map((item: any) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-100 p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                        <div>
                          <h3 className="font-bold text-slate-900">
                            {item.student?.full_name || 'Unknown Student'}
                          </h3>

                          <p className="text-sm text-slate-500">
                            {item.student?.admission_number}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                              {item.class?.name || 'No class'}
                            </span>

                            <span className="rounded-full bg-purple-100 px-3 py-1 text-purple-700">
                              {item.programme?.name || 'No programme'}
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                              {item.academic_year?.name || 'No year'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            deleteEnrollment(item.id)
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

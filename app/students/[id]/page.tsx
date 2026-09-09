'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  admission_number: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  address: string | null;
  admission_date: string;
  jhs_aggregate: number | null;
  status: string;
};

type Enrollment = {
  id: string;
  enrollment_date: string;
  status: string | null;
  academic_year_id: string;
  class_id: string;
  programme_id: string | null;
  academic_year: { name: string }[] | null;
  class: {
    name: string;
    level: string | null;
  }[] | null;
  programme: {
    name: string;
    code: string | null;
  }[] | null;
};

type AttendanceRecord = {
  id: string;
  date: string;
  status: string;
  class_id: string;
};

type Assessment = {
  id: string;
  subject: string;
  assessment_type: string;
  score: number;
  max_score: number;
  term: string | null;
  created_at: string;
};

export default function StudentProfilePage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  const [loading, setLoading] = useState(true);
  const [enrollmentLoading, setEnrollmentLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(true);

  const [error, setError] = useState('');

  async function loadStudent() {
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
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

    const { data, error: studentError } = await supabase
      .from('students')
      .select(
        'id, admission_number, full_name, date_of_birth, gender, guardian_name, guardian_phone, address, admission_date, jhs_aggregate, status'
      )
      .eq('id', studentId)
      .eq('school_id', profile.school_id)
      .single();

    if (studentError || !data) {
      setError(
        studentError?.message || 'Student could not be found.'
      );
      setLoading(false);
      return;
    }

    setStudent(data);
    setLoading(false);

    await Promise.all([
      loadEnrollments(studentId),
      loadAttendance(studentId),
      loadAssessments(studentId),
    ]);
  }

  async function loadEnrollments(id: string) {
    setEnrollmentLoading(true);

    const { data, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        enrollment_date,
        status,
        academic_year_id,
        class_id,
        programme_id,
        academic_year:academic_years (
          name
        ),
        class:classes (
          name,
          level
        ),
        programme:programmes (
          name,
          code
        )
      `)
      .eq('student_id', id)
      .order('enrollment_date', {
        ascending: false,
      });

    if (enrollmentError) {
      console.error(enrollmentError);
      setEnrollments([]);
    } else {
      setEnrollments((data ?? []) as Enrollment[]);
    }

    setEnrollmentLoading(false);
  }

  async function loadAttendance(id: string) {
    setAttendanceLoading(true);

    const { data, error: attendanceError } = await supabase
      .from('attendance')
      .select(`
        id,
        date,
        status,
        class_id
      `)
      .eq('student_id', id)
      .order('date', {
        ascending: false,
      });

    if (attendanceError) {
      console.error(attendanceError);
      setAttendance([]);
    } else {
      setAttendance((data ?? []) as AttendanceRecord[]);
    }

    setAttendanceLoading(false);
  }

  async function loadAssessments(id: string) {
    setResultsLoading(true);

    const { data, error: assessmentError } = await supabase
      .from('assessments')
      .select(`
        id,
        subject,
        assessment_type,
        score,
        max_score,
        term,
        created_at
      `)
      .eq('student_id', id)
      .order('created_at', {
        ascending: false,
      });

    if (assessmentError) {
      console.error(assessmentError);
      setAssessments([]);
    } else {
      setAssessments((data ?? []) as Assessment[]);
    }

    setResultsLoading(false);
  }

  useEffect(() => {
    if (studentId) {
      loadStudent();
    }
  }, [studentId]);

  function formatDate(date: string | null) {
    if (!date) return 'Not provided';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  function calculateAge(dateOfBirth: string | null) {
    if (!dateOfBirth) return null;

    const birthDate = new Date(dateOfBirth);
    const today = new Date();

    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    let age =
      today.getFullYear() -
      birthDate.getFullYear();

    const monthDifference =
      today.getMonth() - birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 &&
        today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  function getStatusClasses(status: string | null) {
    if (status === 'active') {
      return 'bg-green-100 text-green-700';
    }

    if (status === 'completed') {
      return 'bg-blue-100 text-blue-700';
    }

    if (status === 'withdrawn') {
      return 'bg-orange-100 text-orange-700';
    }

    return 'bg-slate-100 text-slate-700';
  }

  function getAttendanceClasses(status: string) {
    const normalized = status.toLowerCase();

    if (normalized === 'present') {
      return 'bg-green-100 text-green-700';
    }

    if (normalized === 'absent') {
      return 'bg-red-100 text-red-700';
    }

    if (normalized === 'late') {
      return 'bg-yellow-100 text-yellow-700';
    }

    if (normalized === 'excused') {
      return 'bg-blue-100 text-blue-700';
    }

    return 'bg-slate-100 text-slate-700';
  }

  function getAttendanceIcon(status: string) {
    const normalized = status.toLowerCase();

    if (normalized === 'present') return '✓';
    if (normalized === 'absent') return '✕';
    if (normalized === 'late') return '⏱';
    if (normalized === 'excused') return 'E';

    return '•';
  }

  function getScorePercentage(
    score: number,
    maxScore: number
  ) {
    if (!maxScore || maxScore <= 0) return 0;

    return Math.round(
      (Number(score) / Number(maxScore)) * 100
    );
  }

  function getResultClasses(percentage: number) {
    if (percentage >= 80) {
      return 'bg-green-100 text-green-700';
    }

    if (percentage >= 60) {
      return 'bg-blue-100 text-blue-700';
    }

    if (percentage >= 50) {
      return 'bg-yellow-100 text-yellow-700';
    }

    return 'bg-red-100 text-red-700';
  }

  const totalAttendance = attendance.length;

  const presentCount = attendance.filter(
    (record) =>
      record.status.toLowerCase() === 'present'
  ).length;

  const absentCount = attendance.filter(
    (record) =>
      record.status.toLowerCase() === 'absent'
  ).length;

  const lateCount = attendance.filter(
    (record) =>
      record.status.toLowerCase() === 'late'
  ).length;

  const excusedCount = attendance.filter(
    (record) =>
      record.status.toLowerCase() === 'excused'
  ).length;

  const attendancePercentage =
    totalAttendance > 0
      ? Math.round(
          (presentCount / totalAttendance) * 100
        )
      : 0;

  const totalAssessments = assessments.length;

  const totalScore = assessments.reduce(
    (sum, assessment) =>
      sum + Number(assessment.score),
    0
  );

  const totalMaxScore = assessments.reduce(
    (sum, assessment) =>
      sum + Number(assessment.max_score),
    0
  );

  const overallPercentage =
    totalMaxScore > 0
      ? Math.round(
          (totalScore / totalMaxScore) * 100
        )
      : 0;

  const subjectNames = Array.from(
    new Set(
      assessments.map(
        (assessment) => assessment.subject
      )
    )
  );

  const subjectAverages = subjectNames.map(
    (subject) => {
      const subjectResults = assessments.filter(
        (assessment) =>
          assessment.subject === subject
      );

      const subjectScore = subjectResults.reduce(
        (sum, assessment) =>
          sum + Number(assessment.score),
        0
      );

      const subjectMax = subjectResults.reduce(
        (sum, assessment) =>
          sum + Number(assessment.max_score),
        0
      );

      const percentage =
        subjectMax > 0
          ? Math.round(
              (subjectScore / subjectMax) * 100
            )
          : 0;

      return {
        subject,
        percentage,
        count: subjectResults.length,
      };
    }
  );

  const bestSubject =
    subjectAverages.length > 0
      ? [...subjectAverages].sort(
          (a, b) =>
            b.percentage - a.percentage
        )[0]
      : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-slate-500">
            Loading student profile...
          </p>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
        <div className="mx-auto max-w-5xl">

          <Link
            href="/students"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to Students
          </Link>

          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">

            <h1 className="text-lg font-bold text-red-800">
              Student Profile
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error || 'Student could not be found.'}
            </p>

          </div>

        </div>
      </div>
    );
  }

  const age = calculateAge(student.date_of_birth);

  const currentEnrollment =
    enrollments.find(
      (enrollment) =>
        enrollment.status === 'active'
    ) || null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">

      <div className="mx-auto max-w-5xl">

        {/* Back */}
        <div className="mb-6">

          <Link
            href="/students"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to Students
          </Link>

        </div>

        {/* Profile Header */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="bg-blue-600 p-6 sm:p-8">

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-4">

                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white text-4xl shadow-sm">
                  👨‍🎓
                </div>

                <div>

                  <h1 className="text-2xl font-bold text-white sm:text-3xl">
                    {student.full_name}
                  </h1>

                  <p className="mt-1 text-sm text-blue-100">
                    {student.admission_number}
                  </p>

                </div>

              </div>

              <div>

                <span
                  className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
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

            </div>

          </div>

          {/* Quick Summary */}
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 sm:p-6">

            <div>
              <p className="text-xs text-slate-400">
                Admission Number
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {student.admission_number}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                JHS Aggregate
              </p>

              <p className="mt-1 text-sm font-bold text-blue-700">
                {student.jhs_aggregate !== null
                  ? student.jhs_aggregate
                  : 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Gender
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {student.gender || 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Age
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {age !== null
                  ? `${age} years`
                  : 'Not provided'}
              </p>
            </div>

          </div>

        </div>

        {/* Current Enrollment */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">

          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-xl font-bold text-slate-900">
                Current Enrollment
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                The student's current academic placement.
              </p>

            </div>

            <Link
              href="/enrollment"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Manage Enrollment
            </Link>

          </div>

          {enrollmentLoading ? (

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">
                Loading enrollment...
              </p>
            </div>

          ) : currentEnrollment ? (

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">

                <p className="text-xs font-medium uppercase tracking-wide text-blue-500">
                  Academic Year
                </p>

                <p className="mt-2 font-bold text-blue-900">
                  {currentEnrollment.academic_year?.[0]?.name ||
                    'Not provided'}
                </p>

              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Programme
                </p>

                <p className="mt-2 font-bold text-slate-800">
                  {currentEnrollment.programme?.[0]?.name ||
                    'Not provided'}
                </p>

                {currentEnrollment.programme?.[0]?.code && (
                  <p className="mt-1 text-xs text-slate-500">
                    {currentEnrollment.programme[0].code}
                  </p>
                )}

              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Class
                </p>

                <p className="mt-2 font-bold text-slate-800">
                  {currentEnrollment.class?.[0]?.name ||
                    'Not provided'}
                </p>

                {currentEnrollment.class?.[0]?.level && (
                  <p className="mt-1 text-xs text-slate-500">
                    {currentEnrollment.class[0].level}
                  </p>
                )}

              </div>

            </div>

          ) : (

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">

              <div className="mb-2 text-3xl">
                🎓
              </div>

              <p className="font-medium text-slate-700">
                No current enrollment found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                This student has not been enrolled in a current
                academic year yet.
              </p>

              <Link
                href="/enrollment"
                className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Enroll Student
              </Link>

            </div>

          )}

        </div>

        {/* Personal Information */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">

          <div className="mb-6">

            <h2 className="text-xl font-bold text-slate-900">
              Personal Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Basic information about the student.
            </p>

          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Full Name
              </p>

              <p className="mt-1 font-medium text-slate-800">
                {student.full_name}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Date of Birth
              </p>

              <p className="mt-1 font-medium text-slate-800">
                {formatDate(student.date_of_birth)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Gender
              </p>

              <p className="mt-1 font-medium text-slate-800">
                {student.gender || 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Admission Date
              </p>

              <p className="mt-1 font-medium text-slate-800">
                {formatDate(student.admission_date)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                JHS Aggregate
              </p>

              <p className="mt-1 font-semibold text-blue-700">
                {student.jhs_aggregate !== null
                  ? student.jhs_aggregate
                  : 'Not provided'}
              </p>

                            <p className="mt-1 text-xs text-slate-400">
                Aggregate used for admission into BTI.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Student Status
              </p>

              <p className="mt-1 font-medium capitalize text-slate-800">
                {student.status}
              </p>
            </div>

          </div>

        </div>

        {/* Guardian Information */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">

          <div className="mb-6">

            <h2 className="text-xl font-bold text-slate-900">
              Guardian Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Parent or guardian contact information.
            </p>

          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Guardian Name
              </p>

              <p className="mt-1 font-medium text-slate-800">
                {student.guardian_name || 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Guardian Phone
              </p>

              <p className="mt-1 font-medium text-slate-800">
                {student.guardian_phone || 'Not provided'}
              </p>
            </div>

            <div className="sm:col-span-2">

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Residential Address
              </p>

              <p className="mt-1 font-medium text-slate-800">
                {student.address || 'Not provided'}
              </p>

            </div>

          </div>

        </div>

        {/* Enrollment History */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">

          <div className="mb-6">

            <h2 className="text-xl font-bold text-slate-900">
              Enrollment History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              The student's academic journey at BTI.
            </p>

          </div>

          {enrollmentLoading ? (

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">
                Loading enrollment history...
              </p>
            </div>

          ) : enrollments.length === 0 ? (

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">

              <p className="font-medium text-slate-700">
                No enrollment history
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Enrollment records will appear here once the
                student is enrolled.
              </p>

            </div>

          ) : (

            <div className="space-y-4">

              {enrollments.map((enrollment, index) => (

                <div
                  key={enrollment.id}
                  className={`rounded-xl border p-5 ${
                    index === 0 &&
                    enrollment.status === 'active'
                      ? 'border-green-200 bg-green-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                    <div>

                      <div className="flex flex-wrap items-center gap-2">

                        <h3 className="font-bold text-slate-900">
                          {enrollment.academic_year?.[0]?.name ||
                            'Academic Year'}
                        </h3>

                        {index === 0 &&
                          enrollment.status === 'active' && (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                              Current
                            </span>
                          )}

                      </div>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {enrollment.class?.[0]?.name ||
                          'Class not provided'}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {enrollment.programme?.[0]?.name ||
                          'Programme not provided'}
                      </p>

                    </div>

                    <div className="flex flex-col gap-2 lg:items-end">

                      <span
                        className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                          enrollment.status
                        )}`}
                      >
                        {enrollment.status || 'Unknown'}
                      </span>

                      <p className="text-xs text-slate-400">
                        Enrolled:{' '}
                        {formatDate(
                          enrollment.enrollment_date
                        )}
                      </p>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>

        {/* Attendance */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">

          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-xl font-bold text-slate-900">
                Attendance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Attendance record and summary for this student.
              </p>

            </div>

            <Link
              href="/attendance"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Manage Attendance
            </Link>

          </div>

          {attendanceLoading ? (

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">
                Loading attendance...
              </p>
            </div>

          ) : totalAttendance === 0 ? (

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">

              <div className="mb-2 text-3xl">
                📅
              </div>

              <p className="font-medium text-slate-700">
                No attendance records
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Attendance records will appear here once
                attendance has been recorded for this student.
              </p>

              <Link
                href="/attendance"
                className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Record Attendance
              </Link>

            </div>

          ) : (

            <>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Recorded
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {totalAttendance}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Days
                  </p>
                </div>

                <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-green-600">
                    Present
                  </p>

                  <p className="mt-2 text-2xl font-bold text-green-700">
                    {presentCount}
                  </p>
                </div>

                <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-red-600">
                    Absent
                  </p>

                  <p className="mt-2 text-2xl font-bold text-red-700">
                    {absentCount}
                  </p>
                </div>

                <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-yellow-700">
                    Late
                  </p>

                  <p className="mt-2 text-2xl font-bold text-yellow-700">
                    {lateCount}
                  </p>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                    Attendance
                  </p>

                  <p className="mt-2 text-2xl font-bold text-blue-700">
                    {attendancePercentage}%
                  </p>
                </div>

              </div>

              <div className="mt-6">

                <div className="mb-2 flex items-center justify-between">

                  <p className="text-sm font-medium text-slate-700">
                    Attendance Rate
                  </p>

                  <p className="text-sm font-bold text-blue-700">
                    {attendancePercentage}%
                  </p>

                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-200">

                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{
                      width: `${attendancePercentage}%`,
                    }}
                  />

                </div>

              </div>

              {excusedCount > 0 && (
                <p className="mt-4 text-xs text-slate-500">
                  Excused absences: {excusedCount}
                </p>
              )}

              <div className="mt-8">

                <h3 className="font-bold text-slate-900">
                  Recent Attendance
                </h3>

                <p className="text-xs text-slate-500">
                  Latest attendance records
                </p>

                <div className="mt-4 space-y-3">

                  {attendance
                    .slice(0, 10)
                    .map((record) => (

                      <div
                        key={record.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >

                        <div className="flex items-center gap-3">

                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${getAttendanceClasses(
                              record.status
                            )}`}
                          >
                            {getAttendanceIcon(
                              record.status
                            )}
                          </div>

                          <div>

                            <p className="text-sm font-semibold text-slate-800">
                              {formatDate(record.date)}
                            </p>

                            <p className="text-xs text-slate-400">
                              Attendance record
                            </p>

                          </div>

                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getAttendanceClasses(
                            record.status
                          )}`}
                        >
                          {record.status}
                        </span>

                      </div>

                    ))}

                </div>

              </div>

            </>

          )}

        </div>

        {/* Results */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">

          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-xl font-bold text-slate-900">
                Academic Results
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Assessment performance for this student.
              </p>

            </div>

            <Link
              href="/assessment"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Manage Assessments
            </Link>

          </div>

          {resultsLoading ? (

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">
                Loading results...
              </p>
            </div>

          ) : totalAssessments === 0 ? (

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">

              <div className="mb-2 text-3xl">
                📊
              </div>

              <p className="font-medium text-slate-700">
                No assessment results
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Assessment results will appear here once
                scores have been recorded for this student.
              </p>

              <Link
                href="/assessment"
                className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Record Assessment
              </Link>

            </div>

          ) : (

            <>

              {/* Results Summary */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Assessments
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {totalAssessments}
                  </p>

                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">

                  <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                    Overall Average
                  </p>

                  <p className="mt-2 text-2xl font-bold text-blue-700">
                    {overallPercentage}%
                  </p>

                </div>

                <div className="rounded-xl border border-green-100 bg-green-50 p-5">

                  <p className="text-xs font-medium uppercase tracking-wide text-green-600">
                    Subjects
                  </p>

                  <p className="mt-2 text-2xl font-bold text-green-700">
                    {subjectNames.length}
                  </p>

                </div>

                <div className="rounded-xl border border-purple-100 bg-purple-50 p-5">

                  <p className="text-xs font-medium uppercase tracking-wide text-purple-600">
                    Best Subject
                  </p>

                  <p className="mt-2 truncate text-lg font-bold text-purple-700">
                    {bestSubject?.subject || '—'}
                  </p>

                  {bestSubject && (
                    <p className="mt-1 text-xs text-purple-500">
                      {bestSubject.percentage}%
                    </p>
                  )}

                </div>

              </div>

              {/* Overall Progress */}
              <div className="mt-6">

                <div className="mb-2 flex items-center justify-between">

                  <p className="text-sm font-medium text-slate-700">
                    Overall Performance
                  </p>

                  <p className="text-sm font-bold text-blue-700">
                    {overallPercentage}%
                  </p>

                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-200">

                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{
                      width: `${Math.min(
                        overallPercentage,
                        100
                      )}%`,
                    }}
                  />

                </div>

              </div>

              {/* Subject Performance */}
              {subjectAverages.length > 0 && (

                <div className="mt-8">

                  <h3 className="font-bold text-slate-900">
                    Subject Performance
                  </h3>

                  <p className="text-xs text-slate-500">
                    Average performance by subject
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">

                    {subjectAverages
                      .sort(
                        (a, b) =>
                          b.percentage -
                          a.percentage
                      )
                      .map((subject) => (

                        <div
                          key={subject.subject}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >

                          <div className="flex items-center justify-between gap-3">

                            <p className="truncate text-sm font-semibold text-slate-800">
                              {subject.subject}
                            </p>

                            <span
                              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getResultClasses(
                                subject.percentage
                              )}`}
                            >
                              {subject.percentage}%
                            </span>

                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">

                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{
                                width: `${Math.min(
                                  subject.percentage,
                                  100
                                )}%`,
                              }}
                            />

                          </div>

                          <p className="mt-2 text-xs text-slate-400">
                            {subject.count}{' '}
                            assessment
                            {subject.count !== 1
                              ? 's'
                              : ''}
                          </p>

                        </div>

                      ))}

                  </div>

                </div>

              )}

              {/* Recent Results */}
              <div className="mt-8">

                <div className="mb-4">

                  <h3 className="font-bold text-slate-900">
                    Recent Assessments
                                     </h3>

                  <p className="text-xs text-slate-500">
                    Latest recorded scores
                  </p>

                </div>

                <div className="space-y-3">

                  {assessments
                    .slice(0, 10)
                    .map((assessment) => {

                      const percentage =
                        getScorePercentage(
                          Number(
                            assessment.score
                          ),
                          Number(
                            assessment.max_score
                          )
                        );

                      return (
                        <div
                          key={assessment.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >

                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                            <div>

                              <p className="font-semibold text-slate-800">
                                {assessment.subject}
                              </p>

                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">

                                <span>
                                  {assessment.assessment_type}
                                </span>

                                {assessment.term && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      {assessment.term}
                                    </span>
                                  </>
                                )}

                                <span>•</span>

                                <span>
                                  {formatDate(
                                    assessment.created_at
                                  )}
                                </span>

                              </div>

                            </div>

                            <div className="flex items-center gap-3">

                              <div className="text-right">

                                <p className="font-bold text-slate-800">
                                  {Number(
                                    assessment.score
                                  )}{' '}
                                  /{' '}
                                  {Number(
                                    assessment.max_score
                                  )}
                                </p>

                                <p className="text-xs text-slate-400">
                                  Score
                                </p>

                              </div>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-bold ${getResultClasses(
                                  percentage
                                )}`}
                              >
                                {percentage}%
                              </span>

                            </div>

                          </div>

                        </div>
                      );
                    })}

                </div>

              </div>

            </>

          )}

        </div>

        {/* Bottom Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">

          <Link
            href="/students"
            className="rounded-xl border border-slate-300 px-6 py-3 text-center font-medium text-slate-700 hover:bg-white"
          >
            ← Back to Students
          </Link>

          <Link
            href={`/students/${student.id}/edit`}
            className="rounded-xl bg-blue-600 px-6 py-3 text-center font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Edit Student
          </Link>

        </div>

      </div>

    </div>
  );
}

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
  status: string;
  jhs_aggregate: number | null;
  photo_url: string | null;
  conduct: string | null;
  promotion_status: string | null;
  class_teacher_remark: string | null;
  hod_remark: string | null;
  next_term_begins: string | null;
};

type Enrollment = {
  id: string;
  enrollment_date: string;
  status: string;
  class: {
    id: string;
    name: string;
    level: string | null;
  }[] | null;
  programme: {
    id: string;
    name: string;
    code: string | null;
  }[] | null;
  academic_year: {
    id: string;
    name: string;
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

const CA_TYPES = [
  'Exercise 1',
  'Exercise 2',
  'Exercise 3',
  'Exercise 4',
  'Class Test 1',
  'Class Test 2',
  'Class Test 3',
];

function getPercentage(score: number, maxScore: number) {
  return maxScore > 0 ? (score / maxScore) * 100 : 0;
}

function getGrade(percentage: number) {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
}

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    photo_url: '',
    conduct: '',
    promotion_status: '',
    class_teacher_remark: '',
    hod_remark: '',
    next_term_begins: '',
  });

  useEffect(() => {
    loadStudent();
  }, [studentId]);

  async function loadStudent() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.school_id) {
      setLoading(false);
      return;
    }

    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        admission_number,
        full_name,
        date_of_birth,
        gender,
        guardian_name,
        guardian_phone,
        address,
        admission_date,
        status,
        jhs_aggregate,
        photo_url,
        conduct,
        promotion_status,
        class_teacher_remark,
        hod_remark,
        next_term_begins
      `)
      .eq('id', studentId)
      .eq('school_id', userProfile.school_id)
      .single();

    if (studentError || !studentData) {
      setLoading(false);
      return;
    }

    setStudent(studentData);

    setForm({
      photo_url: studentData.photo_url || '',
      conduct: studentData.conduct || '',
      promotion_status: studentData.promotion_status || '',
      class_teacher_remark: studentData.class_teacher_remark || '',
      hod_remark: studentData.hod_remark || '',
      next_term_begins: studentData.next_term_begins || '',
    });

    const { data: enrollmentData } = await supabase
      .from('enrollments')
      .select(`
        id,
        enrollment_date,
        status,
        class:classes (
          id,
          name,
          level
        ),
        programme:programmes (
          id,
          name,
          code
        ),
        academic_year:academic_years (
          id,
          name
        )
      `)
      .eq('student_id', studentId)
      .order('enrollment_date', { ascending: false });

    setEnrollments((enrollmentData || []) as Enrollment[]);

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select(`
        id,
        date,
        status,
        class_id
      `)
      .eq('student_id', studentId)
      .order('date', { ascending: false });

    setAttendance(attendanceData || []);

    const { data: assessmentData } = await supabase
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
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    setAssessments(assessmentData || []);

    setLoading(false);
  }

  async function saveReportCardInfo() {
    if (!student) return;

    setSaving(true);

    const { error } = await supabase
      .from('students')
      .update({
        photo_url: form.photo_url.trim() || null,
        conduct: form.conduct.trim() || null,
        promotion_status: form.promotion_status || null,
        class_teacher_remark:
          form.class_teacher_remark.trim() || null,
        hod_remark: form.hod_remark.trim() || null,
        next_term_begins: form.next_term_begins || null,
      })
      .eq('id', student.id);

    if (error) {
      alert(`Could not save report card information: ${error.message}`);
      setSaving(false);
      return;
    }

    alert('Report card information saved successfully.');

    await loadStudent();
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            Loading student profile...
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">
              Student not found
            </h1>

            <Link
              href="/students"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2 font-medium text-white"
            >
              ← Back to Students
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalAttendance = attendance.length;

  const presentCount = attendance.filter(
    (item) => item.status.toLowerCase() === 'present'
  ).length;

  const absentCount = attendance.filter(
    (item) => item.status.toLowerCase() === 'absent'
  ).length;

  const lateCount = attendance.filter(
    (item) => item.status.toLowerCase() === 'late'
  ).length;

  const excusedCount = attendance.filter(
    (item) => item.status.toLowerCase() === 'excused'
  ).length;

  const attendancePercentage =
    totalAttendance > 0
      ? (presentCount / totalAttendance) * 100
      : 0;

  const subjectMap: Record<
    string,
    {
      caRaw: number;
      examRaw: number;
    }
  > = {};

  assessments.forEach((assessment) => {
    if (!subjectMap[assessment.subject]) {
      subjectMap[assessment.subject] = {
        caRaw: 0,
        examRaw: 0,
      };
    }

    if (CA_TYPES.includes(assessment.assessment_type)) {
      subjectMap[assessment.subject].caRaw += Number(assessment.score);
    }

    if (assessment.assessment_type === 'Examination') {
      subjectMap[assessment.subject].examRaw = Number(
        assessment.score
      );
    }
  });

  const subjectResults = Object.entries(subjectMap).map(
    ([subject, values]) => {
      const caContribution = (values.caRaw / 100) * 30;
      const examContribution = (values.examRaw / 100) * 70;
      const finalScore = caContribution + examContribution;

      return {
        subject,
        caRaw: values.caRaw,
        caContribution,
        examRaw: values.examRaw,
        examContribution,
        finalScore,
        grade: getGrade(finalScore),
      };
    }
  );

  const overallAverage =
    subjectResults.length > 0
      ? subjectResults.reduce(
          (sum, item) => sum + item.finalScore,
          0
        ) / subjectResults.length
      : 0;

  const activeEnrollment = enrollments.find(
    (item) => item.status === 'active'
  );

  const currentClass =
    activeEnrollment?.class?.[0]?.name || 'Not enrolled';

  const currentProgramme =
    activeEnrollment?.programme?.[0]?.name || 'Not assigned';

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Student Profile
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Complete student information, academic history,
            attendance and report-card details.
          </p>
        </div>

        {/* Student Overview */}
        <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">

            {/* Photo */}
            <div className="flex justify-center sm:justify-start">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.full_name}
                  className="h-28 w-28 rounded-2xl object-cover ring-4 ring-slate-100"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-slate-100 text-4xl">
                  👤
                </div>
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900">
                {student.full_name}
              </h2>

              <p className="mt-1 text-slate-500">
                {student.admission_number}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  {currentClass}
                </span>

                <span className="rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">
                  {currentProgramme}
                </span>

                <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                  {student.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 text-lg font-bold text-slate-900">
            Personal Information
          </h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Admission Number
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {student.admission_number}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Gender
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {student.gender || 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Date of Birth
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {student.date_of_birth || 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Admission Date
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {student.admission_date}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                JHS Aggregate
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {student.jhs_aggregate ?? 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Status
              </p>
              <p className="mt-1 font-semibold capitalize text-slate-800">
                {student.status}
              </p>
            </div>

          </div>
        </div>

        {/* Guardian Information */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 text-lg font-bold text-slate-900">
            Guardian Information
          </h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Guardian Name
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {student.guardian_name || 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Guardian Phone
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {student.guardian_phone || 'Not provided'}
              </p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase text-slate-400">
                Address
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {student.address || 'Not provided'}
              </p>
            </div>

          </div>
        </div>

        {/* Report Card Information */}
        <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              📋 Report Card Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              These details will appear on the student's official report card.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5">

            {/* Photo URL */}
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Student Photo URL
              </label>

              <input
                type="url"
                value={form.photo_url}
                onChange={(e) =>
                  setForm({
                    ...form,
                    photo_url: e.target.value,
                  })
                }
                placeholder="Paste the student's photo URL"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />

              <p className="mt-1 text-xs text-slate-400">
                We will connect this to direct photo upload later.
              </p>
            </div>

            {/* Conduct */}
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Conduct / Attitude
              </label>

              <select
                value={form.conduct}
                onChange={(e) =>
                  setForm({
                    ...form,
                    conduct: e.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">Select conduct</option>
                <option value="Excellent">Excellent</option>
                <option value="Very Good">Very Good</option>
                <option value="Good">Good</option>
                <option value="Satisfactory">Satisfactory</option>
                <option value="Needs Improvement">
                  Needs Improvement
                </option>
              </select>
            </div>

            {/* Promotion */}
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Promotion Status
              </label>

              <select
                value={form.promotion_status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    promotion_status: e.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">Select promotion status</option>
                <option value="Promoted">Promoted</option>
                <option value="Repeated">Repeated</option>
                <option value="Referred">Referred</option>
              </select>
            </div>

            {/* Class Teacher Remark */}
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Class Teacher's Remark
              </label>

              <textarea
                value={form.class_teacher_remark}
                onChange={(e) =>
                  setForm({
                    ...form,
                    class_teacher_remark: e.target.value,
                  })
                }
                rows={4}
                placeholder="Enter class teacher's remark..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            {/* HOD Remark */}
            <div>
              <label className="text-sm font-semibold text-slate-700">
                HOD / Head's Remark
              </label>

              <textarea
                value={form.hod_remark}
                onChange={(e) =>
                  setForm({
                    ...form,
                    hod_remark: e.target.value,
                  })
                }
                rows={4}
                placeholder="Enter HOD / Head's remark..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            {/* Next Term */}
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Next Term Begins
              </label>

              <input
                type="date"
                value={form.next_term_begins}
                onChange={(e) =>
                  setForm({
                    ...form,
                    next_term_begins: e.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={saveReportCardInfo}
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {saving ? 'Saving...' : '💾 Save Report Card Information'}
            </button>

          </div>
        </div>

        {/* Academic Information */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 text-lg font-bold text-slate-900">
            Academic Information
          </h2>

          {enrollments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No enrollment history found.
            </p>
          ) : (
            <div className="space-y-3">
              {enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                    <div>
                      <p className="font-semibold text-slate-900">
                        {enrollment.class?.[0]?.name ||
                          'Class not available'}
                      </p>

                      <p className="text-sm text-slate-500">
                        {enrollment.programme?.[0]?.name ||
                          'Programme not available'}
                      </p>
                    </div>

                    <div className="text-sm text-slate-500">
                      {enrollment.academic_year?.[0]?.name ||
                        'Academic year unavailable'}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Attendance Summary
            </h2>

            <Link
              href="/attendance"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Manage Attendance →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Recorded</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {totalAttendance}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-xs text-green-700">Present</p>
              <p className="mt-1 text-2xl font-bold text-green-700">
                {presentCount}
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-xs text-red-700">Absent</p>
              <p className="mt-1 text-2xl font-bold text-red-700">
                {absentCount}
              </p>
            </div>

            <div className="rounded-xl bg-yellow-50 p-4">
              <p className="text-xs text-yellow-700">Late</p>
              <p className="mt-1 text-2xl font-bold text-yellow-700">
                {lateCount}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs text-blue-700">Excused</p>
              <p className="mt-1 text-2xl font-bold text-blue-700">
                {excusedCount}
              </p>
            </div>

          </div>

          <div className="mt-5">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-600">
                Attendance Percentage
              </span>

              <span className="font-bold text-slate-900">
                {attendancePercentage.toFixed(1)}%
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-green-500"
                style={{
                  width: `${Math.min(
                    attendancePercentage,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          {attendance.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-3 font-semibold text-slate-600">
                      Date
                    </th>
                    <th className="px-3 py-3 font-semibold text-slate-600">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {attendance.slice(0, 10).map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-3">
                        {record.date}
                      </td>

                      <td className="px-3 py-3 capitalize">
                        {record.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Academic Results */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Academic Results
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Current recorded assessment performance.
              </p>
            </div>

            <Link
              href="/assessment"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Manage Assessments →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Assessments
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {assessments.length}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-sm text-blue-700">
                Overall Average
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-700">
                {overallAverage.toFixed(1)}%
              </p>
            </div>

            <div className="rounded-xl bg-purple-50 p-4">
              <p className="text-sm text-purple-700">
                Subjects
              </p>

              <p className="mt-1 text-2xl font-bold text-purple-700">
                {subjectResults.length}
              </p>
            </div>

          </div>

          {subjectResults.length > 0 && (
            <div className="mt-6 space-y-3">
              {subjectResults.map((result) => (
                <div
                  key={result.subject}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {result.subject}
                      </p>

                      <p className="text-sm text-slate-500">
                        Final: {result.finalScore.toFixed(1)}%
                      </p>
                    </div>

                    <div className="rounded-lg bg-slate-100 px-3 py-2 font-bold text-slate-800">
                      {result.grade}
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{
                        width: `${Math.min(
                          result.finalScore,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {subjectResults.length === 0 && (
            <p className="mt-6 text-sm text-slate-500">
              No assessment results have been recorded yet.
            </p>
          )}

        </div>

        {/* Bottom Actions */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">

          <Link
            href="/students"
            className="rounded-xl border border-slate-300 px-6 py-3 text-center font-medium text-slate-700 hover:bg-white"
          >
            ← Back to Students
          </Link>

          <Link
            href={`/students/${student.id}/edit`}
            className="rounded-xl bg-blue-600 px-6 py-3 text-center font-semibold text-white hover:bg-blue-700"
          >
            ✏️ Edit Student
          </Link>

          <Link
            href={`/report-card/${student.id}`}
            className="rounded-xl bg-slate-900 px-6 py-3 text-center font-semibold text-white hover:bg-slate-800"
          >
            📄 Report Card
          </Link>

        </div>

      </div>
    </div>
  );
}

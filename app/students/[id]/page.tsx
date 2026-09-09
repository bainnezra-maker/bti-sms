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

export default function StudentProfilePage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
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
                {age !== null ? `${age} years` : 'Not provided'}
              </p>
            </div>
          </div>
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

        {/* Academic Information - Coming Next */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-900">
              Academic Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              The student's academic history will appear here.
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-700">
              Enrollment History
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Programme, class and academic year information will
              be connected here next.
            </p>
          </div>
        </div>

        {/* Attendance and Results - Coming Next */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-bold text-slate-900">
              Attendance
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Attendance summary will appear here.
            </p>

            <div className="mt-5 rounded-xl bg-slate-50 p-5 text-center">
              <p className="text-sm text-slate-400">
                Coming next
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-bold text-slate-900">
              Results
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Assessment and academic results will appear here.
            </p>

            <div className="mt-5 rounded-xl bg-slate-50 p-5 text-center">
              <p className="text-sm text-slate-400">
                Coming next
              </p>
            </div>
          </div>
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

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Get school_id
  const { data: userData } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', user.id)
    .single();

  if (!userData) {
    return <div className="p-6">School not found</div>;
  }

  const schoolId = userData.school_id;

  // Count total students
  const { count: studentCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId);

  // Count total staff
  const { count: staffCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            📊 BTI School Management System
          </h1>

          <p className="text-gray-600 mt-2">
            Welcome back! Manage your school from the dashboard.
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

          <div className="bg-white p-6 rounded-xl shadow border">
            <p className="text-sm text-gray-500">
              Total Students
            </p>

            <p className="text-3xl font-bold text-blue-600 mt-2">
              {studentCount || 0}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow border">
            <p className="text-sm text-gray-500">
              Total Staff
            </p>

            <p className="text-3xl font-bold text-green-600 mt-2">
              {staffCount || 0}
            </p>
          </div>

        </div>

        {/* Main Menu */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          School Management
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Students */}
          <Link href="/students">
            <div className="bg-white p-6 rounded-xl shadow border hover:shadow-lg transition cursor-pointer">
              <div className="text-3xl mb-3">📚</div>

              <h3 className="font-semibold text-lg text-gray-900">
                Students
              </h3>

              <p className="text-sm text-gray-600 mt-2">
                View and manage student records.
              </p>
            </div>
          </Link>

          {/* Add Student */}
          <Link href="/students/add">
            <div className="bg-white p-6 rounded-xl shadow border hover:shadow-lg transition cursor-pointer">
              <div className="text-3xl mb-3">➕</div>

              <h3 className="font-semibold text-lg text-gray-900">
                Add Student
              </h3>

              <p className="text-sm text-gray-600 mt-2">
                Register a new student.
              </p>
            </div>
          </Link>

          {/* Attendance */}
          <Link href="/attendance">
            <div className="bg-white p-6 rounded-xl shadow border hover:shadow-lg transition cursor-pointer">
              <div className="text-3xl mb-3">📋</div>

              <h3 className="font-semibold text-lg text-gray-900">
                Attendance
              </h3>

              <p className="text-sm text-gray-600 mt-2">
                Record and manage student attendance.
              </p>
            </div>
          </Link>

          {/* Assessment */}
          <Link href="/assessment">
            <div className="bg-white p-6 rounded-xl shadow border hover:shadow-lg transition cursor-pointer">
              <div className="text-3xl mb-3">📝</div>

              <h3 className="font-semibold text-lg text-gray-900">
                Assessment
              </h3>

              <p className="text-sm text-gray-600 mt-2">
                Manage student assessments and results.
              </p>
            </div>
          </Link>

        </div>

        {/* Welcome message */}
        <div className="bg-white p-6 rounded-xl shadow border mt-8">
          <h2 className="font-semibold text-lg mb-2">
            👋 Welcome back!
          </h2>

          <p className="text-gray-600">
            You currently have{' '}
            <strong>{studentCount || 0}</strong>{' '}
            students registered in your school.
          </p>
        </div>

      </div>
    </div>
  );
}

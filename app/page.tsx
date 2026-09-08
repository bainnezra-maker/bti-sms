import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get school_id
  const { data: userData } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', user.id)
    .single();
  if (!userData) return <div>School not found</div>;
  const schoolId = userData.school_id;

  // Count total students
  const { count: studentCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId);

  // Count total staff (users)
  const { count: staffCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📊 Dashboard</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Student Card */}
        <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
          <p className="text-sm text-gray-500">Total Students</p>
          <p className="text-3xl font-bold text-blue-600">{studentCount || 0}</p>
        </div>
        
        {/* Staff Card */}
        <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
          <p className="text-sm text-gray-500">Total Staff</p>
          <p className="text-3xl font-bold text-green-600">{staffCount || 0}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
        <h2 className="font-semibold text-lg mb-2">👋 Welcome back!</h2>
        <p className="text-gray-600">
          You have <strong>{studentCount || 0}</strong> students registered in your school.
        </p>
      </div>
    </div>
  );
}

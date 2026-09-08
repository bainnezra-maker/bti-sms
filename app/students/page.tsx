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
  status: string;
};

export default function StudentsPage() {
  const supabase = createClient();

  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
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

    const { data, error: studentError } = await supabase
      .from('students')
      .select(
        'id, admission_number, full_name, gender, guardian_name, guardian_phone, admission_date, status'
      )
      .eq('school_id', profile.school_id)
      .order('full_name');

    if (studentError) {
      setError(studentError.message);
    } else {
      setStudents(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const query = search.toLowerCase().trim();

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.full_name.toLowerCase().includes(query) ||
        student.admission_number.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'all' || student.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [students, search, statusFilter]);

  const activeCount = students.filter(
    (s) => s.status === 'active'
  ).length;

  const graduatedCount = students.filter(
    (s) => s.status === 'graduated'
  ).length;

  const otherCount = students.length - activeCount - graduatedCount;

  async function deleteStudent(id: string, name: string) {
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
      current.filter((student) => student.id !== id)
    );
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-500">Loading students...</p>
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
              Manage student records and information.
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
            <p className="text-sm text-slate-500">Total Students</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {students.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Active Students</p>
            <p className="mt-2 text-3xl font-bold text-green-600">
              {activeCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Other Status</p>
            <p className="mt-2 text-3xl font-bold text-orange-500">
              {graduatedCount + otherCount}
            </p>
          </div>
        </div>

        {/* Search and filter */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              placeholder="Search by student name or admission number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="all">All Students</option>
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Students */}
        {filteredStudents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mb-3 text-5xl">👨‍🎓</div>

            <h2 className="text-xl font-semibold text-slate-900">
              No students found
            </h2>

            <p className="mt-2 text-slate-500">
              Try another search or register a new student.
            </p>

            <Link
              href="/students/add"
              className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
            >
              Add Student
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
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

                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-xs text-slate-400">Gender</p>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {student.gender || 'Not provided'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Admission Date</p>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {student.admission_date || 'Not provided'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Guardian</p>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {student.guardian_name || 'Not provided'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Guardian Phone</p>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {student.guardian_phone || 'Not provided'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={() =>
                      deleteStudent(student.id, student.full_name)
                    }
                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
                    }

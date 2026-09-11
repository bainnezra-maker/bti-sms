'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  admission_number: string;
  full_name: string;
  status: string;
};

type Movement = {
  id: string;
  student_id: string;
  movement_type: 'transfer' | 'withdrawal';
  movement_date: string;
  destination_school: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
};

type MovementWithStudent = Movement & {
  student: Student | null;
};

export default function StudentMovementsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [students, setStudents] = useState<Student[]>([]);
  const [movements, setMovements] = useState<
    MovementWithStudent[]
  >([]);

  const [selectedStudentId, setSelectedStudentId] =
    useState('');

  const [movementType, setMovementType] =
    useState<'transfer' | 'withdrawal'>('transfer');

  const [movementDate, setMovementDate] =
    useState(
      new Date().toISOString().slice(0, 10)
    );

  const [destinationSchool, setDestinationSchool] =
    useState('');

  const [reason, setReason] =
    useState('');

  const [notes, setNotes] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const {
      data: userProfile,
      error: userProfileError,
    } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (
      userProfileError ||
      !userProfile?.school_id
    ) {
      setError(
        'Could not identify your school.'
      );
      setLoading(false);
      return;
    }

    const schoolId =
      userProfile.school_id;

    const {
      data: studentData,
      error: studentError,
    } = await supabase
      .from('students')
      .select(`
        id,
        admission_number,
        full_name,
        status
      `)
      .eq('school_id', schoolId)
      .order('full_name', {
        ascending: true,
      });

    if (studentError) {
      console.error(
        'Student loading error:',
        studentError
      );

      setError(
        `Could not load students: ${studentError.message}`
      );
    } else {
      setStudents(
        (studentData || []) as Student[]
      );
    }

    const {
      data: movementData,
      error: movementError,
    } = await supabase
      .from('student_movements')
      .select(`
        id,
        student_id,
        movement_type,
        movement_date,
        destination_school,
        reason,
        notes,
        created_at,
        student:students (
          id,
          admission_number,
          full_name,
          status
        )
      `)
      .order('movement_date', {
        ascending: false,
      })
      .order('created_at', {
        ascending: false,
      });

    if (movementError) {
      console.error(
        'Movement loading error:',
        movementError
      );

      setError(
        `Could not load movement history: ${movementError.message}`
      );
    } else {
      const normalizedMovements: MovementWithStudent[] =
        (movementData || []).map(
          (item: any) => ({
            id: item.id,
            student_id:
              item.student_id,
            movement_type:
              item.movement_type,
            movement_date:
              item.movement_date,
            destination_school:
              item.destination_school,
            reason:
              item.reason,
            notes:
              item.notes,
            created_at:
              item.created_at,
            student: Array.isArray(
              item.student
            )
              ? item.student[0] || null
              : item.student || null,
          })
        );

      setMovements(
        normalizedMovements
      );
    }

    setLoading(false);
  }

  async function saveMovement() {
    setMessage('');
    setError('');

    if (!selectedStudentId) {
      setError(
        'Please select a student.'
      );
      return;
    }

    if (!movementDate) {
      setError(
        'Please select the movement date.'
      );
      return;
    }

    if (
      movementType === 'transfer' &&
      !destinationSchool.trim()
    ) {
      setError(
        'Please enter the destination school for a transfer.'
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }

      const {
        error: insertError,
      } = await supabase
        .from('student_movements')
        .insert({
          student_id:
            selectedStudentId,

          movement_type:
            movementType,

          movement_date:
            movementDate,

          destination_school:
            movementType ===
            'transfer'
              ? destinationSchool.trim() ||
                null
              : null,

          reason:
            reason.trim() || null,

          notes:
            notes.trim() || null,

          recorded_by:
            user.id,
        });

      if (insertError) {
        console.error(
          'Movement save error:',
          insertError
        );

        setError(
          `Could not save movement: ${insertError.message}`
        );

        return;
      }

      setMessage(
        movementType === 'transfer'
          ? 'Student transfer recorded successfully.'
          : 'Student withdrawal recorded successfully.'
      );

      setSelectedStudentId('');
      setMovementType('transfer');
      setMovementDate(
        new Date()
          .toISOString()
          .slice(0, 10)
      );
      setDestinationSchool('');
      setReason('');
      setNotes('');

      await loadData();
    } catch (saveError) {
      console.error(
        'Unexpected movement error:',
        saveError
      );

      setError(
        'An unexpected error occurred while recording the student movement.'
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredStudents =
    students.filter((student) => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) return true;

      return (
        student.full_name
          .toLowerCase()
          .includes(query) ||
        student.admission_number
          .toLowerCase()
          .includes(query)
      );
    });

  function formatDate(
    value: string
  ) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(
      'en-GB'
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            Loading student movement records...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Student Transfer & Withdrawal
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                Record student transfers and withdrawals while preserving
                all historical academic records.
              </p>
            </div>

            <Link
              href="/students"
              className="inline-flex w-fit rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Students
            </Link>

          </div>
        </div>

        {/* Important notice */}
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">
            🔒 Historical records are preserved
          </p>

          <p className="mt-1 text-sm text-blue-800">
            Recording a transfer or withdrawal does not delete the
            student's previous enrollment, attendance, assessment,
            result or report-card records.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">

          <h2 className="text-lg font-bold text-slate-900">
            Record Student Movement
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Complete the information below and save the movement.
          </p>

          {message && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
              {error}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* Student */}
            <div className="md:col-span-2">

              <label className="text-sm font-semibold text-slate-700">
                Student
              </label>

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search by student name or admission number..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />

              <select
                value={selectedStudentId}
                onChange={(e) =>
                  setSelectedStudentId(
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">
                  Select student
                </option>

                {filteredStudents.map(
                  (student) => (
                    <option
                      key={student.id}
                      value={student.id}
                    >
                      {student.full_name} —{' '}
                      {student.admission_number}
                    </option>
                  )
                )}
              </select>

              <p className="mt-1 text-xs text-slate-400">
                {filteredStudents.length} student
                {filteredStudents.length === 1
                  ? ''
                  : 's'} found.
              </p>

            </div>

            {/* Movement Type */}
            <div>

              <label className="text-sm font-semibold text-slate-700">
                Movement Type
              </label>

              <select
                value={movementType}
                onChange={(e) =>
                  setMovementType(
                    e.target.value as
                      | 'transfer'
                      | 'withdrawal'
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="transfer">
                  Transfer
                </option>

                <option value="withdrawal">
                  Withdrawal
                </option>
              </select>

            </div>

            {/* Date */}
            <div>

              <label className="text-sm font-semibold text-slate-700">
                Movement Date
              </label>

              <input
                type="date"
                value={movementDate}
                onChange={(e) =>
                  setMovementDate(
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />

            </div>

            {/* Destination */}
            {movementType ===
              'transfer' && (
              <div className="md:col-span-2">

                <label className="text-sm font-semibold text-slate-700">
                  Destination School / Institution
                </label>

                <input
                  type="text"
                  value={
                    destinationSchool
                  }
                  onChange={(e) =>
                    setDestinationSchool(
                      e.target.value
                    )
                  }
                  placeholder="Enter destination school or institution"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />

              </div>
            )}

            {/* Reason */}
            <div className="md:col-span-2">

              <label className="text-sm font-semibold text-slate-700">
                Reason
              </label>

              <input
                type="text"
                value={reason}
                onChange={(e) =>
                  setReason(
                    e.target.value
                  )
                }
                placeholder="Enter reason for transfer or withdrawal"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />

            </div>

            {/* Notes */}
            <div className="md:col-span-2">

              <label className="text-sm font-semibold text-slate-700">
                Additional Notes
              </label>

              <textarea
                value={notes}
                onChange={(e) =>
                  setNotes(
                    e.target.value
                  )
                }
                rows={4}
                placeholder="Enter any additional information..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />

            </div>

          </div>

          <div className="mt-6">

            <button
              onClick={saveMovement}
              disabled={
                saving ||
                !selectedStudentId
              }
              className={`w-full rounded-xl px-6 py-3 font-semibold text-white sm:w-auto ${
                movementType ===
                'transfer'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {saving
                ? 'Saving...'
                : movementType ===
                  'transfer'
                ? '🔄 Record Transfer'
                : '🚪 Record Withdrawal'}
            </button>

          </div>

        </div>

        {/* Movement History */}
        <div className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

          <div className="border-b border-slate-200 p-5 sm:p-6">

            <h2 className="text-lg font-bold text-slate-900">
              Student Movement History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              All recorded transfers and withdrawals.
            </p>

          </div>

          {movements.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium text-slate-700">
                No transfer or withdrawal records found.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Recorded movements will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="min-w-full divide-y divide-slate-200">

                <thead className="bg-slate-50">
                  <tr>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Date
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Student
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Admission No.
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Movement
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Destination
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Reason
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">

                  {movements.map(
                    (movement) => (
                      <tr
                        key={
                          movement.id
                        }
                        className="hover:bg-slate-50"
                      >

                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                          {formatDate(
                            movement.movement_date
                          )}
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                          {movement.student
                            ?.full_name ||
                            'Student unavailable'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                          {movement.student
                            ?.admission_number ||
                            '—'}
                        </td>

                        <td className="px-4 py-3">

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              movement.movement_type ===
                              'transfer'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {movement.movement_type ===
                            'transfer'
                              ? 'Transfer'
                              : 'Withdrawal'}
                          </span>

                        </td>

                        <td className="px-4 py-3 text-sm text-slate-700">
                          {movement.destination_school ||
                            '—'}
                        </td>

                        <td className="max-w-xs px-4 py-3 text-sm text-slate-700">
                          {movement.reason ||
                            movement.notes ||
                            '—'}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>

        {/* Information */}
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">

          <h3 className="font-bold text-amber-900">
            Important
          </h3>

          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            <li>
              • Transfer and withdrawal records are permanent historical records.
            </li>

            <li>
              • Previous academic results are not deleted.
            </li>

            <li>
              • Previous attendance records are not deleted.
            </li>

            <li>
              • Previous enrollments remain available for historical reporting.
            </li>

            <li>
              • Historical report cards can therefore continue to be retrieved.
            </li>
          </ul>

        </div>

      </div>
    </div>
  );
}

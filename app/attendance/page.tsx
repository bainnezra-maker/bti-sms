'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type AcademicYear = {
  id: string;
  name: string;
  is_current: boolean;
};

type Programme = {
  id: string;
  name: string;
  code: string | null;
};

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
  academic_year_id: string | null;
};

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
};

type AttendanceRecord = {
  student_id: string;
  date: string;
  status: Status;
};

type Status = 'present' | 'absent' | 'late' | 'excused';

const STATUS_OPTIONS: Status[] = [
  'present',
  'absent',
  'late',
  'excused',
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(status: Status) {
  if (status === 'present') return 'Present';
  if (status === 'absent') return 'Absent';
  if (status === 'late') return 'Late';
  return 'Excused';
}

export default function AttendancePage() {
  const supabase = createClient();

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedProgramme, setSelectedProgramme] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [search, setSearch] = useState('');

  const [marks, setMarks] = useState<Record<string, Status>>({});

  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');

  // ------------------------------------------------------------
  // LOAD USER, SCHOOL AND ACADEMIC DATA
  // ------------------------------------------------------------
  useEffect(() => {
    async function loadSetup() {
      setLoading(true);
      setMessage('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage('You are not logged in.');
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data: profile, error: profileError } =
        await supabase
          .from('users')
          .select('school_id')
          .eq('id', user.id)
          .maybeSingle();

      if (profileError || !profile?.school_id) {
        setMessage(
          'Could not load your school information.'
        );
        setLoading(false);
        return;
      }

      setSchoolId(profile.school_id);

      const [
        academicYearsResult,
        programmesResult,
        classesResult,
      ] = await Promise.all([
        supabase
          .from('academic_years')
          .select('id, name, is_current')
          .eq('school_id', profile.school_id)
          .order('name', { ascending: false }),

        supabase
          .from('programmes')
          .select('id, name, code')
          .eq('school_id', profile.school_id)
          .order('name'),

        supabase
          .from('classes')
          .select(
            'id, name, level, programme_id, academic_year_id'
          )
          .eq('school_id', profile.school_id)
          .order('name'),
      ]);

      if (academicYearsResult.error) {
        setMessage(academicYearsResult.error.message);
      } else {
        setAcademicYears(
          academicYearsResult.data || []
        );

        const currentYear =
          academicYearsResult.data?.find(
            (year) => year.is_current
          );

        if (currentYear) {
          setSelectedYear(currentYear.id);
        } else if (
          academicYearsResult.data?.length
        ) {
          setSelectedYear(
            academicYearsResult.data[0].id
          );
        }
      }

      if (programmesResult.error) {
        setMessage(programmesResult.error.message);
      } else {
        setProgrammes(
          programmesResult.data || []
        );
      }

      if (classesResult.error) {
        setMessage(classesResult.error.message);
      } else {
        setClasses(classesResult.data || []);
      }

      setLoading(false);
    }

    loadSetup();
  }, []);

  // ------------------------------------------------------------
  // FILTER CLASSES
  // ------------------------------------------------------------
  const filteredClasses = useMemo(() => {
    return classes.filter((item) => {
      const matchesYear =
        !selectedYear ||
        item.academic_year_id === selectedYear;

      const matchesProgramme =
        !selectedProgramme ||
        item.programme_id === selectedProgramme;

      return matchesYear && matchesProgramme;
    });
  }, [
    classes,
    selectedYear,
    selectedProgramme,
  ]);

  // Reset class when year/programme changes
  useEffect(() => {
    if (
      selectedClass &&
      !filteredClasses.some(
        (item) => item.id === selectedClass
      )
    ) {
      setSelectedClass('');
    }
  }, [filteredClasses, selectedClass]);

  // ------------------------------------------------------------
  // LOAD STUDENTS IN SELECTED CLASS
  // ------------------------------------------------------------
  useEffect(() => {
    async function loadStudents() {
      if (
        !schoolId ||
        !selectedYear ||
        !selectedClass
      ) {
        setStudents([]);
        setMarks({});
        return;
      }

      setLoadingStudents(true);
      setMessage('');

      const {
        data: enrollmentData,
        error: enrollmentError,
      } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', selectedClass)
        .eq('academic_year_id', selectedYear)
        .eq('status', 'active');

      if (enrollmentError) {
        setMessage(
          `Could not load class enrollment: ${enrollmentError.message}`
        );
        setStudents([]);
        setLoadingStudents(false);
        return;
      }

      const studentIds =
        enrollmentData?.map(
          (item) => item.student_id
        ) || [];

      if (!studentIds.length) {
        setStudents([]);
        setMarks({});
        setLoadingStudents(false);
        return;
      }

      const {
        data: studentData,
        error: studentError,
      } = await supabase
        .from('students')
        .select(
          'id, full_name, admission_number'
        )
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .in('id', studentIds)
        .order('full_name');

      if (studentError) {
        setMessage(
          `Could not load students: ${studentError.message}`
        );
        setStudents([]);
        setLoadingStudents(false);
        return;
      }

      const loadedStudents = studentData || [];

      setStudents(loadedStudents);

      const initialMarks: Record<string, Status> = {};

      loadedStudents.forEach((student) => {
        initialMarks[student.id] = 'present';
      });

      setMarks(initialMarks);

      setLoadingStudents(false);
    }

    loadStudents();
  }, [
    schoolId,
    selectedYear,
    selectedClass,
  ]);

  // ------------------------------------------------------------
  // LOAD EXISTING ATTENDANCE FOR DATE
  // ------------------------------------------------------------
  useEffect(() => {
    async function loadAttendance() {
      if (
        !selectedClass ||
        !selectedDate ||
        !students.length
      ) {
        return;
      }

      setLoadingAttendance(true);
      setMessage('');

      const studentIds = students.map(
        (student) => student.id
      );

      const { data, error } = await supabase
        .from('attendance')
        .select(
          'student_id, date, status'
        )
        .in('student_id', studentIds)
        .eq('date', selectedDate);

      if (error) {
        setMessage(
          `Could not load attendance: ${error.message}`
        );
        setLoadingAttendance(false);
        return;
      }

      const existingMarks: Record<string, Status> = {};

      students.forEach((student) => {
        existingMarks[student.id] = 'present';
      });

      (data || []).forEach((record) => {
        if (
          record.status === 'present' ||
          record.status === 'absent' ||
          record.status === 'late' ||
          record.status === 'excused'
        ) {
          existingMarks[record.student_id] =
            record.status;
        }
      });

      setMarks(existingMarks);

      setLoadingAttendance(false);
    }

    loadAttendance();
  }, [
    selectedClass,
    selectedDate,
    students,
  ]);

  // ------------------------------------------------------------
  // SEARCH STUDENTS
  // ------------------------------------------------------------
  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return students;

    return students.filter((student) => {
      return (
        student.full_name
          .toLowerCase()
          .includes(query) ||
        student.admission_number
          .toLowerCase()
          .includes(query)
      );
    });
  }, [students, search]);

  // ------------------------------------------------------------
  // COUNTS
  // ------------------------------------------------------------
  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    students.forEach((student) => {
      const status = marks[student.id];

      if (status === 'present') present++;
      if (status === 'absent') absent++;
      if (status === 'late') late++;
      if (status === 'excused') excused++;
    });

    const total = students.length;

    // Present + Late are treated as attended.
    // Excused remains separate and does not count
    // toward attendance percentage.
    const attended = present + late;

    const attendancePercentage =
      total > 0
        ? (attended / total) * 100
        : 0;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attended,
      attendancePercentage,
    };
  }, [students, marks]);

  // ------------------------------------------------------------
  // CHANGE INDIVIDUAL STATUS
  // ------------------------------------------------------------
  function setMark(
    studentId: string,
    status: Status
  ) {
    setMarks((previous) => ({
      ...previous,
      [studentId]: status,
    }));
  }

  // ------------------------------------------------------------
  // MARK EVERYONE
  // ------------------------------------------------------------
  function markAll(status: Status) {
    const newMarks: Record<string, Status> = {};

    students.forEach((student) => {
      newMarks[student.id] = status;
    });

    setMarks(newMarks);
  }

  // ------------------------------------------------------------
  // SAVE ATTENDANCE
  // ------------------------------------------------------------
  async function saveAttendance() {
    if (
      !schoolId ||
      !userId ||
      !selectedClass ||
      !selectedDate ||
      !students.length
    ) {
      setMessage(
        'Please select an academic year and class first.'
      );
      return;
    }

    setSaving(true);
    setMessage('');

    const rows = students.map((student) => ({
      student_id: student.id,
      school_id: schoolId,
      class_id: selectedClass,
      date: selectedDate,
      status: marks[student.id] || 'present',
      recorded_by: userId,
    }));

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, {
        onConflict: 'student_id,date',
      });

    if (error) {
      setMessage(
        `Could not save attendance: ${error.message}`
      );
      setSaving(false);
      return;
    }

    setMessage(
      `Attendance saved successfully for ${students.length} students.`
    );

    setSaving(false);
  }

  // ------------------------------------------------------------
  // LOADING
  // ------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            Loading attendance...
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // PAGE
  // ------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">

        {/* HEADER */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Attendance Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Take and manage daily attendance by class.
            </p>
          </div>

          <Link
            href="/students"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Students
          </Link>
        </div>

        {/* FILTERS */}
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Attendance Register
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* ACADEMIC YEAR */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Academic Year
              </label>

              <select
                value={selectedYear}
                onChange={(event) =>
                  setSelectedYear(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
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
                    {year.is_current
                      ? ' (Current)'
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* PROGRAMME */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Programme
              </label>

              <select
                value={selectedProgramme}
                onChange={(event) =>
                  setSelectedProgramme(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
              >
                <option value="">
                  All Programmes
                </option>

                {programmes.map((programme) => (
                  <option
                    key={programme.id}
                    value={programme.id}
                  >
                    {programme.name}
                    {programme.code
                      ? ` (${programme.code})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* CLASS */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Class
              </label>

              <select
                value={selectedClass}
                onChange={(event) =>
                  setSelectedClass(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
              >
                <option value="">
                  Select class
                </option>

                {filteredClasses.map((classItem) => (
                  <option
                    key={classItem.id}
                    value={classItem.id}
                  >
                    {classItem.name}
                  </option>
                ))}
              </select>
            </div>

            {/* DATE */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Date
              </label>

              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

          </div>
        </div>

        {/* MESSAGE */}
        {message && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        {/* NO CLASS */}
        {!selectedClass && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">🎓</div>

            <h2 className="mt-3 text-lg font-bold text-slate-900">
              Select a class
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Choose an academic year and class to load
              the student register.
            </p>
          </div>
        )}

        {/* ATTENDANCE REGISTER */}
        {selectedClass && (
          <>
            {/* SUMMARY */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Total
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {counts.total}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Present
                </p>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  {counts.present}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Absent
                </p>
                <p className="mt-1 text-2xl font-bold text-red-600">
                  {counts.absent}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Late
                </p>
                <p className="mt-1 text-2xl font-bold text-orange-600">
                  {counts.late}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Attendance %
                </p>
                <p className="mt-1 text-2xl font-bold text-blue-600">
                  {counts.attendancePercentage.toFixed(1)}%
                </p>
              </div>

            </div>

            {/* REGISTER */}
            <div className="rounded-2xl bg-white shadow-sm">

              {/* REGISTER HEADER */}
              <div className="border-b border-slate-200 p-4 sm:p-6">

                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Student Register
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedDate}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        markAll('present')
                      }
                      className="rounded-lg bg-green-100 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-200"
                    >
                      Present All
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        markAll('absent')
                      }
                      className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                    >
                      Absent All
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        markAll('late')
                      }
                      className="rounded-lg bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-200"
                    >
                      Late All
                    </button>

                  </div>
                </div>

                {/* SEARCH */}
                <div className="mt-4">
                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search student name or admission number..."
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* LOADING */}
              {(loadingStudents ||
                loadingAttendance) && (
                <div className="p-8 text-center text-sm text-slate-500">
                  Loading attendance register...
                </div>
              )}

              {/* EMPTY */}
              {!loadingStudents &&
                !loadingAttendance &&
                students.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="font-semibold text-slate-700">
                      No active students found.
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Make sure students are enrolled in
                      this class for the selected academic
                      year.
                    </p>
                  </div>
                )}

              {/* STUDENTS */}
              {!loadingStudents &&
                !loadingAttendance &&
                filteredStudents.length > 0 && (
                  <div className="divide-y divide-slate-100">

                    {filteredStudents.map(
                      (student, index) => {
                        const currentStatus =
                          marks[student.id] ||
                          'present';

                        return (
                          <div
                            key={student.id}
                            className="p-4 sm:p-5"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                              {/* STUDENT INFO */}
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                                  {index + 1}
                                </div>

                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {student.full_name}
                                  </p>

                                  <p className="text-xs text-slate-500">
                                    {student.admission_number}
                                  </p>
                                </div>
                              </div>

                              {/* STATUS BUTTONS */}
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

                                {STATUS_OPTIONS.map(
                                  (status) => {
                                    const active =
                                      currentStatus ===
                                      status;

                                    return (
                                      <button
                                        key={status}
                                        type="button"
                                        onClick={() =>
                                          setMark(
                                            student.id,
                                            status
                                          )
                                        }
                                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                          active
                                            ? 'border-blue-600 bg-blue-600 text-white'
                                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                      >
                                        {statusLabel(
                                          status
                                        )}
                                      </button>
                                    );
                                  }
                                )}

                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              {/* NO SEARCH RESULTS */}
              {!loadingStudents &&
                !loadingAttendance &&
                students.length > 0 &&
                filteredStudents.length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No students match your search.
                  </div>
                )}

              {/* SAVE */}
              {students.length > 0 && (
                <div className="border-t border-slate-200 p-4 sm:p-6">

                  <button
                    type="button"
                    onClick={saveAttendance}
                    disabled={saving}
                    className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {saving
                      ? 'Saving Attendance...'
                      : 'Save Attendance'}
                  </button>

                </div>
              )}

            </div>
          </>
        )}

      </div>
    </div>
  );
}

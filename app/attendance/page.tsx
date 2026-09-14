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

type UserProfile = {
  id: string;
  school_id: string;
  role: string;
  is_active: boolean | null;
};

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

function statusIcon(status: Status) {
  if (status === 'present') {
    return 'fa-solid fa-circle-check';
  }

  if (status === 'absent') {
    return 'fa-solid fa-circle-xmark';
  }

  if (status === 'late') {
    return 'fa-solid fa-clock';
  }

  return 'fa-solid fa-shield-heart';
}

export default function AttendancePage() {
  const supabase = createClient();

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState('');

  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);

  const [programmes, setProgrammes] = useState<
    Programme[]
  >([]);

  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [students, setStudents] = useState<Student[]>([]);

  const [selectedYear, setSelectedYear] = useState('');

  const [selectedProgramme, setSelectedProgramme] =
    useState('');

  const [selectedClass, setSelectedClass] = useState('');

  const [selectedDate, setSelectedDate] =
    useState(todayString());

  const [search, setSearch] = useState('');

  const [marks, setMarks] = useState<Record<string, Status>>({});

  const [loading, setLoading] = useState(true);

  const [loadingStudents, setLoadingStudents] =
    useState(false);

  const [loadingAttendance, setLoadingAttendance] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');

  const [messageType, setMessageType] =
    useState<'info' | 'success' | 'error'>('info');

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
        setMessageType('error');
        setMessage('You are not logged in.');
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('users')
        .select('id, school_id, role, is_active')
        .eq('id', user.id)
        .maybeSingle();

      if (
        profileError ||
        !profile?.school_id ||
        profile.is_active === false
      ) {
        setMessageType('error');
        setMessage(
          'Could not load your active school account.'
        );
        setLoading(false);
        return;
      }

      const typedProfile = profile as UserProfile;

      setSchoolId(typedProfile.school_id);
      setRole(typedProfile.role);

      const [
        academicYearsResult,
        programmesResult,
        classesResult,
      ] = await Promise.all([
        supabase
          .from('academic_years')
          .select('id, name, is_current')
          .eq('school_id', typedProfile.school_id)
          .order('name', {
            ascending: false,
          }),

        supabase
          .from('programmes')
          .select('id, name, code')
          .eq('school_id', typedProfile.school_id)
          .order('name'),

        supabase
          .from('classes')
          .select(
            'id, name, level, programme_id, academic_year_id'
          )
          .eq('school_id', typedProfile.school_id)
          .order('name'),
      ]);

      // ----------------------------------------------------------
      // ACADEMIC YEARS
      // ----------------------------------------------------------
      let loadedAcademicYears: AcademicYear[] = [];

      if (academicYearsResult.error) {
        setMessageType('error');
        setMessage(
          academicYearsResult.error.message
        );
      } else {
        loadedAcademicYears =
          academicYearsResult.data || [];

        setAcademicYears(
          loadedAcademicYears
        );

        const currentYear =
          loadedAcademicYears.find(
            (year) => year.is_current
          );

        if (currentYear) {
          setSelectedYear(
            currentYear.id
          );
        } else if (
          loadedAcademicYears.length
        ) {
          setSelectedYear(
            loadedAcademicYears[0].id
          );
        }
      }

      // ----------------------------------------------------------
      // PROGRAMMES
      // ----------------------------------------------------------
      if (programmesResult.error) {
        setMessageType('error');
        setMessage(
          programmesResult.error.message
        );
      } else {
        setProgrammes(
          programmesResult.data || []
        );
      }

      // ----------------------------------------------------------
      // CLASSES
      // ----------------------------------------------------------
      if (classesResult.error) {
        setMessageType('error');
        setMessage(
          classesResult.error.message
        );
      } else {
        let loadedClasses =
          classesResult.data || [];

        /*
         * ADMINISTRATORS:
         * Keep school-wide access to all classes.
         */
        if (
          typedProfile.role.toLowerCase() ===
          'teacher'
        ) {
          /*
           * TEACHERS:
           * Only load classes assigned to this teacher
           * through the existing teacher_assignments table.
           */
          const {
            data: assignments,
            error: assignmentError,
          } = await supabase
            .from('teacher_assignments')
            .select('class_id')
            .eq(
              'teacher_id',
              typedProfile.id
            );

          if (assignmentError) {
            setMessageType('error');

            setMessage(
              `Could not load your teaching assignments: ${assignmentError.message}`
            );

            loadedClasses = [];
          } else {
            const assignedClassIds =
              new Set(
                (assignments || []).map(
                  (assignment) =>
                    assignment.class_id
                )
              );

            /*
             * Keep ONLY classes assigned to this teacher.
             */
            loadedClasses =
              loadedClasses.filter(
                (classItem) =>
                  assignedClassIds.has(
                    classItem.id
                  )
              );

            /*
             * IMPORTANT:
             *
             * If the teacher has exactly ONE assigned class,
             * automatically select that class and its academic year.
             */
            if (
              loadedClasses.length === 1
            ) {
              const onlyClass =
                loadedClasses[0];

              if (
                onlyClass.academic_year_id
              ) {
                setSelectedYear(
                  onlyClass.academic_year_id
                );
              }

              setSelectedClass(
                onlyClass.id
              );
            }

            /*
             * If the teacher has MULTIPLE assigned classes,
             * automatically select the current academic year
             * if one of their classes belongs to it.
             *
             * Otherwise select the first academic year
             * containing one of their assigned classes.
             */
            if (
              loadedClasses.length > 1
            ) {
              const currentAcademicYear =
                loadedAcademicYears.find(
                  (year) =>
                    year.is_current &&
                    loadedClasses.some(
                      (classItem) =>
                        classItem.academic_year_id ===
                        year.id
                    )
                );

              const matchingAcademicYear =
                currentAcademicYear ||
                loadedAcademicYears.find(
                  (year) =>
                    loadedClasses.some(
                      (classItem) =>
                        classItem.academic_year_id ===
                        year.id
                    )
                );

              if (
                matchingAcademicYear
              ) {
                setSelectedYear(
                  matchingAcademicYear.id
                );
              }
            }
          }
        }

        setClasses(
          loadedClasses
        );
      }

      setLoading(false);
    }

    loadSetup();
  }, []);

  // ------------------------------------------------------------
  // FILTER CLASSES
  // ------------------------------------------------------------
  const filteredClasses = useMemo(() => {
    return classes.filter(
      (item) => {
        const matchesYear =
          !selectedYear ||
          item.academic_year_id ===
            selectedYear;

        const matchesProgramme =
          !selectedProgramme ||
          item.programme_id ===
            selectedProgramme;

        return (
          matchesYear &&
          matchesProgramme
        );
      }
    );
  }, [
    classes,
    selectedYear,
    selectedProgramme,
  ]);

  // ------------------------------------------------------------
  // RESET CLASS WHEN FILTER CHANGES
  // ------------------------------------------------------------
  useEffect(() => {
    if (
      selectedClass &&
      !filteredClasses.some(
        (item) =>
          item.id ===
          selectedClass
      )
    ) {
      setSelectedClass('');
    }
  }, [
    filteredClasses,
    selectedClass,
  ]);

  // ------------------------------------------------------------
  // AUTO-SELECT CLASS WHEN ONLY ONE CLASS IS AVAILABLE
  // ------------------------------------------------------------
  useEffect(() => {
    if (
      filteredClasses.length === 1 &&
      selectedClass !==
        filteredClasses[0].id
    ) {
      setSelectedClass(
        filteredClasses[0].id
      );
    }
  }, [
    filteredClasses,
    selectedClass,
  ]);

  // ------------------------------------------------------------
  // SELECTED CLASS
  // ------------------------------------------------------------
  const selectedClassItem =
    useMemo(() => {
      return classes.find(
        (item) =>
          item.id ===
          selectedClass
      );
    }, [
      classes,
      selectedClass,
    ]);

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
        .eq(
          'class_id',
          selectedClass
        )
        .eq(
          'academic_year_id',
          selectedYear
        )
        .eq(
          'status',
          'active'
        );

      if (enrollmentError) {
        setMessageType('error');

        setMessage(
          `Could not load class enrollment: ${enrollmentError.message}`
        );

        setStudents([]);
        setLoadingStudents(false);
        return;
      }

      const studentIds =
        enrollmentData?.map(
          (item) =>
            item.student_id
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
        .eq(
          'school_id',
          schoolId
        )
        .eq(
          'status',
          'active'
        )
        .in(
          'id',
          studentIds
        )
        .order('full_name');

      if (studentError) {
        setMessageType('error');

        setMessage(
          `Could not load students: ${studentError.message}`
        );

        setStudents([]);
        setLoadingStudents(false);
        return;
      }

      const loadedStudents =
        studentData || [];

      setStudents(
        loadedStudents
      );

      const initialMarks: Record<
        string,
        Status
      > = {};

      loadedStudents.forEach(
        (student) => {
          initialMarks[
            student.id
          ] = 'present';
        }
      );

      setMarks(
        initialMarks
      );

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

      const studentIds =
        students.map(
          (student) =>
            student.id
        );

      const {
        data,
        error,
      } = await supabase
        .from('attendance')
        .select(
          'student_id, date, status'
        )
        .in(
          'student_id',
          studentIds
        )
        .eq(
          'date',
          selectedDate
        );

      if (error) {
        setMessageType('error');

        setMessage(
          `Could not load attendance: ${error.message}`
        );

        setLoadingAttendance(false);
        return;
      }

      const existingMarks: Record<
        string,
        Status
      > = {};

      students.forEach(
        (student) => {
          existingMarks[
            student.id
          ] = 'present';
        }
      );

      const records =
        (data || []) as AttendanceRecord[];

      records.forEach(
        (record) => {
          if (
            record.status ===
              'present' ||
            record.status ===
              'absent' ||
            record.status ===
              'late' ||
            record.status ===
              'excused'
          ) {
            existingMarks[
              record.student_id
            ] =
              record.status;
          }
        }
      );

      setMarks(
        existingMarks
      );

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
  const filteredStudents =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return students;
      }

      return students.filter(
        (student) =>
          student.full_name
            .toLowerCase()
            .includes(query) ||
          student.admission_number
            .toLowerCase()
            .includes(query)
      );
    }, [
      students,
      search,
    ]);

  // ------------------------------------------------------------
  // COUNTS
  // ------------------------------------------------------------
  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    students.forEach(
      (student) => {
        const status =
          marks[student.id];

        if (
          status ===
          'present'
        ) {
          present++;
        }

        if (
          status ===
          'absent'
        ) {
          absent++;
        }

        if (
          status ===
          'late'
        ) {
          late++;
        }

        if (
          status ===
          'excused'
        ) {
          excused++;
        }
      }
    );

    const total =
      students.length;

    const attended =
      present + late;

    const attendancePercentage =
      total > 0
        ? (attended / total) *
          100
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
  }, [
    students,
    marks,
  ]);

  // ------------------------------------------------------------
  // CHANGE INDIVIDUAL STATUS
  // ------------------------------------------------------------
  function setMark(
    studentId: string,
    status: Status
  ) {
    setMarks(
      (previous) => ({
        ...previous,
        [studentId]:
          status,
      })
    );
  }

  // ------------------------------------------------------------
  // MARK EVERYONE
  // ------------------------------------------------------------
  function markAll(
    status: Status
  ) {
    const newMarks: Record<
      string,
      Status
    > = {};

    students.forEach(
      (student) => {
        newMarks[
          student.id
        ] = status;
      }
    );

    setMarks(
      newMarks
    );
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
      setMessageType(
        'error'
      );

      setMessage(
        'Please select an academic year and class first.'
      );

      return;
    }

    setSaving(true);
    setMessage('');

    const rows =
      students.map(
        (student) => ({
          student_id:
            student.id,

          school_id:
            schoolId,

          class_id:
            selectedClass,

          date:
            selectedDate,

          status:
            marks[
              student.id
            ] ||
            'present',

          recorded_by:
            userId,
        })
      );

    const {
      error,
    } = await supabase
      .from('attendance')
      .upsert(
        rows,
        {
          onConflict:
            'student_id,date',
        }
      );

    if (error) {
      setMessageType(
        'error'
      );

      setMessage(
        `Could not save attendance: ${error.message}`
      );

      setSaving(false);
      return;
    }

    setMessageType(
      'success'
    );

    setMessage(
      `Attendance saved successfully for ${students.length} students.`
    );

    setSaving(false);
  }

  // ------------------------------------------------------------
  // LOADING SCREEN
  // ------------------------------------------------------------
  if (loading) {
    return (
      <>
        <style jsx global>{`
          @keyframes btiAttendanceFade {
            from {
              opacity: 0;
              transform: translateY(12px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .bti-attendance-loading {
            animation:
              btiAttendanceFade
              0.5s ease-out both;
          }

          @media (
            prefers-reduced-motion: reduce
          ) {
            .bti-attendance-loading {
              animation: none;
            }
          }
        `}</style>

        <div className="min-h-screen bg-slate-50 p-6">
          <div className="bti-attendance-loading mx-auto max-w-6xl">
            <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <i className="fa-solid fa-calendar-check text-2xl" />
              </div>

              <h2 className="mt-4 text-lg font-bold text-slate-900">
                Loading Attendance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Preparing your attendance workspace...
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------
  // PAGE
  // ------------------------------------------------------------
  return (
    <>
      <style jsx global>{`
        @keyframes btiAttendanceFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes btiAttendanceScale {
          from {
            opacity: 0;
            transform: scale(0.97);
          }

          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes btiAttendanceProgress {
          from {
            width: 0;
          }
        }

        @keyframes btiAttendancePulse {
          0%,
          100% {
            transform: scale(1);
          }

          50% {
            transform: scale(1.04);
          }
        }

        .bti-attendance-fade {
          animation:
            btiAttendanceFadeUp
            0.55s ease-out both;
        }

        .bti-attendance-scale {
          animation:
            btiAttendanceScale
            0.45s ease-out both;
        }

        .bti-attendance-delay-1 {
          animation-delay: 0.08s;
        }

        .bti-attendance-delay-2 {
          animation-delay: 0.16s;
        }

        .bti-attendance-delay-3 {
          animation-delay: 0.24s;
        }

        .bti-attendance-delay-4 {
          animation-delay: 0.32s;
        }

        .bti-attendance-progress {
          animation:
            btiAttendanceProgress
            0.9s ease-out both;
        }

        .bti-attendance-pulse:hover {
          animation:
            btiAttendancePulse
            0.7s ease-in-out;
        }

        @media (
          prefers-reduced-motion: reduce
        ) {
          .bti-attendance-fade,
          .bti-attendance-scale,
          .bti-attendance-progress,
          .bti-attendance-pulse {
            animation: none;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-5">

          {/* HEADER */}
          <div className="bti-attendance-fade flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                  <i className="fa-solid fa-calendar-check text-xl" />
                </div>

                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    Attendance Management
                  </h1>

                  <p className="mt-1 text-sm text-slate-500">
                    Take and manage daily attendance by class.
                  </p>
                </div>
              </div>

              {role.toLowerCase() ===
                'teacher' && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  <i className="fa-solid fa-chalkboard-user" />
                  Teacher Attendance Workspace
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {role.toLowerCase() ===
                'teacher' && (
                <Link
                  href="/teacher/classes"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  <i className="fa-solid fa-arrow-left" />
                  My Classes
                </Link>
              )}

              <Link
                href="/students"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
              >
                <i className="fa-solid fa-users" />
                Students
              </Link>
            </div>
          </div>

          {/* FILTERS */}
          <div className="bti-attendance-fade bti-attendance-delay-1 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <i className="fa-solid fa-sliders" />
              </div>

              <div>
                <h2 className="font-bold text-slate-900">
                  Attendance Register
                </h2>

                <p className="text-xs text-slate-500">
                  Select the academic year, class and date.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              {/* ACADEMIC YEAR */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Academic Year
                </label>

                <select
                  value={selectedYear}
                  onChange={(event) =>
                    setSelectedYear(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">
                    Select academic year
                  </option>

                  {academicYears.map(
                    (year) => (
                      <option
                        key={year.id}
                        value={year.id}
                      >
                        {year.name}
                        {year.is_current
                          ? ' (Current)'
                          : ''}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* PROGRAMME */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Programme
                </label>

                <select
                  value={
                    selectedProgramme
                  }
                  onChange={(event) =>
                    setSelectedProgramme(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">
                    All Programmes
                  </option>

                  {programmes.map(
                    (programme) => (
                      <option
                        key={
                          programme.id
                        }
                        value={
                          programme.id
                        }
                      >
                        {
                          programme.name
                        }
                        {programme.code
                          ? ` (${programme.code})`
                          : ''}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* CLASS */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Class
                </label>

                <select
                  value={
                    selectedClass
                  }
                  onChange={(event) =>
                    setSelectedClass(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">
                    Select class
                  </option>

                  {filteredClasses.map(
                    (classItem) => (
                      <option
                        key={
                          classItem.id
                        }
                        value={
                          classItem.id
                        }
                      >
                        {
                          classItem.name
                        }
                        {classItem.level
                          ? ` • ${classItem.level}`
                          : ''}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* DATE */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Date
                </label>

                <input
                  type="date"
                  value={
                    selectedDate
                  }
                  onChange={(event) =>
                    setSelectedDate(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            {selectedClassItem && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                <i className="fa-solid fa-building-columns text-blue-600" />

                <span className="font-semibold text-slate-800">
                  {
                    selectedClassItem.name
                  }
                </span>

                {selectedClassItem.level && (
                  <span className="text-slate-500">
                    •{' '}
                    {
                      selectedClassItem.level
                    }
                  </span>
                )}
              </div>
            )}
          </div>

          {/* MESSAGE */}
          {message && (
            <div
              className={`bti-attendance-fade rounded-2xl border px-4 py-3 text-sm ${
                messageType ===
                'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : messageType ===
                    'error'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-blue-200 bg-blue-50 text-blue-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <i
                  className={`mt-0.5 ${
                    messageType ===
                    'success'
                      ? 'fa-solid fa-circle-check'
                      : messageType ===
                        'error'
                      ? 'fa-solid fa-circle-exclamation'
                      : 'fa-solid fa-circle-info'
                  }`}
                />

                <span>
                  {message}
                </span>
              </div>
            </div>
          )}

          {/* NO CLASS */}
          {!selectedClass && (
            <div className="bti-attendance-scale rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <i className="fa-solid fa-users-rectangle text-2xl" />
              </div>

              <h2 className="mt-5 text-xl font-black text-slate-900">
                Select a class
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Choose an academic year and class to load
                the student attendance register.
              </p>

              {role.toLowerCase() ===
                'teacher' && (
                <Link
                  href="/teacher/classes"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
                >
                  <i className="fa-solid fa-chalkboard" />
                  Open My Classes
                </Link>
              )}
            </div>
          )}

          {/* ATTENDANCE REGISTER */}
          {selectedClass && (
            <>
              {/* SUMMARY */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

                {[
                  {
                    label: 'Total',
                    value:
                      counts.total,
                    icon:
                      'fa-solid fa-users',
                    style:
                      'bg-slate-50 text-slate-700',
                  },
                  {
                    label: 'Present',
                    value:
                      counts.present,
                    icon:
                      'fa-solid fa-circle-check',
                    style:
                      'bg-emerald-50 text-emerald-700',
                  },
                  {
                    label: 'Absent',
                    value:
                      counts.absent,
                    icon:
                      'fa-solid fa-circle-xmark',
                    style:
                      'bg-red-50 text-red-700',
                  },
                  {
                    label: 'Late',
                    value:
                      counts.late,
                    icon:
                      'fa-solid fa-clock',
                    style:
                      'bg-orange-50 text-orange-700',
                  },
                  {
                    label: 'Excused',
                    value:
                      counts.excused,
                    icon:
                      'fa-solid fa-shield-heart',
                    style:
                      'bg-purple-50 text-purple-700',
                  },
                  {
                    label: 'Attendance',
                    value: `${counts.attendancePercentage.toFixed(
                      1
                    )}%`,
                    icon:
                      'fa-solid fa-chart-line',
                    style:
                      'bg-blue-50 text-blue-700',
                  },
                ].map(
                  (
                    card,
                    index
                  ) => (
                    <div
                      key={
                        card.label
                      }
                      className={`bti-attendance-fade bti-attendance-delay-${
                        (index %
                          4) +
                        1
                      } rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.style}`}
                      >
                        <i
                          className={
                            card.icon
                          }
                        />
                      </div>

                      <p className="mt-3 text-xs font-semibold text-slate-500">
                        {
                          card.label
                        }
                      </p>

                      <p className="mt-1 text-2xl font-black text-slate-900">
                        {
                          card.value
                        }
                      </p>
                    </div>
                  )
                )}

              </div>

              {/* REGISTER */}
              <div className="bti-attendance-fade bti-attendance-delay-2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

                {/* REGISTER HEADER */}
                <div className="border-b border-slate-200 p-4 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <i className="fa-solid fa-clipboard-user" />
                        </div>

                        <div>
                          <h2 className="font-bold text-slate-900">
                            Student Register
                          </h2>

                          <p className="text-xs text-slate-500">
                            {
                              selectedDate
                            }
                            {selectedClassItem
                              ? ` • ${selectedClassItem.name}`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          markAll(
                            'present'
                          )
                        }
                        className="bti-attendance-pulse inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-200"
                      >
                        <i className="fa-solid fa-check-double" />
                        Present All
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          markAll(
                            'absent'
                          )
                        }
                        className="bti-attendance-pulse inline-flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-200"
                      >
                        <i className="fa-solid fa-xmark" />
                        Absent All
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          markAll(
                            'late'
                          )
                        }
                        className="bti-attendance-pulse inline-flex items-center gap-2 rounded-xl bg-orange-100 px-3 py-2 text-xs font-bold text-orange-700 transition hover:bg-orange-200"
                      >
                        <i className="fa-solid fa-clock" />
                        Late All
                      </button>
                    </div>
                  </div>

                  {/* SEARCH */}
                  <div className="relative mt-5">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={
                        search
                      }
                      onChange={(
                        event
                      ) =>
                        setSearch(
                          event.target
                            .value
                        )
                      }
                      placeholder="Search student name or admission number..."
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* LOADING */}
                {(loadingStudents ||
                  loadingAttendance) && (
                  <div className="p-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <i className="fa-solid fa-spinner fa-spin text-xl" />
                    </div>

                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Loading attendance register...
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Please wait.
                    </p>
                  </div>
                )}

                {/* EMPTY */}
                {!loadingStudents &&
                  !loadingAttendance &&
                  students.length ===
                    0 && (
                    <div className="p-10 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <i className="fa-solid fa-user-group text-xl" />
                      </div>

                      <p className="mt-4 font-bold text-slate-700">
                        No active students found.
                      </p>

                      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                        Make sure students are enrolled in
                        this class for the selected academic
                        year.
                      </p>
                    </div>
                  )}

                {/* STUDENTS */}
                {!loadingStudents &&
                  !loadingAttendance &&
                  filteredStudents.length >
                    0 && (
                    <div className="divide-y divide-slate-100">
                      {filteredStudents.map(
                        (
                          student,
                          index
                        ) => {
                          const currentStatus =
                            marks[
                              student
                                .id
                            ] ||
                            'present';

                          return (
                            <div
                              key={
                                student.id
                              }
                              className="p-4 transition hover:bg-slate-50 sm:p-5"
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                                {/* STUDENT INFO */}
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600">
                                    {
                                      index +
                                      1
                                    }
                                  </div>

                                  <div className="min-w-0">
                                    <p className="truncate font-bold text-slate-900">
                                      {
                                        student.full_name
                                      }
                                    </p>

                                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                      <i className="fa-solid fa-id-card" />

                                      {
                                        student.admission_number
                                      }
                                    </p>
                                  </div>
                                </div>

                                {/* STATUS BUTTONS */}
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  {STATUS_OPTIONS.map(
                                    (
                                      status
                                    ) => {
                                      const active =
                                        currentStatus ===
                                        status;

                                      return (
                                        <button
                                          key={
                                            status
                                          }
                                          type="button"
                                          onClick={() =>
                                            setMark(
                                              student.id,
                                              status
                                            )
                                          }
                                          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                                            active
                                              ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                              : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50'
                                          }`}
                                        >
                                          <i
                                            className={statusIcon(
                                              status
                                            )}
                                          />

                                          {
                                            statusLabel(
                                              status
                                            )
                                          }
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
                  students.length >
                    0 &&
                  filteredStudents.length ===
                    0 && (
                    <div className="p-10 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <i className="fa-solid fa-magnifying-glass text-lg" />
                      </div>

                      <p className="mt-3 font-semibold text-slate-700">
                        No students match your search.
                      </p>
                    </div>
                  )}

                {/* PROGRESS */}
                {students.length >
                  0 && (
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>
                        Attendance Progress
                      </span>

                      <span>
                        {
                          counts.attended
                        }
                        /
                        {
                          counts.total
                        }{' '}
                        attended
                      </span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="bti-attendance-progress h-full rounded-full bg-blue-600"
                        style={{
                          width: `${Math.min(
                            counts.attendancePercentage,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* SAVE */}
                {students.length >
                  0 && (
                  <div className="border-t border-slate-200 p-4 sm:p-6">
                    <button
                      type="button"
                      onClick={
                        saveAttendance
                      }
                      disabled={
                        saving
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      <i
                        className={
                          saving
                            ? 'fa-solid fa-spinner fa-spin'
                            : 'fa-solid fa-floppy-disk'
                        }
                      />

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

      {/* FONT AWESOME */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      />
    </>
  );
}

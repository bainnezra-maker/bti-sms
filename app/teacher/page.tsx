'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  school_id: string;
};

type Assignment = {
  id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
};

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
};

type Subject = {
  id: string;
  name: string;
  code: string | null;
};

type Semester = {
  id: string;
  name: string;
  academic_year_id: string;
};

type AcademicYear = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
};

type AttendanceRow = {
  student_id: string;
  status: string;
};

const supabase = createClient();

const quickActions = [
  {
    title: 'Take Attendance',
    description: 'Record daily attendance for your assigned classes.',
    href: '/attendance',
    icon: 'fa-solid fa-calendar-check',
    badge: 'Daily',
  },
  {
    title: 'Enter Assessment',
    description: 'Enter exercises, class tests and examination marks.',
    href: '/assessment',
    icon: 'fa-solid fa-clipboard-check',
    badge: 'Marks',
  },
  {
    title: 'View Results',
    description: 'Review academic performance for your assigned classes.',
    href: '/results',
    icon: 'fa-solid fa-chart-line',
    badge: 'Results',
  },
  {
    title: 'Attendance Reports',
    description: 'Review attendance records and percentages.',
    href: '/attendance-reports',
    icon: 'fa-solid fa-chart-column',
    badge: 'Reports',
  },
];

const getInitials = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return 'T';

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const formatToday = () => {
  return new Intl.DateTimeFormat('en-GH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
};

export default function TeacherDashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadTeacherDashboard() {
      setLoading(true);
      setError('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: userProfile, error: profileError } =
        await supabase
          .from('users')
          .select('id, full_name, email, role, school_id')
          .eq('id', user.id)
          .single();

      if (profileError || !userProfile) {
        if (mounted) {
          setError(
            profileError?.message ??
              'Unable to load your teacher profile.'
          );
          setLoading(false);
        }

        return;
      }

      /*
       * ------------------------------------------------------
       * ROLE PROTECTION
       * ------------------------------------------------------
       */

      if (userProfile.role !== 'teacher') {
        if (userProfile.role === 'admin') {
          router.replace('/');
        } else if (userProfile.role === 'Student') {
          router.replace('/student');
        } else {
          await supabase.auth.signOut();
          router.replace('/login');
        }

        return;
      }

      /*
       * ------------------------------------------------------
       * LOAD TEACHER ASSIGNMENTS
       * ------------------------------------------------------
       */

      const {
        data: assignmentData,
        error: assignmentError,
      } = await supabase
        .from('teacher_assignments')
        .select('id, class_id, subject_id, term_id')
        .eq('teacher_id', user.id);

      if (assignmentError) {
        if (mounted) {
          setError(assignmentError.message);
          setLoading(false);
        }

        return;
      }

      const assignmentRows = assignmentData ?? [];

      const classIds = [
        ...new Set(
          assignmentRows.map((row) => row.class_id)
        ),
      ];

      const subjectIds = [
        ...new Set(
          assignmentRows.map((row) => row.subject_id)
        ),
      ];

      const termIds = [
        ...new Set(
          assignmentRows.map((row) => row.term_id)
        ),
      ];

      /*
       * ------------------------------------------------------
       * LOAD ASSIGNED CLASSES, SUBJECTS AND SEMESTERS
       * ------------------------------------------------------
       */

      const [
        classesResult,
        subjectsResult,
        termsResult,
      ] = await Promise.all([
        classIds.length
          ? supabase
              .from('classes')
              .select('id, name, level, programme_id')
              .in('id', classIds)
              .order('name')
          : Promise.resolve({
              data: [],
              error: null,
            }),

        subjectIds.length
          ? supabase
              .from('subjects')
              .select('id, name, code')
              .in('id', subjectIds)
              .order('name')
          : Promise.resolve({
              data: [],
              error: null,
            }),

        termIds.length
          ? supabase
              .from('terms')
              .select('id, name, academic_year_id')
              .in('id', termIds)
              .order('start_date')
          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

      const firstError =
        classesResult.error ||
        subjectsResult.error ||
        termsResult.error;

      if (firstError) {
        if (mounted) {
          setError(firstError.message);
          setLoading(false);
        }

        return;
      }

      const classRows =
        (classesResult.data ?? []) as ClassItem[];

      const subjectRows =
        (subjectsResult.data ?? []) as Subject[];

      const semesterRows =
        (termsResult.data ?? []) as Semester[];

      /*
       * ------------------------------------------------------
       * LOAD ACADEMIC YEARS
       * ------------------------------------------------------
       */

      const academicYearIds = [
        ...new Set(
          semesterRows.map(
            (semester) => semester.academic_year_id
          )
        ),
      ];

      const academicYearResult =
        academicYearIds.length
          ? await supabase
              .from('academic_years')
              .select('id, name')
              .in('id', academicYearIds)
              .order('start_date', {
                ascending: false,
              })
          : {
              data: [],
              error: null,
            };

      if (academicYearResult.error) {
        if (mounted) {
          setError(
            academicYearResult.error.message
          );
          setLoading(false);
        }

        return;
      }

      /*
       * ------------------------------------------------------
       * LOAD STUDENTS IN ASSIGNED CLASSES
       * ------------------------------------------------------
       */

      let studentRows: Student[] = [];

      if (classIds.length) {
        const {
          data: enrollmentRows,
          error: enrollmentError,
        } = await supabase
          .from('enrollments')
          .select('student_id')
          .in('class_id', classIds);

        if (enrollmentError) {
          if (mounted) {
            setError(enrollmentError.message);
            setLoading(false);
          }

          return;
        }

        const studentIds = [
          ...new Set(
            (enrollmentRows ?? []).map(
              (row) => row.student_id
            )
          ),
        ];

        if (studentIds.length) {
          const {
            data: studentData,
            error: studentError,
          } = await supabase
            .from('students')
            .select(
              'id, full_name, admission_number'
            )
            .in('id', studentIds)
            .order('full_name');

          if (studentError) {
            if (mounted) {
              setError(studentError.message);
              setLoading(false);
            }

            return;
          }

          studentRows =
            (studentData ?? []) as Student[];
        }
      }

      /*
       * ------------------------------------------------------
       * LOAD TODAY'S ATTENDANCE
       * ------------------------------------------------------
       */

      let todayAttendance: AttendanceRow[] = [];

      if (studentRows.length) {
        const today = new Date()
          .toISOString()
          .slice(0, 10);

        const studentIds = studentRows.map(
          (student) => student.id
        );

        const {
          data: attendanceData,
          error: attendanceError,
        } = await supabase
          .from('attendance')
          .select('student_id, status')
          .in('student_id', studentIds)
          .eq('date', today);

        if (attendanceError) {
          /*
           * Attendance should enhance the dashboard,
           * but should not prevent the teacher dashboard
           * from loading if attendance access is restricted.
           */
          todayAttendance = [];
        } else {
          todayAttendance =
            (attendanceData ?? []) as AttendanceRow[];
        }
      }

      if (!mounted) return;

      setProfile(userProfile as Profile);
      setAssignments(
        assignmentRows as Assignment[]
      );
      setClasses(classRows);
      setSubjects(subjectRows);
      setSemesters(semesterRows);
      setAcademicYears(
        (academicYearResult.data ??
          []) as AcademicYear[]
      );
      setStudents(studentRows);
      setAttendanceRows(todayAttendance);

      setLoading(false);
    }

    loadTeacherDashboard();

    return () => {
      mounted = false;
    };
  }, [router]);

  /*
   * --------------------------------------------------------
   * CURRENT SEMESTER
   * --------------------------------------------------------
   */

  const currentSemester = useMemo(() => {
    const semesterOne = semesters.find(
      (semester) =>
        semester.name === 'Semester 1'
    );

    const semesterTwo = semesters.find(
      (semester) =>
        semester.name === 'Semester 2'
    );

    return (
      semesterOne ??
      semesterTwo ??
      semesters[0] ??
      null
    );
  }, [semesters]);

  /*
   * --------------------------------------------------------
   * CURRENT ACADEMIC YEAR
   * --------------------------------------------------------
   */

  const currentAcademicYear = useMemo(() => {
    if (!currentSemester) return null;

    return (
      academicYears.find(
        (year) =>
          year.id ===
          currentSemester.academic_year_id
      ) ?? null
    );
  }, [
    academicYears,
    currentSemester,
  ]);

  /*
   * --------------------------------------------------------
   * ASSIGNMENT DISPLAY
   * --------------------------------------------------------
   */

  const assignmentPairs = useMemo(() => {
    return assignments
      .map((assignment) => {
        const classItem = classes.find(
          (item) =>
            item.id === assignment.class_id
        );

        const subject = subjects.find(
          (item) =>
            item.id === assignment.subject_id
        );

        const semester = semesters.find(
          (item) =>
            item.id === assignment.term_id
        );

        const year = semester
          ? academicYears.find(
              (item) =>
                item.id ===
                semester.academic_year_id
            )
          : null;

        return {
          ...assignment,
          classItem,
          subject,
          semester,
          year,
        };
      })
      .filter(
        (item) =>
          item.classItem &&
          item.subject
      );
  }, [
    assignments,
    classes,
    subjects,
    semesters,
    academicYears,
  ]);

  /*
   * --------------------------------------------------------
   * UNIQUE CLASS-SUBJECT COUNTS
   * --------------------------------------------------------
   */

  const uniqueClassSubjectCount = useMemo(() => {
    return new Set(
      assignments.map(
        (assignment) =>
          `${assignment.class_id}-${assignment.subject_id}`
      )
    ).size;
  }, [assignments]);

  /*
   * --------------------------------------------------------
   * TODAY'S ATTENDANCE SUMMARY
   * --------------------------------------------------------
   */

  const attendanceSummary = useMemo(() => {
    const present = attendanceRows.filter(
      (row) =>
        row.status.toLowerCase() ===
          'present' ||
        row.status.toLowerCase() ===
          'late'
    ).length;

    const absent = attendanceRows.filter(
      (row) =>
        row.status.toLowerCase() ===
        'absent'
    ).length;

    const late = attendanceRows.filter(
      (row) =>
        row.status.toLowerCase() ===
        'late'
    ).length;

    const excused = attendanceRows.filter(
      (row) =>
        row.status.toLowerCase() ===
        'excused'
    ).length;

    const recorded = attendanceRows.length;

    const percentage =
      students.length > 0
        ? Math.round(
            (present / students.length) * 100
          )
        : 0;

    return {
      present,
      absent,
      late,
      excused,
      recorded,
      percentage,
    };
  }, [
    attendanceRows,
    students.length,
  ]);

  /*
   * --------------------------------------------------------
   * ASSIGNED CLASS SUMMARY
   * --------------------------------------------------------
   */

  const classSummaries = useMemo(() => {
    return classes.map((classItem) => {
      const assignmentCount =
        assignments.filter(
          (assignment) =>
            assignment.class_id ===
            classItem.id
        ).length;

      return {
        ...classItem,
        assignmentCount,
      };
    });
  }, [
    classes,
    assignments,
  ]);

  /*
   * --------------------------------------------------------
   * LOADING SCREEN
   * --------------------------------------------------------
   */

  if (loading) {
    return (
      <>
        <style jsx global>{`
          @keyframes btiTeacherSkeleton {
            0% {
              opacity: 0.55;
            }
            50% {
              opacity: 1;
            }
            100% {
              opacity: 0.55;
            }
          }

          .bti-teacher-skeleton {
            animation: btiTeacherSkeleton
              1.5s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .bti-teacher-skeleton {
              animation: none;
            }
          }
        `}</style>

        <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="bti-teacher-skeleton h-56 rounded-[2rem] bg-slate-200" />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="bti-teacher-skeleton h-32 rounded-3xl bg-slate-200"
                  />
                )
              )}
            </div>

            <div className="bti-teacher-skeleton h-72 rounded-[2rem] bg-slate-200" />

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bti-teacher-skeleton h-80 rounded-[2rem] bg-slate-200" />
              <div className="bti-teacher-skeleton h-80 rounded-[2rem] bg-slate-200" />
            </div>
          </div>
        </div>
      </>
    );
  }

  /*
   * --------------------------------------------------------
   * ERROR SCREEN
   * --------------------------------------------------------
   */

  if (error) {
    return (
      <>
        <style jsx global>{`
          @keyframes btiErrorIn {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .bti-error-card {
            animation: btiErrorIn
              0.45s ease-out both;
          }

          @media (prefers-reduced-motion: reduce) {
            .bti-error-card {
              animation: none;
            }
          }
        `}</style>

        <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
          <div className="bti-error-card mx-auto max-w-3xl rounded-[2rem] border border-red-200 bg-white p-8 shadow-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <i className="fa-solid fa-triangle-exclamation text-xl" />
            </div>

            <h1 className="mt-5 text-2xl font-black text-slate-900">
              Teacher dashboard could not load
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg"
            >
              <i className="fa-solid fa-rotate-right" />
              Try Again
            </button>
          </div>
        </div>
      </>
    );
  }

  /*
   * --------------------------------------------------------
   * DASHBOARD
   * --------------------------------------------------------
   */

  return (
    <>
      <style jsx global>{`
        @keyframes btiTeacherFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes btiTeacherScale {
          from {
            opacity: 0;
            transform: scale(0.97);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes btiTeacherFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        @keyframes btiTeacherProgress {
          from {
            width: 0;
          }
        }

        @keyframes btiTeacherPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.55;
          }
        }

        .bti-teacher-fade {
          animation: btiTeacherFadeUp
            0.55s ease-out both;
        }

        .bti-teacher-scale {
          animation: btiTeacherScale
            0.55s ease-out both;
        }

        .bti-teacher-float {
          animation: btiTeacherFloat
            4s ease-in-out infinite;
        }

        .bti-teacher-progress {
          animation: btiTeacherProgress
            1.1s ease-out both;
        }

        .bti-teacher-pulse {
          animation: btiTeacherPulse
            2s ease-in-out infinite;
        }

        .bti-teacher-delay-1 {
          animation-delay: 80ms;
        }

        .bti-teacher-delay-2 {
          animation-delay: 160ms;
        }

        .bti-teacher-delay-3 {
          animation-delay: 240ms;
        }

        .bti-teacher-delay-4 {
          animation-delay: 320ms;
        }

        @media (prefers-reduced-motion: reduce) {
          .bti-teacher-fade,
          .bti-teacher-scale,
          .bti-teacher-float,
          .bti-teacher-progress,
          .bti-teacher-pulse {
            animation: none;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* ==================================================
              HERO
          ================================================== */}

          <section className="bti-teacher-scale relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-7 text-white shadow-2xl sm:px-8 sm:py-8">

            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/[0.04]" />

            <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-white/[0.035]" />

            <div className="pointer-events-none absolute right-20 top-12 h-20 w-20 rounded-full border border-white/[0.06]" />

            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">

              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-bold text-slate-200 ring-1 ring-white/10 backdrop-blur">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                    <i className="fa-solid fa-chalkboard-user text-[10px]" />
                  </span>
                  Teacher Workspace
                </div>

                <div className="flex items-center gap-4">

                  <div className="bti-teacher-float hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-black text-slate-900 shadow-xl sm:flex">
                    {getInitials(
                      profile?.full_name ??
                        'Teacher'
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-400">
                      {formatToday()}
                    </p>

                    <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
                      Welcome,{' '}
                      {profile?.full_name ??
                        'Teacher'}
                    </h1>
                  </div>
                </div>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Your teaching workspace for
                  managing classes, students,
                  attendance and academic
                  assessments.
                </p>
              </div>

              <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/10 backdrop-blur-md lg:min-w-[250px]">

                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                    <i className="fa-solid fa-calendar-days text-sm" />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      Academic Context
                    </p>

                    <p className="mt-1 text-sm font-extrabold text-white">
                      {currentAcademicYear?.name ??
                        'No academic year'}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-300">
                      {currentSemester?.name ??
                        'No semester assigned'}
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* ==================================================
              SUMMARY CARDS
          ================================================== */}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {[
              {
                label: 'My Classes',
                value: classes.length,
                note: 'Assigned classes',
                icon: 'fa-solid fa-school',
                delay: 'bti-teacher-delay-1',
              },
              {
                label: 'My Subjects',
                value: subjects.length,
                note: 'Assigned subjects',
                icon: 'fa-solid fa-book-open',
                delay: 'bti-teacher-delay-2',
              },
              {
                label: 'My Students',
                value: students.length,
                note: 'Across your classes',
                icon: 'fa-solid fa-user-graduate',
                delay: 'bti-teacher-delay-3',
              },
              {
                label: 'Teaching Load',
                value: uniqueClassSubjectCount,
                note: 'Class-subject pairs',
                icon: 'fa-solid fa-layer-group',
                delay: 'bti-teacher-delay-4',
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`bti-teacher-fade ${card.delay} group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl`}
              >
                <div className="flex items-start justify-between gap-4">

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {card.label}
                    </p>

                    <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                      {card.value}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {card.note}
                    </p>
                  </div>

                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition duration-300 group-hover:rotate-3 group-hover:bg-slate-900 group-hover:text-white">
                    <i className={`${card.icon} text-sm`} />
                  </span>
                </div>
              </div>
            ))}
          </section>

          {/* ==================================================
              QUICK ACTIONS
          ================================================== */}

          <section className="bti-teacher-fade">

            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Teaching Tools
                </p>

                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                  Quick Actions
                </h2>
              </div>

              <div className="hidden items-center gap-2 text-xs font-semibold text-slate-400 sm:flex">
                <i className="fa-solid fa-bolt text-amber-500" />
                Ready for today
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              {quickActions.map(
                (action, index) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl"
                  >
                    <div className="absolute right-0 top-0 h-20 w-20 translate-x-8 -translate-y-8 rounded-full bg-slate-50 transition duration-500 group-hover:scale-150" />

                    <div className="relative">

                      <div className="flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md transition duration-300 group-hover:scale-105 group-hover:rotate-2">
                          <i className={`${action.icon} text-sm`} />
                        </div>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                          {action.badge}
                        </span>
                      </div>

                      <h3 className="mt-5 font-black text-slate-900">
                        {action.title}
                      </h3>

                      <p className="mt-1.5 text-xs leading-5 text-slate-500">
                        {action.description}
                      </p>

                      <div className="mt-5 flex items-center gap-2 text-xs font-black text-slate-700">
                        Open Tool
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 transition duration-300 group-hover:translate-x-1 group-hover:bg-slate-900 group-hover:text-white">
                          <i className="fa-solid fa-arrow-right text-[9px]" />
                        </span>
                      </div>
                    </div>

                    {index === 0 && (
                      <span className="absolute bottom-0 left-0 h-1 w-full bg-slate-900 opacity-0 transition group-hover:opacity-100" />
                    )}
                  </Link>
                )
              )}

            </div>
          </section>

          {/* ==================================================
              ATTENDANCE + TEACHING OVERVIEW
          ================================================== */}

          <section className="grid gap-6 lg:grid-cols-2">

            {/* Attendance Card */}

            <div className="bti-teacher-fade bti-teacher-delay-1 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">

              <div className="flex items-start justify-between gap-4">

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Daily Attendance
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Today&apos;s Overview
                  </h2>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <i className="fa-solid fa-calendar-check" />
                </div>

              </div>

              <div className="mt-6 flex items-center gap-6">

                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white shadow-sm">
                    <div className="text-center">
                      <p className="text-2xl font-black text-slate-900">
                        {attendanceSummary.percentage}%
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Present
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-3">

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-semibold text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Present
                    </span>

                    <span className="font-black text-slate-900">
                      {attendanceSummary.present}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-semibold text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Absent
                    </span>

                    <span className="font-black text-slate-900">
                      {attendanceSummary.absent}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-semibold text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Late
                    </span>

                    <span className="font-black text-slate-900">
                      {attendanceSummary.late}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-semibold text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Excused
                    </span>

                    <span className="font-black text-slate-900">
                      {attendanceSummary.excused}
                    </span>
                  </div>

                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Attendance recorded
                  </span>

                  <span className="text-xs font-black text-slate-700">
                    {attendanceSummary.recorded}/
                    {students.length}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="bti-teacher-progress h-full rounded-full bg-slate-900"
                    style={{
                      width:
                        students.length > 0
                          ? `${Math.min(
                              100,
                              Math.round(
                                (attendanceSummary.recorded /
                                  students.length) *
                                  100
                              )
                            )}%`
                          : '0%',
                    }}
                  />
                </div>
              </div>

              <Link
                href="/attendance"
                className="mt-6 inline-flex items-center gap-2 text-xs font-black text-slate-700 transition hover:text-slate-950"
              >
                Open attendance
                <i className="fa-solid fa-arrow-right text-[9px]" />
              </Link>
            </div>

            {/* Class Overview */}

            <div className="bti-teacher-fade bti-teacher-delay-2 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">

              <div className="flex items-start justify-between gap-4">

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Teaching Overview
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Assigned Classes
                  </h2>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <i className="fa-solid fa-school" />
                </div>

              </div>

              {classSummaries.length === 0 ? (
                <div className="py-10 text-center">

                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <i className="fa-solid fa-school-circle-xmark" />
                  </div>

                  <p className="mt-3 text-sm font-bold text-slate-700">
                    No classes assigned
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Your administrator needs to
                    create a teacher assignment.
                  </p>

                </div>
              ) : (
                <div className="mt-5 space-y-3">

                  {classSummaries
                    .slice(0, 5)
                    .map((classItem) => (
                      <div
                        key={classItem.id}
                        className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3.5 transition duration-200 hover:border-slate-200 hover:bg-white hover:shadow-sm"
                      >

                        <div className="flex min-w-0 items-center gap-3">

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm transition group-hover:bg-slate-900 group-hover:text-white">
                            <i className="fa-solid fa-building-columns text-xs" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-800">
                              {classItem.name}
                            </p>

                            {classItem.level && (
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                {classItem.level}
                              </p>
                            )}
                          </div>

                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black text-slate-900">
                            {classItem.assignmentCount}
                          </p>

                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            subjects
                          </p>
                        </div>

                      </div>
                    ))}

                  {classSummaries.length > 5 && (
                    <p className="pt-1 text-center text-[11px] font-semibold text-slate-400">
                      +{classSummaries.length - 5}{' '}
                      more assigned class
                      {classSummaries.length - 5 === 1
                        ? ''
                        : 'es'}
                    </p>
                  )}

                </div>
              )}
            </div>

          </section>

          {/* ==================================================
              MY ASSIGNMENTS
          ================================================== */}

          <section className="bti-teacher-fade bti-teacher-delay-2 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-100 px-6 py-6 sm:px-7">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Teaching Load
                  </p>

                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                    My Assignments
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Your assigned class, subject and
                    semester combinations.
                  </p>
                </div>

                <div className="flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3.5 py-2 text-xs font-black text-slate-600">
                  <i className="fa-solid fa-layer-group text-slate-400" />
                  {assignments.length}{' '}
                  assignment
                  {assignments.length === 1
                    ? ''
                    : 's'}
                </div>

              </div>
            </div>

            {assignmentPairs.length === 0 ? (
              <div className="px-6 py-14 text-center sm:px-7">

                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <i className="fa-solid fa-clipboard-list text-xl" />
                </div>

                <h3 className="mt-5 font-black text-slate-900">
                  No assignments yet
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  An administrator needs to assign
                  a class, subject and semester to
                  your teacher account before your
                  teaching tools can be fully used.
                </p>

              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="min-w-full text-left text-sm">

                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">

                    <tr>
                      <th className="px-6 py-4 sm:px-7">
                        Class
                      </th>

                      <th className="px-6 py-4">
                        Subject
                      </th>

                      <th className="px-6 py-4">
                        Semester
                      </th>

                      <th className="px-6 py-4">
                        Academic Year
                      </th>
                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {assignmentPairs.map(
                      (assignment) => (
                        <tr
                          key={assignment.id}
                          className="group transition hover:bg-slate-50"
                        >

                          <td className="px-6 py-4 sm:px-7">

                            <div className="flex items-center gap-3">

                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-slate-900 group-hover:text-white">
                                <i className="fa-solid fa-school text-[10px]" />
                              </div>

                              <div>
                                <div className="font-black text-slate-900">
                                  {assignment.classItem?.name}
                                </div>

                                {assignment.classItem
                                  ?.level && (
                                  <div className="mt-0.5 text-xs text-slate-400">
                                    {
                                      assignment
                                        .classItem
                                        .level
                                    }
                                  </div>
                                )}
                              </div>

                            </div>

                          </td>

                          <td className="px-6 py-4">

                            <div className="font-bold text-slate-800">
                              {assignment.subject?.name}
                            </div>

                            {assignment.subject
                              ?.code && (
                              <div className="mt-0.5 text-xs text-slate-400">
                                {
                                  assignment
                                    .subject
                                    .code
                                }
                              </div>
                            )}

                          </td>

                          <td className="px-6 py-4">

                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                              <i className="fa-solid fa-calendar-days text-[9px]" />
                              {assignment.semester
                                ?.name ?? '—'}
                            </span>

                          </td>

                          <td className="px-6 py-4 font-semibold text-slate-600">
                            {assignment.year
                              ?.name ?? '—'}
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ==================================================
              STUDENT DIRECTORY
          ================================================== */}

          <section className="bti-teacher-fade bti-teacher-delay-3 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">

            <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-6 sm:px-7 md:flex-row md:items-center md:justify-between">

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Student Access
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  My Students
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Students currently enrolled in
                  your assigned classes.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-3.5 py-2 text-xs font-black text-slate-600">
                <i className="fa-solid fa-users mr-1.5 text-slate-400" />
                {students.length}{' '}
                student
                {students.length === 1
                  ? ''
                  : 's'}
              </span>

            </div>

            {students.length === 0 ? (
              <div className="px-6 py-12 text-center sm:px-7">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <i className="fa-solid fa-user-graduate text-lg" />
                </div>

                <p className="mt-4 text-sm font-bold text-slate-700">
                  No students found
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Students will appear here once
                  they are enrolled in your assigned
                  classes.
                </p>

              </div>
            ) : (
              <>
                <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">

                  {students
                    .slice(0, 12)
                    .map((student, index) => (
                      <div
                        key={student.id}
                        className={`bti-teacher-fade group flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-sm`}
                        style={{
                          animationDelay: `${index * 35}ms`,
                        }}
                      >

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition duration-300 group-hover:scale-105">
                          <span className="text-xs font-black">
                            {getInitials(
                              student.full_name
                            )}
                          </span>
                        </div>

                        <div className="min-w-0">

                          <p className="truncate text-sm font-black text-slate-800">
                            {student.full_name}
                          </p>

                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                            <i className="fa-solid fa-id-card text-[9px]" />
                            {student.admission_number}
                          </p>

                        </div>

                      </div>
                    ))}

                </div>

                {students.length > 12 && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4 text-center text-xs font-semibold text-slate-400">
                    <i className="fa-solid fa-circle-info mr-1.5" />
                    Showing the first 12 students.
                    Your assigned class tools provide
                    access to the complete roster.
                  </div>
                )}
              </>
            )}
          </section>

          {/* ==================================================
              FOOTER
          ================================================== */}

          <footer className="bti-teacher-fade border-t border-slate-200 pt-5 pb-4">

            <div className="flex flex-col gap-2 text-center text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:text-left">

              <p>
                <i className="fa-solid fa-shield-halved mr-1.5" />
                BTI-SMS Teacher Workspace
              </p>

              <p>
                <i className="fa-solid fa-graduation-cap mr-1.5" />
                Biriwa Technical Institute
              </p>

            </div>
          </footer>

        </div>
      </div>
    </>
  );
}

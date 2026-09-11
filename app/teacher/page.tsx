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

const supabase = createClient();

const quickActions = [
  {
    title: 'Take Attendance',
    description: 'Record attendance for your assigned classes.',
    href: '/attendance',
    icon: 'fa-solid fa-calendar-check',
  },
  {
    title: 'Enter Assessment',
    description: 'Enter and update marks for your assigned subjects.',
    href: '/assessment',
    icon: 'fa-solid fa-clipboard-check',
  },
  {
    title: 'View Results',
    description: 'Review academic performance for your classes.',
    href: '/results',
    icon: 'fa-solid fa-chart-line',
  },
  {
    title: 'Attendance Reports',
    description: 'Review attendance records and percentages.',
    href: '/attendance-reports',
    icon: 'fa-solid fa-chart-column',
  },
];

export default function TeacherDashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

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
          .select(
            'id, full_name, email, role, school_id'
          )
          .eq('id', user.id)
          .single();

      if (profileError || !userProfile) {
        if (mounted) {
          setError(
            profileError?.message ??
              'Unable to load your profile.'
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
        .select(
          'id, class_id, subject_id, term_id'
        )
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
          assignmentRows.map(
            (row) => row.class_id
          )
        ),
      ];

      const subjectIds = [
        ...new Set(
          assignmentRows.map(
            (row) => row.subject_id
          )
        ),
      ];

      const termIds = [
        ...new Set(
          assignmentRows.map(
            (row) => row.term_id
          )
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
              .select(
                'id, name, level, programme_id'
              )
              .in('id', classIds)
              .order('name')
          : Promise.resolve({
              data: [],
              error: null,
            }),

        subjectIds.length
          ? supabase
              .from('subjects')
              .select(
                'id, name, code'
              )
              .in('id', subjectIds)
              .order('name')
          : Promise.resolve({
              data: [],
              error: null,
            }),

        termIds.length
          ? supabase
              .from('terms')
              .select(
                'id, name, academic_year_id'
              )
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
       * LOAD ACADEMIC YEARS CONNECTED TO ASSIGNMENTS
       * ------------------------------------------------------
       */

      const academicYearIds = [
        ...new Set(
          semesterRows.map(
            (term) => term.academic_year_id
          )
        ),
      ];

      const academicYearResult =
        academicYearIds.length
          ? await supabase
              .from('academic_years')
              .select('id, name')
              .in(
                'id',
                academicYearIds
              )
              .order(
                'start_date',
                {
                  ascending: false,
                }
              )
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
            setError(
              enrollmentError.message
            );
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
              setError(
                studentError.message
              );
              setLoading(false);
            }

            return;
          }

          studentRows =
            (studentData ?? []) as Student[];
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
    return (
      semesters.find(
        (semester) =>
          semester.name === 'Semester 1' ||
          semester.name === 'Semester 2'
      ) ??
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
   * BUILD ASSIGNMENT DISPLAY
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
   * LOADING SCREEN
   * --------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-6">
          <div className="h-36 rounded-3xl bg-slate-200" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="h-32 rounded-2xl bg-slate-200"
                />
              )
            )}
          </div>

          <div className="h-80 rounded-3xl bg-slate-200" />
        </div>
      </div>
    );
  }

  /*
   * --------------------------------------------------------
   * ERROR SCREEN
   * --------------------------------------------------------
   */

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <i className="fa-solid fa-triangle-exclamation text-xl" />
          </div>

          <h1 className="mt-5 text-2xl font-extrabold text-slate-900">
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
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /*
   * --------------------------------------------------------
   * DASHBOARD
   * --------------------------------------------------------
   */

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ==================================================
            HEADER
        ================================================== */}

        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-7 text-white shadow-xl sm:px-8">

          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5" />

          <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-white/5" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200 ring-1 ring-white/10">
                <i className="fa-solid fa-chalkboard-user" />
                Teacher Workspace
              </div>

              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                Welcome,{' '}
                {profile?.full_name ??
                  'Teacher'}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Manage your assigned classes,
                students, attendance and
                assessments from one place.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/10 backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Academic Context
              </p>

              <p className="mt-1 text-sm font-bold text-white">
                {currentAcademicYear?.name ??
                  'No academic year assigned'}
              </p>

              <p className="mt-0.5 text-xs text-slate-300">
                {currentSemester?.name ??
                  'No semester assigned'}
              </p>
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
              icon: 'fa-solid fa-school',
              note: 'Assigned classes',
            },
            {
              label: 'My Subjects',
              value: subjects.length,
              icon: 'fa-solid fa-book-open',
              note: 'Assigned subjects',
            },
            {
              label: 'My Students',
              value: students.length,
              icon: 'fa-solid fa-user-graduate',
              note: 'Across assigned classes',
            },
            {
              label: 'Assignments',
              value: assignments.length,
              icon: 'fa-solid fa-chalkboard-user',
              note: 'Class-subject-semester',
            },
          ].map((card) => (
            <div
              key={card.label}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {card.label}
                  </p>

                  <p className="mt-2 text-3xl font-black text-slate-900">
                    {card.value}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {card.note}
                  </p>
                </div>

                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
                  <i
                    className={`${card.icon} text-base`}
                  />
                </span>
              </div>
            </div>
          ))}
        </section>

        {/* ==================================================
            QUICK ACTIONS
        ================================================== */}

        <section>

          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Quick Actions
              </p>

              <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                Teaching tools
              </h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {quickActions.map(
              (action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition group-hover:scale-105">
                    <i
                      className={`${action.icon} text-sm`}
                    />
                  </div>

                  <h3 className="mt-4 font-extrabold text-slate-900">
                    {action.title}
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {action.description}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-700">
                    Open

                    <i className="fa-solid fa-arrow-right text-[10px] transition group-hover:translate-x-1" />
                  </div>
                </Link>
              )
            )}

          </div>
        </section>

        {/* ==================================================
            MY ASSIGNMENTS
        ================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-6 py-5 sm:px-7">

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Teaching Load
            </p>

            <h2 className="mt-1 text-xl font-extrabold text-slate-900">
              My Assignments
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              These are the class, subject and
              semester combinations assigned to
              your teacher account.
            </p>
          </div>

          {assignmentPairs.length === 0 ? (
            <div className="px-6 py-12 text-center sm:px-7">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <i className="fa-solid fa-clipboard-list text-xl" />
              </div>

              <h3 className="mt-4 font-bold text-slate-900">
                No assignments yet
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                An administrator needs to assign
                a class, subject and semester to
                your teacher account before
                teaching tools can be used.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="min-w-full text-left text-sm">

                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">

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
                        className="transition hover:bg-slate-50"
                      >

                        <td className="px-6 py-4 sm:px-7">

                          <div className="font-bold text-slate-900">
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

                        </td>

                        <td className="px-6 py-4">

                          <div className="font-semibold text-slate-800">
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

                        <td className="px-6 py-4 text-slate-600">
                          {assignment.semester
                            ?.name ?? '—'}
                        </td>

                        <td className="px-6 py-4 text-slate-600">
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
            MY STUDENTS
        ================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:px-7 md:flex-row md:items-center md:justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Student Access
              </p>

              <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                My Students
              </h2>

            </div>

            <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
              {students.length}{' '}
              student
              {students.length === 1
                ? ''
                : 's'}
            </span>

          </div>

          {students.length === 0 ? (
            <div className="px-6 py-10 text-center sm:px-7">

              <p className="text-sm text-slate-500">
                No students are currently
                enrolled in your assigned
                classes.
              </p>

            </div>
          ) : (
            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">

              {students
                .slice(0, 12)
                .map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                  >

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <i className="fa-solid fa-user text-xs" />
                    </div>

                    <div className="min-w-0">

                      <p className="truncate text-sm font-bold text-slate-800">
                        {student.full_name}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        {student.admission_number}
                      </p>

                    </div>

                  </div>
                ))}

            </div>
          )}

          {students.length > 12 && (
            <div className="border-t border-slate-100 px-6 py-4 text-center text-xs font-semibold text-slate-400">
              Showing the first 12 students.
              Use your assigned class tools
              for the complete roster.
            </div>
          )}

        </section>

      </div>
    </div>
  );
}

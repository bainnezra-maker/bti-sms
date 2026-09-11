import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

type AcademicYear = {
  id: string;
  name: string;
  is_current: boolean;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // --------------------------------------------------
  // GET USER SCHOOL
  // --------------------------------------------------

  const { data: userData } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', user.id)
    .single();

  if (!userData?.school_id) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          School profile could not be found.
        </div>
      </div>
    );
  }

  const schoolId = userData.school_id;

  // --------------------------------------------------
  // LOAD DASHBOARD DATA
  // --------------------------------------------------

  const [
    studentResult,
    staffResult,
    classResult,
    subjectResult,
    programmeResult,
    academicYearResult,
    attendanceResult,
    assessmentResult,
  ] = await Promise.all([
    supabase
      .from('students')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('school_id', schoolId),

    supabase
      .from('users')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('school_id', schoolId),

    supabase
      .from('classes')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('school_id', schoolId),

    supabase
      .from('subjects')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('school_id', schoolId),

    supabase
      .from('programmes')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('school_id', schoolId),

    supabase
      .from('academic_years')
      .select(
        'id, name, is_current'
      )
      .eq('school_id', schoolId)
      .order('start_date', {
        ascending: false,
        nullsFirst: false,
      }),

    supabase
      .from('attendance')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('school_id', schoolId),

    supabase
      .from('assessments')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('school_id', schoolId),
  ]);

  const studentCount =
    studentResult.count || 0;

  const staffCount =
    staffResult.count || 0;

  const classCount =
    classResult.count || 0;

  const subjectCount =
    subjectResult.count || 0;

  const programmeCount =
    programmeResult.count || 0;

  const attendanceCount =
    attendanceResult.count || 0;

  const assessmentCount =
    assessmentResult.count || 0;

  const academicYears =
    (academicYearResult.data ||
      []) as AcademicYear[];

  const currentAcademicYear =
    academicYears.find(
      (year) => year.is_current
    );

  // --------------------------------------------------
  // QUICK ACTIONS
  // --------------------------------------------------

  const quickActions = [
    {
      title: 'Students',
      description:
        'View and manage student records.',
      href: '/students',
      icon: 'fa-solid fa-users',
      iconBg:
        'bg-blue-100 text-blue-600',
      hover:
        'hover:border-blue-300 hover:shadow-blue-100',
    },
    {
      title: 'Add Student',
      description:
        'Register a new student into the school.',
      href: '/students/new',
      icon: 'fa-solid fa-user-plus',
      iconBg:
        'bg-emerald-100 text-emerald-600',
      hover:
        'hover:border-emerald-300 hover:shadow-emerald-100',
    },
    {
      title: 'Attendance',
      description:
        'Record daily student attendance.',
      href: '/attendance',
      icon: 'fa-solid fa-calendar-check',
      iconBg:
        'bg-violet-100 text-violet-600',
      hover:
        'hover:border-violet-300 hover:shadow-violet-100',
    },
    {
      title: 'Assessment',
      description:
        'Record class exercises, tests and examinations.',
      href: '/assessment',
      icon: 'fa-solid fa-pen-to-square',
      iconBg:
        'bg-amber-100 text-amber-600',
      hover:
        'hover:border-amber-300 hover:shadow-amber-100',
    },
    {
      title: 'Results',
      description:
        'View student and class academic results.',
      href: '/results',
      icon: 'fa-solid fa-chart-column',
      iconBg:
        'bg-cyan-100 text-cyan-600',
      hover:
        'hover:border-cyan-300 hover:shadow-cyan-100',
    },
    {
      title: 'Promotion',
      description:
        'Promote students to the next academic year.',
      href: '/promotion',
      icon: 'fa-solid fa-arrow-up-right-dots',
      iconBg:
        'bg-indigo-100 text-indigo-600',
      hover:
        'hover:border-indigo-300 hover:shadow-indigo-100',
    },
    {
      title: 'Transfer & Withdrawal',
      description:
        'Record student transfers and withdrawals.',
      href: '/student-movements',
      icon: 'fa-solid fa-right-left',
      iconBg:
        'bg-rose-100 text-rose-600',
      hover:
        'hover:border-rose-300 hover:shadow-rose-100',
    },
    {
      title: 'Report Cards',
      description:
        'Generate professional student report cards.',
      href: '/students',
      icon: 'fa-solid fa-file-lines',
      iconBg:
        'bg-sky-100 text-sky-600',
      hover:
        'hover:border-sky-300 hover:shadow-sky-100',
    },
  ];

  const managementLinks = [
    {
      title: 'Classes',
      href: '/classes',
      icon: 'fa-solid fa-school',
    },
    {
      title: 'Subjects',
      href: '/subjects',
      icon: 'fa-solid fa-book-open',
    },
    {
      title: 'Programmes',
      href: '/programmes',
      icon: 'fa-solid fa-layer-group',
    },
    {
      title: 'Academic Years',
      href: '/academic-years',
      icon: 'fa-solid fa-calendar-days',
    },
    {
      title: 'Semesters',
      href: '/terms',
      icon: 'fa-solid fa-calendar-week',
    },
    {
      title: 'Staff',
      href: '/staff',
      icon: 'fa-solid fa-user-tie',
    },
    {
      title: 'Fees',
      href: '/fees',
      icon: 'fa-solid fa-money-bill-wave',
    },
    {
      title: 'Reports',
      href: '/reports',
      icon: 'fa-solid fa-chart-pie',
    },
  ];

  return (
    <>
      {/* Font Awesome */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      />

      <div className="min-h-screen overflow-hidden bg-slate-50">

        {/* ==================================================
            HERO SECTION
        ================================================== */}

        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-4 pb-16 pt-20 text-white sm:px-6 lg:px-10 lg:pt-10">

          {/* Decorative animated circles */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 animate-pulse rounded-full bg-blue-500/20 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 animate-pulse rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="pointer-events-none absolute right-1/3 top-1/2 h-40 w-40 animate-ping rounded-full bg-cyan-400/5" />

          <div className="relative mx-auto max-w-7xl">

            <div className="animate-[fadeInDown_0.7s_ease-out]">

              <div className="mb-5 flex items-center gap-3">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/20 backdrop-blur">

                  <i className="fa-solid fa-school text-xl text-cyan-300" />

                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-200">
                    BTI
                  </p>

                  <p className="text-sm text-blue-100">
                    School Management System
                  </p>
                </div>

              </div>

              <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">

                Welcome back to your
                <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
                  school dashboard.
                </span>

              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100/80 sm:text-base">
                Manage students, attendance, assessments,
                results, academic records and daily school
                operations from one central platform.
              </p>

            </div>

            {/* Current Academic Year */}
            <div className="mt-8 animate-[fadeInUp_0.8s_ease-out_0.2s_both]">

              <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-xl backdrop-blur-md">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/20 text-cyan-300">
                  <i className="fa-solid fa-calendar-check" />
                </div>

                <div>
                  <p className="text-xs font-medium text-blue-200">
                    Current Academic Year
                  </p>

                  <p className="font-bold text-white">
                    {currentAcademicYear?.name ||
                      'No current academic year'}
                  </p>
                </div>

                {currentAcademicYear && (
                  <span className="ml-2 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-300">
                    Active
                  </span>
                )}

              </div>

            </div>

          </div>
        </section>

        {/* ==================================================
            MAIN CONTENT
        ================================================== */}

        <main className="-mt-8 relative z-10 px-4 pb-12 sm:px-6 lg:px-10">

          <div className="mx-auto max-w-7xl">

            {/* ==================================================
                STATISTICS
            ================================================== */}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

              {/* Students */}
              <div className="group animate-[fadeInUp_0.7s_ease-out_0.1s_both] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-6">

                <div className="flex items-start justify-between">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition-transform duration-300 group-hover:scale-110">
                    <i className="fa-solid fa-users" />
                  </div>

                  <span className="text-xs font-semibold text-blue-500">
                    Students
                  </span>

                </div>

                <p className="mt-5 text-3xl font-black text-slate-900">
                  {studentCount.toLocaleString()}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Total registered students
                </p>

              </div>

              {/* Staff */}
              <div className="group animate-[fadeInUp_0.7s_ease-out_0.2s_both] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-6">

                <div className="flex items-start justify-between">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition-transform duration-300 group-hover:scale-110">
                    <i className="fa-solid fa-user-tie" />
                  </div>

                  <span className="text-xs font-semibold text-emerald-500">
                    Staff
                  </span>

                </div>

                <p className="mt-5 text-3xl font-black text-slate-900">
                  {staffCount.toLocaleString()}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  School staff accounts
                </p>

              </div>

              {/* Classes */}
              <div className="group animate-[fadeInUp_0.7s_ease-out_0.3s_both] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-6">

                <div className="flex items-start justify-between">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600 transition-transform duration-300 group-hover:scale-110">
                    <i className="fa-solid fa-school" />
                  </div>

                  <span className="text-xs font-semibold text-violet-500">
                    Classes
                  </span>

                </div>

                <p className="mt-5 text-3xl font-black text-slate-900">
                  {classCount.toLocaleString()}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Active school classes
                </p>

              </div>

              {/* Subjects */}
              <div className="group animate-[fadeInUp_0.7s_ease-out_0.4s_both] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-6">

                <div className="flex items-start justify-between">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600 transition-transform duration-300 group-hover:scale-110">
                    <i className="fa-solid fa-book-open" />
                  </div>

                  <span className="text-xs font-semibold text-amber-500">
                    Subjects
                  </span>

                </div>

                <p className="mt-5 text-3xl font-black text-slate-900">
                  {subjectCount.toLocaleString()}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Subjects in the system
                </p>

              </div>

            </div>

            {/* ==================================================
                SECONDARY STATISTICS
            ================================================== */}

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">

              <div className="animate-[fadeInUp_0.7s_ease-out_0.5s_both] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                <div className="flex items-center gap-4">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
                    <i className="fa-solid fa-layer-group" />
                  </div>

                  <div>
                    <p className="text-2xl font-black text-slate-900">
                      {programmeCount.toLocaleString()}
                    </p>

                    <p className="text-sm text-slate-500">
                      Programmes
                    </p>
                  </div>

                </div>

              </div>

              <div className="animate-[fadeInUp_0.7s_ease-out_0.6s_both] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                <div className="flex items-center gap-4">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                    <i className="fa-solid fa-calendar-check" />
                  </div>

                  <div>
                    <p className="text-2xl font-black text-slate-900">
                      {attendanceCount.toLocaleString()}
                    </p>

                    <p className="text-sm text-slate-500">
                      Attendance records
                    </p>
                  </div>

                </div>

              </div>

              <div className="animate-[fadeInUp_0.7s_ease-out_0.7s_both] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                <div className="flex items-center gap-4">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <i className="fa-solid fa-clipboard-check" />
                  </div>

                  <div>
                    <p className="text-2xl font-black text-slate-900">
                      {assessmentCount.toLocaleString()}
                    </p>

                    <p className="text-sm text-slate-500">
                      Assessment records
                    </p>
                  </div>

                </div>

              </div>

            </div>

            {/* ==================================================
                QUICK ACTIONS
            ================================================== */}

            <section className="mt-10">

              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
                    Quick Access
                  </p>

                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    School Management
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Quickly access the most important
                    school operations.
                  </p>
                </div>

                <div className="hidden text-sm font-medium text-slate-400 sm:block">
                  {quickActions.length} quick actions
                </div>

              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                {quickActions.map(
                  (action, index) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className={`group animate-[fadeInUp_0.7s_ease-out_${0.1 + index * 0.05}s_both]`}
                    >
                      <div
                        className={`h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${action.hover}`}
                      >

                        <div className="flex items-start justify-between">

                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.iconBg} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}
                          >
                            <i
                              className={`${action.icon} text-lg`}
                            />
                          </div>

                          <div className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-all duration-300 group-hover:bg-slate-100 group-hover:text-slate-700">
                            <i className="fa-solid fa-arrow-right text-xs transition-transform duration-300 group-hover:translate-x-1" />
                          </div>

                        </div>

                        <h3 className="mt-5 text-lg font-bold text-slate-900">
                          {action.title}
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {action.description}
                        </p>

                      </div>
                    </Link>
                  )
                )}

              </div>

            </section>

            {/* ==================================================
                MANAGEMENT CENTRE
            ================================================== */}

            <section className="mt-10">

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="mb-6">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <i className="fa-solid fa-sliders" />
                    </div>

                    <div>
                      <h2 className="text-xl font-black text-slate-900">
                        Management Centre
                      </h2>

                      <p className="text-sm text-slate-500">
                        Configure and manage your school system.
                      </p>
                    </div>

                  </div>

                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                  {managementLinks.map(
                    (item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group rounded-xl border border-slate-200 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm"
                      >

                        <div className="flex items-center gap-3">

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
                            <i
                              className={`${item.icon} text-sm`}
                            />
                          </div>

                          <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">
                            {item.title}
                          </span>

                        </div>

                      </Link>
                    )
                  )}

                </div>

              </div>

            </section>

            {/* ==================================================
                WELCOME / SYSTEM STATUS
            ================================================== */}

            <section className="mt-6">

              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white shadow-xl">

                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

                <div className="absolute -bottom-10 left-1/3 h-32 w-32 rounded-full bg-cyan-300/10 blur-2xl" />

                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <div className="mb-2 flex items-center gap-2">

                      <i className="fa-solid fa-circle-check text-emerald-300" />

                      <span className="text-sm font-semibold text-blue-100">
                        System Overview
                      </span>

                    </div>

                    <h2 className="text-xl font-black sm:text-2xl">
                      Your school is ready to manage.
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                      You currently have{' '}
                      <strong className="text-white">
                        {studentCount.toLocaleString()}
                      </strong>{' '}
                      registered students across{' '}
                      <strong className="text-white">
                        {classCount.toLocaleString()}
                      </strong>{' '}
                      classes.
                    </p>

                  </div>

                  <Link
                    href="/students"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-50"
                  >
                    <i className="fa-solid fa-arrow-right" />
                    View Students
                  </Link>

                </div>

              </div>

            </section>

          </div>

        </main>

      </div>

      {/* ==================================================
          DASHBOARD ANIMATIONS
      ================================================== */}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(18px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes fadeInDown {
              from {
                opacity: 0;
                transform: translateY(-18px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `,
        }}
      />
    </>
  );
}

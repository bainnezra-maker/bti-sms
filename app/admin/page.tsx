'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Stat = {
  label: string;
  value: number;
  icon: string;
  href: string;
  description: string;
};

type RecentEnrollment = {
  id: string;
  enrollment_date: string | null;
  status: string | null;
  student: {
    full_name: string | null;
    admission_number: string | null;
  } | null;
  class: {
    name: string | null;
  } | null;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  is_read: boolean;
  created_at: string;
};

type Activity = {
  id: string;
  title: string;
  activity_date: string;
  end_date: string | null;
  activity_type: string | null;
};

const supabase = createClient();

function formatDate(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTimeAgo(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
  });
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('Administrator');

  const [stats, setStats] = useState<Stat[]>([
    {
      label: 'Students',
      value: 0,
      icon: 'fa-solid fa-user-graduate',
      href: '/students',
      description: 'Registered students',
    },
    {
      label: 'Staff',
      value: 0,
      icon: 'fa-solid fa-users',
      href: '/staff',
      description: 'Teaching & support staff',
    },
    {
      label: 'Classes',
      value: 0,
      icon: 'fa-solid fa-school',
      href: '/classes',
      description: 'Active classes',
    },
    {
      label: 'Programmes',
      value: 0,
      icon: 'fa-solid fa-book-open',
      href: '/programmes',
      description: 'Academic programmes',
    },
  ]);

  const [recentEnrollments, setRecentEnrollments] = useState<
    RecentEnrollment[]
  >([]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [academicYear, setAcademicYear] = useState('Academic year');
  const [academicYearStatus, setAcademicYearStatus] = useState('');

  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Your session has expired. Please sign in again.');
        return;
      }

      // ---------------------------------------------------------
      // PROFILE
      // ---------------------------------------------------------

      const { data: profile } = await supabase
        .from('users')
        .select('full_name, school_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.full_name) {
        setProfileName(profile.full_name);
      }

      const schoolId = profile?.school_id;

      if (!schoolId) {
        setError('No school is associated with your account.');
        return;
      }

      // ---------------------------------------------------------
      // COUNTS
      // ---------------------------------------------------------

      const [
        studentsResult,
        staffResult,
        classesResult,
        programmesResult,
      ] = await Promise.all([
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId),

        supabase
          .from('staff')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId),

        supabase
          .from('classes')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId),

        supabase
          .from('programmes')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId),
      ]);

      setStats([
        {
          label: 'Students',
          value: studentsResult.count ?? 0,
          icon: 'fa-solid fa-user-graduate',
          href: '/students',
          description: 'Registered students',
        },
        {
          label: 'Staff',
          value: staffResult.count ?? 0,
          icon: 'fa-solid fa-users',
          href: '/staff',
          description: 'Teaching & support staff',
        },
        {
          label: 'Classes',
          value: classesResult.count ?? 0,
          icon: 'fa-solid fa-school',
          href: '/classes',
          description: 'Active classes',
        },
        {
          label: 'Programmes',
          value: programmesResult.count ?? 0,
          icon: 'fa-solid fa-book-open',
          href: '/programmes',
          description: 'Academic programmes',
        },
      ]);

      // ---------------------------------------------------------
      // RECENT ENROLLMENTS
      // ---------------------------------------------------------

      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select(`
          id,
          enrollment_date,
          status,
          student:students (
            full_name,
            admission_number
          ),
          class:classes (
            name
          )
        `)
        .eq('school_id', schoolId)
        .order('enrollment_date', { ascending: false })
        .limit(6);

      const normalizedEnrollments: RecentEnrollment[] = (
        enrollmentData ?? []
      ).map((item: any) => ({
        id: item.id,
        enrollment_date: item.enrollment_date,
        status: item.status,
        student: Array.isArray(item.student)
          ? item.student[0] ?? null
          : item.student ?? null,
        class: Array.isArray(item.class)
          ? item.class[0] ?? null
          : item.class ?? null,
      }));

      setRecentEnrollments(normalizedEnrollments);

      // ---------------------------------------------------------
      // CURRENT ACADEMIC YEAR
      // ---------------------------------------------------------

      const { data: yearData } = await supabase
        .from('academic_years')
        .select('id, name, status')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (yearData) {
        setAcademicYear(yearData.name ?? 'Academic year');
        setAcademicYearStatus(yearData.status ?? '');
      }

      // ---------------------------------------------------------
      // UPCOMING ACTIVITIES
      // ---------------------------------------------------------

      const today = new Date().toISOString().split('T')[0];

      const { data: activityData } = await supabase
        .from('school_activities')
        .select(`
          id,
          title,
          activity_date,
          end_date,
          activity_type
        `)
        .eq('school_id', schoolId)
        .gte('activity_date', today)
        .order('activity_date', { ascending: true })
        .limit(5);

      setActivities(activityData ?? []);

      // ---------------------------------------------------------
      // NOTIFICATIONS
      // ---------------------------------------------------------

      const { data: notificationData, count: notificationCount } =
        await supabase
          .from('notifications')
          .select(
            'id, title, message, type, priority, is_read, created_at',
            { count: 'exact' }
          )
          .eq('recipient_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

      setNotifications(notificationData ?? []);
      setUnreadNotifications(notificationCount ?? 0);
    } catch (err) {
      console.error(err);
      setError('Unable to load the administration dashboard.');
    } finally {
      setLoading(false);
    }
  }

  const quickActions = useMemo(
    () => [
      {
        title: 'Add Student',
        description: 'Register a new student',
        icon: 'fa-solid fa-user-plus',
        href: '/students/add',
      },
      {
        title: 'Manage Staff',
        description: 'View and manage staff',
        icon: 'fa-solid fa-user-tie',
        href: '/staff',
      },
      {
        title: 'Timetable',
        description: 'Manage school timetable',
        icon: 'fa-solid fa-calendar-days',
        href: '/timetable',
      },
      {
        title: 'Attendance',
        description: 'Review attendance',
        icon: 'fa-solid fa-clipboard-check',
        href: '/attendance',
      },
      {
        title: 'Academic Calendar',
        description: 'Manage academic periods',
        icon: 'fa-solid fa-calendar',
        href: '/academic-calendar',
      },
      {
        title: 'Notifications',
        description: 'View school notifications',
        icon: 'fa-solid fa-bell',
        href: '/notifications',
      },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <style jsx>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulseGlow {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.08);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -700px 0;
          }
          100% {
            background-position: 700px 0;
          }
        }

        .fade-up {
          animation: fadeUp 0.55s ease-out both;
        }

        .dashboard-card {
          animation: fadeUp 0.55s ease-out both;
        }

        .glow {
          animation: pulseGlow 4s ease-in-out infinite;
        }

        .skeleton {
          background: linear-gradient(
            90deg,
            rgba(51, 65, 85, 0.35),
            rgba(71, 85, 105, 0.55),
            rgba(51, 65, 85, 0.35)
          );
          background-size: 700px 100%;
          animation: shimmer 1.6s infinite linear;
        }
      `}</style>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl glow" />
        <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-indigo-600/20 blur-3xl glow" />

        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* HEADER */}
          <section className="fade-up mb-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-400">
                  <i className="fa-solid fa-shield-halved" />
                  Administration
                </div>

                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Welcome back, {profileName}
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                  Manage your school operations, academics, students, staff,
                  activities and notifications from one central dashboard.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/notifications"
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 transition hover:border-blue-500/50 hover:bg-slate-800 hover:text-white"
                  title="Notifications"
                >
                  <i className="fa-solid fa-bell" />

                  {unreadNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-red-500/30">
                      {unreadNotifications > 99
                        ? '99+'
                        : unreadNotifications}
                    </span>
                  )}
                </Link>

                <button
                  onClick={loadDashboard}
                  className="flex h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 text-sm font-semibold text-slate-200 transition hover:border-blue-500/50 hover:bg-slate-800"
                >
                  <i className="fa-solid fa-rotate" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </section>

          {/* ERROR */}
          {error && (
            <div className="fade-up mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-triangle-exclamation mt-0.5" />
                <div>
                  <p className="font-semibold">Dashboard error</p>
                  <p className="mt-1 text-red-300/80">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* ACADEMIC STATUS */}
          <section className="dashboard-card mb-6" style={{ animationDelay: '80ms' }}>
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <i className="fa-solid fa-graduation-cap text-lg" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Current Academic Year
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-white">
                      {loading ? 'Loading...' : academicYear}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {academicYearStatus && (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                      {academicYearStatus}
                    </span>
                  )}

                  <Link
                    href="/academic-calendar"
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    <i className="fa-solid fa-calendar-days" />
                    Calendar
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* STAT CARDS */}
          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, index) => (
              <Link
                href={stat.href}
                key={stat.label}
                className="dashboard-card group rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-slate-900"
                style={{ animationDelay: `${120 + index * 70}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 transition group-hover:bg-blue-500/20">
                    <i className={`${stat.icon} text-lg`} />
                  </div>

                  <i className="fa-solid fa-arrow-up-right-from-square text-xs text-slate-600 transition group-hover:text-blue-400" />
                </div>

                <div className="mt-5">
                  {loading ? (
                    <div className="skeleton h-9 w-20 rounded-lg" />
                  ) : (
                    <p className="text-3xl font-bold tracking-tight text-white">
                      {stat.value.toLocaleString()}
                    </p>
                  )}

                  <p className="mt-1 font-semibold text-slate-200">
                    {stat.label}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {stat.description}
                  </p>
                </div>
              </Link>
            ))}
          </section>

          {/* QUICK ACTIONS */}
          <section className="dashboard-card mb-8" style={{ animationDelay: '420ms' }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Quick Actions
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Frequently used administration tools
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {quickActions.map((action) => (
                <Link
                  href={action.href}
                  key={action.title}
                  className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-slate-900"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-blue-400 transition group-hover:bg-blue-500/10">
                    <i className={action.icon} />
                  </div>

                  <p className="mt-4 text-sm font-bold text-slate-200">
                    {action.title}
                  </p>

                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    {action.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* MAIN GRID */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* RECENT ENROLLMENTS */}
            <div
              className="dashboard-card rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl shadow-black/10"
              style={{ animationDelay: '500ms' }}
            >
              <div className="flex items-center justify-between border-b border-slate-800 p-5">
                <div>
                  <h2 className="font-bold text-white">
                    Recent Enrollments
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Latest student enrollment activity
                  </p>
                </div>

                <Link
                  href="/students"
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  View all
                </Link>
              </div>

              <div className="divide-y divide-slate-800">
                {loading ? (
                  [1, 2, 3].map((item) => (
                    <div key={item} className="p-5">
                      <div className="skeleton h-4 w-40 rounded" />
                      <div className="skeleton mt-3 h-3 w-28 rounded" />
                    </div>
                  ))
                ) : recentEnrollments.length === 0 ? (
                  <div className="p-8 text-center">
                    <i className="fa-solid fa-user-graduate text-2xl text-slate-700" />
                    <p className="mt-3 text-sm text-slate-500">
                      No recent enrollments found.
                    </p>
                  </div>
                ) : (
                  recentEnrollments.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 p-5 transition hover:bg-slate-800/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-200">
                          {item.student?.full_name ?? 'Unnamed student'}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>
                            {item.student?.admission_number ?? 'No admission no.'}
                          </span>
                          <span>
                            {item.class?.name ?? 'No class'}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs text-slate-500">
                          {formatDate(item.enrollment_date)}
                        </p>

                        <span className="mt-1 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-blue-400">
                          {item.status ?? 'active'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* UPCOMING ACTIVITIES */}
            <div
              className="dashboard-card rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl shadow-black/10"
              style={{ animationDelay: '570ms' }}
            >
              <div className="flex items-center justify-between border-b border-slate-800 p-5">
                <div>
                  <h2 className="font-bold text-white">
                    Upcoming Activities
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    What is happening next at school
                  </p>
                </div>

                <Link
                  href="/school-activities"
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  View calendar
                </Link>
              </div>

              <div className="divide-y divide-slate-800">
                {loading ? (
                  [1, 2, 3].map((item) => (
                    <div key={item} className="p-5">
                      <div className="skeleton h-4 w-44 rounded" />
                      <div className="skeleton mt-3 h-3 w-28 rounded" />
                    </div>
                  ))
                ) : activities.length === 0 ? (
                  <div className="p-8 text-center">
                    <i className="fa-solid fa-calendar-xmark text-2xl text-slate-700" />
                    <p className="mt-3 text-sm text-slate-500">
                      No upcoming activities.
                    </p>
                  </div>
                ) : (
                  activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex gap-4 p-5 transition hover:bg-slate-800/40"
                    >
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                        <span className="text-[10px] font-bold uppercase">
                          {new Date(activity.activity_date).toLocaleDateString(
                            'en-GH',
                            { month: 'short' }
                          )}
                        </span>
                        <span className="text-base font-bold">
                          {new Date(activity.activity_date).getDate()}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-200">
                          {activity.title}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {activity.activity_type ?? 'School activity'}
                          {' · '}
                          {formatDate(activity.activity_date)}
                        </p>

                        {activity.end_date && (
                          <p className="mt-1 text-[11px] text-slate-600">
                            Ends {formatDate(activity.end_date)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* NOTIFICATIONS */}
            <div
              className="dashboard-card rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl shadow-black/10"
              style={{ animationDelay: '640ms' }}
            >
              <div className="flex items-center justify-between border-b border-slate-800 p-5">
                <div>
                  <h2 className="font-bold text-white">
                    Recent Notifications
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Latest alerts for your account
                  </p>
                </div>

                <Link
                  href="/notifications"
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  View all
                </Link>
              </div>

              <div className="divide-y divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <i className="fa-regular fa-bell-slash text-2xl text-slate-700" />
                    <p className="mt-3 text-sm text-slate-500">
                      You have no recent notifications.
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href="/notifications"
                      className="flex gap-4 p-5 transition hover:bg-slate-800/40"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          notification.priority === 'urgent'
                            ? 'bg-red-500/10 text-red-400'
                            : notification.priority === 'high'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        <i className="fa-solid fa-bell" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p
                            className={`truncate text-sm ${
                              notification.is_read
                                ? 'font-medium text-slate-400'
                                : 'font-bold text-white'
                            }`}
                          >
                            {notification.title}
                          </p>

                          {!notification.is_read && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                          )}
                        </div>

                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {notification.message}
                        </p>

                        <p className="mt-1 text-[10px] text-slate-600">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* SYSTEM TOOLS */}
            <div
              className="dashboard-card rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl shadow-black/10"
              style={{ animationDelay: '710ms' }}
            >
              <div className="border-b border-slate-800 p-5">
                <h2 className="font-bold text-white">Administration Tools</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Manage core school operations
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
                <Link
                  href="/staff/duty-roster"
                  className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 transition hover:border-blue-500/30 hover:bg-slate-800/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                    <i className="fa-solid fa-user-shield" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Duty Roster
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Manage staff duties
                    </p>
                  </div>
                </Link>

                <Link
                  href="/my-schedule"
                  className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 transition hover:border-blue-500/30 hover:bg-slate-800/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    <i className="fa-solid fa-clock" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      My Schedule
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      View your timetable
                    </p>
                  </div>
                </Link>

                <Link
                  href="/school-activities"
                  className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 transition hover:border-blue-500/30 hover:bg-slate-800/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <i className="fa-solid fa-calendar-check" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Activities
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      School events & activities
                    </p>
                  </div>
                </Link>

                <Link
                  href="/leave"
                  className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 transition hover:border-blue-500/30 hover:bg-slate-800/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                    <i className="fa-solid fa-person-walking-arrow-right" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Leave Requests
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Review staff leave
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <div className="mt-8 border-t border-slate-800 pt-6 text-center">
            <p className="text-xs text-slate-600">
              BTI School Management System · Administration Dashboard
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarDays,
  faClock,
  faChalkboardUser,
  faBookOpen,
  faGraduationCap,
  faCircleCheck,
  faCircleXmark,
  faRotate,
  faArrowRight,
  faCalendarWeek,
  faUserTie,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';

type TimetableEntry = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'cancelled';
  notes: string | null;
  academic_year_id: string;

  teacher_assignment?: {
    id: string;
    teacher_id: string;
    class_id: string;
    subject_id: string;

    class?: {
      id: string;
      name: string;
      level: string | null;
    } | null;

    subject?: {
      id: string;
      name: string;
      code: string | null;
    } | null;

    teacher?: {
      id: string;
      full_name: string | null;
    } | null;
  } | null;

  academic_year?: {
    id: string;
    name: string;
    is_current: boolean | null;
  } | null;
};

type CurrentUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

const DAYS = [
  { number: 1, name: 'Monday', short: 'Mon' },
  { number: 2, name: 'Tuesday', short: 'Tue' },
  { number: 3, name: 'Wednesday', short: 'Wed' },
  { number: 4, name: 'Thursday', short: 'Thu' },
  { number: 5, name: 'Friday', short: 'Fri' },
];

function formatTime(time: string) {
  if (!time) return '';

  const [hours, minutes] = time.split(':').map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDayName(day: number) {
  return DAYS.find((item) => item.number === day)?.name ?? 'Unknown';
}

export default function MySchedulePage() {
  const supabase = createClient();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadSchedule = async () => {
    try {
      setError('');

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setError('You must be logged in to view your schedule.');
        setLoading(false);
        return;
      }

      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('id', authUser.id)
        .single();

      if (userError) {
        throw userError;
      }

      setUser(currentUser);

      const { data: timetable, error: timetableError } = await supabase
        .from('timetable')
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          status,
          notes,
          academic_year_id,

          academic_year:academic_years (
            id,
            name,
            is_current
          ),

          teacher_assignment:teacher_assignments (
            id,
            teacher_id,
            class_id,
            subject_id,

            class:classes (
              id,
              name,
              level
            ),

            subject:subjects (
              id,
              name,
              code
            ),

            teacher:users!teacher_assignments_teacher_id_fkey (
              id,
              full_name
            )
          )
        `)
        .eq('teacher_assignment.teacher_id', authUser.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (timetableError) {
        throw timetableError;
      }

      setEntries((timetable ?? []) as TimetableEntry[]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unable to load your schedule.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSchedule();
  };

  const scheduledEntries = useMemo(
    () => entries.filter((entry) => entry.status === 'scheduled'),
    [entries]
  );

  const cancelledEntries = useMemo(
    () => entries.filter((entry) => entry.status === 'cancelled'),
    [entries]
  );

  const todayNumber = (() => {
    const day = new Date().getDay();

    if (day === 0 || day === 6) return null;

    return day;
  })();

  const todayEntries = useMemo(() => {
    if (!todayNumber) return [];

    return scheduledEntries.filter(
      (entry) => entry.day_of_week === todayNumber
    );
  }, [scheduledEntries, todayNumber]);

  const nextClass = useMemo(() => {
    if (!todayEntries.length) return null;

    const now = new Date();

    return (
      todayEntries.find((entry) => {
        const [hours, minutes] = entry.start_time.split(':').map(Number);

        const start = new Date();
        start.setHours(hours, minutes, 0, 0);

        return start >= now;
      }) ?? null
    );
  }, [todayEntries]);

  const groupedSchedule = useMemo(() => {
    return DAYS.map((day) => ({
      ...day,
      entries: scheduledEntries.filter(
        (entry) => entry.day_of_week === day.number
      ),
    }));
  }, [scheduledEntries]);

  const academicYearName =
    entries.find((entry) => entry.academic_year?.is_current)
      ?.academic_year?.name ??
    entries[0]?.academic_year?.name ??
    'Current Academic Year';

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-500 blur-3xl animate-pulse" />
          <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-cyan-500 blur-3xl animate-pulse" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="animate-[fadeIn_.7s_ease-out]">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-200 backdrop-blur">
                <FontAwesomeIcon icon={faCalendarWeek} />
                <span>Teacher Workspace</span>
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                My Schedule
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Your weekly teaching timetable, classes, subjects and lesson
                periods — all in one professional workspace.
              </p>

              {user && (
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                    <FontAwesomeIcon icon={faUserTie} />
                  </div>

                  <div>
                    <p className="font-semibold text-white">
                      {user.full_name || 'Teacher'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {academicYearName}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FontAwesomeIcon
                icon={faRotate}
                className={refreshing ? 'animate-spin' : ''}
              />
              {refreshing ? 'Refreshing...' : 'Refresh Schedule'}
            </button>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ERROR */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-200 animate-[fadeIn_.4s_ease-out]">
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="mt-0.5"
            />
            <div>
              <p className="font-semibold">Schedule unavailable</p>
              <p className="mt-1 text-sm text-red-200/80">{error}</p>
            </div>
          </div>
        )}

        {/* LOADING */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        ) : (
          <>
            {/* SUMMARY CARDS */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                icon={faCalendarDays}
                label="Total Lessons"
                value={scheduledEntries.length}
              />

              <SummaryCard
                icon={faCalendarWeek}
                label="Today"
                value={todayEntries.length}
              />

              <SummaryCard
                icon={faCircleCheck}
                label="Scheduled"
                value={scheduledEntries.length}
              />

              <SummaryCard
                icon={faCircleXmark}
                label="Cancelled"
                value={cancelledEntries.length}
              />
            </div>

            {/* NEXT CLASS */}
            <div className="mt-6 overflow-hidden rounded-3xl border border-indigo-400/20 bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 p-5 shadow-2xl shadow-indigo-950/20">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300">
                    <FontAwesomeIcon
                      icon={nextClass ? faClock : faCalendarDays}
                      className="text-xl"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      {nextClass ? 'Next Class Today' : 'Today'}
                    </p>

                    {nextClass ? (
                      <>
                        <h2 className="mt-1 text-xl font-black">
                          {nextClass.teacher_assignment?.subject?.name ??
                            'Subject'}
                        </h2>

                        <p className="mt-1 text-sm text-slate-400">
                          {nextClass.teacher_assignment?.class?.name ??
                            'Class'}{' '}
                          • {formatTime(nextClass.start_time)} –{' '}
                          {formatTime(nextClass.end_time)}
                        </p>
                      </>
                    ) : (
                      <h2 className="mt-1 text-xl font-black">
                        {todayNumber
                          ? 'No more classes today'
                          : 'Weekend — enjoy your break'}
                      </h2>
                    )}
                  </div>
                </div>

                <div className="hidden md:block">
                  <FontAwesomeIcon
                    icon={faArrowRight}
                    className="text-indigo-300"
                  />
                </div>
              </div>
            </div>

            {/* WEEKLY GRID */}
            <div className="mt-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                  <FontAwesomeIcon icon={faCalendarWeek} />
                </div>

                <div>
                  <h2 className="text-xl font-black">Weekly Timetable</h2>
                  <p className="text-sm text-slate-400">
                    Monday to Friday teaching schedule
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {groupedSchedule.map((day) => {
                  const isToday = day.number === todayNumber;

                  return (
                    <div
                      key={day.number}
                      className={`overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1 ${
                        isToday
                          ? 'border-indigo-400/40 bg-indigo-500/10 shadow-lg shadow-indigo-950/20'
                          : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <div
                        className={`border-b border-white/10 px-4 py-4 ${
                          isToday ? 'bg-indigo-500/10' : 'bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              {day.short}
                            </p>

                            <h3 className="mt-1 font-black">{day.name}</h3>
                          </div>

                          {isToday && (
                            <span className="rounded-full bg-indigo-500/20 px-2.5 py-1 text-[10px] font-bold text-indigo-300">
                              TODAY
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 p-3">
                        {day.entries.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center">
                            <FontAwesomeIcon
                              icon={faCalendarDays}
                              className="mb-2 text-slate-600"
                            />
                            <p className="text-xs text-slate-500">
                              No lessons
                            </p>
                          </div>
                        ) : (
                          day.entries.map((entry) => (
                            <LessonCard
                              key={entry.id}
                              entry={entry}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CANCELLED LESSONS */}
            {cancelledEntries.length > 0 && (
              <div className="mt-8">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-300">
                    <FontAwesomeIcon icon={faCircleXmark} />
                  </div>

                  <div>
                    <h2 className="text-xl font-black">
                      Cancelled Lessons
                    </h2>

                    <p className="text-sm text-slate-400">
                      Lessons currently marked as cancelled
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cancelledEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-red-400/20 bg-red-500/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-red-300">
                            {getDayName(entry.day_of_week)}
                          </p>

                          <h3 className="mt-1 font-bold text-white">
                            {entry.teacher_assignment?.subject?.name ??
                              'Subject'}
                          </h3>
                        </div>

                        <FontAwesomeIcon
                          icon={faCircleXmark}
                          className="text-red-400"
                        />
                      </div>

                      <p className="mt-3 text-sm text-slate-400">
                        {entry.teacher_assignment?.class?.name ??
                          'Class'}{' '}
                        • {formatTime(entry.start_time)} –{' '}
                        {formatTime(entry.end_time)}
                      </p>

                      {entry.notes && (
                        <p className="mt-2 text-xs text-red-200/70">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* EMPTY STATE */}
            {entries.length === 0 && (
              <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">
                  <FontAwesomeIcon
                    icon={faCalendarDays}
                    className="text-2xl"
                  />
                </div>

                <h2 className="mt-5 text-2xl font-black">
                  No timetable assigned yet
                </h2>

                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
                  Your teaching schedule will appear here once an administrator
                  assigns timetable periods to your teaching assignments.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: number;
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition duration-300 hover:-translate-y-1 hover:border-indigo-400/20 hover:bg-white/[0.05]">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300 transition group-hover:scale-110">
          <FontAwesomeIcon icon={icon} />
        </div>

        <span className="text-3xl font-black">{value}</span>
      </div>

      <p className="mt-4 text-sm font-medium text-slate-400">{label}</p>
    </div>
  );
}

function LessonCard({ entry }: { entry: TimetableEntry }) {
  const assignment = entry.teacher_assignment;

  return (
    <div className="group rounded-xl border border-white/10 bg-slate-900/60 p-3 transition duration-300 hover:-translate-y-0.5 hover:border-indigo-400/30 hover:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
        <FontAwesomeIcon icon={faClock} />

        <span>
          {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
        </span>
      </div>

      <h4 className="mt-3 line-clamp-2 font-bold text-white">
        {assignment?.subject?.name ?? 'Subject'}
      </h4>

      {assignment?.subject?.code && (
        <p className="mt-1 text-[11px] text-slate-500">
          {assignment.subject.code}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3 text-xs text-slate-400">
        <FontAwesomeIcon icon={faGraduationCap} />

        <span className="truncate">
          {assignment?.class?.name ?? 'Class'}
        </span>
      </div>

      {assignment?.class?.level && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <FontAwesomeIcon icon={faBookOpen} />
          <span>{assignment.class.level}</span>
        </div>
      )}

      {entry.notes && (
        <div className="mt-3 rounded-lg bg-white/[0.03] px-2.5 py-2 text-[11px] text-slate-400">
          {entry.notes}
        </div>
      )}
    </div>
  );
}

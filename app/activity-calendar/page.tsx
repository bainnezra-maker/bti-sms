'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type ActivityType =
  | 'general'
  | 'academic'
  | 'examination'
  | 'meeting'
  | 'sports'
  | 'ceremony'
  | 'holiday'
  | 'workshop'
  | 'welfare'
  | 'other';

type Staff = {
  id: string;
  full_name: string | null;
  staff_number?: string | null;
  department?: string | null;
  position?: string | null;
};

type ResponsibleRow = {
  id: string;
  staff: Staff | Staff[] | null;
};

type Activity = {
  id: string;
  school_id: string;
  academic_year_id: string | null;
  title: string;
  activity_date: string;
  end_date: string | null;
  description: string | null;
  activity_type: ActivityType | null;
  is_all_staff: boolean;
  created_at: string;
  responsible_staff: ResponsibleRow[] | null;
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

type CalendarDay = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const supabase = createClient();

const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: string; color: string; soft: string }
> = {
  general: {
    label: 'General',
    icon: 'fa-solid fa-calendar-check',
    color: '#60a5fa',
    soft: 'rgba(96,165,250,.14)',
  },
  academic: {
    label: 'Academic',
    icon: 'fa-solid fa-graduation-cap',
    color: '#a78bfa',
    soft: 'rgba(167,139,250,.14)',
  },
  examination: {
    label: 'Examination',
    icon: 'fa-solid fa-file-pen',
    color: '#f87171',
    soft: 'rgba(248,113,113,.14)',
  },
  meeting: {
    label: 'Meeting',
    icon: 'fa-solid fa-users',
    color: '#22d3ee',
    soft: 'rgba(34,211,238,.14)',
  },
  sports: {
    label: 'Sports',
    icon: 'fa-solid fa-futbol',
    color: '#34d399',
    soft: 'rgba(52,211,153,.14)',
  },
  ceremony: {
    label: 'Ceremony',
    icon: 'fa-solid fa-award',
    color: '#fbbf24',
    soft: 'rgba(251,191,36,.14)',
  },
  holiday: {
    label: 'Holiday',
    icon: 'fa-solid fa-umbrella-beach',
    color: '#fb923c',
    soft: 'rgba(251,146,60,.14)',
  },
  workshop: {
    label: 'Workshop',
    icon: 'fa-solid fa-chalkboard-user',
    color: '#f472b6',
    soft: 'rgba(244,114,182,.14)',
  },
  welfare: {
    label: 'Welfare',
    icon: 'fa-solid fa-heart',
    color: '#fb7185',
    soft: 'rgba(251,113,133,.14)',
  },
  other: {
    label: 'Other',
    icon: 'fa-solid fa-ellipsis',
    color: '#94a3b8',
    soft: 'rgba(148,163,184,.14)',
  },
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;

  const [year, month, day] = value.slice(0, 10).split('-').map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getMonday(date: Date) {
  const result = new Date(date);
  const day = result.getDay();

  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);
  result.setHours(0, 0, 0, 0);

  return result;
}

function getCalendarDays(monthDate: Date): CalendarDay[] {
  const firstOfMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1
  );

  const start = getMonday(firstOfMonth);

  const days: CalendarDay[] = [];

  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);

    days.push({
      date,
      dateKey: dateKey(date),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
      isToday: dateKey(date) === dateKey(new Date()),
    });
  }

  return days;
}

function normalizeStaff(value: Staff | Staff[] | null): Staff | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export default function ActivityCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedActivity, setSelectedActivity] =
    useState<Activity | null>(null);

  const [search, setSearch] = useState('');
  const [activityType, setActivityType] = useState<'all' | ActivityType>(
    'all'
  );
  const [selectedYear, setSelectedYear] = useState('all');

  const [showFilters, setShowFilters] = useState(false);

  async function loadCalendar(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(authError.message);
      }

      if (!user) {
        throw new Error('You must be signed in to view the activity calendar.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, school_id, role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (!profile?.school_id) {
        throw new Error('Your account is not linked to a school.');
      }

      setSchoolId(profile.school_id);

      const [
        { data: activityData, error: activityError },
        { data: yearData, error: yearError },
      ] = await Promise.all([
        supabase
          .from('school_activities')
          .select(
            `
              id,
              school_id,
              academic_year_id,
              title,
              activity_date,
              end_date,
              description,
              activity_type,
              is_all_staff,
              created_at,
              responsible_staff:school_activity_responsible_staff(
                id,
                staff:staff(
                  id,
                  full_name,
                  staff_number,
                  department,
                  position
                )
              )
            `
          )
          .eq('school_id', profile.school_id)
          .order('activity_date', { ascending: true }),

        supabase
          .from('academic_years')
          .select('id, name, start_date, end_date, is_current')
          .eq('school_id', profile.school_id)
          .order('start_date', { ascending: false }),
      ]);

      if (activityError) {
        throw new Error(activityError.message);
      }

      if (yearError) {
        throw new Error(yearError.message);
      }

      setActivities((activityData ?? []) as Activity[]);
      setAcademicYears((yearData ?? []) as AcademicYear[]);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load the activity calendar.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadCalendar();
  }, []);

  const filteredActivities = useMemo(() => {
    const term = search.trim().toLowerCase();

    return activities.filter((activity) => {
      const titleMatch =
        !term ||
        activity.title.toLowerCase().includes(term) ||
        (activity.description ?? '').toLowerCase().includes(term) ||
        (activity.responsible_staff ?? []).some((row) => {
          const staff = normalizeStaff(row.staff);

          return (staff?.full_name ?? '').toLowerCase().includes(term);
        });

      const typeMatch =
        activityType === 'all' ||
        (activity.activity_type ?? 'general') === activityType;

      const yearMatch =
        selectedYear === 'all' ||
        activity.academic_year_id === selectedYear;

      return titleMatch && typeMatch && yearMatch;
    });
  }, [activities, search, activityType, selectedYear]);

  const calendarDays = useMemo(
    () => getCalendarDays(currentMonth),
    [currentMonth]
  );

  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();

    filteredActivities.forEach((activity) => {
      const start = parseDateOnly(activity.activity_date);

      if (!start) return;

      const end = parseDateOnly(activity.end_date) ?? start;

      const cursor = new Date(start);

      while (cursor <= end) {
        const key = dateKey(cursor);

        const existing = map.get(key) ?? [];
        existing.push(activity);

        map.set(key, existing);

        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return map;
  }, [filteredActivities]);

  const monthActivities = useMemo(() => {
    return filteredActivities.filter((activity) => {
      const start = parseDateOnly(activity.activity_date);
      const end = parseDateOnly(activity.end_date) ?? start;

      if (!start) return false;

      const monthStart = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1
      );

      const monthEnd = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0
      );

      return start <= monthEnd && end! >= monthStart;
    });
  }, [filteredActivities, currentMonth]);

  const todayActivities = useMemo(() => {
    const today = dateKey(new Date());

    return activities.filter((activity) => {
      const start = parseDateOnly(activity.activity_date);
      const end = parseDateOnly(activity.end_date) ?? start;

      if (!start || !end) return false;

      const key = today;

      return key >= dateKey(start) && key <= dateKey(end);
    });
  }, [activities]);

  const upcomingActivities = useMemo(() => {
    const today = dateKey(new Date());

    return [...activities]
      .filter((activity) => activity.activity_date >= today)
      .sort((a, b) =>
        a.activity_date.localeCompare(b.activity_date)
      )
      .slice(0, 5);
  }, [activities]);

  const currentAcademicYear = useMemo(
    () =>
      academicYears.find((year) => year.is_current) ??
      academicYears[0] ??
      null,
    [academicYears]
  );

  function goToPreviousMonth() {
    setCurrentMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
  }

  function goToNextMonth() {
    setCurrentMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
  }

  function goToToday() {
    const now = new Date();

    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  function getResponsibleNames(activity: Activity) {
    const names = (activity.responsible_staff ?? [])
      .map((row) => normalizeStaff(row.staff)?.full_name)
      .filter(Boolean) as string[];

    return [...new Set(names)];
  }

  function getActivityMeta(activity: Activity) {
    return (
      ACTIVITY_META[activity.activity_type ?? 'general'] ??
      ACTIVITY_META.general
    );
  }

  function renderActivity(activity: Activity) {
    const meta = getActivityMeta(activity);
    const responsible = getResponsibleNames(activity);

    return (
      <button
        key={activity.id}
        type="button"
        onClick={() => setSelectedActivity(activity)}
        className="group mb-1.5 w-full rounded-xl border px-2 py-1.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        style={{
          background: meta.soft,
          borderColor: `${meta.color}30`,
        }}
      >
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
            style={{
              background: `${meta.color}20`,
              color: meta.color,
            }}
          >
            <i className={`${meta.icon} text-[9px]`} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-bold text-white">
              {activity.title}
            </span>

            {responsible.length > 0 && (
              <span className="mt-0.5 block truncate text-[9px] text-slate-400">
                <i className="fa-solid fa-user-tie mr-1" />
                {responsible.join(', ')}
              </span>
            )}
          </span>
        </div>
      </button>
    );
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -right-32 top-32 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {/* HEADER */}
        <header className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 shadow-lg shadow-cyan-950/30">
                  <i className="fa-solid fa-calendar-days text-xl text-cyan-300" />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                    BTI-SMS
                  </p>

                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                    Activity Calendar
                  </h1>
                </div>
              </div>

              <p className="max-w-2xl text-sm text-slate-400">
                View school activities, meetings, examinations, ceremonies,
                sports and other scheduled events in one calendar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => loadCalendar(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.09] disabled:opacity-50"
              >
                <i
                  className={`fa-solid fa-rotate ${
                    refreshing ? 'fa-spin' : ''
                  }`}
                />
                Refresh
              </button>

              <Link
                href="/activities"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.09]"
              >
                <i className="fa-solid fa-list-check" />
                Activities
              </Link>

              <Link
                href="/activities"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5"
              >
                <i className="fa-solid fa-plus" />
                Create Activity
              </Link>
            </div>
          </div>
        </header>

        {/* ERROR */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
            <i className="fa-solid fa-triangle-exclamation mt-0.5" />

            <div className="flex-1">
              <p className="font-bold">Unable to load calendar</p>
              <p className="mt-1 text-red-200/70">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => loadCalendar()}
              className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/20"
            >
              Retry
            </button>
          </div>
        )}

        {/* STATS */}
        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition hover:-translate-y-1">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Activities
              </span>

              <i className="fa-solid fa-calendar-check text-cyan-300" />
            </div>

            <p className="text-2xl font-black">
              {loading ? '—' : activities.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition hover:-translate-y-1">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                This Month
              </span>

              <i className="fa-solid fa-calendar-days text-violet-300" />
            </div>

            <p className="text-2xl font-black">
              {loading ? '—' : monthActivities.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition hover:-translate-y-1">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Today
              </span>

              <i className="fa-solid fa-bolt text-amber-300" />
            </div>

            <p className="text-2xl font-black">
              {loading ? '—' : todayActivities.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition hover:-translate-y-1">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Academic Year
              </span>

              <i className="fa-solid fa-graduation-cap text-emerald-300" />
            </div>

            <p className="truncate text-sm font-black">
              {currentAcademicYear?.name ?? 'Not set'}
            </p>
          </div>
        </section>

        {/* TOOLBAR */}
        <section className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* MONTH NAVIGATION */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.1]"
                aria-label="Previous month"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>

              <div className="min-w-[190px] text-center">
                <h2 className="text-lg font-black">
                  {currentMonth.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h2>
              </div>

              <button
                type="button"
                onClick={goToNextMonth}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.1]"
                aria-label="Next month"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>

              <button
                type="button"
                onClick={goToToday}
                className="ml-1 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-400/15"
              >
                Today
              </button>
            </div>

            {/* FILTER BUTTON */}
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.09]"
            >
              <i className="fa-solid fa-filter" />
              Filters
              {(search || activityType !== 'all' || selectedYear !== 'all') && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1.5 text-[10px] font-black text-slate-950">
                  !
                </span>
              )}
            </button>
          </div>

          {/* FILTERS */}
          {showFilters && (
            <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Search
                </label>

                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search activity or staff..."
                    className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Activity Type
                </label>

                <select
                  value={activityType}
                  onChange={(event) =>
                    setActivityType(
                      event.target.value as 'all' | ActivityType
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0b1728] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/40"
                >
                  <option value="all">All Types</option>

                  {Object.entries(ACTIVITY_META).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Academic Year
                </label>

                <select
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0b1728] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/40"
                >
                  <option value="all">All Academic Years</option>

                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          {/* CALENDAR */}
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl backdrop-blur-xl">
            {/* WEEKDAY HEADER */}
            <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.025]">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="border-r border-white/10 px-2 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 last:border-r-0 sm:text-xs"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* CALENDAR GRID */}
            {loading ? (
              <div className="grid grid-cols-7">
                {Array.from({ length: 42 }).map((_, index) => (
                  <div
                    key={index}
                    className="min-h-[100px] border-b border-r border-white/10 bg-white/[0.01] p-2"
                  >
                    <div className="h-5 w-5 animate-pulse rounded-full bg-white/10" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const dayActivities =
                    activitiesByDate.get(day.dateKey) ?? [];

                  return (
                    <div
                      key={day.dateKey}
                      className={`group min-h-[105px] border-b border-r border-white/10 p-1.5 transition-colors sm:min-h-[125px] sm:p-2 ${
                        day.isCurrentMonth
                          ? 'bg-transparent'
                          : 'bg-black/10 opacity-50'
                      } hover:bg-white/[0.025]`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                            day.isToday
                              ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
                              : day.isCurrentMonth
                                ? 'text-slate-300'
                                : 'text-slate-600'
                          }`}
                        >
                          {day.date.getDate()}
                        </span>

                        {dayActivities.length > 0 && (
                          <span className="text-[9px] font-bold text-slate-600">
                            {dayActivities.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        {dayActivities.slice(0, 3).map(renderActivity)}

                        {dayActivities.length > 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              const first = dayActivities[3];

                              if (first) {
                                setSelectedActivity(first);
                              }
                            }}
                            className="px-1 text-[9px] font-black text-cyan-300 hover:text-cyan-200"
                          >
                            +{dayActivities.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* RIGHT PANEL */}
          <aside className="space-y-5">
            {/* TODAY */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-xl backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
                    Today
                  </p>

                  <h3 className="mt-1 text-lg font-black">
                    {formatDate(new Date())}
                  </h3>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  <i className="fa-solid fa-bolt" />
                </div>
              </div>

              {todayActivities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
                  <i className="fa-regular fa-calendar-xmark mb-2 text-xl text-slate-600" />
                  <p className="text-xs font-bold text-slate-500">
                    No activities scheduled today.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayActivities.slice(0, 5).map((activity) => {
                    const meta = getActivityMeta(activity);

                    return (
                      <button
                        key={activity.id}
                        type="button"
                        onClick={() => setSelectedActivity(activity)}
                        className="w-full rounded-xl border border-white/10 bg-black/10 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.05]"
                      >
                        <div className="flex gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                            style={{
                              background: meta.soft,
                              color: meta.color,
                            }}
                          >
                            <i className={meta.icon} />
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-white">
                              {activity.title}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-500">
                              {meta.label}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* UPCOMING */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-xl backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">
                    Upcoming
                  </p>

                  <h3 className="mt-1 text-lg font-black">
                    Next Activities
                  </h3>
                </div>

                <i className="fa-solid fa-forward text-violet-300" />
              </div>

              {upcomingActivities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
                  <i className="fa-regular fa-calendar mb-2 text-xl text-slate-600" />
                  <p className="text-xs font-bold text-slate-500">
                    No upcoming activities.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingActivities.map((activity) => {
                    const meta = getActivityMeta(activity);
                    const activityDate = parseDateOnly(
                      activity.activity_date
                    );

                    return (
                      <button
                        key={activity.id}
                        type="button"
                        onClick={() => setSelectedActivity(activity)}
                        className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/10 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.05]"
                      >
                        <div
                          className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl"
                          style={{
                            background: meta.soft,
                            color: meta.color,
                          }}
                        >
                          <span className="text-sm font-black">
                            {activityDate?.getDate() ?? '--'}
                          </span>

                          <span className="text-[8px] font-black uppercase">
                            {activityDate?.toLocaleDateString('en-US', {
                              month: 'short',
                            })}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-white">
                            {activity.title}
                          </p>

                          <p className="mt-1 truncate text-[10px] text-slate-500">
                            <i className="fa-solid fa-user-tie mr-1" />
                            {getResponsibleNames(activity).join(', ') ||
                              'No responsible staff assigned'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      {/* ACTIVITY DETAILS MODAL */}
      {selectedActivity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedActivity(null);
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0a1627] shadow-2xl shadow-black/50">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/10 bg-[#0a1627]/95 p-5 backdrop-blur-xl">
              <div className="flex gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    background: getActivityMeta(selectedActivity).soft,
                    color: getActivityMeta(selectedActivity).color,
                  }}
                >
                  <i
                    className={`${getActivityMeta(selectedActivity).icon} text-lg`}
                  />
                </div>

                <div>
                  <p
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{
                      color: getActivityMeta(selectedActivity).color,
                    }}
                  >
                    {getActivityMeta(selectedActivity).label}
                  </p>

                  <h2 className="mt-1 text-xl font-black text-white">
                    {selectedActivity.title}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedActivity(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-400 hover:text-white"
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* DATE */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                  <i className="fa-solid fa-calendar-day text-cyan-300" />
                  Date
                </div>

                <p className="text-sm font-bold text-white">
                  {formatLongDate(
                    parseDateOnly(selectedActivity.activity_date) ??
                      new Date()
                  )}

                  {selectedActivity.end_date &&
                    selectedActivity.end_date !==
                      selectedActivity.activity_date && (
                      <>
                        {' '}
                        —{' '}
                        {formatLongDate(
                          parseDateOnly(selectedActivity.end_date) ??
                            new Date()
                        )}
                      </>
                    )}
                </p>
              </div>

              {/* RESPONSIBLE STAFF */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                  <i className="fa-solid fa-user-tie text-violet-300" />
                  Personnel Responsible
                </div>

                {getResponsibleNames(selectedActivity).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No responsible staff assigned.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {getResponsibleNames(selectedActivity).map((name) => (
                      <span
                        key={name}
                        className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-200"
                      >
                        <i className="fa-solid fa-user mr-1.5" />
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* DESCRIPTION */}
              {selectedActivity.description && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                    <i className="fa-solid fa-align-left text-emerald-300" />
                    Description
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                    {selectedActivity.description}
                  </p>
                </div>
              )}

              {/* ALL STAFF */}
              {selectedActivity.is_all_staff && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                    <i className="fa-solid fa-users" />
                  </div>

                  <div>
                    <p className="text-xs font-black text-emerald-200">
                      School-wide activity
                    </p>

                    <p className="mt-0.5 text-[10px] text-emerald-200/60">
                      This activity is visible to all staff.
                    </p>
                  </div>
                </div>
              )}

              {/* ACTIONS */}
              <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedActivity(null)}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/[0.09]"
                >
                  Close
                </button>

                <Link
                  href="/activities"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-black text-white"
                >
                  <i className="fa-solid fa-pen-to-square" />
                  Manage Activity
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes calendarFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        main {
          animation: calendarFadeIn 0.45s ease-out;
        }

        button,
        a,
        input,
        select {
          -webkit-tap-highlight-color: transparent;
        }

        ::-webkit-scrollbar {
          width: 7px;
          height: 7px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.2);
          border-radius: 999px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.35);
        }
      `}</style>
    </main>
  );
}

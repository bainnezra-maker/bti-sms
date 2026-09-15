'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarDays,
  faGraduationCap,
  faPlaneDeparture,
  faBriefcase,
  faPlus,
  faPenToSquare,
  faTrashCan,
  faCheck,
  faMagnifyingGlass,
  faXmark,
  faFloppyDisk,
  faSpinner,
  faCircleCheck,
  faClock,
  faCircleExclamation,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string | null;
};

type Semester = {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

type CalendarPeriod = {
  id: string;
  academic_year_id: string;
  name: string;
  period_type: 'vacation' | 'wel';
  start_date: string;
  end_date: string;
  notes: string | null;
  display_order: number;
  created_at: string | null;
};

type PeriodType = 'vacation' | 'wel';

function formatDate(date: string | null) {
  if (!date) return '—';

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getPeriodStatus(
  startDate: string | null,
  endDate: string | null
) {
  if (!startDate || !endDate) {
    return 'upcoming';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);

  if (today < start) return 'upcoming';
  if (today > end) return 'completed';

  return 'current';
}

function getPeriodIcon(period: CalendarPeriod) {
  if (period.period_type === 'wel') {
    return faBriefcase;
  }

  return faPlaneDeparture;
}

function getPeriodColor(period: CalendarPeriod) {
  if (period.period_type === 'wel') {
    return {
      icon: 'bg-purple-100 text-purple-600',
      badge: 'bg-purple-100 text-purple-700',
      border: 'border-purple-200',
    };
  }

  return {
    icon: 'bg-orange-100 text-orange-600',
    badge: 'bg-orange-100 text-orange-700',
    border: 'border-orange-200',
  };
}

export default function AcademicYearsPage() {
  const supabase = createClient();

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [periods, setPeriods] = useState<CalendarPeriod[]>([]);

  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);

  const [yearName, setYearName] = useState('');
  const [yearStartDate, setYearStartDate] = useState('');
  const [yearEndDate, setYearEndDate] = useState('');
  const [editingYearId, setEditingYearId] = useState<string | null>(null);

  const [semesterName, setSemesterName] = useState('Semester 1');
  const [semesterStartDate, setSemesterStartDate] = useState('');
  const [semesterEndDate, setSemesterEndDate] = useState('');
  const [editingSemesterId, setEditingSemesterId] =
    useState<string | null>(null);

  const [periodType, setPeriodType] =
    useState<PeriodType>('vacation');

  const [periodName, setPeriodName] = useState('Vacation 1');
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [periodNotes, setPeriodNotes] = useState('');
  const [editingPeriodId, setEditingPeriodId] =
    useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [savingYear, setSavingYear] = useState(false);
  const [savingSemester, setSavingSemester] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadCalendar();
  }, []);

  async function getSchoolId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.school_id) {
      setError('School profile could not be found.');
      return null;
    }

    return profile.school_id as string;
  }

  async function loadCalendar(preferredYearId?: string) {
    setLoading(true);
    setError('');

    const schoolId = await getSchoolId();

    if (!schoolId) {
      setLoading(false);
      return;
    }

    const { data: yearData, error: yearError } = await supabase
      .from('academic_years')
      .select(
        'id, name, start_date, end_date, is_current, created_at'
      )
      .eq('school_id', schoolId)
      .order('start_date', {
        ascending: false,
        nullsFirst: false,
      })
      .order('name', {
        ascending: false,
      });

    if (yearError) {
      setError(yearError.message);
      setLoading(false);
      return;
    }

    const loadedYears = (yearData || []) as AcademicYear[];

    setYears(loadedYears);

    let activeYearId =
      preferredYearId ||
      selectedYearId ||
      loadedYears.find((year) => year.is_current)?.id ||
      loadedYears[0]?.id ||
      null;

    if (
      activeYearId &&
      !loadedYears.some((year) => year.id === activeYearId)
    ) {
      activeYearId =
        loadedYears.find((year) => year.is_current)?.id ||
        loadedYears[0]?.id ||
        null;
    }

    setSelectedYearId(activeYearId);

    if (!activeYearId) {
      setSemesters([]);
      setPeriods([]);
      setLoading(false);
      return;
    }

    const [semesterResult, periodResult] = await Promise.all([
      supabase
        .from('terms')
        .select(
          'id, academic_year_id, name, start_date, end_date, is_current'
        )
        .eq('academic_year_id', activeYearId)
        .in('name', ['Semester 1', 'Semester 2'])
        .order('start_date', {
          ascending: true,
          nullsFirst: false,
        }),

      supabase
        .from('academic_calendar_periods')
        .select(
          'id, academic_year_id, name, period_type, start_date, end_date, notes, display_order, created_at'
        )
        .eq('academic_year_id', activeYearId)
        .order('start_date', {
          ascending: true,
        })
        .order('display_order', {
          ascending: true,
        }),
    ]);

    if (semesterResult.error) {
      setError(semesterResult.error.message);
      setLoading(false);
      return;
    }

    if (periodResult.error) {
      setError(periodResult.error.message);
      setLoading(false);
      return;
    }

    setSemesters(
      (semesterResult.data || []) as Semester[]
    );

    setPeriods(
      (periodResult.data || []) as CalendarPeriod[]
    );

    setLoading(false);
  }

  function clearMessages() {
    setError('');
    setMessage('');
  }

  function resetYearForm() {
    setYearName('');
    setYearStartDate('');
    setYearEndDate('');
    setEditingYearId(null);
  }

  function resetSemesterForm() {
    setSemesterName('Semester 1');
    setSemesterStartDate('');
    setSemesterEndDate('');
    setEditingSemesterId(null);
  }

  function resetPeriodForm() {
    setPeriodType('vacation');
    setPeriodName('Vacation 1');
    setPeriodStartDate('');
    setPeriodEndDate('');
    setPeriodNotes('');
    setEditingPeriodId(null);
  }

  function editYear(year: AcademicYear) {
    clearMessages();

    setEditingYearId(year.id);
    setYearName(year.name || '');
    setYearStartDate(year.start_date || '');
    setYearEndDate(year.end_date || '');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function saveYear(e: FormEvent) {
    e.preventDefault();

    clearMessages();

    const cleanName = yearName.trim();

    if (!cleanName) {
      setError(
        'Please enter an academic year, for example 2027/2028.'
      );
      return;
    }

    if (!yearStartDate || !yearEndDate) {
      setError(
        'Please enter both the start date and end date.'
      );
      return;
    }

    if (yearEndDate <= yearStartDate) {
      setError(
        'The end date must be after the start date.'
      );
      return;
    }

    const schoolId = await getSchoolId();

    if (!schoolId) return;

    setSavingYear(true);

    if (editingYearId) {
      const { error: updateError } = await supabase
        .from('academic_years')
        .update({
          name: cleanName,
          start_date: yearStartDate,
          end_date: yearEndDate,
        })
        .eq('id', editingYearId)
        .eq('school_id', schoolId);

      if (updateError) {
        setError(updateError.message);
      } else {
        setMessage(
          'Academic year updated successfully.'
        );

        resetYearForm();
        await loadCalendar(selectedYearId || editingYearId);
      }
    } else {
      const { data: insertedYear, error: insertError } =
        await supabase
          .from('academic_years')
          .insert({
            school_id: schoolId,
            name: cleanName,
            start_date: yearStartDate,
            end_date: yearEndDate,
            is_current: false,
          })
          .select('id')
          .single();

      if (insertError) {
        setError(insertError.message);
      } else {
        setMessage(
          'Academic year created successfully.'
        );

        resetYearForm();

        await loadCalendar(
          insertedYear?.id || undefined
        );
      }
    }

    setSavingYear(false);
  }

  async function makeYearCurrent(id: string) {
    clearMessages();

    const schoolId = await getSchoolId();

    if (!schoolId) return;

    const { error: clearError } = await supabase
      .from('academic_years')
      .update({
        is_current: false,
      })
      .eq('school_id', schoolId);

    if (clearError) {
      setError(clearError.message);
      return;
    }

    const { error: currentError } = await supabase
      .from('academic_years')
      .update({
        is_current: true,
      })
      .eq('id', id)
      .eq('school_id', schoolId);

    if (currentError) {
      setError(currentError.message);
      return;
    }

    setMessage(
      'Academic year is now the current academic year.'
    );

    await loadCalendar(id);
  }

  async function deleteYear(id: string) {
    clearMessages();

    const year = years.find(
      (item) => item.id === id
    );

    if (!year) return;

    if (year.is_current) {
      setError(
        'You cannot delete the current academic year. Make another year current first.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete academic year ${year.name}? Only delete a year if it has no historical records.`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from('academic_years')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage(
      'Academic year deleted successfully.'
    );

    const remaining = years.filter(
      (item) => item.id !== id
    );

    setYears(remaining);

    const nextYear =
      remaining.find((item) => item.is_current) ||
      remaining[0];

    if (nextYear) {
      await loadCalendar(nextYear.id);
    } else {
      setSelectedYearId(null);
      setSemesters([]);
      setPeriods([]);
    }
  }

  function editSemester(semester: Semester) {
    clearMessages();

    setEditingSemesterId(semester.id);
    setSemesterName(semester.name);
    setSemesterStartDate(
      semester.start_date || ''
    );
    setSemesterEndDate(
      semester.end_date || ''
    );
  }

  async function saveSemester(e: FormEvent) {
    e.preventDefault();

    clearMessages();

    if (!selectedYearId) {
      setError(
        'Please create or select an academic year first.'
      );
      return;
    }

    if (
      semesterName !== 'Semester 1' &&
      semesterName !== 'Semester 2'
    ) {
      setError(
        'Please select Semester 1 or Semester 2.'
      );
      return;
    }

    if (!semesterStartDate || !semesterEndDate) {
      setError(
        'Please enter the semester start and end dates.'
      );
      return;
    }

    if (semesterEndDate <= semesterStartDate) {
      setError(
        'The semester end date must be after the start date.'
      );
      return;
    }

    const selectedYear = years.find(
      (year) => year.id === selectedYearId
    );

    if (
      selectedYear?.start_date &&
      semesterStartDate < selectedYear.start_date
    ) {
      setError(
        'The semester cannot start before the academic year.'
      );
      return;
    }

    if (
      selectedYear?.end_date &&
      semesterEndDate > selectedYear.end_date
    ) {
      setError(
        'The semester cannot end after the academic year.'
      );
      return;
    }

    setSavingSemester(true);

    const duplicate = semesters.find(
      (semester) =>
        semester.name === semesterName &&
        semester.id !== editingSemesterId
    );

    if (duplicate) {
      setError(
        `${semesterName} already exists for this academic year.`
      );
      setSavingSemester(false);
      return;
    }

    if (editingSemesterId) {
      const { error: updateError } = await supabase
        .from('terms')
        .update({
          name: semesterName,
          start_date: semesterStartDate,
          end_date: semesterEndDate,
        })
        .eq('id', editingSemesterId)
        .eq('academic_year_id', selectedYearId);

      if (updateError) {
        setError(updateError.message);
      } else {
        setMessage(
          'Semester updated successfully.'
        );

        resetSemesterForm();
        await loadCalendar(selectedYearId);
      }
    } else {
      const { error: insertError } = await supabase
        .from('terms')
        .insert({
          academic_year_id: selectedYearId,
          name: semesterName,
          start_date: semesterStartDate,
          end_date: semesterEndDate,
          is_current: false,
        });

      if (insertError) {
        setError(insertError.message);
      } else {
        setMessage(
          'Semester created successfully.'
        );

        resetSemesterForm();
        await loadCalendar(selectedYearId);
      }
    }

    setSavingSemester(false);
  }

  async function makeSemesterCurrent(id: string) {
    clearMessages();

    if (!selectedYearId) return;

    const { error: clearError } = await supabase
      .from('terms')
      .update({
        is_current: false,
      })
      .eq('academic_year_id', selectedYearId)
      .in('name', ['Semester 1', 'Semester 2']);

    if (clearError) {
      setError(clearError.message);
      return;
    }

    const { error: currentError } = await supabase
      .from('terms')
      .update({
        is_current: true,
      })
      .eq('id', id)
      .eq('academic_year_id', selectedYearId);

    if (currentError) {
      setError(currentError.message);
      return;
    }

    setMessage(
      'Semester is now the current semester.'
    );

    await loadCalendar(selectedYearId);
  }

  async function deleteSemester(id: string) {
    clearMessages();

    const semester = semesters.find(
      (item) => item.id === id
    );

    if (!semester) return;

    if (semester.is_current) {
      setError(
        'You cannot delete the current semester. Make another semester current first.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete ${semester.name}? Historical academic records may depend on this semester.`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from('terms')
      .delete()
      .eq('id', id)
      .eq('academic_year_id', selectedYearId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage(
      'Semester deleted successfully.'
    );

    await loadCalendar(selectedYearId || undefined);
  }

  function startPeriodEdit(period: CalendarPeriod) {
    clearMessages();

    setEditingPeriodId(period.id);
    setPeriodType(period.period_type);
    setPeriodName(period.name);
    setPeriodStartDate(period.start_date);
    setPeriodEndDate(period.end_date);
    setPeriodNotes(period.notes || '');
  }

  function handlePeriodTypeChange(
    type: PeriodType
  ) {
    setPeriodType(type);

    if (!editingPeriodId) {
      setPeriodName(
        type === 'wel'
          ? 'Workplace Experience Learning'
          : 'Vacation 1'
      );
    }
  }

  async function savePeriod(e: FormEvent) {
    e.preventDefault();

    clearMessages();

    if (!selectedYearId) {
      setError(
        'Please create or select an academic year first.'
      );
      return;
    }

    const cleanName = periodName.trim();

    if (!cleanName) {
      setError('Please enter a calendar period name.');
      return;
    }

    if (!periodStartDate || !periodEndDate) {
      setError(
        'Please enter both the start date and end date.'
      );
      return;
    }

    if (periodEndDate <= periodStartDate) {
      setError(
        'The end date must be after the start date.'
      );
      return;
    }

    const selectedYear = years.find(
      (year) => year.id === selectedYearId
    );

    if (
      selectedYear?.start_date &&
      periodStartDate < selectedYear.start_date
    ) {
      setError(
        'The period cannot start before the academic year.'
      );
      return;
    }

    if (
      selectedYear?.end_date &&
      periodEndDate > selectedYear.end_date
    ) {
      setError(
        'The period cannot end after the academic year.'
      );
      return;
    }

    setSavingPeriod(true);

    if (editingPeriodId) {
      const { error: updateError } = await supabase
        .from('academic_calendar_periods')
        .update({
          name: cleanName,
          period_type: periodType,
          start_date: periodStartDate,
          end_date: periodEndDate,
          notes: periodNotes.trim() || null,
        })
        .eq('id', editingPeriodId)
        .eq('academic_year_id', selectedYearId);

      if (updateError) {
        setError(updateError.message);
      } else {
        setMessage(
          'Calendar period updated successfully.'
        );

        resetPeriodForm();
        await loadCalendar(selectedYearId);
      }
    } else {
      const { error: insertError } = await supabase
        .from('academic_calendar_periods')
        .insert({
          academic_year_id: selectedYearId,
          name: cleanName,
          period_type: periodType,
          start_date: periodStartDate,
          end_date: periodEndDate,
          notes: periodNotes.trim() || null,
          display_order:
            periods.filter(
              (period) =>
                period.period_type === periodType
            ).length,
        });

      if (insertError) {
        setError(insertError.message);
      } else {
        setMessage(
          'Calendar period created successfully.'
        );

        resetPeriodForm();
        await loadCalendar(selectedYearId);
      }
    }

    setSavingPeriod(false);
  }

  async function deletePeriod(id: string) {
    clearMessages();

    const period = periods.find(
      (item) => item.id === id
    );

    if (!period) return;

    const confirmed = window.confirm(
      `Delete ${period.name}?`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from('academic_calendar_periods')
      .delete()
      .eq('id', id)
      .eq('academic_year_id', selectedYearId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage(
      'Calendar period deleted successfully.'
    );

    await loadCalendar(selectedYearId || undefined);
  }

  const filteredYears = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return years;

    return years.filter((year) =>
      year.name.toLowerCase().includes(term)
    );
  }, [years, search]);

  const selectedYear = years.find(
    (year) => year.id === selectedYearId
  );

  const calendarItems = useMemo(() => {
    const semesterItems = semesters.map(
      (semester) => ({
        id: semester.id,
        name: semester.name,
        type: 'semester' as const,
        start_date: semester.start_date,
        end_date: semester.end_date,
        is_current: semester.is_current,
      })
    );

    const periodItems = periods.map(
      (period) => ({
        id: period.id,
        name: period.name,
        type: period.period_type,
        start_date: period.start_date,
        end_date: period.end_date,
        is_current:
          getPeriodStatus(
            period.start_date,
            period.end_date
          ) === 'current',
      })
    );

    return [
      ...semesterItems,
      ...periodItems,
    ].sort((a, b) =>
      (a.start_date || '').localeCompare(
        b.start_date || ''
      )
    );
  }, [semesters, periods]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 shadow-sm transition-transform duration-300 hover:scale-105">
            <FontAwesomeIcon
              icon={faCalendarDays}
              className="text-2xl"
            />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Academic Calendar
              </h1>

              <p className="mt-2 max-w-3xl text-slate-500">
                Manage academic years, semesters, vacations and
                Workplace Experience Learning in one central calendar.
              </p>
            </div>

            {selectedYear?.is_current && (
              <div className="flex items-center gap-2 self-start rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 lg:self-auto">
                <FontAwesomeIcon icon={faCircleCheck} />
                Current Academic Year
              </div>
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 shadow-sm">
            <FontAwesomeIcon
              icon={faCircleExclamation}
              className="mt-0.5"
            />
            <span>{error}</span>

            <button
              onClick={() => setError('')}
              className="ml-auto rounded-lg p-1 hover:bg-red-100"
              aria-label="Close error"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}

        {message && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700 shadow-sm">
            <FontAwesomeIcon
              icon={faCircleCheck}
              className="mt-0.5"
            />
            <span>{message}</span>

            <button
              onClick={() => setMessage('')}
              className="ml-auto rounded-lg p-1 hover:bg-green-100"
              aria-label="Close message"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}

        {/* Academic Year Selector */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={faGraduationCap}
                  className="text-blue-600"
                />

                <h2 className="font-bold text-slate-900">
                  Select Academic Year
                </h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Select the academic year whose calendar you want to manage.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedYearId || ''}
                onChange={(e) => {
                  clearMessages();
                  setSelectedYearId(
                    e.target.value || null
                  );

                  if (e.target.value) {
                    loadCalendar(e.target.value);
                  }
                }}
                className="min-w-[230px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {years.length === 0 && (
                  <option value="">
                    No academic years
                  </option>
                )}

                {years.map((year) => (
                  <option
                    key={year.id}
                    value={year.id}
                  >
                    {year.name}
                    {year.is_current
                      ? ' — Current'
                      : ''}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Search years..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        {/* Academic Year + Semester */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* Academic Year Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <FontAwesomeIcon icon={faCalendarDays} />
                </div>

                <h2 className="text-lg font-bold text-slate-900">
                  {editingYearId
                    ? 'Edit Academic Year'
                    : 'Add Academic Year'}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Example: 2027/2028
                </p>
              </div>
            </div>

            <form
              onSubmit={saveYear}
              className="space-y-4"
            >
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Academic Year
                </label>

                <input
                  type="text"
                  value={yearName}
                  onChange={(e) =>
                    setYearName(e.target.value)
                  }
                  placeholder="e.g. 2027/2028"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Start Date
                </label>

                <input
                  type="date"
                  value={yearStartDate}
                  onChange={(e) =>
                    setYearStartDate(e.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  End Date
                </label>

                <input
                  type="date"
                  value={yearEndDate}
                  onChange={(e) =>
                    setYearEndDate(e.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={savingYear}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition duration-200 hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FontAwesomeIcon
                  icon={
                    savingYear
                      ? faSpinner
                      : faFloppyDisk
                  }
                  className={
                    savingYear
                      ? 'animate-spin'
                      : ''
                  }
                />

                {savingYear
                  ? 'Saving...'
                  : editingYearId
                  ? 'Save Changes'
                  : 'Add Academic Year'}
              </button>

              {editingYearId && (
                <button
                  type="button"
                  onClick={resetYearForm}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <FontAwesomeIcon icon={faXmark} />
                  Cancel Edit
                </button>
              )}
            </form>
          </div>

          {/* Year Records */}
          <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Academic Years
                </h2>

                <p className="text-sm text-slate-500">
                  {years.length} record
                  {years.length !== 1
                    ? 's'
                    : ''}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <div className="flex items-center gap-3 text-slate-500">
                  <FontAwesomeIcon
                    icon={faSpinner}
                    className="animate-spin"
                  />
                  Loading calendar...
                </div>
              </div>
            ) : filteredYears.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center">
                <FontAwesomeIcon
                  icon={faCalendarDays}
                  className="mb-3 text-3xl text-slate-300"
                />

                <p className="text-slate-500">
                  No academic years found.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredYears.map((year) => (
                  <div
                    key={year.id}
                    className={`rounded-xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
                      selectedYearId === year.id
                        ? 'border-blue-300 bg-blue-50/40'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedYearId(
                            year.id
                          );
                          loadCalendar(year.id);
                        }}
                        className="text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">
                            {year.name}
                          </h3>

                          {year.is_current && (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                              CURRENT
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(
                            year.start_date
                          )}{' '}
                          →{' '}
                          {formatDate(
                            year.end_date
                          )}
                        </p>
                      </button>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            editYear(year)
                          }
                          className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                        >
                          <FontAwesomeIcon
                            icon={faPenToSquare}
                          />
                          Edit
                        </button>

                        {!year.is_current && (
                          <button
                            onClick={() =>
                              makeYearCurrent(
                                year.id
                              )
                            }
                            className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                          >
                            <FontAwesomeIcon
                              icon={faCheck}
                            />
                            Make Current
                          </button>
                        )}

                        <button
                          onClick={() =>
                            deleteYear(
                              year.id
                            )
                          }
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <FontAwesomeIcon
                            icon={faTrashCan}
                          />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Calendar Management */}
        {selectedYearId && (
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">

            {/* Semesters */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <FontAwesomeIcon
                      icon={faGraduationCap}
                    />
                  </div>

                  <h2 className="text-xl font-bold text-slate-900">
                    Semesters
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Manage Semester 1 and Semester 2 for{' '}
                    <span className="font-semibold">
                      {selectedYear?.name}
                    </span>
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  {semesters.length}/2
                </span>
              </div>

              <form
                onSubmit={saveSemester}
                className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Semester
                    </label>

                    <select
                      value={semesterName}
                      onChange={(e) =>
                        setSemesterName(
                          e.target.value
                        )}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option>
                        Semester 1
                      </option>
                      <option>
                        Semester 2
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Start
                    </label>

                    <input
                      type="date"
                      value={semesterStartDate}
                      onChange={(e) =>
                        setSemesterStartDate(
                          e.target.value
                        )}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      End
                    </label>

                    <input
                      type="date"
                      value={semesterEndDate}
                      onChange={(e) =>
                        setSemesterEndDate(
                          e.target.value
                        )}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={savingSemester}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <FontAwesomeIcon
                      icon={
                        savingSemester
                          ? faSpinner
                          : faPlus
                      }
                      className={
                        savingSemester
                          ? 'animate-spin'
                          : ''
                      }
                    />

                    {editingSemesterId
                      ? 'Save Semester'
                      : 'Add Semester'}
                  </button>

                  {editingSemesterId && (
                    <button
                      type="button"
                      onClick={
                        resetSemesterForm
                      }
                      className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <FontAwesomeIcon
                        icon={faXmark}
                      />
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="space-y-3">
                {semesters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No semesters have been added yet.
                  </div>
                ) : (
                  semesters.map(
                    (semester) => (
                      <div
                        key={semester.id}
                        className="rounded-xl border border-slate-200 p-4 transition duration-200 hover:border-blue-200 hover:shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-slate-900">
                                {semester.name}
                              </h3>

                              {semester.is_current && (
                                <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">
                                  CURRENT
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                              {formatDate(
                                semester.start_date
                              )}{' '}
                              →{' '}
                              {formatDate(
                                semester.end_date
                              )}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() =>
                                editSemester(
                                  semester
                                )
                              }
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <FontAwesomeIcon
                                icon={
                                  faPenToSquare
                                }
                                className="mr-1"
                              />
                              Edit
                            </button>

                            {!semester.is_current && (
                              <button
                                onClick={() =>
                                  makeSemesterCurrent(
                                    semester.id
                                  )
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                              >
                                Make Current
                              </button>
                            )}

                            <button
                              onClick={() =>
                                deleteSemester(
                                  semester.id
                                )
                              }
                              className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                            >
                              <FontAwesomeIcon
                                icon={faTrashCan}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            </div>

            {/* Vacation / WEL */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                    <FontAwesomeIcon
                      icon={faBriefcase}
                    />
                  </div>

                  <h2 className="text-xl font-bold text-slate-900">
                    Vacation & WEL
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Add school calendar periods for{' '}
                    <span className="font-semibold">
                      {selectedYear?.name}
                    </span>
                  </p>
                </div>
              </div>

              <form
                onSubmit={savePeriod}
                className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Period Type
                    </label>

                    <select
                      value={periodType}
                      onChange={(e) =>
                        handlePeriodTypeChange(
                          e.target.value as PeriodType
                        )}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="vacation">
                        Vacation
                      </option>

                      <option value="wel">
                        Workplace Experience Learning
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Name
                    </label>

                    <input
                      type="text"
                      value={periodName}
                      onChange={(e) =>
                        setPeriodName(
                          e.target.value
                        )}
                      placeholder="e.g. Vacation 1"
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Start Date
                    </label>

                    <input
                      type="date"
                      value={periodStartDate}
                      onChange={(e) =>
                        setPeriodStartDate(
                          e.target.value
                        )}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      End Date
                    </label>

                    <input
                      type="date"
                      value={periodEndDate}
                      onChange={(e) =>
                        setPeriodEndDate(
                          e.target.value
                        )}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Notes
                  </label>

                  <textarea
                    value={periodNotes}
                    onChange={(e) =>
                      setPeriodNotes(
                        e.target.value
                      )}
                    rows={3}
                    placeholder="Optional notes..."
                    className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={savingPeriod}
                    className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                  >
                    <FontAwesomeIcon
                      icon={
                        savingPeriod
                          ? faSpinner
                          : faPlus
                      }
                      className={
                        savingPeriod
                          ? 'animate-spin'
                          : ''
                      }
                    />

                    {savingPeriod
                      ? 'Saving...'
                      : editingPeriodId
                      ? 'Save Period'
                      : 'Add Calendar Period'}
                  </button>

                  {editingPeriodId && (
                    <button
                      type="button"
                      onClick={
                        resetPeriodForm
                      }
                      className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <FontAwesomeIcon
                        icon={faXmark}
                      />
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="space-y-3">
                {periods.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No vacation or WEL periods have been added yet.
                  </div>
                ) : (
                  periods.map(
                    (period) => {
                      const status =
                        getPeriodStatus(
                          period.start_date,
                          period.end_date
                        );

                      const color =
                        getPeriodColor(
                          period
                        );

                      return (
                        <div
                          key={period.id}
                          className={`rounded-xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-sm ${color.border}`}
                        >
                          <div className="flex gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color.icon}`}
                            >
                              <FontAwesomeIcon
                                icon={getPeriodIcon(
                                  period
                                )}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-bold text-slate-900">
                                      {period.name}
                                    </h3>

                                    <span
                                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${color.badge}`}
                                    >
                                      {period.period_type ===
                                      'wel'
                                        ? 'WEL'
                                        : 'Vacation'}
                                    </span>
                                  </div>

                                  <p className="mt-1 text-sm text-slate-500">
                                    {formatDate(
                                      period.start_date
                                    )}{' '}
                                    →{' '}
                                    {formatDate(
                                      period.end_date
                                    )}
                                  </p>
                                </div>

                                <span
                                  className={`flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                                    status ===
                                    'current'
                                      ? 'bg-green-100 text-green-700'
                                      : status ===
                                        'completed'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  <FontAwesomeIcon
                                    icon={
                                      status ===
                                      'current'
                                        ? faCircleCheck
                                        : status ===
                                          'completed'
                                        ? faCheck
                                        : faClock
                                    }
                                  />

                                  {status}
                                </span>
                              </div>

                              {period.notes && (
                                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
                                  {period.notes}
                                </p>
                              )}

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  onClick={() =>
                                    startPeriodEdit(
                                      period
                                    )
                                  }
                                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  <FontAwesomeIcon
                                    icon={
                                      faPenToSquare
                                    }
                                    className="mr-1"
                                  />
                                  Edit
                                </button>

                                <button
                                  onClick={() =>
                                    deletePeriod(
                                      period.id
                                    )
                                  }
                                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                >
                                  <FontAwesomeIcon
                                    icon={
                                      faTrashCan
                                    }
                                    className="mr-1"
                                  />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Calendar Timeline */}
        {selectedYearId && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={faCalendarDays}
                  className="text-blue-600"
                />

                <h2 className="text-xl font-bold text-slate-900">
                  Calendar Timeline
                </h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                A single view of the academic periods for{' '}
                <span className="font-semibold">
                  {selectedYear?.name}
                </span>
              </p>
            </div>

            {calendarItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Add semesters, vacations or WEL periods to build the academic calendar.
              </div>
            ) : (
              <div className="relative">
                <div className="absolute bottom-4 left-[19px] top-4 w-px bg-slate-200" />

                <div className="space-y-4">
                  {calendarItems.map(
                    (item, index) => {
                      const isSemester =
                        item.type ===
                        'semester';

                      const status =
                        isSemester
                          ? item.is_current
                            ? 'current'
                            : getPeriodStatus(
                                item.start_date,
                                item.end_date
                              )
                          : getPeriodStatus(
                              item.start_date,
                              item.end_date
                            );

                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          className="relative flex gap-4 rounded-xl p-3 transition duration-200 hover:bg-slate-50"
                          style={{
                            animationDelay: `${index * 60}ms`,
                          }}
                        >
                          <div
                            className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white shadow-sm ${
                              isSemester
                                ? 'bg-blue-600 text-white'
                                : item.type ===
                                  'wel'
                                ? 'bg-purple-600 text-white'
                                : 'bg-orange-500 text-white'
                            }`}
                          >
                            <FontAwesomeIcon
                              icon={
                                isSemester
                                  ? faGraduationCap
                                  : item.type ===
                                    'wel'
                                  ? faBriefcase
                                  : faPlaneDeparture
                              }
                              className="text-xs"
                            />
                          </div>

                          <div className="min-w-0 flex-1 pb-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h3 className="font-bold text-slate-900">
                                  {item.name}
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                  {formatDate(
                                    item.start_date
                                  )}{' '}
                                  →{' '}
                                  {formatDate(
                                    item.end_date
                                  )}
                                </p>
                              </div>

                              <span
                                className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase ${
                                  status ===
                                  'current'
                                    ? 'bg-green-100 text-green-700'
                                    : status ===
                                      'completed'
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {status}
                              </span>
                            </div>
                          </div>

                          <FontAwesomeIcon
                            icon={faChevronRight}
                            className="mt-3 hidden text-xs text-slate-300 sm:block"
                          />
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

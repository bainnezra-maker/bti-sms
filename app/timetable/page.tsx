'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
  faCalendarDays,
  faClock,
  faChalkboardUser,
  faBookOpen,
  faGraduationCap,
  faPlus,
  faPenToSquare,
  faTrash,
  faBan,
  faRotateLeft,
  faCircleCheck,
  faTriangleExclamation,
  faXmark,
  faArrowRight,
  faCalendarWeek,
  faUserTie,
} from '@fortawesome/free-solid-svg-icons';

type Teacher = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type AcademicYear = {
  id: string;
  name: string;
  is_current?: boolean | null;
};

type Term = {
  id: string;
  name: string;
  academic_year_id: string;
  is_current?: boolean | null;
};

type ClassRecord = {
  id: string;
  name: string;
  level: string | null;
  academic_year_id: string | null;
};

type Subject = {
  id: string;
  name: string;
  code: string | null;
};

type Assignment = {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
  teacher?: Teacher | Teacher[] | null;
  class?: ClassRecord | ClassRecord[] | null;
  subject?: Subject | Subject[] | null;
  term?: Term | Term[] | null;
};

type TimetableEntry = {
  id: string;
  school_id: string;
  teacher_assignment_id: string;
  academic_year_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'cancelled';
  notes: string | null;
  teacher_assignment?: Assignment | Assignment[] | null;
};

const supabase = createClient();

const DAYS = [
  { value: 1, label: 'Monday', short: 'MON' },
  { value: 2, label: 'Tuesday', short: 'TUE' },
  { value: 3, label: 'Wednesday', short: 'WED' },
  { value: 4, label: 'Thursday', short: 'THU' },
  { value: 5, label: 'Friday', short: 'FRI' },
];

function firstRelation<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatTime(time: string) {
  return time ? time.slice(0, 5) : '';
}

export default function TimetablePage() {
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState('');

  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [notes, setNotes] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const filteredTerms = useMemo(() => {
    if (!selectedYear) return terms;

    return terms.filter(
      (term) => term.academic_year_id === selectedYear
    );
  }, [terms, selectedYear]);

  const filteredClasses = useMemo(() => {
    if (!selectedYear) return classes;

    return classes.filter(
      (classRecord) =>
        classRecord.academic_year_id === selectedYear
    );
  }, [classes, selectedYear]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      const classRecord = firstRelation(assignment.class);
      const term = firstRelation(assignment.term);

      const matchesYear =
        !selectedYear ||
        classRecord?.academic_year_id === selectedYear ||
        term?.academic_year_id === selectedYear;

      const matchesClass =
        !selectedClass ||
        assignment.class_id === selectedClass;

      const matchesTerm =
        !selectedTerm ||
        assignment.term_id === selectedTerm;

      return matchesYear && matchesClass && matchesTerm;
    });
  }, [
    assignments,
    selectedYear,
    selectedClass,
    selectedTerm,
  ]);

  const scheduledCount = entries.filter(
    (entry) => entry.status === 'scheduled'
  ).length;

  const cancelledCount = entries.filter(
    (entry) => entry.status === 'cancelled'
  ).length;

  const entriesByDay = useMemo(() => {
    const result: Record<number, TimetableEntry[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
    };

    [...entries]
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) {
          return a.day_of_week - b.day_of_week;
        }

        return a.start_time.localeCompare(b.start_time);
      })
      .forEach((entry) => {
        if (result[entry.day_of_week]) {
          result[entry.day_of_week].push(entry);
        }
      });

    return result;
  }, [entries]);

  async function getSchoolId() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error(
        'You must be logged in to access the timetable.'
      );
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('school_id, role, is_active')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      throw new Error(
        'Unable to load your school profile.'
      );
    }

    if (profile.role !== 'admin') {
      throw new Error(
        'Only administrators can manage the timetable.'
      );
    }

    if (!profile.is_active) {
      throw new Error('Your account is inactive.');
    }

    if (!profile.school_id) {
      throw new Error(
        'Your account is not linked to a school.'
      );
    }

    return profile.school_id as string;
  }

  async function loadEntries(school: string) {
    let query = supabase
      .from('timetable')
      .select(`
        id,
        school_id,
        teacher_assignment_id,
        academic_year_id,
        day_of_week,
        start_time,
        end_time,
        status,
        notes,
        teacher_assignment:teacher_assignments (
          id,
          teacher_id,
          class_id,
          subject_id,
          term_id,
          teacher:users!teacher_assignments_teacher_id_fkey (
            id,
            full_name,
            email
          ),
          class:classes (
            id,
            name,
            level,
            academic_year_id
          ),
          subject:subjects (
            id,
            name,
            code
          ),
          term:terms (
            id,
            name,
            academic_year_id,
            is_current
          )
        )
      `)
      .eq('school_id', school)
      .order('day_of_week', {
        ascending: true,
      })
      .order('start_time', {
        ascending: true,
      });

    if (selectedYear) {
      query = query.eq(
        'academic_year_id',
        selectedYear
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    setEntries((data ?? []) as TimetableEntry[]);
  }

  async function loadData(school: string) {
    const [
      yearsResult,
      classesResult,
    ] = await Promise.all([
      supabase
        .from('academic_years')
        .select('id, name, is_current')
        .eq('school_id', school)
        .order('name', {
          ascending: false,
        }),

      supabase
        .from('classes')
        .select(
          'id, name, level, academic_year_id'
        )
        .eq('school_id', school)
        .order('name'),
    ]);

    if (yearsResult.error) {
      throw yearsResult.error;
    }

    if (classesResult.error) {
      throw classesResult.error;
    }

    const yearData =
      (yearsResult.data ?? []) as AcademicYear[];

    setAcademicYears(yearData);
    setClasses(
      (classesResult.data ?? []) as ClassRecord[]
    );

    if (!selectedYear && yearData.length > 0) {
      const currentYear =
        yearData.find(
          (year) => year.is_current
        ) ?? yearData[0];

      setSelectedYear(currentYear.id);
    }

    const yearIds = yearData.map(
      (year) => year.id
    );

    if (yearIds.length > 0) {
      const termsResult = await supabase
        .from('terms')
        .select(
          'id, name, academic_year_id, is_current'
        )
        .in(
          'academic_year_id',
          yearIds
        )
        .order('name');

      if (termsResult.error) {
        throw termsResult.error;
      }

      const termData =
        (termsResult.data ?? []) as Term[];

      setTerms(termData);

      const currentTerm = termData.find(
        (term) => term.is_current
      );

      if (currentTerm && !selectedTerm) {
        setSelectedTerm(currentTerm.id);
      }
    }

    const assignmentsResult = await supabase
      .from('teacher_assignments')
      .select(`
        id,
        teacher_id,
        class_id,
        subject_id,
        term_id,
        teacher:users!teacher_assignments_teacher_id_fkey (
          id,
          full_name,
          email
        ),
        class:classes (
          id,
          name,
          level,
          academic_year_id
        ),
        subject:subjects (
          id,
          name,
          code
        ),
        term:terms (
          id,
          name,
          academic_year_id,
          is_current
        )
      `)
      .order('id', {
        ascending: false,
      });

    if (assignmentsResult.error) {
      throw assignmentsResult.error;
    }

    setAssignments(
      (assignmentsResult.data ?? []) as Assignment[]
    );
  }

  async function initialize() {
    try {
      setLoading(true);
      setErrorMessage('');

      const school = await getSchoolId();

      setSchoolId(school);

      await loadData(school);
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          'Unable to load timetable data.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!schoolId) return;

    loadEntries(schoolId).catch(
      (error: any) => {
        setErrorMessage(
          error?.message ||
            'Unable to load timetable.'
        );
      }
    );
  }, [schoolId, selectedYear]);

  useEffect(() => {
    if (
      !selectedAssignment &&
      filteredAssignments.length > 0
    ) {
      setSelectedAssignment(
        filteredAssignments[0].id
      );
    }
  }, [
    filteredAssignments,
    selectedAssignment,
  ]);

  function resetForm() {
    setSelectedAssignment('');
    setDayOfWeek('1');
    setStartTime('08:00');
    setEndTime('09:00');
    setNotes('');
    setEditingId(null);
  }

  function startEdit(entry: TimetableEntry) {
    setEditingId(entry.id);
    setSelectedAssignment(
      entry.teacher_assignment_id
    );
    setSelectedYear(entry.academic_year_id);
    setDayOfWeek(
      String(entry.day_of_week)
    );
    setStartTime(
      formatTime(entry.start_time)
    );
    setEndTime(
      formatTime(entry.end_time)
    );
    setNotes(entry.notes ?? '');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function saveEntry() {
    if (!schoolId) {
      setErrorMessage(
        'School information is not available.'
      );
      return;
    }

    if (!selectedAssignment) {
      setErrorMessage(
        'Please select a teacher assignment.'
      );
      return;
    }

    if (!selectedYear) {
      setErrorMessage(
        'Please select an academic year.'
      );
      return;
    }

    if (!startTime || !endTime) {
      setErrorMessage(
        'Please select both start and end times.'
      );
      return;
    }

    if (endTime <= startTime) {
      setErrorMessage(
        'End time must be later than start time.'
      );
      return;
    }

    const assignment =
      assignments.find(
        (item) =>
          item.id === selectedAssignment
      );

    if (!assignment) {
      setErrorMessage(
        'The selected teacher assignment could not be found.'
      );
      return;
    }

    const assignmentClass =
      firstRelation(assignment.class);

    const assignmentTerm =
      firstRelation(assignment.term);

    if (
      assignmentClass?.academic_year_id &&
      assignmentClass.academic_year_id !==
        selectedYear
    ) {
      setErrorMessage(
        'The selected class does not belong to the selected academic year.'
      );
      return;
    }

    if (
      assignmentTerm?.academic_year_id &&
      assignmentTerm.academic_year_id !==
        selectedYear
    ) {
      setErrorMessage(
        'The selected assignment does not belong to the selected academic year.'
      );
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const payload = {
        school_id: schoolId,
        teacher_assignment_id:
          selectedAssignment,
        academic_year_id: selectedYear,
        day_of_week:
          Number(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        status: 'scheduled',
        notes:
          notes.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('timetable')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;

        setSuccessMessage(
          'Timetable entry updated successfully.'
        );
      } else {
        const { error } = await supabase
          .from('timetable')
          .insert(payload);

        if (error) throw error;

        setSuccessMessage(
          'Timetable entry added successfully.'
        );
      }

      resetForm();

      await loadEntries(schoolId);

      setTimeout(() => {
        setSuccessMessage('');
      }, 3500);
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          'Unable to save timetable entry. Please check for a timetable conflict.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!schoolId) return;

    const confirmed = window.confirm(
      'Are you sure you want to remove this timetable entry?'
    );

    if (!confirmed) return;

    try {
      setErrorMessage('');

      const { error } = await supabase
        .from('timetable')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEntries((current) =>
        current.filter(
          (entry) => entry.id !== id
        )
      );

      setSuccessMessage(
        'Timetable entry removed.'
      );

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          'Unable to remove timetable entry.'
      );
    }
  }

  async function toggleStatus(
    entry: TimetableEntry
  ) {
    const newStatus =
      entry.status === 'scheduled'
        ? 'cancelled'
        : 'scheduled';

    try {
      setErrorMessage('');

      const { error } = await supabase
        .from('timetable')
        .update({
          status: newStatus,
        })
        .eq('id', entry.id);

      if (error) throw error;

      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                status: newStatus,
              }
            : item
        )
      );
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          'Unable to update timetable status.'
      );
    }
  }

  function getEntryDetails(
    entry: TimetableEntry
  ) {
    const assignment =
      firstRelation(
        entry.teacher_assignment
      );

    if (!assignment) {
      return {
        teacher: 'Unknown teacher',
        className: 'Unknown class',
        subject: 'Unknown subject',
        term: '',
      };
    }

    const teacher =
      firstRelation(assignment.teacher);

    const classRecord =
      firstRelation(assignment.class);

    const subject =
      firstRelation(assignment.subject);

    const term =
      firstRelation(assignment.term);

    return {
      teacher:
        teacher?.full_name ||
        teacher?.email ||
        'Teacher',

      className:
        classRecord?.name ||
        'Class',

      subject:
        subject?.name ||
        'Subject',

      term:
        term?.name || '',
    };
  }

  function assignmentLabel(
    assignment: Assignment
  ) {
    const teacher =
      firstRelation(assignment.teacher);

    const classRecord =
      firstRelation(assignment.class);

    const subject =
      firstRelation(assignment.subject);

    return `${classRecord?.name || 'Class'} • ${
      subject?.name || 'Subject'
    } • ${
      teacher?.full_name ||
      teacher?.email ||
      'Teacher'
    }`;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl">
              <FontAwesomeIcon
                icon={faCalendarDays}
                className="animate-bounce text-3xl"
              />
            </div>

            <h2 className="text-lg font-bold text-slate-900">
              Loading Timetable
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Preparing your academic schedule...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* PREMIUM HERO */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-5 text-white shadow-2xl md:p-8">

          <div className="absolute -right-16 -top-16 h-48 w-48 animate-pulse rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-indigo-300/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">

            <div className="max-w-2xl">

              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                <FontAwesomeIcon
                  icon={faCalendarWeek}
                  className="animate-pulse"
                />
                Academic Management
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
                School Timetable
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 md:text-base">
                Design, organize and manage your school's
                weekly academic schedule with confidence.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm transition hover:scale-105">
                  <FontAwesomeIcon
                    icon={faCircleCheck}
                    className="text-green-300"
                  />
                  <span className="text-sm font-semibold">
                    {scheduledCount} Scheduled
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm transition hover:scale-105">
                  <FontAwesomeIcon
                    icon={faBan}
                    className="text-amber-300"
                  />
                  <span className="text-sm font-semibold">
                    {cancelledCount} Cancelled
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex">
              <div className="group flex h-36 w-36 animate-[float_4s_ease-in-out_infinite] items-center justify-center rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md">
                <FontAwesomeIcon
                  icon={faCalendarDays}
                  className="text-7xl text-white transition duration-500 group-hover:rotate-6 group-hover:scale-110"
                />
              </div>
            </div>

          </div>
        </section>

        {/* ALERTS */}
        {errorMessage && (
          <div className="animate-[fadeIn_.3s_ease-out] rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <FontAwesomeIcon
                  icon={faTriangleExclamation}
                />
              </div>

              <div className="flex-1">
                <p className="font-bold text-red-800">
                  Unable to continue
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {errorMessage}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="text-red-400 transition hover:rotate-90 hover:text-red-600"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="animate-[fadeIn_.3s_ease-out] rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <div className="flex items-center gap-3 text-green-700">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100">
                <FontAwesomeIcon
                  icon={faCircleCheck}
                  className="animate-pulse"
                />
              </div>

              <p className="font-bold">
                {successMessage}
              </p>
            </div>
          </div>
        )}

        {/* FORM */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md md:p-6">

          <div className="mb-6 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FontAwesomeIcon
                  icon={
                    editingId
                      ? faPenToSquare
                      : faPlus
                  }
                  className="transition-transform duration-300 hover:scale-125"
                />
              </div>

              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {editingId
                    ? 'Edit Timetable Entry'
                    : 'Create Timetable Entry'}
                </h2>

                <p className="text-sm text-slate-500">
                  Build your timetable from existing teacher assignments.
                </p>
              </div>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:shadow-sm"
              >
                <FontAwesomeIcon
                  icon={faXmark}
                  className="mr-2"
                />
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {/* YEAR */}
            <div className="group">
              <label className="mb-2 block text-sm font-bold text-slate-700">
                <FontAwesomeIcon
                  icon={faGraduationCap}
                  className="mr-2 text-blue-500"
                />
                Academic Year
              </label>

              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedClass('');
                  setSelectedTerm('');
                  setSelectedAssignment('');
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
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

            {/* TERM */}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                <FontAwesomeIcon
                  icon={faBookOpen}
                  className="mr-2 text-indigo-500"
                />
                Semester / Term
              </label>

              <select
                value={selectedTerm}
                onChange={(e) => {
                  setSelectedTerm(e.target.value);
                  setSelectedAssignment('');
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="">
                  All semesters
                </option>

                {filteredTerms.map((term) => (
                  <option
                    key={term.id}
                    value={term.id}
                  >
                    {term.name}
                    {term.is_current
                      ? ' (Current)'
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* CLASS */}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                <FontAwesomeIcon
                  icon={faChalkboardUser}
                  className="mr-2 text-purple-500"
                />
                Class
              </label>

              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedAssignment('');
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="">
                  All classes
                </option>

                {filteredClasses.map(
                  (classRecord) => (
                    <option
                      key={classRecord.id}
                      value={classRecord.id}
                    >
                      {classRecord.name}
                      {classRecord.level
                        ? ` • ${classRecord.level}`
                        : ''}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* ASSIGNMENT */}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                <FontAwesomeIcon
                  icon={faUserTie}
                  className="mr-2 text-blue-500"
                />
                Teacher Assignment
              </label>

              <select
                value={selectedAssignment}
                onChange={(e) =>
                  setSelectedAssignment(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="">
                  Select teacher • class • subject
                </option>

                {filteredAssignments.map(
                  (assignment) => (
                    <option
                      key={assignment.id}
                      value={assignment.id}
                    >
                      {assignmentLabel(
                        assignment
                      )}
                    </option>
                  )
                )}
              </select>

              {filteredAssignments.length === 0 && (
                <p className="mt-2 text-xs font-medium text-amber-600">
                  No matching teacher assignments found.
                </p>
              )}
            </div>

            {/* DAY */}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                <FontAwesomeIcon
                  icon={faCalendarDays}
                  className="mr-2 text-blue-500"
                />
                Day
              </label>

              <select
                value={dayOfWeek}
                onChange={(e) =>
                  setDayOfWeek(e.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                {DAYS.map((day) => (
                  <option
                    key={day.value}
                    value={day.value}
                  >
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            {/* START */}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                <FontAwesomeIcon
                  icon={faClock}
                  className="mr-2 text-green-500"
                />
                Start Time
              </label>

              <input
                type="time"
                value={startTime}
                onChange={(e) =>
                  setStartTime(e.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {/* END */}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                <FontAwesomeIcon
                  icon={faClock}
                  className="mr-2 text-red-500"
                />
                End Time
              </label>

              <input
                type="time"
                value={endTime}
                onChange={(e) =>
                  setEndTime(e.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {/* NOTES */}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Notes
              </label>

              <input
                type="text"
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
                placeholder="Optional timetable note"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* PREVIEW */}
          {selectedAssignment && (
            <div className="mt-6 animate-[fadeIn_.3s_ease-out] rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">

              <div className="mb-3 flex items-center gap-2">
                <FontAwesomeIcon
                  icon={faArrowRight}
                  className="text-blue-600"
                />

                <span className="text-xs font-black uppercase tracking-widest text-blue-600">
                  Lesson Preview
                </span>
              </div>

              {(() => {
                const assignment =
                  assignments.find(
                    (item) =>
                      item.id ===
                      selectedAssignment
                  );

                if (!assignment) return null;

                const teacher =
                  firstRelation(
                    assignment.teacher
                  );

                const classRecord =
                  firstRelation(
                    assignment.class
                  );

                const subject =
                  firstRelation(
                    assignment.subject
                  );

                return (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        Class
                      </p>
                      <p className="font-bold text-slate-900">
                        {classRecord?.name || '—'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Subject
                      </p>
                      <p className="font-bold text-slate-900">
                        {subject?.name || '—'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Teacher
                      </p>
                      <p className="font-bold text-slate-900">
                        {teacher?.full_name || '—'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Time
                      </p>
                      <p className="font-bold text-slate-900">
                        {startTime} – {endTime}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ACTIONS */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={saveEntry}
              disabled={
                saving ||
                !selectedAssignment
              }
              className="group rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FontAwesomeIcon
                icon={
                  editingId
                    ? faPenToSquare
                    : faPlus
                }
                className="mr-2 transition-transform duration-300 group-hover:scale-125"
              />

              {saving
                ? 'Saving...'
                : editingId
                  ? 'Update Timetable'
                  : 'Add to Timetable'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
            >
              Clear Form
            </button>
          </div>
        </section>

        {/* WEEKLY TIMETABLE */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <FontAwesomeIcon
                  icon={faCalendarWeek}
                />
              </div>

              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Weekly Schedule
                </h2>

                <p className="text-sm text-slate-500">
                  Monday to Friday academic timetable.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600">
              {entries.length} Total Entries
            </div>
          </div>

          {/* DESKTOP */}
          <div className="hidden overflow-x-auto xl:block">
            <div className="grid min-w-[1100px] grid-cols-5 gap-4">

              {DAYS.map((day) => (
                <div
                  key={day.value}
                  className="rounded-2xl bg-slate-50 p-3 transition hover:bg-slate-100"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black tracking-widest text-blue-600">
                        {day.short}
                      </p>

                      <h3 className="font-black text-slate-900">
                        {day.label}
                      </h3>
                    </div>

                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-slate-500 shadow-sm">
                      {entriesByDay[
                        day.value
                      ]?.length || 0}
                    </span>
                  </div>

                  <div className="space-y-3">

                    {entriesByDay[
                      day.value
                    ]?.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
                        <FontAwesomeIcon
                          icon={faCalendarDays}
                          className="mb-2 text-2xl text-slate-300"
                        />

                        <p className="text-xs font-medium text-slate-400">
                          No lessons
                        </p>
                      </div>
                    ) : (
                      entriesByDay[
                        day.value
                      ].map((entry) => {
                        const details =
                          getEntryDetails(
                            entry
                          );

                        return (
                          <div
                            key={entry.id}
                            className={`group rounded-2xl border bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg ${
                              entry.status ===
                              'cancelled'
                                ? 'border-red-200 opacity-60'
                                : 'border-slate-200'
                            }`}
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                                <FontAwesomeIcon
                                  icon={faClock}
                                  className="mr-1"
                                />
                                {formatTime(
                                  entry.start_time
                                )}{' '}
                                –{' '}
                                {formatTime(
                                  entry.end_time
                                )}
                              </span>

                              <span
                                className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                                  entry.status ===
                                  'scheduled'
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {entry.status}
                              </span>
                            </div>

                            <h4 className="font-black text-slate-900">
                              {details.subject}
                            </h4>

                            <p className="mt-1 text-xs font-bold text-slate-600">
                              <FontAwesomeIcon
                                icon={
                                  faChalkboardUser
                                }
                                className="mr-1 text-blue-500"
                              />
                              {details.className}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              <FontAwesomeIcon
                                icon={faUserTie}
                                className="mr-1"
                              />
                              {details.teacher}
                            </p>

                            {details.term && (
                              <p className="mt-1 text-[11px] text-slate-400">
                                {details.term}
                              </p>
                            )}

                            {entry.notes && (
                              <div className="mt-3 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">
                                {entry.notes}
                              </div>
                            )}

                            <div className="mt-4 grid grid-cols-3 gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  startEdit(
                                    entry
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-black text-slate-600 transition hover:bg-slate-50"
                              >
                                <FontAwesomeIcon
                                  icon={
                                    faPenToSquare
                                  }
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleStatus(
                                    entry
                                  )
                                }
                                className="rounded-lg border border-amber-200 px-2 py-2 text-[10px] font-black text-amber-700 transition hover:bg-amber-50"
                              >
                                <FontAwesomeIcon
                                  icon={
                                    entry.status ===
                                    'scheduled'
                                      ? faBan
                                      : faRotateLeft
                                  }
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteEntry(
                                    entry.id
                                  )
                                }
                                className="rounded-lg border border-red-200 px-2 py-2 text-[10px] font-black text-red-600 transition hover:bg-red-50"
                              >
                                <FontAwesomeIcon
                                  icon={faTrash}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MOBILE / TABLET */}
          <div className="space-y-4 xl:hidden">

            {DAYS.map((day) => (
              <div
                key={day.value}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white shadow-md">
                      {day.short}
                    </div>

                    <div>
                      <h3 className="font-black text-slate-900">
                        {day.label}
                      </h3>

                      <p className="text-xs text-slate-500">
                        {entriesByDay[
                          day.value
                        ]?.length || 0}{' '}
                        lessons
                      </p>
                    </div>
                  </div>
                </div>

                {entriesByDay[
                  day.value
                ]?.length === 0 ? (
                  <div className="rounded-xl bg-white p-5 text-center">
                    <FontAwesomeIcon
                      icon={faCalendarDays}
                      className="mb-2 text-2xl text-slate-300"
                    />

                    <p className="text-xs text-slate-400">
                      No lessons scheduled.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entriesByDay[
                      day.value
                    ].map((entry) => {
                      const details =
                        getEntryDetails(
                          entry
                        );

                      return (
                        <div
                          key={entry.id}
                          className={`rounded-2xl border bg-white p-4 shadow-sm transition duration-300 hover:shadow-md ${
                            entry.status ===
                            'cancelled'
                              ? 'border-red-200 opacity-60'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                            <div>
                              <span className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                                <FontAwesomeIcon
                                  icon={faClock}
                                  className="mr-1.5"
                                />

                                {formatTime(
                                  entry.start_time
                                )}{' '}
                                –{' '}
                                {formatTime(
                                  entry.end_time
                                )}
                              </span>

                              <h4 className="mt-3 text-base font-black text-slate-900">
                                {details.subject}
                              </h4>

                              <p className="mt-1 text-sm font-bold text-slate-700">
                                <FontAwesomeIcon
                                  icon={
                                    faChalkboardUser
                                  }
                                  className="mr-2 text-blue-500"
                                />
                                {details.className}
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                <FontAwesomeIcon
                                  icon={faUserTie}
                                  className="mr-2"
                                />
                                {details.teacher}
                              </p>

                              {details.term && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {details.term}
                                </p>
                              )}
                            </div>

                            <span
                              className={`self-start rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                                entry.status ===
                                'scheduled'
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {entry.status}
                            </span>
                          </div>

                          {entry.notes && (
                            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                              {entry.notes}
                            </div>
                          )}

                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEdit(
                                  entry
                                )
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                            >
                              <FontAwesomeIcon
                                icon={
                                  faPenToSquare
                                }
                                className="mr-1.5"
                              />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                toggleStatus(
                                  entry
                                )
                              }
                              className="rounded-xl border border-amber-200 px-3 py-2.5 text-xs font-black text-amber-700 transition hover:bg-amber-50"
                            >
                              <FontAwesomeIcon
                                icon={
                                  entry.status ===
                                  'scheduled'
                                    ? faBan
                                    : faRotateLeft
                                }
                                className="mr-1.5"
                              />
                              {entry.status ===
                              'scheduled'
                                ? 'Cancel'
                                : 'Restore'}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteEntry(
                                  entry.id
                                )
                              }
                              className="rounded-xl border border-red-200 px-3 py-2.5 text-xs font-black text-red-600 transition hover:bg-red-50"
                            >
                              <FontAwesomeIcon
                                icon={faTrash}
                                className="mr-1.5"
                              />
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

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

        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </main>
  );
}

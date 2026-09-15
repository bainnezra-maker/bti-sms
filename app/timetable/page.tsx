'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
];

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatTime(time: string) {
  if (!time) return '';
  return time.slice(0, 5);
}

export default function TimetablePage() {
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
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

  const selectedAssignmentRecord = useMemo(
    () =>
      assignments.find(
        (assignment) => assignment.id === selectedAssignment
      ) ?? null,
    [assignments, selectedAssignment]
  );

  const filteredTerms = useMemo(() => {
    if (!selectedYear) return terms;
    return terms.filter((term) => term.academic_year_id === selectedYear);
  }, [terms, selectedYear]);

  const filteredClasses = useMemo(() => {
    if (!selectedYear) return classes;
    return classes.filter(
      (classRecord) => classRecord.academic_year_id === selectedYear
    );
  }, [classes, selectedYear]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      const assignmentClass = firstRelation(assignment.class);
      const assignmentTerm = firstRelation(assignment.term);

      const matchesYear =
        !selectedYear ||
        assignmentTerm?.academic_year_id === selectedYear ||
        assignmentClass?.academic_year_id === selectedYear;

      const matchesClass =
        !selectedClass || assignment.class_id === selectedClass;

      const matchesTerm =
        !selectedTerm || assignment.term_id === selectedTerm;

      return matchesYear && matchesClass && matchesTerm;
    });
  }, [assignments, selectedYear, selectedClass, selectedTerm]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) {
        return a.day_of_week - b.day_of_week;
      }

      return a.start_time.localeCompare(b.start_time);
    });
  }, [entries]);

  const entriesByDay = useMemo(() => {
    const result: Record<number, TimetableEntry[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
    };

    sortedEntries.forEach((entry) => {
      if (result[entry.day_of_week]) {
        result[entry.day_of_week].push(entry);
      }
    });

    return result;
  }, [sortedEntries]);

  async function getSchoolId() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('You must be logged in to access the timetable.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('school_id, role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Unable to load your school profile.');
    }

    if (profile.role !== 'admin') {
      throw new Error('Only administrators can manage the timetable.');
    }

    if (!profile.is_active) {
      throw new Error('Your account is inactive.');
    }

    if (!profile.school_id) {
      throw new Error('Your account is not linked to a school.');
    }

    return profile.school_id as string;
  }

  async function loadAssignments(school: string) {
    const { data, error } = await supabase
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
      .order('id', { ascending: false });

    if (error) throw error;

    const validAssignments = (data ?? []).filter((assignment: any) => {
      const assignmentClass = firstRelation(
        assignment.class as ClassRecord | ClassRecord[] | null
      );

      return assignmentClass?.academic_year_id
        ? classes.some(
            (classRecord) =>
              classRecord.id === assignmentClass.id &&
              classRecord.academic_year_id === assignmentClass.academic_year_id
          ) || school
        : true;
    });

    setAssignments(validAssignments as Assignment[]);
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
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (selectedYear) {
      query = query.eq('academic_year_id', selectedYear);
    }

    const { data, error } = await query;

    if (error) throw error;

    setEntries((data ?? []) as TimetableEntry[]);
  }

  async function loadData(school: string) {
    const [
      teachersResult,
      yearsResult,
      classesResult,
      subjectsResult,
    ] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, email')
        .eq('school_id', school)
        .eq('role', 'teacher')
        .eq('is_active', true)
        .order('full_name'),

      supabase
        .from('academic_years')
        .select('id, name, is_current')
        .eq('school_id', school)
        .order('name', { ascending: false }),

      supabase
        .from('classes')
        .select('id, name, level, academic_year_id')
        .eq('school_id', school)
        .order('name'),

      supabase
        .from('subjects')
        .select('id, name, code')
        .eq('school_id', school)
        .order('name'),
    ]);

    if (teachersResult.error) throw teachersResult.error;
    if (yearsResult.error) throw yearsResult.error;
    if (classesResult.error) throw classesResult.error;
    if (subjectsResult.error) throw subjectsResult.error;

    setTeachers((teachersResult.data ?? []) as Teacher[]);
    setAcademicYears((yearsResult.data ?? []) as AcademicYear[]);
    setClasses((classesResult.data ?? []) as ClassRecord[]);
    setSubjects((subjectsResult.data ?? []) as Subject[]);

    const yearData = (yearsResult.data ?? []) as AcademicYear[];

    if (yearData.length > 0 && !selectedYear) {
      const currentYear =
        yearData.find((year) => year.is_current) ?? yearData[0];

      setSelectedYear(currentYear.id);
    }

    const yearIds = yearData.map((year) => year.id);

    if (yearIds.length > 0) {
      const termsResult = await supabase
        .from('terms')
        .select('id, name, academic_year_id, is_current')
        .in('academic_year_id', yearIds)
        .order('name');

      if (termsResult.error) throw termsResult.error;

      setTerms((termsResult.data ?? []) as Term[]);

      const currentTerm =
        (termsResult.data ?? []).find((term: Term) => term.is_current);

      if (currentTerm && !selectedTerm) {
        setSelectedTerm(currentTerm.id);
      }
    }

    await loadAssignments(school);
  }

  async function initialize() {
    try {
      setLoading(true);
      setErrorMessage('');

      const school = await getSchoolId();

      setSchoolId(school);

      await loadData(school);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to load timetable data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!schoolId) return;

    loadEntries(schoolId).catch((error: any) => {
      setErrorMessage(error?.message || 'Unable to load timetable.');
    });
  }, [schoolId, selectedYear]);

  useEffect(() => {
    if (!selectedAssignment && filteredAssignments.length > 0) {
      setSelectedAssignment(filteredAssignments[0].id);
    }
  }, [filteredAssignments, selectedAssignment]);

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
    setSelectedAssignment(entry.teacher_assignment_id);
    setSelectedYear(entry.academic_year_id);
    setDayOfWeek(String(entry.day_of_week));
    setStartTime(formatTime(entry.start_time));
    setEndTime(formatTime(entry.end_time));
    setNotes(entry.notes ?? '');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function saveEntry() {
    if (!schoolId) {
      setErrorMessage('School information is not available.');
      return;
    }

    if (!selectedAssignment) {
      setErrorMessage('Please select a teacher assignment.');
      return;
    }

    if (!selectedYear) {
      setErrorMessage('Please select an academic year.');
      return;
    }

    if (!startTime || !endTime) {
      setErrorMessage('Please select both start and end times.');
      return;
    }

    if (endTime <= startTime) {
      setErrorMessage('End time must be later than start time.');
      return;
    }

    const assignment = assignments.find(
      (item) => item.id === selectedAssignment
    );

    if (!assignment) {
      setErrorMessage('The selected teacher assignment could not be found.');
      return;
    }

    const assignmentTerm = firstRelation(assignment.term);
    const assignmentClass = firstRelation(assignment.class);

    if (
      assignmentTerm?.academic_year_id &&
      assignmentTerm.academic_year_id !== selectedYear
    ) {
      setErrorMessage(
        'The selected assignment does not belong to the selected academic year.'
      );
      return;
    }

    if (
      assignmentClass?.academic_year_id &&
      assignmentClass.academic_year_id !== selectedYear
    ) {
      setErrorMessage(
        'The selected class does not belong to the selected academic year.'
      );
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const payload = {
        school_id: schoolId,
        teacher_assignment_id: selectedAssignment,
        academic_year_id: selectedYear,
        day_of_week: Number(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        status: 'scheduled',
        notes: notes.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('timetable')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;

        setSuccessMessage('Timetable entry updated successfully.');
      } else {
        const { error } = await supabase
          .from('timetable')
          .insert(payload);

        if (error) throw error;

        setSuccessMessage('Timetable entry added successfully.');
      }

      resetForm();

      await loadEntries(schoolId);

      setTimeout(() => {
        setSuccessMessage('');
      }, 3500);
    } catch (error: any) {
      const message =
        error?.message ||
        'Unable to save timetable entry. Please check for a timetable conflict.';

      setErrorMessage(message);
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
      setSuccessMessage('');

      const { error } = await supabase
        .from('timetable')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEntries((current) => current.filter((entry) => entry.id !== id));

      setSuccessMessage('Timetable entry removed.');

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error: any) {
      setErrorMessage(
        error?.message || 'Unable to remove timetable entry.'
      );
    }
  }

  async function toggleStatus(entry: TimetableEntry) {
    if (!schoolId) return;

    const newStatus =
      entry.status === 'scheduled' ? 'cancelled' : 'scheduled';

    try {
      setErrorMessage('');

      const { error } = await supabase
        .from('timetable')
        .update({ status: newStatus })
        .eq('id', entry.id);

      if (error) throw error;

      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? { ...item, status: newStatus }
            : item
        )
      );
    } catch (error: any) {
      setErrorMessage(
        error?.message || 'Unable to update timetable status.'
      );
    }
  }

  function assignmentLabel(assignment: Assignment) {
    const teacher = firstRelation(assignment.teacher);
    const classRecord = firstRelation(assignment.class);
    const subject = firstRelation(assignment.subject);
    const term = firstRelation(assignment.term);

    const teacherName = teacher?.full_name || teacher?.email || 'Teacher';
    const className = classRecord?.name || 'Class';
    const subjectName = subject?.name || 'Subject';
    const termName = term?.name || '';

    return `${className} • ${subjectName} • ${teacherName}${
      termName ? ` • ${termName}` : ''
    }`;
  }

  function getEntryDetails(entry: TimetableEntry) {
    const assignment = firstRelation(entry.teacher_assignment);

    if (!assignment) {
      return {
        teacher: 'Unknown teacher',
        className: 'Unknown class',
        subject: 'Unknown subject',
        term: '',
      };
    }

    const teacher = firstRelation(assignment.teacher);
    const classRecord = firstRelation(assignment.class);
    const subject = firstRelation(assignment.subject);
    const term = firstRelation(assignment.term);

    return {
      teacher: teacher?.full_name || teacher?.email || 'Teacher',
      className: classRecord?.name || 'Class',
      subject: subject?.name || 'Subject',
      term: term?.name || '',
    };
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <p className="text-sm font-medium text-slate-600">
              Loading timetable...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        <section className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-2xl text-white shadow-sm">
                  🗓️
                </div>

                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                    Timetable
                  </h1>

                  <p className="text-sm text-slate-500">
                    Create and manage the school weekly timetable.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <span className="font-semibold">
                {entries.filter((entry) => entry.status === 'scheduled').length}
              </span>{' '}
              scheduled lessons
            </div>
          </div>
        </section>

        {/* Messages */}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-semibold">Unable to continue</p>
                <p className="mt-1">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <div className="flex items-center gap-3">
              <span className="text-lg">✅</span>
              <p className="font-semibold">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Add / Edit Form */}
        <section className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Timetable Entry' : 'Add Timetable Entry'}
              </h2>

              <p className="text-sm text-slate-500">
                Select an existing teacher assignment and give it a time slot.
              </p>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Academic Year */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Academic Year
              </label>

              <select
                value={selectedYear}
                onChange={(event) => {
                  setSelectedYear(event.target.value);
                  setSelectedClass('');
                  setSelectedTerm('');
                  setSelectedAssignment('');
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select academic year</option>

                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                    {year.is_current ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Term */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Semester / Term
              </label>

              <select
                value={selectedTerm}
                onChange={(event) => {
                  setSelectedTerm(event.target.value);
                  setSelectedAssignment('');
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All semesters</option>

                {filteredTerms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                    {term.is_current ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Class */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Class
              </label>

              <select
                value={selectedClass}
                onChange={(event) => {
                  setSelectedClass(event.target.value);
                  setSelectedAssignment('');
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All classes</option>

                {filteredClasses.map((classRecord) => (
                  <option key={classRecord.id} value={classRecord.id}>
                    {classRecord.name}
                    {classRecord.level
                      ? ` • ${classRecord.level}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignment */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Teacher Assignment
              </label>

              <select
                value={selectedAssignment}
                onChange={(event) =>
                  setSelectedAssignment(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select teacher / class / subject
                </option>

                {filteredAssignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignmentLabel(assignment)}
                  </option>
                ))}
              </select>

              {filteredAssignments.length === 0 && (
                <p className="mt-1.5 text-xs text-amber-600">
                  No matching teacher assignments found. Create a teacher
                  assignment first.
                </p>
              )}
            </div>

            {/* Day */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Day
              </label>

              <select
                value={dayOfWeek}
                onChange={(event) => setDayOfWeek(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Start */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Start Time
              </label>

              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* End */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                End Time
              </label>

              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Notes
              </label>

              <input
                type="text"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional note"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Preview */}
          {selectedAssignmentRecord && (
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600">
                Lesson Preview
              </p>

              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span className="text-slate-500">Class</span>
                  <p className="font-semibold text-slate-900">
                    {firstRelation(selectedAssignmentRecord.class)?.name ||
                      '—'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Subject</span>
                  <p className="font-semibold text-slate-900">
                    {firstRelation(selectedAssignmentRecord.subject)?.name ||
                      '—'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Teacher</span>
                  <p className="font-semibold text-slate-900">
                    {firstRelation(selectedAssignmentRecord.teacher)
                      ?.full_name || '—'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Time</span>
                  <p className="font-semibold text-slate-900">
                    {startTime} – {endTime}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={saveEntry}
              disabled={saving || !selectedAssignment}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Update Timetable'
                  : 'Add to Timetable'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </section>

        {/* Weekly Timetable */}
        <section className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Weekly Timetable
              </h2>

              <p className="text-sm text-slate-500">
                Monday to Friday lesson schedule.
              </p>
            </div>

            <div className="text-sm text-slate-500">
              {entries.length} total entries
            </div>
          </div>

          {/* Tablet / Desktop Grid */}
          <div className="hidden overflow-x-auto lg:block">
            <div className="min-w-[1050px]">
              <div className="grid grid-cols-5 gap-3">
                {DAYS.map((day) => (
                  <div
                    key={day.value}
                    className="rounded-xl bg-slate-100 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">
                        {day.label}
                      </h3>

                      <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                        {entriesByDay[day.value]?.length || 0}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {entriesByDay[day.value]?.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-400">
                          No lessons
                        </div>
                      ) : (
                        entriesByDay[day.value].map((entry) => {
                          const details = getEntryDetails(entry);

                          return (
                            <div
                              key={entry.id}
                              className={`rounded-xl border bg-white p-3 shadow-sm ${
                                entry.status === 'cancelled'
                                  ? 'border-red-200 opacity-60'
                                  : 'border-slate-200'
                              }`}
                            >
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                                  {formatTime(entry.start_time)} –{' '}
                                  {formatTime(entry.end_time)}
                                </span>

                                <span
                                  className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                                    entry.status === 'scheduled'
                                      ? 'bg-green-50 text-green-700'
                                      : 'bg-red-50 text-red-700'
                                  }`}
                                >
                                  {entry.status}
                                </span>
                              </div>

                              <h4 className="font-bold text-slate-900">
                                {details.subject}
                              </h4>

                              <p className="mt-1 text-xs font-semibold text-slate-600">
                                {details.className}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                👨‍🏫 {details.teacher}
                              </p>

                              {details.term && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {details.term}
                                </p>
                              )}

                              {entry.notes && (
                                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
                                  {entry.notes}
                                </p>
                              )}

                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEdit(entry)}
                                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleStatus(entry)}
                                  className="flex-1 rounded-lg border border-amber-200 px-2 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50"
                                >
                                  {entry.status === 'scheduled'
                                    ? 'Cancel'
                                    : 'Restore'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteEntry(entry.id)}
                                  className="rounded-lg border border-red-200 px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                                >
                                  Delete
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
          </div>

          {/* Mobile / Smaller Tablet List */}
          <div className="space-y-4 lg:hidden">
            {DAYS.map((day) => (
              <div
                key={day.value}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">
                    {day.label}
                  </h3>

                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">
                    {entriesByDay[day.value]?.length || 0} lessons
                  </span>
                </div>

                {entriesByDay[day.value]?.length === 0 ? (
                  <div className="rounded-xl bg-white p-4 text-center text-xs text-slate-400">
                    No lessons scheduled for {day.label}.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entriesByDay[day.value].map((entry) => {
                      const details = getEntryDetails(entry);

                      return (
                        <div
                          key={entry.id}
                          className={`rounded-xl border bg-white p-4 shadow-sm ${
                            entry.status === 'cancelled'
                              ? 'border-red-200 opacity-60'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <span className="inline-block rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                                {formatTime(entry.start_time)} –{' '}
                                {formatTime(entry.end_time)}
                              </span>

                              <h4 className="mt-2 text-base font-bold text-slate-900">
                                {details.subject}
                              </h4>

                              <p className="mt-1 text-sm font-semibold text-slate-700">
                                {details.className}
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                👨‍🏫 {details.teacher}
                              </p>

                              {details.term && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {details.term}
                                </p>
                              )}
                            </div>

                            <span
                              className={`self-start rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                                entry.status === 'scheduled'
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {entry.status}
                            </span>
                          </div>

                          {entry.notes && (
                            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                              {entry.notes}
                            </div>
                          )}

                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleStatus(entry)}
                              className="rounded-lg border border-amber-200 px-2 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50"
                            >
                              {entry.status === 'scheduled'
                                ? 'Cancel'
                                : 'Restore'}
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteEntry(entry.id)}
                              className="rounded-lg border border-red-200 px-2 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                            >
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
    </main>
  );
}

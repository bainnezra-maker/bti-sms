'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSchool,
  faXmark,
  faSpinner,
  faTriangleExclamation,
  faCircleCheck,
  faCalendarDays,
  faLayerGroup,
  faGraduationCap,
  faUsers,
  faArrowRight,
  faChalkboardTeacher,
  faBookOpen,
  faCircleInfo,
  faChevronRight,
  faHouse,
  faBed,
} from '@fortawesome/free-solid-svg-icons';

type AcademicYear = {
  id: string;
  name: string;
  is_current?: boolean;
};

type StudentDirectoryEntry = {
  id: string;
  academic_year_id: string;
  programme_id: string | null;
  class_id: string | null;
  student: {
    id: string;
    full_name: string;
    admission_number: string | null;
    resident: string | null;
  } | null;
  class: {
    id: string;
    name: string;
    level: string | null;
  } | null;
  programme: Programme | null;
};

type Programme = {
  id: string;
  name: string;
};

type ClassRecord = {
  id: string;
  school_id: string;
  name: string;
  level: string | null;
  academic_year_id: string | null;
  programme_id: string | null;
  academic_year?: AcademicYear | null;
  programme?: Programme | null;
};

export default function ClassesPage() {
  const supabase = createClient();

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [directoryEntries, setDirectoryEntries] = useState<StudentDirectoryEntry[]>([]);
  const [selectedDirectoryYearId, setSelectedDirectoryYearId] = useState('');
  const [selectedForm, setSelectedForm] = useState('');
  const [selectedClassLetter, setSelectedClassLetter] = useState('');

  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [programmeId, setProgrammeId] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const normalizeClass = (item: any): ClassRecord => ({
    id: item.id,
    school_id: item.school_id,
    name: item.name,
    level: item.level ?? null,
    academic_year_id: item.academic_year_id ?? null,
    programme_id: item.programme_id ?? null,
    academic_year: Array.isArray(item.academic_year)
      ? item.academic_year[0] || null
      : item.academic_year || null,
    programme: Array.isArray(item.programme)
      ? item.programme[0] || null
      : item.programme || null,
  });

  const normalizeDirectoryEntry = (item: any): StudentDirectoryEntry => ({
    id: item.id,
    academic_year_id: item.academic_year_id,
    programme_id: item.programme_id ?? null,
    class_id: item.class_id ?? null,
    student: Array.isArray(item.student)
      ? item.student[0] || null
      : item.student || null,
    class: Array.isArray(item.class)
      ? item.class[0] || null
      : item.class || null,
    programme: Array.isArray(item.programme)
      ? item.programme[0] || null
      : item.programme || null,
  });

  const getSchoolId = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('You must be logged in.');
    }

    const { data, error } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (error) {
      throw new Error('Unable to determine your school.');
    }

    if (!data?.school_id) {
      throw new Error('Your account is not linked to a school.');
    }

    return data.school_id as string;
  };

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const schoolId = await getSchoolId();

      const [
        { data: classData, error: classError },
        { data: yearData, error: yearError },
        { data: programmeData, error: programmeError },
        { data: enrollmentData, error: enrollmentDataError },
      ] = await Promise.all([
        supabase
          .from('classes')
          .select(`
            id,
            school_id,
            name,
            level,
            academic_year_id,
            programme_id,
            academic_year:academic_years (
              id,
              name
            ),
            programme:programmes (
              id,
              name
            )
          `)
          .eq('school_id', schoolId)
          .order('name', { ascending: true }),

        supabase
          .from('academic_years')
          .select('id, name, is_current')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: false }),

        supabase
          .from('programmes')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('name', { ascending: true }),

        supabase
          .from('enrollments')
          .select(`
            id,
            academic_year_id,
            programme_id,
            class_id,
            student:students!inner (
              id,
              full_name,
              admission_number,
              resident
            ),
            class:classes!inner (
              id,
              name,
              level
            ),
            programme:programmes (
              id,
              name
            )
          `)
          .eq('student.school_id', schoolId),
      ]);

      if (classError) {
        throw new Error(classError.message);
      }

      if (yearError) {
        throw new Error(yearError.message);
      }

      if (programmeError) {
        throw new Error(programmeError.message);
      }

      if (enrollmentDataError) {
        throw new Error(enrollmentDataError.message);
      }

      setClasses(
        (classData || []).map((item: any) => normalizeClass(item))
      );

      const normalizedYears = (yearData || []) as AcademicYear[];
      const normalizedEntries = (enrollmentData || []).map((item: any) =>
        normalizeDirectoryEntry(item)
      );

      setAcademicYears(normalizedYears);
      setProgrammes((programmeData || []) as Programme[]);
      setDirectoryEntries(normalizedEntries);

      const selectedYear =
        normalizedYears.find((year) => year.is_current) ||
        normalizedYears[0] ||
        null;

      if (selectedYear) {
        setSelectedDirectoryYearId((current) => current || selectedYear.id);
      }

      const availableForms = Array.from(
        new Set(
          normalizedEntries
            .map((entry) => entry.class?.level?.trim() || '')
            .filter(Boolean)
        )
      ).sort((a, b) => {
        const aNumber = Number(a.match(/\d+/)?.[0] || 999);
        const bNumber = Number(b.match(/\d+/)?.[0] || 999);
        return aNumber - bNumber || a.localeCompare(b);
      });

      if (availableForms.length > 0) {
        setSelectedForm((current) => current || availableForms[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load classes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setName('');
    setLevel('');
    setAcademicYearId('');
    setProgrammeId('');
    setEditingId(null);
  };

  const editClass = (classItem: ClassRecord) => {
    setError('');
    setMessage('');

    setEditingId(classItem.id);
    setName(classItem.name);
    setLevel(classItem.level || '');
    setAcademicYearId(classItem.academic_year_id || '');
    setProgrammeId(classItem.programme_id || '');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const saveClass = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setMessage('');

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Please enter a class name.');
      return;
    }

    if (!academicYearId) {
      setError('Please select an academic year.');
      return;
    }

    setSaving(true);

    try {
      const schoolId = await getSchoolId();

      const payload = {
        school_id: schoolId,
        name: trimmedName,
        level: level.trim() || null,
        academic_year_id: academicYearId,
        programme_id: programmeId || null,
      };

      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('classes')
          .update(payload)
          .eq('id', editingId)
          .eq('school_id', schoolId)
          .select(`
            id,
            school_id,
            name,
            level,
            academic_year_id,
            programme_id,
            academic_year:academic_years (
              id,
              name
            ),
            programme:programmes (
              id,
              name
            )
          `)
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        if (data) {
          const normalizedClass = normalizeClass(data);

          setClasses((current) =>
            current.map((item) =>
              item.id === editingId ? normalizedClass : item
            )
          );
        }

        setMessage('Class updated successfully.');
        resetForm();
      } else {
        const { data, error: insertError } = await supabase
          .from('classes')
          .insert(payload)
          .select(`
            id,
            school_id,
            name,
            level,
            academic_year_id,
            programme_id,
            academic_year:academic_years (
              id,
              name
            ),
            programme:programmes (
              id,
              name
            )
          `)
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        if (data) {
          const normalizedClass = normalizeClass(data);

          setClasses((current) =>
            [...current, normalizedClass].sort((a, b) =>
              a.name.localeCompare(b.name)
            )
          );
        }

        setMessage('Class created successfully.');
        resetForm();
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to save class.');
    } finally {
      setSaving(false);
    }
  };

  const deleteClass = async (classItem: ClassRecord) => {
    if (deletingId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${classItem.name}"?\n\n` +
        'This action cannot be undone.'
    );

    if (!confirmed) return;

    setError('');
    setMessage('');
    setDeletingId(classItem.id);

    try {
      const schoolId = await getSchoolId();

      const {
        count: enrollmentCount,
        error: enrollmentError,
      } = await supabase
        .from('enrollments')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('class_id', classItem.id);

      if (enrollmentError) {
        throw new Error(
          `Unable to check student enrollments: ${enrollmentError.message}`
        );
      }

      const {
        count: teacherAssignmentCount,
        error: teacherAssignmentError,
      } = await supabase
        .from('teacher_assignments')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('class_id', classItem.id);

      if (teacherAssignmentError) {
        throw new Error(
          `Unable to check teacher assignments: ${teacherAssignmentError.message}`
        );
      }

      const studentsUsingClass = enrollmentCount || 0;
      const teachersUsingClass = teacherAssignmentCount || 0;

      if (studentsUsingClass > 0 || teachersUsingClass > 0) {
        const details: string[] = [];

        if (studentsUsingClass > 0) {
          details.push(
            `${studentsUsingClass} student enrollment${
              studentsUsingClass === 1 ? '' : 's'
            }`
          );
        }

        if (teachersUsingClass > 0) {
          details.push(
            `${teachersUsingClass} teacher assignment${
              teachersUsingClass === 1 ? '' : 's'
            }`
          );
        }

        throw new Error(
          `This class cannot be deleted because it is currently in use by ${details.join(
            ' and '
          )}. Remove the related records first.`
        );
      }

      const { error: deleteError } = await supabase
        .from('classes')
        .delete()
        .eq('id', classItem.id)
        .eq('school_id', schoolId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setClasses((current) =>
        current.filter((item) => item.id !== classItem.id)
      );

      if (editingId === classItem.id) {
        resetForm();
      }

      setMessage(`"${classItem.name}" was deleted successfully.`);
    } catch (err: any) {
      setError(err?.message || 'Unable to delete class.');
    } finally {
      setDeletingId(null);
    }
  };

  const classLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const getClassLetter = (className: string | null | undefined) => {
    const match = (className || '')
      .trim()
      .toUpperCase()
      .match(/^([A-F])(?:\s*CLASS)?$/);

    return match?.[1] || '';
  };

  const directoryForms = useMemo(() => {
    const discovered = Array.from(
      new Set(
        directoryEntries
          .filter((entry) =>
            selectedDirectoryYearId
              ? entry.academic_year_id === selectedDirectoryYearId
              : true
          )
          .map((entry) => entry.class?.level?.trim() || '')
          .filter(Boolean)
      )
    );

    return discovered.sort((a, b) => {
      const aNumber = Number(a.match(/\d+/)?.[0] || 999);
      const bNumber = Number(b.match(/\d+/)?.[0] || 999);
      return aNumber - bNumber || a.localeCompare(b);
    });
  }, [directoryEntries, selectedDirectoryYearId]);

  const selectedFormEntries = useMemo(
    () =>
      directoryEntries.filter(
        (entry) =>
          (!selectedDirectoryYearId ||
            entry.academic_year_id === selectedDirectoryYearId) &&
          entry.class?.level?.trim() === selectedForm &&
          Boolean(entry.student)
      ),
    [directoryEntries, selectedDirectoryYearId, selectedForm]
  );

  const selectedClassEntries = useMemo(
    () =>
      selectedFormEntries.filter(
        (entry) => getClassLetter(entry.class?.name) === selectedClassLetter
      ),
    [selectedFormEntries, selectedClassLetter]
  );

  const programmeStudentGroups = useMemo(() => {
    const groups = new Map<string, StudentDirectoryEntry[]>();

    selectedClassEntries.forEach((entry) => {
      const programmeName = entry.programme?.name || 'Unassigned programme';
      groups.set(programmeName, [...(groups.get(programmeName) || []), entry]);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([programmeName, students]) => ({
        programmeName,
        students: students.sort((a, b) =>
          (a.student?.full_name || '').localeCompare(b.student?.full_name || '')
        ),
      }));
  }, [selectedClassEntries]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-8 lg:pt-8">
      <div className="mx-auto max-w-7xl">

        {/* PREMIUM HEADER */}
        <div className="relative mb-7 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 shadow-xl sm:p-8">

          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute right-1/3 top-1/2 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-4">

              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/20 backdrop-blur">

                <FontAwesomeIcon
                  icon={faSchool}
                  className="text-2xl text-cyan-300 transition-transform duration-500 hover:scale-125 hover:rotate-6 animate-pulse"
                />

              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">

                  <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-400/20">
                    <FontAwesomeIcon
                      icon={faLayerGroup}
                      className="mr-1"
                    />
                    Academic Management
                  </span>

                  <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
                    <FontAwesomeIcon
                      icon={faCircleCheck}
                      className="mr-1"
                    />
                    Active
                  </span>

                </div>

                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Classes
                </h1>

                <p className="mt-1 max-w-2xl text-sm text-slate-300">
                  Open a form, choose A–F, and view every student in that class across programmes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex">

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/10">

                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <FontAwesomeIcon icon={faSchool} />
                  Class Groups
                </div>

                <div className="mt-1 text-2xl font-bold text-white">
                  6
                </div>

              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/10">

                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <FontAwesomeIcon icon={faLayerGroup} />
                  Students Enrolled
                </div>

                <div className="mt-1 text-2xl font-bold text-white">
                  {directoryEntries.filter(
                    (entry) =>
                      entry.academic_year_id === selectedDirectoryYearId &&
                      Boolean(entry.student)
                  ).length}
                </div>

              </div>

            </div>

          </div>
        </div>

        {/* MESSAGES */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100">
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                className="animate-pulse"
              />
            </div>

            <div className="flex-1">
              <p className="font-bold">
                Action could not be completed
              </p>

              <p className="mt-1">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError('')}
              className="rounded-lg p-2 text-red-500 transition hover:bg-red-100"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>

          </div>
        )}

        {message && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
              <FontAwesomeIcon
                icon={faCircleCheck}
                className="animate-bounce"
              />
            </div>

            <div className="flex-1">
              <p className="font-bold">Success</p>

              <p className="mt-1">
                {message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMessage('')}
              className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-100"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>

          </div>
        )}


        {/* STUDENT CLASS DIRECTORY */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
                  <FontAwesomeIcon
                    icon={faUsers}
                    className="animate-pulse text-lg"
                  />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">
                    Student Class Directory
                  </h2>
                  <p className="text-sm text-slate-500">
                    Select a form, then A–F. Students are grouped by programme and ordered by name.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <FontAwesomeIcon icon={faCalendarDays} className="text-indigo-500" />
                Academic year
                <select
                  value={selectedDirectoryYearId}
                  onChange={(event) => {
                    setSelectedDirectoryYearId(event.target.value);
                    setSelectedForm('');
                    setSelectedClassLetter('');
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                >
                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}{year.is_current ? ' (Current)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="mb-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                <FontAwesomeIcon icon={faGraduationCap} className="text-indigo-500" />
                Step 1: Choose a form
              </p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {directoryForms.map((form) => {
                  const formStudentCount = directoryEntries.filter(
                    (entry) =>
                      entry.academic_year_id === selectedDirectoryYearId &&
                      entry.class?.level?.trim() === form &&
                      Boolean(entry.student)
                  ).length;

                  return (
                    <button
                      key={form}
                      type="button"
                      onClick={() => {
                        setSelectedForm(form);
                        setSelectedClassLetter('');
                      }}
                      className={
                        'group rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-md ' +
                        (selectedForm === form
                          ? 'border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300')
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <FontAwesomeIcon
                          icon={faSchool}
                          className={
                            selectedForm === form
                              ? 'animate-bounce text-indigo-100'
                              : 'text-indigo-500 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6'
                          }
                        />
                        <span
                          className={
                            'rounded-full px-2.5 py-1 text-xs font-bold ' +
                            (selectedForm === form
                              ? 'bg-white/20 text-white'
                              : 'bg-indigo-50 text-indigo-700')
                          }
                        >
                          {formStudentCount}
                        </span>
                      </div>
                      <p className="mt-4 font-bold">{form}</p>
                      <p
                        className={
                          'mt-1 text-xs ' +
                          (selectedForm === form ? 'text-indigo-100' : 'text-slate-500')
                        }
                      >
                        View class groups
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedForm ? (
              <div className="border-t border-slate-100 pt-5">
                <p className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <FontAwesomeIcon icon={faLayerGroup} className="text-cyan-500" />
                  Step 2: Choose a class in {selectedForm}
                </p>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {classLetters.map((letter) => {
                    const classStudentCount = selectedFormEntries.filter(
                      (entry) => getClassLetter(entry.class?.name) === letter
                    ).length;

                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => setSelectedClassLetter(letter)}
                        className={
                          'group rounded-2xl border p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-md ' +
                          (selectedClassLetter === letter
                            ? 'border-cyan-500 bg-cyan-600 text-white shadow-lg shadow-cyan-200'
                            : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-cyan-300 hover:bg-cyan-50')
                        }
                      >
                        <FontAwesomeIcon
                          icon={faSchool}
                          className={
                            selectedClassLetter === letter
                              ? 'animate-bounce text-cyan-100'
                              : 'text-cyan-500 transition-transform duration-300 group-hover:scale-110'
                          }
                        />
                        <p className="mt-2 text-lg font-black">{letter}</p>
                        <p
                          className={
                            'text-xs font-semibold ' +
                            (selectedClassLetter === letter
                              ? 'text-cyan-100'
                              : 'text-slate-500')
                          }
                        >
                          {classStudentCount} student{classStudentCount === 1 ? '' : 's'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedClassLetter ? (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                      {selectedForm} · {selectedClassLetter} Class
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">
                      {selectedClassEntries.length} student{selectedClassEntries.length === 1 ? '' : 's'}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-500">
                    Grouped alphabetically by programme
                  </p>
                </div>

                {programmeStudentGroups.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <FontAwesomeIcon icon={faUsers} className="animate-pulse text-2xl text-slate-400" />
                    <p className="mt-3 font-semibold text-slate-700">No students are assigned to this class yet.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {programmeStudentGroups.map(({ programmeName, students }) => (
                      <section
                        key={programmeName}
                        className="overflow-hidden rounded-2xl border border-slate-200"
                      >
                        <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faLayerGroup} className="text-indigo-500" />
                            <h4 className="font-bold text-slate-800">{programmeName}</h4>
                          </div>
                          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                            {students.length}
                          </span>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {students.map((entry, index) => (
                            <Link
                              key={entry.id}
                              href={entry.student ? `/students/${entry.student.id}` : '#'}
                              className="group flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-indigo-50"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-600 transition-transform duration-300 group-hover:scale-110">
                                  {index + 1}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-900">
                                    {entry.student?.full_name || 'Unnamed student'}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {entry.student?.admission_number || 'Admission number pending'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                {entry.student?.resident ? (
                                  <span className="hidden items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 sm:inline-flex">
                                    <FontAwesomeIcon
                                      icon={
                                        entry.student.resident.toLowerCase() === 'boarding'
                                          ? faBed
                                          : faHouse
                                      }
                                      className="text-indigo-500"
                                    />
                                    {entry.student.resident}
                                  </span>
                                ) : null}
                                <FontAwesomeIcon
                                  icon={faChevronRight}
                                  className="text-slate-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-indigo-600"
                                />
                              </div>
                            </Link>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* AUTOMATIC CLASS MEMBERSHIP */}
        <div className="mb-6 flex items-start gap-3 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5 text-sm text-indigo-900 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
            <FontAwesomeIcon icon={faCircleCheck} className="animate-pulse" />
          </div>
          <div>
            <p className="font-bold">Student classes update automatically</p>
            <p className="mt-1 text-indigo-700">
              When a student is added or imported with Form and Class A–F, the student appears in the matching class above. No separate programme class needs to be created.
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-6 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-2">
            <FontAwesomeIcon
              icon={faChalkboardTeacher}
              className="text-blue-400"
            />
            <span>
              BTI-SMS Academic Structure
            </span>
          </div>

          <div className="flex items-center gap-2">
            <FontAwesomeIcon
              icon={faBookOpen}
              className="text-cyan-400"
            />
            <span>
              Classes • Forms • Programmes • Academic Years
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span>Manage</span>
            <FontAwesomeIcon
              icon={faArrowRight}
              className="text-slate-300"
            />
            <span>Organize</span>
          </div>

        </div>

      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSchool,
  faPlus,
  faPenToSquare,
  faTrashCan,
  faMagnifyingGlass,
  faFloppyDisk,
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

  const [search, setSearch] = useState('');

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

  const filteredClasses = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return classes;

    return classes.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        (item.level || '').toLowerCase().includes(query) ||
        (item.programme?.name || '')
          .toLowerCase()
          .includes(query) ||
        (item.academic_year?.name || '')
          .toLowerCase()
          .includes(query)
      );
    });
  }, [classes, search]);

  const formCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    classes.forEach((item) => {
      const form = item.level || 'Other';
      counts[form] = (counts[form] || 0) + 1;
    });

    return counts;
  }, [classes]);

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
                  Total Classes
                </div>

                <div className="mt-1 text-2xl font-bold text-white">
                  {classes.length}
                </div>

              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/10">

                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <FontAwesomeIcon icon={faLayerGroup} />
                  Programmes
                </div>

                <div className="mt-1 text-2xl font-bold text-white">
                  {programmes.length}
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

        {/* FORM + QUICK INFO */}
        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* FORM */}
          <div className="xl:col-span-2">

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-lg">

              <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-6">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">

                    <FontAwesomeIcon
                      icon={editingId ? faPenToSquare : faPlus}
                      className="transition-transform duration-300 hover:scale-125"
                    />

                  </div>

                  <div>
                    <h2 className="font-bold text-slate-900">
                      {editingId
                        ? 'Edit Class'
                        : 'Create New Class'}
                    </h2>

                    <p className="text-xs text-slate-500">
                      {editingId
                        ? 'Update the class information below.'
                        : 'Add a class to your academic structure.'}
                    </p>
                  </div>

                </div>

              </div>

              <form
                onSubmit={saveClass}
                className="p-6"
              >

                <div className="grid gap-5 md:grid-cols-2">

                  {/* CLASS NAME */}
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <FontAwesomeIcon
                        icon={faSchool}
                        className="text-blue-500"
                      />
                      Class Name
                    </label>

                    <input
                      type="text"
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      placeholder="e.g. A, B, 1A, 2B"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {/* FORM */}
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <FontAwesomeIcon
                        icon={faGraduationCap}
                        className="text-blue-500"
                      />
                      Level / Form
                    </label>

                    <select
                      value={level}
                      onChange={(e) =>
                        setLevel(e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">
                        Select form
                      </option>
                      <option value="Form 1">
                        Form 1
                      </option>
                      <option value="Form 2">
                        Form 2
                      </option>
                      <option value="Form 3">
                        Form 3
                      </option>
                    </select>
                  </div>

                  {/* ACADEMIC YEAR */}
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <FontAwesomeIcon
                        icon={faCalendarDays}
                        className="text-blue-500"
                      />
                      Academic Year
                    </label>

                    <select
                      value={academicYearId}
                      onChange={(e) =>
                        setAcademicYearId(e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* PROGRAMME */}
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <FontAwesomeIcon
                        icon={faLayerGroup}
                        className="text-blue-500"
                      />
                      Programme
                    </label>

                    <select
                      value={programmeId}
                      onChange={(e) =>
                        setProgrammeId(e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">
                        Select programme
                      </option>

                      {programmes.map((programme) => (
                        <option
                          key={programme.id}
                          value={programme.id}
                        >
                          {programme.name}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>

                {/* ACTIONS */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3 font-bold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    <FontAwesomeIcon
                      icon={
                        saving
                          ? faSpinner
                          : editingId
                          ? faFloppyDisk
                          : faPlus
                      }
                      className={
                        saving
                          ? 'animate-spin'
                          : ''
                      }
                    />

                    {saving
                      ? 'Saving...'
                      : editingId
                      ? 'Save Changes'
                      : 'Create Class'}

                  </button>

                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-100 disabled:opacity-60"
                    >
                      <FontAwesomeIcon
                        icon={faXmark}
                        className="transition-transform duration-300 hover:rotate-90"
                      />
                      Cancel
                    </button>
                  )}

                </div>

              </form>
            </div>
          </div>

          {/* QUICK FORM OVERVIEW */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="mb-5 flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <FontAwesomeIcon
                  icon={faGraduationCap}
                  className="transition-transform duration-500 hover:scale-125 hover:-rotate-6"
                />
              </div>

              <div>
                <h2 className="font-bold text-slate-900">
                  Form Overview
                </h2>

                <p className="text-xs text-slate-500">
                  Current class structure
                </p>
              </div>

            </div>

            <div className="space-y-3">

              {['Form 1', 'Form 2', 'Form 3'].map(
                (form) => (
                  <div
                    key={form}
                    className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50"
                  >

                    <div className="flex items-center gap-3">

                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm transition-transform duration-300 group-hover:scale-110">
                        <FontAwesomeIcon icon={faSchool} />
                      </div>

                      <span className="font-semibold text-slate-700">
                        {form}
                      </span>

                    </div>

                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                      {formCounts[form] || 0}
                    </span>

                  </div>
                )
              )}

            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">

              <div className="flex gap-3">

                <FontAwesomeIcon
                  icon={faCircleInfo}
                  className="mt-0.5 text-blue-500"
                />

                <p className="text-xs leading-5 text-blue-700">
                  Classes are linked to academic years and
                  programmes. Student promotion uses the
                  Form/Level information stored here.
                </p>

              </div>

            </div>

          </div>
        </div>

        {/* SEARCH + LIST */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 p-5 sm:p-6">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <FontAwesomeIcon
                    icon={faSchool}
                    className="transition-transform duration-500 hover:scale-125"
                  />
                </div>

                <div>
                  <h2 className="font-bold text-slate-900">
                    Class Setup Records
                  </h2>

                  <p className="text-sm text-slate-500">
                    Showing {filteredClasses.length} of{' '}
                    {classes.length} underlying programme records
                  </p>
                </div>

              </div>

              <div className="relative w-full lg:max-w-md">

                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search class, form, programme..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />

              </div>

            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center">

              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                <FontAwesomeIcon
                  icon={faSpinner}
                  className="text-2xl text-blue-600 animate-spin"
                />
              </div>

              <p className="font-semibold text-slate-600">
                Loading classes...
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Preparing your academic structure
              </p>

            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">

              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <FontAwesomeIcon
                  icon={faSchool}
                  className="text-2xl text-slate-400 transition-transform duration-500 hover:scale-125 hover:rotate-6"
                />
              </div>

              <h3 className="font-bold text-slate-800">
                {search
                  ? 'No classes found'
                  : 'No classes yet'}
              </h3>

              <p className="mt-1 max-w-md text-sm text-slate-500">
                {search
                  ? 'Try a different search term.'
                  : 'Create your first class using the form above.'}
              </p>

            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div className="hidden overflow-x-auto md:block">

                <table className="w-full text-left text-sm">

                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-4">
                        Class
                      </th>

                      <th className="px-6 py-4">
                        Form
                      </th>

                      <th className="px-6 py-4">
                        Programme
                      </th>

                      <th className="px-6 py-4">
                        Academic Year
                      </th>

                      <th className="px-6 py-4 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {filteredClasses.map(
                      (classItem, index) => (
                        <tr
                          key={classItem.id}
                          className="group transition-all duration-300 hover:bg-blue-50/40"
                          style={{
                            animationDelay: `${index * 40}ms`,
                          }}
                        >

                          <td className="px-6 py-4">

                            <div className="flex items-center gap-3">

                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-100">

                                <FontAwesomeIcon
                                  icon={faSchool}
                                  className="transition-transform duration-300 group-hover:rotate-6"
                                />

                              </div>

                              <div>
                                <p className="font-bold text-slate-900">
                                  {classItem.name}
                                </p>

                                <p className="text-xs text-slate-400">
                                  Class structure
                                </p>
                              </div>

                            </div>

                          </td>

                          <td className="px-6 py-4">

                            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                              <FontAwesomeIcon
                                icon={faGraduationCap}
                              />
                              {classItem.level || '—'}
                            </span>

                          </td>

                          <td className="px-6 py-4">

                            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
                              <FontAwesomeIcon
                                icon={faLayerGroup}
                              />
                              {classItem.programme?.name ||
                                'All programmes'}
                            </span>

                          </td>

                          <td className="px-6 py-4">

                            <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                              <FontAwesomeIcon
                                icon={faCalendarDays}
                                className="text-slate-400"
                              />
                              {classItem.academic_year?.name ||
                                '—'}
                            </span>

                          </td>

                          <td className="px-6 py-4">

                            <div className="flex justify-end gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  editClass(classItem)
                                }
                                disabled={
                                  deletingId ===
                                  classItem.id
                                }
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-md disabled:opacity-50"
                              >
                                <FontAwesomeIcon
                                  icon={faPenToSquare}
                                  className="transition-transform duration-300 hover:rotate-6"
                                />
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteClass(classItem)
                                }
                                disabled={
                                  deletingId ===
                                  classItem.id
                                }
                                className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                              >

                                <FontAwesomeIcon
                                  icon={
                                    deletingId ===
                                    classItem.id
                                      ? faSpinner
                                      : faTrashCan
                                  }
                                  className={
                                    deletingId ===
                                    classItem.id
                                      ? 'animate-spin'
                                      : 'transition-transform duration-300 hover:rotate-12'
                                  }
                                />

                                {deletingId ===
                                classItem.id
                                  ? 'Deleting...'
                                  : 'Delete'}

                              </button>

                            </div>

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>
              </div>

              {/* MOBILE / TABLET CARDS */}
              <div className="divide-y divide-slate-100 md:hidden">

                {filteredClasses.map(
                  (classItem, index) => (
                    <div
                      key={classItem.id}
                      className="group p-5 transition-all duration-300 hover:bg-blue-50/30"
                      style={{
                        animationDelay: `${index * 40}ms`,
                      }}
                    >

                      <div className="flex items-start gap-4">

                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-100">

                          <FontAwesomeIcon
                            icon={faSchool}
                            className="transition-transform duration-300 group-hover:rotate-6"
                          />

                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="flex items-start justify-between gap-3">

                            <div>
                              <h3 className="font-bold text-slate-900">
                                {classItem.name}
                              </h3>

                              <p className="mt-1 text-xs text-slate-400">
                                Academic class
                              </p>
                            </div>

                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                              {classItem.level || '—'}
                            </span>

                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-2">

                            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                              <FontAwesomeIcon
                                icon={faLayerGroup}
                                className="text-cyan-500"
                              />

                              <span>
                                {classItem.programme?.name ||
                                  'All programmes'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                              <FontAwesomeIcon
                                icon={faCalendarDays}
                                className="text-blue-500"
                              />

                              <span>
                                {classItem.academic_year?.name ||
                                  'No academic year'}
                              </span>
                            </div>

                          </div>

                          <div className="mt-4 flex gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                editClass(classItem)
                              }
                              disabled={
                                deletingId ===
                                classItem.id
                              }
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-100 disabled:opacity-50"
                            >
                              <FontAwesomeIcon
                                icon={faPenToSquare}
                              />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteClass(classItem)
                              }
                              disabled={
                                deletingId ===
                                classItem.id
                              }
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-100 disabled:opacity-50"
                            >

                              <FontAwesomeIcon
                                icon={
                                  deletingId ===
                                  classItem.id
                                    ? faSpinner
                                    : faTrashCan
                                }
                                className={
                                  deletingId ===
                                  classItem.id
                                    ? 'animate-spin'
                                    : ''
                                }
                              />

                              {deletingId ===
                              classItem.id
                                ? 'Deleting...'
                                : 'Delete'}

                            </button>

                          </div>

                        </div>

                      </div>
                    </div>
                  )
                )}

              </div>
            </>
          )}
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

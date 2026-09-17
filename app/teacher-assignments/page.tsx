'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  faBook,
  faBuilding,
  faChalkboardTeacher,
  faCheck,
  faCheckCircle,
  faClipboardList,
  faGraduationCap,
  faLayerGroup,
  faSearch,
  faSpinner,
  faTrash,
  faUserTie,
  faUsers,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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

type Programme = {
  id: string;
  name: string;
  code: string | null;
};

type Subject = {
  id: string;
  name: string;
  code: string | null;
};

type Assignment = {
  id: string;
  teacher_id: string;
  subject_id: string;
  school_id: string | null;
  academic_year_id: string | null;
  programme_ids: string[];
  forms: string[];
  class_id: string | null;
  term_id: string | null;
  created_at?: string | null;

  teacher?: Teacher | Teacher[] | null;
  subject?: Subject | Subject[] | null;
  academic_year?: AcademicYear | AcademicYear[] | null;
};

const FORM_OPTIONS = ['Form 1', 'Form 2', 'Form 3'];

function firstRelation<T>(
  relation: T | T[] | null | undefined
): T | null {
  if (!relation) return null;

  if (Array.isArray(relation)) {
    return relation[0] || null;
  }

  return relation;
}

function arraysEqualUnordered(
  first: string[],
  second: string[]
) {
  if (first.length !== second.length) return false;

  const a = [...first].sort();
  const b = [...second].sort();

  return a.every((value, index) => value === b[index]);
}

export default function TeacherAssignmentsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [schoolId, setSchoolId] = useState('');

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const [selectedProgrammes, setSelectedProgrammes] = useState<
    string[]
  >([]);

  const [selectedForms, setSelectedForms] = useState<string[]>([]);

  const [search, setSearch] = useState('');

  async function getSchoolId() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('You are not logged in.');
    }

    const { data: profile, error: profileError } =
      await supabase
        .from('users')
        .select('id, school_id, role, is_active')
        .eq('id', user.id)
        .single();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (profile?.role !== 'admin') {
      throw new Error(
        'Only administrators can manage teacher assignments.'
      );
    }

    if (!profile.school_id) {
      throw new Error(
        'Your account is not linked to a school.'
      );
    }

    if (profile.is_active === false) {
      throw new Error('Your account is inactive.');
    }

    return profile.school_id as string;
  }

  async function loadAssignments() {
    const { data, error: assignmentError } =
      await supabase
        .from('teacher_assignments')
        .select(`
          id,
          teacher_id,
          subject_id,
          school_id,
          academic_year_id,
          programme_ids,
          forms,
          class_id,
          term_id,
          created_at,
          teacher:users!teacher_assignments_teacher_id_fkey (
            id,
            full_name,
            email
          ),
          subject:subjects (
            id,
            name,
            code
          ),
          academic_year:academic_years (
            id,
            name,
            is_current
          )
        `)
        .order('created_at', {
          ascending: false,
        });

    if (assignmentError) {
      throw new Error(
        `Unable to load teacher assignments: ${assignmentError.message}`
      );
    }

    setAssignments(
      ((data || []) as unknown as Assignment[]).map(
        (assignment) => ({
          ...assignment,
          programme_ids: assignment.programme_ids || [],
          forms: assignment.forms || [],
        })
      )
    );
  }

  async function loadData() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const currentSchoolId = await getSchoolId();

      setSchoolId(currentSchoolId);

      const [
        teachersResult,
        yearsResult,
        programmesResult,
        subjectsResult,
      ] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, email')
          .eq('school_id', currentSchoolId)
          .eq('role', 'teacher')
          .eq('is_active', true)
          .order('full_name'),

        supabase
          .from('academic_years')
          .select('id, name, is_current')
          .eq('school_id', currentSchoolId)
          .order('name', { ascending: false }),

        supabase
          .from('programmes')
          .select('id, name, code')
          .eq('school_id', currentSchoolId)
          .order('name'),

        supabase
          .from('subjects')
          .select('id, name, code')
          .eq('school_id', currentSchoolId)
          .order('name'),
      ]);

      if (teachersResult.error) {
        throw new Error(
          `Unable to load teachers: ${teachersResult.error.message}`
        );
      }

      if (yearsResult.error) {
        throw new Error(
          `Unable to load academic years: ${yearsResult.error.message}`
        );
      }

      if (programmesResult.error) {
        throw new Error(
          `Unable to load departments: ${programmesResult.error.message}`
        );
      }

      if (subjectsResult.error) {
        throw new Error(
          `Unable to load subjects: ${subjectsResult.error.message}`
        );
      }

      const loadedTeachers =
        (teachersResult.data || []) as Teacher[];

      const loadedYears =
        (yearsResult.data || []) as AcademicYear[];

      const loadedProgrammes =
        (programmesResult.data || []) as Programme[];

      const loadedSubjects =
        (subjectsResult.data || []) as Subject[];

      setTeachers(loadedTeachers);
      setAcademicYears(loadedYears);
      setProgrammes(loadedProgrammes);
      setSubjects(loadedSubjects);

      const currentYear =
        loadedYears.find(
          (year) => year.is_current === true
        ) || loadedYears[0];

      setSelectedYear(currentYear?.id || '');

      await loadAssignments();
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to load teacher assignments.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleProgramme(programmeId: string) {
    setSelectedProgrammes((current) => {
      if (current.includes(programmeId)) {
        return current.filter(
          (id) => id !== programmeId
        );
      }

      return [...current, programmeId];
    });
  }

  function toggleForm(form: string) {
    setSelectedForms((current) => {
      if (current.includes(form)) {
        return current.filter(
          (item) => item !== form
        );
      }

      return [...current, form];
    });
  }

  function toggleAllProgrammes() {
    if (
      programmes.length > 0 &&
      selectedProgrammes.length === programmes.length
    ) {
      setSelectedProgrammes([]);
      return;
    }

    setSelectedProgrammes(
      programmes.map((programme) => programme.id)
    );
  }

  function toggleAllForms() {
    if (selectedForms.length === FORM_OPTIONS.length) {
      setSelectedForms([]);
      return;
    }

    setSelectedForms([...FORM_OPTIONS]);
  }

  const programmeMap = useMemo(() => {
    return new Map(
      programmes.map((programme) => [
        programme.id,
        programme,
      ])
    );
  }, [programmes]);

  const yearMap = useMemo(() => {
    return new Map(
      academicYears.map((year) => [
        year.id,
        year,
      ])
    );
  }, [academicYears]);

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return assignments;

    return assignments.filter((assignment) => {
      const teacher = firstRelation(
        assignment.teacher
      );

      const subject = firstRelation(
        assignment.subject
      );

      const academicYear =
        firstRelation(assignment.academic_year) ||
        (assignment.academic_year_id
          ? yearMap.get(
              assignment.academic_year_id
            ) || null
          : null);

      const departmentNames =
        assignment.programme_ids
          .map((id) => {
            const programme = programmeMap.get(id);

            return [
              programme?.name || '',
              programme?.code || '',
            ].join(' ');
          })
          .join(' ')
          .toLowerCase();

      const forms = assignment.forms
        .join(' ')
        .toLowerCase();

      return (
        (teacher?.full_name || '')
          .toLowerCase()
          .includes(query) ||
        (teacher?.email || '')
          .toLowerCase()
          .includes(query) ||
        (subject?.name || '')
          .toLowerCase()
          .includes(query) ||
        (subject?.code || '')
          .toLowerCase()
          .includes(query) ||
        (academicYear?.name || '')
          .toLowerCase()
          .includes(query) ||
        departmentNames.includes(query) ||
        forms.includes(query)
      );
    });
  }, [
    assignments,
    search,
    programmeMap,
    yearMap,
  ]);

  async function handleAssign() {
    setMessage('');
    setError('');

    if (!selectedTeacher) {
      setError('Please select a teacher.');
      return;
    }

    if (!selectedYear) {
      setError('Please select an academic year.');
      return;
    }

    if (!selectedSubject) {
      setError('Please select a subject.');
      return;
    }

    if (selectedProgrammes.length === 0) {
      setError(
        'Please select at least one department.'
      );
      return;
    }

    if (selectedForms.length === 0) {
      setError(
        'Please select at least one form.'
      );
      return;
    }

    if (!schoolId) {
      setError(
        'Unable to determine your school.'
      );
      return;
    }

    const duplicate = assignments.some(
      (assignment) => {
        if (
          assignment.teacher_id !== selectedTeacher ||
          assignment.subject_id !== selectedSubject ||
          assignment.academic_year_id !== selectedYear
        ) {
          return false;
        }

        return (
          arraysEqualUnordered(
            assignment.programme_ids || [],
            selectedProgrammes
          ) &&
          arraysEqualUnordered(
            assignment.forms || [],
            selectedForms
          )
        );
      }
    );

    if (duplicate) {
      setError(
        'This exact teacher assignment already exists.'
      );
      return;
    }

    setSaving(true);

    try {
      const { error: insertError } =
        await supabase
          .from('teacher_assignments')
          .insert({
            teacher_id: selectedTeacher,
            subject_id: selectedSubject,
            school_id: schoolId,
            academic_year_id: selectedYear,
            programme_ids: selectedProgrammes,
            forms: selectedForms,

            // Legacy fields are intentionally unused.
            class_id: null,
            term_id: null,
          });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setMessage(
        'Teacher assignment created successfully.'
      );

      await loadAssignments();

      setSelectedSubject('');
      setSelectedProgrammes([]);
      setSelectedForms([]);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to create teacher assignment.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(
    assignmentId: string
  ) {
    const confirmed = window.confirm(
      'Are you sure you want to remove this teacher assignment?'
    );

    if (!confirmed) return;

    setError('');
    setMessage('');
    setDeletingId(assignmentId);

    try {
      const { error: deleteError } =
        await supabase
          .from('teacher_assignments')
          .delete()
          .eq('id', assignmentId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setMessage(
        'Teacher assignment removed successfully.'
      );

      await loadAssignments();
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to remove teacher assignment.'
      );
    } finally {
      setDeletingId('');
    }
  }

  const selectedTeacherName =
    teachers.find(
      (teacher) =>
        teacher.id === selectedTeacher
    )?.full_name || '';

  const selectedSubjectName =
    subjects.find(
      (subject) =>
        subject.id === selectedSubject
    )?.name || '';

  const selectedYearName =
    academicYears.find(
      (year) => year.id === selectedYear
    )?.name || '';

  const selectedProgrammeNames =
    selectedProgrammes
      .map((id) => {
        const programme = programmeMap.get(id);

        return (
          programme?.code ||
          programme?.name ||
          ''
        );
      })
      .filter(Boolean);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 p-5 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 animate-pulse rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 animate-pulse rounded-full bg-blue-300/10" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 shadow-inner backdrop-blur">
                <FontAwesomeIcon
                  icon={faChalkboardTeacher}
                  className="animate-pulse text-2xl"
                />
              </div>

              <div>
                <h1 className="text-2xl font-bold md:text-3xl">
                  Teacher Assignments
                </h1>

                <p className="mt-1 text-sm text-blue-100">
                  Assign teachers to multiple departments and forms
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white/10 px-4 py-3 text-sm shadow-inner backdrop-blur">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={faClipboardList}
                  className="animate-pulse"
                />

                <span>
                  {assignments.length} assignment
                  {assignments.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* MESSAGES */}
        {error && (
          <div className="mb-5 animate-[fadeIn_0.25s_ease-out] rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            <div className="flex items-start gap-3">
              <FontAwesomeIcon
                icon={faClipboardList}
                className="mt-0.5"
              />

              <span>{error}</span>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-5 animate-[fadeIn_0.25s_ease-out] rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 shadow-sm">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon
                icon={faCheckCircle}
                className="animate-pulse"
              />

              <span>{message}</span>
            </div>
          </div>
        )}

        {/* CREATE ASSIGNMENT */}
        <section className="mb-6 overflow-hidden rounded-2xl bg-white shadow-md">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <FontAwesomeIcon
                  icon={faWandMagicSparkles}
                  className="animate-pulse"
                />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Create Teacher Assignment
                </h2>

                <p className="text-sm text-slate-500">
                  Choose a teacher, academic year, subject,
                  departments and forms.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                className="mr-3 text-xl text-blue-600"
              />

              Loading assignment data...
            </div>
          ) : (
            <div className="p-5">

              {/* TOP SELECTORS */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                {/* TEACHER */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <FontAwesomeIcon
                      icon={faUserTie}
                      className="text-blue-600"
                    />
                    Teacher
                  </label>

                  <select
                    value={selectedTeacher}
                    onChange={(e) =>
                      setSelectedTeacher(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition duration-200 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">
                      Select teacher
                    </option>

                    {teachers.map((teacher) => (
                      <option
                        key={teacher.id}
                        value={teacher.id}
                      >
                        {teacher.full_name ||
                          teacher.email ||
                          'Unnamed Teacher'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ACADEMIC YEAR */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <FontAwesomeIcon
                      icon={faGraduationCap}
                      className="text-indigo-600"
                    />
                    Academic Year
                  </label>

                  <select
                    value={selectedYear}
                    onChange={(e) =>
                      setSelectedYear(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition duration-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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

                {/* SUBJECT */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <FontAwesomeIcon
                      icon={faBook}
                      className="text-green-600"
                    />
                    Subject
                  </label>

                  <select
                    value={selectedSubject}
                    onChange={(e) =>
                      setSelectedSubject(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition duration-200 hover:border-green-300 focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  >
                    <option value="">
                      Select subject
                    </option>

                    {subjects.map((subject) => (
                      <option
                        key={subject.id}
                        value={subject.id}
                      >
                        {subject.name}
                        {subject.code
                          ? ` (${subject.code})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DEPARTMENTS */}
              <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={faBuilding}
                        className="text-blue-600"
                      />

                      <h3 className="font-bold text-slate-800">
                        Departments
                      </h3>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      Check one or multiple departments for this teacher.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={toggleAllProgrammes}
                    disabled={programmes.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition duration-200 hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FontAwesomeIcon
                      icon={faCheckCircle}
                    />

                    {selectedProgrammes.length ===
                      programmes.length &&
                    programmes.length > 0
                      ? 'Clear All'
                      : 'Select All'}
                  </button>
                </div>

                {programmes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                    No departments/programmes found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {programmes.map((programme) => {
                      const selected =
                        selectedProgrammes.includes(
                          programme.id
                        );

                      return (
                        <button
                          type="button"
                          key={programme.id}
                          onClick={() =>
                            toggleProgramme(
                              programme.id
                            )
                          }
                          className={`group relative min-h-[92px] rounded-xl border p-4 text-left transition duration-200 ${
                            selected
                              ? 'scale-[1.02] border-blue-500 bg-blue-600 text-white shadow-md'
                              : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p
                                className={`text-xs font-bold uppercase tracking-wide ${
                                  selected
                                    ? 'text-blue-100'
                                    : 'text-blue-600'
                                }`}
                              >
                                {programme.code ||
                                  'Department'}
                              </p>

                              <p className="mt-1 text-sm font-semibold">
                                {programme.name}
                              </p>
                            </div>

                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                                selected
                                  ? 'border-white bg-white text-blue-600'
                                  : 'border-slate-300 bg-slate-50 text-transparent group-hover:border-blue-300'
                              }`}
                            >
                              <FontAwesomeIcon
                                icon={faCheck}
                                className={
                                  selected
                                    ? 'animate-[bounce_0.35s_ease-out]'
                                    : ''
                                }
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* FORMS */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={faLayerGroup}
                        className="text-purple-600"
                      />

                      <h3 className="font-bold text-slate-800">
                        Forms
                      </h3>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      Check Form 1, Form 2, Form 3 or any combination.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={toggleAllForms}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-semibold text-purple-700 transition duration-200 hover:-translate-y-0.5 hover:bg-purple-50 hover:shadow-sm"
                  >
                    <FontAwesomeIcon
                      icon={faCheckCircle}
                    />

                    {selectedForms.length ===
                    FORM_OPTIONS.length
                      ? 'Clear All'
                      : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {FORM_OPTIONS.map((form) => {
                    const selected =
                      selectedForms.includes(form);

                    return (
                      <button
                        type="button"
                        key={form}
                        onClick={() =>
                          toggleForm(form)
                        }
                        className={`group rounded-xl border p-5 transition duration-200 ${
                          selected
                            ? 'scale-[1.02] border-purple-500 bg-purple-600 text-white shadow-md'
                            : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FontAwesomeIcon
                              icon={faGraduationCap}
                              className={
                                selected
                                  ? 'animate-pulse'
                                  : 'text-purple-500'
                              }
                            />

                            <span className="font-bold">
                              {form}
                            </span>
                          </div>

                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                              selected
                                ? 'border-white bg-white text-purple-600'
                                : 'border-slate-300 text-transparent'
                            }`}
                          >
                            <FontAwesomeIcon
                              icon={faCheck}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ASSIGNMENT PREVIEW */}
              {(selectedTeacherName ||
                selectedSubjectName ||
                selectedProgrammeNames.length > 0 ||
                selectedForms.length > 0) && (
                <div className="mt-5 animate-[fadeIn_0.25s_ease-out] rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FontAwesomeIcon
                      icon={faClipboardList}
                      className="text-blue-600"
                    />

                    <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                      Assignment Preview
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    {selectedTeacherName && (
                      <span className="rounded-full bg-blue-600 px-3 py-1.5 font-medium text-white shadow-sm">
                        Teacher: {selectedTeacherName}
                      </span>
                    )}

                    {selectedYearName && (
                      <span className="rounded-full bg-indigo-100 px-3 py-1.5 font-medium text-indigo-700">
                        Year: {selectedYearName}
                      </span>
                    )}

                    {selectedSubjectName && (
                      <span className="rounded-full bg-green-100 px-3 py-1.5 font-medium text-green-700">
                        Subject: {selectedSubjectName}
                      </span>
                    )}

                    {selectedProgrammeNames.map(
                      (name) => (
                        <span
                          key={name}
                          className="rounded-full bg-cyan-100 px-3 py-1.5 font-medium text-cyan-700"
                        >
                          {name}
                        </span>
                      )
                    )}

                    {selectedForms.map((form) => (
                      <span
                        key={form}
                        className="rounded-full bg-purple-100 px-3 py-1.5 font-medium text-purple-700"
                      >
                        {form}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ASSIGN BUTTON */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={saving || loading}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 font-semibold text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  {saving ? (
                    <>
                      <FontAwesomeIcon
                        icon={faSpinner}
                        spin
                      />

                      Assigning Teacher...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        className="transition-transform duration-200 group-hover:scale-110"
                      />

                      Assign Teacher
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* EXISTING ASSIGNMENTS */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-md">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <FontAwesomeIcon
                    icon={faClipboardList}
                  />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Existing Assignments
                  </h2>

                  <p className="text-sm text-slate-500">
                    Manage teacher, department, form and subject assignments.
                  </p>
                </div>
              </div>

              <div className="relative w-full md:w-80">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search assignments..."
                  className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-14 text-slate-500">
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                className="mr-3 text-xl text-indigo-600"
              />

              Loading assignments...
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="m-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
              <FontAwesomeIcon
                icon={faClipboardList}
                className="mb-3 animate-pulse text-3xl text-slate-300"
              />

              <p className="font-semibold text-slate-600">
                No teacher assignments found.
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Create an assignment using the form above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Teacher
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Departments
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Forms
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Subject
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Academic Year
                    </th>

                    <th className="px-4 py-3 text-right font-semibold text-slate-600">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAssignments.map(
                    (assignment) => {
                      const teacher =
                        firstRelation(
                          assignment.teacher
                        );

                      const subject =
                        firstRelation(
                          assignment.subject
                        );

                      const academicYear =
                        firstRelation(
                          assignment.academic_year
                        ) ||
                        (assignment.academic_year_id
                          ? yearMap.get(
                              assignment.academic_year_id
                            ) || null
                          : null);

                      const assignmentProgrammes =
                        assignment.programme_ids
                          .map((id) =>
                            programmeMap.get(id)
                          )
                          .filter(
                            (
                              programme
                            ): programme is Programme =>
                              Boolean(programme)
                          );

                      return (
                        <tr
                          key={assignment.id}
                          className="border-b border-slate-100 transition duration-200 hover:bg-blue-50/40"
                        >
                          {/* TEACHER */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                <FontAwesomeIcon
                                  icon={faUserTie}
                                />
                              </div>

                              <div>
                                <p className="font-semibold text-slate-800">
                                  {teacher?.full_name ||
                                    'Unknown Teacher'}
                                </p>

                                {teacher?.email && (
                                  <p className="text-xs text-slate-500">
                                    {teacher.email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* DEPARTMENTS */}
                          <td className="px-4 py-4">
                            <div className="flex max-w-sm flex-wrap gap-1.5">
                              {assignmentProgrammes.length >
                              0 ? (
                                assignmentProgrammes.map(
                                  (programme) => (
                                    <span
                                      key={
                                        programme.id
                                      }
                                      title={
                                        programme.name
                                      }
                                      className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700"
                                    >
                                      {programme.code ||
                                        programme.name}
                                    </span>
                                  )
                                )
                              ) : (
                                <span className="text-slate-400">
                                  No department
                                </span>
                              )}
                            </div>
                          </td>

                          {/* FORMS */}
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {assignment.forms.length >
                              0 ? (
                                assignment.forms.map(
                                  (form) => (
                                    <span
                                      key={form}
                                      className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700"
                                    >
                                      {form}
                                    </span>
                                  )
                                )
                              ) : (
                                <span className="text-slate-400">
                                  No form
                                </span>
                              )}
                            </div>
                          </td>

                          {/* SUBJECT */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <FontAwesomeIcon
                                icon={faBook}
                                className="text-green-500"
                              />

                              <span className="text-slate-700">
                                {subject?.name ||
                                  'Unknown Subject'}

                                {subject?.code && (
                                  <span className="ml-1 text-xs text-slate-400">
                                    ({subject.code})
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>

                          {/* ACADEMIC YEAR */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <FontAwesomeIcon
                                icon={faGraduationCap}
                                className="text-indigo-500"
                              />

                              <span className="text-slate-700">
                                {academicYear?.name ||
                                  'Unknown Year'}
                              </span>
                            </div>
                          </td>

                          {/* ACTION */}
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  assignment.id
                                )
                              }
                              disabled={
                                deletingId ===
                                assignment.id
                              }
                              className="rounded-lg px-3 py-2 text-red-600 transition duration-200 hover:scale-110 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Remove assignment"
                            >
                              <FontAwesomeIcon
                                icon={
                                  deletingId ===
                                  assignment.id
                                    ? faSpinner
                                    : faTrash
                                }
                                spin={
                                  deletingId ===
                                  assignment.id
                                }
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SUMMARY CARDS */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="group rounded-xl bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <FontAwesomeIcon
                  icon={faChalkboardTeacher}
                  className="transition-transform duration-200 group-hover:scale-110"
                />
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Teachers
                </p>

                <p className="text-xl font-bold text-slate-800">
                  {teachers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="group rounded-xl bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600">
                <FontAwesomeIcon
                  icon={faBuilding}
                  className="transition-transform duration-200 group-hover:scale-110"
                />
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Departments
                </p>

                <p className="text-xl font-bold text-slate-800">
                  {programmes.length}
                </p>
              </div>
            </div>
          </div>

          <div className="group rounded-xl bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <FontAwesomeIcon
                  icon={faBook}
                  className="transition-transform duration-200 group-hover:scale-110"
                />
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Subjects
                </p>

                <p className="text-xl font-bold text-slate-800">
                  {subjects.length}
                </p>
              </div>
            </div>
          </div>

          <div className="group rounded-xl bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <FontAwesomeIcon
                  icon={faUsers}
                  className="transition-transform duration-200 group-hover:scale-110"
                />
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Assignments
                </p>

                <p className="text-xl font-bold text-slate-800">
                  {assignments.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* INFORMATION */}
        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          <div className="flex items-start gap-3">
            <FontAwesomeIcon
              icon={faGraduationCap}
              className="mt-0.5 text-blue-600"
            />

            <div>
              <p className="font-semibold">
                Assignment-based teacher access
              </p>

              <p className="mt-1 text-blue-700">
                Each assignment links a teacher to an academic
                year, subject, selected departments and selected
                forms. These assignments can be used by the
                teacher portal to determine which students and
                academic records belong to that teacher.
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}

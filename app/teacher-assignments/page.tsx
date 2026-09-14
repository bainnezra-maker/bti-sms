'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  faChalkboardTeacher,
  faCheckCircle,
  faClipboardList,
  faGraduationCap,
  faSearch,
  faSpinner,
  faTrash,
  faUserTie,
  faBook,
  faCalendarAlt,
  faSchool,
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
  programme_id: string | null;
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

function firstRelation<T>(
  relation: T | T[] | null | undefined
): T | null {
  if (!relation) return null;

  if (Array.isArray(relation)) {
    return relation[0] || null;
  }

  return relation;
}

export default function TeacherAssignmentsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(
    []
  );
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const [search, setSearch] = useState('');

  async function getSchoolId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
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

  async function loadData() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const schoolId = await getSchoolId();

      const [
        teachersResult,
        yearsResult,
        classesResult,
        subjectsResult,
      ] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, email')
          .eq('school_id', schoolId)
          .eq('role', 'teacher')
          .eq('is_active', true)
          .order('full_name'),

        supabase
          .from('academic_years')
          .select('id, name, is_current')
          .eq('school_id', schoolId)
          .order('name', { ascending: false }),

        supabase
          .from('classes')
          .select(
            'id, name, level, academic_year_id, programme_id'
          )
          .eq('school_id', schoolId)
          .order('name'),

        supabase
          .from('subjects')
          .select('id, name, code')
          .eq('school_id', schoolId)
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

      if (classesResult.error) {
        throw new Error(
          `Unable to load classes: ${classesResult.error.message}`
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

      const loadedClasses =
        (classesResult.data || []) as ClassRecord[];

      const loadedSubjects =
        (subjectsResult.data || []) as Subject[];

      setTeachers(loadedTeachers);
      setAcademicYears(loadedYears);
      setClasses(loadedClasses);
      setSubjects(loadedSubjects);

      const currentYear =
        loadedYears.find(
          (year) => year.is_current === true
        ) || loadedYears[0];

      if (currentYear) {
        setSelectedYear(currentYear.id);
      }

      /*
       * IMPORTANT:
       * Terms belong to academic years.
       * They do NOT have school_id.
       */
      if (loadedYears.length > 0) {
        const yearIds = loadedYears.map(
          (year) => year.id
        );

        const {
          data: termsData,
          error: termsError,
        } = await supabase
          .from('terms')
          .select(
            'id, name, academic_year_id, is_current'
          )
          .in('academic_year_id', yearIds)
          .order('start_date', {
            ascending: true,
          });

        if (termsError) {
          throw new Error(
            `Unable to load semesters: ${termsError.message}`
          );
        }

        const loadedTerms =
          (termsData || []) as Term[];

        setTerms(loadedTerms);

        if (currentYear) {
          const currentTerm =
            loadedTerms.find(
              (term) =>
                term.academic_year_id ===
                  currentYear.id &&
                term.is_current === true
            ) ||
            loadedTerms.find(
              (term) =>
                term.academic_year_id ===
                currentYear.id
            );

          if (currentTerm) {
            setSelectedTerm(currentTerm.id);
          }
        }
      } else {
        setTerms([]);
      }

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

  async function loadAssignments() {
    const { data, error: assignmentError } =
      await supabase
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
            academic_year_id,
            programme_id
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

    if (assignmentError) {
      throw new Error(
        `Unable to load teacher assignments: ${assignmentError.message}`
      );
    }

    setAssignments(
      (data || []) as unknown as Assignment[]
    );
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredTerms = useMemo(() => {
    if (!selectedYear) return [];

    return terms.filter(
      (term) =>
        term.academic_year_id === selectedYear
    );
  }, [terms, selectedYear]);

  const filteredClasses = useMemo(() => {
    if (!selectedYear) return [];

    return classes.filter(
      (item) =>
        item.academic_year_id === selectedYear
    );
  }, [classes, selectedYear]);

  useEffect(() => {
    if (!selectedYear) {
      setSelectedClass('');
      setSelectedTerm('');
      return;
    }

    const classStillValid = classes.some(
      (item) =>
        item.id === selectedClass &&
        item.academic_year_id === selectedYear
    );

    if (selectedClass && !classStillValid) {
      setSelectedClass('');
    }

    const termStillValid = terms.some(
      (term) =>
        term.id === selectedTerm &&
        term.academic_year_id === selectedYear
    );

    if (selectedTerm && !termStillValid) {
      const currentTerm =
        filteredTerms.find(
          (term) => term.is_current === true
        ) || filteredTerms[0];

      setSelectedTerm(
        currentTerm?.id || ''
      );
    }

    if (!selectedTerm && filteredTerms.length > 0) {
      const currentTerm =
        filteredTerms.find(
          (term) => term.is_current === true
        ) || filteredTerms[0];

      setSelectedTerm(currentTerm.id);
    }
  }, [
    selectedYear,
    classes,
    selectedClass,
    terms,
    selectedTerm,
    filteredTerms,
  ]);

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return assignments;

    return assignments.filter((assignment) => {
      const teacher = firstRelation(
        assignment.teacher
      );

      const classRecord = firstRelation(
        assignment.class
      );

      const subject = firstRelation(
        assignment.subject
      );

      const term = firstRelation(
        assignment.term
      );

      const teacherName =
        teacher?.full_name?.toLowerCase() || '';

      const teacherEmail =
        teacher?.email?.toLowerCase() || '';

      const className =
        classRecord?.name?.toLowerCase() || '';

      const subjectName =
        subject?.name?.toLowerCase() || '';

      const subjectCode =
        subject?.code?.toLowerCase() || '';

      const termName =
        term?.name?.toLowerCase() || '';

      return (
        teacherName.includes(query) ||
        teacherEmail.includes(query) ||
        className.includes(query) ||
        subjectName.includes(query) ||
        subjectCode.includes(query) ||
        termName.includes(query)
      );
    });
  }, [assignments, search]);

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

    if (!selectedTerm) {
      setError('Please select a semester.');
      return;
    }

    if (!selectedClass) {
      setError('Please select a class.');
      return;
    }

    if (!selectedSubject) {
      setError('Please select a subject.');
      return;
    }

    setSaving(true);

    try {
      const duplicate = assignments.some(
        (assignment) =>
          assignment.teacher_id === selectedTeacher &&
          assignment.class_id === selectedClass &&
          assignment.subject_id === selectedSubject &&
          assignment.term_id === selectedTerm
      );

      if (duplicate) {
        throw new Error(
          'This teacher is already assigned to this class and subject for the selected semester.'
        );
      }

      /*
       * IMPORTANT:
       * teacher_assignments uses these four fields.
       */
      const { error: insertError } =
        await supabase
          .from('teacher_assignments')
          .insert({
            teacher_id: selectedTeacher,
            class_id: selectedClass,
            subject_id: selectedSubject,
            term_id: selectedTerm,
          });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setMessage(
        'Teacher assignment created successfully.'
      );

      await loadAssignments();

      setSelectedSubject('');
      setSelectedClass('');
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
    }
  }

  const selectedTeacherName =
    teachers.find(
      (teacher) =>
        teacher.id === selectedTeacher
    )?.full_name || '';

  const selectedClassName =
    classes.find(
      (item) => item.id === selectedClass
    )?.name || '';

  const selectedSubjectName =
    subjects.find(
      (subject) =>
        subject.id === selectedSubject
    )?.name || '';

  const selectedTermName =
    terms.find(
      (term) => term.id === selectedTerm
    )?.name || '';

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                  <FontAwesomeIcon
                    icon={faChalkboardTeacher}
                    className="text-2xl"
                  />
                </div>

                <div>
                  <h1 className="text-2xl font-bold md:text-3xl">
                    Teacher Assignments
                  </h1>

                  <p className="text-sm text-blue-100">
                    Assign teachers to classes and subjects
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white/10 px-4 py-3 text-sm backdrop-blur">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faClipboardList} />
                <span>
                  {assignments.length} assignment
                  {assignments.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="font-bold">Error:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 shadow-sm">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faCheckCircle} />
              <span>{message}</span>
            </div>
          </div>
        )}

        {/* Assignment Form */}
        <section className="mb-6 rounded-2xl bg-white p-5 shadow-md">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <FontAwesomeIcon icon={faUserTie} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Create Teacher Assignment
              </h2>

              <p className="text-sm text-slate-500">
                Select the teacher, academic year, semester,
                class and subject.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                className="mr-3 text-xl"
              />
              Loading assignment data...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">

              {/* Teacher */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Teacher
                </label>

                <select
                  value={selectedTeacher}
                  onChange={(e) =>
                    setSelectedTeacher(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

              {/* Academic Year */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Academic Year
                </label>

                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(e.target.value);
                    setSelectedTerm('');
                    setSelectedClass('');
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

              {/* Semester */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Semester
                </label>

                <select
                  value={selectedTerm}
                  onChange={(e) =>
                    setSelectedTerm(e.target.value)
                  }
                  disabled={!selectedYear}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  <option value="">
                    {selectedYear
                      ? 'Select semester'
                      : 'Select year first'}
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

              {/* Class */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Class
                </label>

                <select
                  value={selectedClass}
                  onChange={(e) =>
                    setSelectedClass(e.target.value)
                  }
                  disabled={!selectedYear}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  <option value="">
                    {selectedYear
                      ? 'Select class'
                      : 'Select year first'}
                  </option>

                  {filteredClasses.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name}
                      {item.level
                        ? ` — ${item.level}`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Subject
                </label>

                <select
                  value={selectedSubject}
                  onChange={(e) =>
                    setSelectedSubject(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

              {/* Button */}
              <div className="md:col-span-2 lg:col-span-5">
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={saving || loading}
                  className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  {saving ? (
                    <>
                      <FontAwesomeIcon
                        icon={faSpinner}
                        spin
                        className="mr-2"
                      />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        className="mr-2"
                      />
                      Assign Teacher
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Selection preview */}
          {(selectedTeacherName ||
            selectedClassName ||
            selectedSubjectName ||
            selectedTermName) && (
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assignment Preview
              </p>

              <div className="flex flex-wrap gap-2 text-sm">
                {selectedTeacherName && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                    Teacher: {selectedTeacherName}
                  </span>
                )}

                {selectedClassName && (
                  <span className="rounded-full bg-purple-100 px-3 py-1 text-purple-700">
                    Class: {selectedClassName}
                  </span>
                )}

                {selectedSubjectName && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
                    Subject: {selectedSubjectName}
                  </span>
                )}

                {selectedTermName && (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700">
                    Semester: {selectedTermName}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Existing Assignments */}
        <section className="rounded-2xl bg-white p-5 shadow-md">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <FontAwesomeIcon icon={faClipboardList} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Existing Assignments
                  </h2>

                  <p className="text-sm text-slate-500">
                    Manage teacher, class and subject assignments.
                  </p>
                </div>
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
                className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                className="mr-3 text-xl"
              />
              Loading assignments...
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
              <FontAwesomeIcon
                icon={faClipboardList}
                className="mb-3 text-3xl text-slate-300"
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
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Teacher
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Class
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Subject
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Semester
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

                      const classRecord =
                        firstRelation(
                          assignment.class
                        );

                      const subject =
                        firstRelation(
                          assignment.subject
                        );

                      const term =
                        firstRelation(
                          assignment.term
                        );

                      return (
                        <tr
                          key={assignment.id}
                          className="border-b border-slate-100 transition hover:bg-slate-50"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
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

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <FontAwesomeIcon
                                icon={faSchool}
                                className="text-slate-400"
                              />

                              <span className="font-medium text-slate-700">
                                {classRecord?.name ||
                                  'Unknown Class'}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <FontAwesomeIcon
                                icon={faBook}
                                className="text-slate-400"
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

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <FontAwesomeIcon
                                icon={faCalendarAlt}
                                className="text-slate-400"
                              />

                              <span className="text-slate-700">
                                {term?.name ||
                                  'Unknown Semester'}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  assignment.id
                                )
                              }
                              className="rounded-lg px-3 py-2 text-red-600 transition hover:bg-red-50"
                              title="Remove assignment"
                            >
                              <FontAwesomeIcon
                                icon={faTrash}
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

        {/* Footer information */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon
                icon={faChalkboardTeacher}
                className="text-blue-600"
              />

              <div>
                <p className="text-xs text-slate-500">
                  Teachers
                </p>
                <p className="font-bold text-slate-800">
                  {teachers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon
                icon={faGraduationCap}
                className="text-purple-600"
              />

              <div>
                <p className="text-xs text-slate-500">
                  Classes
                </p>
                <p className="font-bold text-slate-800">
                  {classes.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon
                icon={faBook}
                className="text-green-600"
              />

              <div>
                <p className="text-xs text-slate-500">
                  Subjects
                </p>
                <p className="font-bold text-slate-800">
                  {subjects.length}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}

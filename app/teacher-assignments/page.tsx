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
};

type Term = {
  id: string;
  name: string;
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

  /*
   * Supabase may return relationship records as either
   * an object or an array depending on the generated type.
   */
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
  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>(
    []
  );

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

    try {
      const schoolId = await getSchoolId();

      const [
        teachersResult,
        yearsResult,
        termsResult,
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
          .select('id, name')
          .eq('school_id', schoolId)
          .order('name', { ascending: false }),

        supabase
          .from('terms')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('name'),

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

      if (termsResult.error) {
        throw new Error(
          `Unable to load semesters: ${termsResult.error.message}`
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

      setTeachers(
        (teachersResult.data || []) as Teacher[]
      );

      setAcademicYears(
        (yearsResult.data || []) as AcademicYear[]
      );

      setTerms((termsResult.data || []) as Term[]);

      setClasses(
        (classesResult.data || []) as ClassRecord[]
      );

      setSubjects(
        (subjectsResult.data || []) as Subject[]
      );

      await loadAssignments(schoolId);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to load teacher assignments.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignments(schoolId: string) {
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
            name
          )
        `)
        .eq('school_id', schoolId)
        .order('id', { ascending: false });

    if (assignmentError) {
      /*
       * Fallback for databases where teacher_assignments
       * does not contain school_id directly.
       */
      const fallback = await supabase
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
            name
          )
        `)
        .order('id', { ascending: false });

      if (fallback.error) {
        throw new Error(
          `Unable to load teacher assignments: ${fallback.error.message}`
        );
      }

      /*
       * unknown is intentional here.
       *
       * Supabase returns nested relationships as arrays
       * in the generated response type, while our UI
       * accepts either a single object or an array.
       */
      setAssignments(
        (fallback.data || []) as unknown as Assignment[]
      );

      return;
    }

    setAssignments(
      (data || []) as unknown as Assignment[]
    );
  }

  useEffect(() => {
    loadData();
  }, []);

  /*
   * When the academic year changes, make sure the
   * selected class belongs to that academic year.
   */
  useEffect(() => {
    if (!selectedYear) return;

    const classStillValid = classes.some(
      (item) =>
        item.id === selectedClass &&
        item.academic_year_id === selectedYear
    );

    if (selectedClass && !classStillValid) {
      setSelectedClass('');
    }
  }, [selectedYear, classes, selectedClass]);

  const filteredClasses = useMemo(() => {
    if (!selectedYear) return [];

    return classes.filter(
      (item) => item.academic_year_id === selectedYear
    );
  }, [classes, selectedYear]);

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

  async function handleAssign(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setMessage('');
    setError('');

    if (
      !selectedTeacher ||
      !selectedYear ||
      !selectedTerm ||
      !selectedClass ||
      !selectedSubject
    ) {
      setError(
        'Please select the teacher, academic year, semester, class and subject.'
      );
      return;
    }

    const selectedClassRecord = classes.find(
      (item) => item.id === selectedClass
    );

    if (
      selectedClassRecord?.academic_year_id &&
      selectedClassRecord.academic_year_id !== selectedYear
    ) {
      setError(
        'The selected class belongs to a different academic year.'
      );
      return;
    }

    setSaving(true);

    try {
      /*
       * Prevent duplicate assignments.
       */
      const {
        data: existing,
        error: existingError,
      } = await supabase
        .from('teacher_assignments')
        .select('id')
        .eq('teacher_id', selectedTeacher)
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('term_id', selectedTerm)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      if (existing) {
        throw new Error(
          'This teacher is already assigned to this class and subject for the selected semester.'
        );
      }

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
        'Teacher assignment saved successfully.'
      );

      setSelectedClass('');
      setSelectedSubject('');

      const schoolId = await getSchoolId();

      await loadAssignments(schoolId);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to save teacher assignment.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(
    assignmentId: string
  ) {
    const confirmed = window.confirm(
      'Remove this teacher assignment?'
    );

    if (!confirmed) return;

    setMessage('');
    setError('');

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
        'Teacher assignment removed.'
      );

      const schoolId = await getSchoolId();

      await loadAssignments(schoolId);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to remove teacher assignment.'
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <i className="fa-solid fa-spinner fa-spin mb-3 text-2xl text-blue-600" />

            <p className="text-sm font-medium text-gray-600">
              Loading teacher assignments...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <i className="fa-solid fa-user-check text-lg" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Teacher Assignments
                </h1>

                <p className="mt-1 text-sm text-gray-600">
                  Assign teachers to classes and subjects for each semester.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <i className="fa-solid fa-circle-exclamation mt-0.5" />

            <div>
              <p className="font-semibold">
                Something went wrong
              </p>

              <p className="mt-1">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {message && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <i className="fa-solid fa-circle-check mt-0.5 animate-pulse" />

            <div>
              <p className="font-semibold">
                Success
              </p>

              <p className="mt-1">
                {message}
              </p>
            </div>
          </div>
        )}

        {/* ASSIGNMENT FORM */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <i className="fa-solid fa-user-plus" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Assign Teacher
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Select the teacher, academic year, semester, class and subject.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleAssign}
            className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 lg:grid-cols-3"
          >

            {/* TEACHER */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                <i className="fa-solid fa-user mr-2 text-blue-500" />
                Teacher
              </label>

              <select
                value={selectedTeacher}
                onChange={(e) =>
                  setSelectedTeacher(e.target.value)
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                      'Teacher'}
                  </option>
                ))}
              </select>
            </div>

            {/* ACADEMIC YEAR */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                <i className="fa-solid fa-calendar-days mr-2 text-blue-500" />
                Academic Year
              </label>

              <select
                value={selectedYear}
                onChange={(e) =>
                  setSelectedYear(e.target.value)
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

            {/* SEMESTER */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                <i className="fa-solid fa-layer-group mr-2 text-blue-500" />
                Semester
              </label>

              <select
                value={selectedTerm}
                onChange={(e) =>
                  setSelectedTerm(e.target.value)
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select semester
                </option>

                {terms.map((term) => (
                  <option
                    key={term.id}
                    value={term.id}
                  >
                    {term.name}
                  </option>
                ))}
              </select>
            </div>

            {/* CLASS */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                <i className="fa-solid fa-school mr-2 text-blue-500" />
                Class
              </label>

              <select
                value={selectedClass}
                onChange={(e) =>
                  setSelectedClass(e.target.value)
                }
                disabled={!selectedYear}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                <option value="">
                  {selectedYear
                    ? 'Select class'
                    : 'Select academic year first'}
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

            {/* SUBJECT */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                <i className="fa-solid fa-book-open mr-2 text-blue-500" />
                Subject
              </label>

              <select
                value={selectedSubject}
                onChange={(e) =>
                  setSelectedSubject(e.target.value)
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

            {/* ASSIGN BUTTON */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <i
                  className={`fa-solid ${
                    saving
                      ? 'fa-spinner fa-spin'
                      : 'fa-user-check group-hover:animate-pulse'
                  }`}
                />

                {saving
                  ? 'Assigning...'
                  : 'Assign Teacher'}
              </button>
            </div>
          </form>
        </section>

        {/* HOW IT WORKS */}
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <i className="fa-solid fa-circle-info" />
            </div>

            <div>
              <h2 className="font-semibold text-blue-900">
                How teacher assignment works
              </h2>

              <div className="mt-3 grid gap-2 text-sm text-blue-800 md:grid-cols-2">
                <p>
                  <i className="fa-solid fa-1 mr-2" />
                  Select the teacher.
                </p>

                <p>
                  <i className="fa-solid fa-2 mr-2" />
                  Select the academic year.
                </p>

                <p>
                  <i className="fa-solid fa-3 mr-2" />
                  Select the semester.
                </p>

                <p>
                  <i className="fa-solid fa-4 mr-2" />
                  Select the class.
                </p>

                <p>
                  <i className="fa-solid fa-5 mr-2" />
                  Select the subject.
                </p>

                <p>
                  <i className="fa-solid fa-6 mr-2" />
                  Tap Assign Teacher.
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-medium text-blue-900">
                <i className="fa-solid fa-arrow-right animate-pulse" />

                <span>
                  The teacher will see the assigned class under
                  Teacher Portal → Classes.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CURRENT ASSIGNMENTS */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
                <i className="fa-solid fa-list-check" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Current Teacher Assignments
                </h2>

                <p className="text-sm text-gray-500">
                  {assignments.length}{' '}
                  assignment
                  {assignments.length === 1
                    ? ''
                    : 's'}
                </p>
              </div>
            </div>

            <div className="relative w-full md:w-80">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

              <input
                type="search"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search teacher, class or subject..."
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <i className="fa-solid fa-user-slash text-xl" />
              </div>

              <p className="mt-4 font-semibold text-gray-700">
                No teacher assignments found.
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Use the form above to assign a teacher to a
                class and subject.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Teacher
                    </th>

                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Class
                    </th>

                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Subject
                    </th>

                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Semester
                    </th>

                    <th className="px-4 py-3 text-right font-semibold text-gray-700">
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
                          className="border-b last:border-0 hover:bg-gray-50"
                        >
                          {/* TEACHER */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                <i className="fa-solid fa-user" />
                              </div>

                              <div>
                                <div className="font-medium text-gray-900">
                                  {teacher?.full_name ||
                                    teacher?.email ||
                                    'Unknown teacher'}
                                </div>

                                {teacher?.email && (
                                  <div className="text-xs text-gray-500">
                                    {teacher.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* CLASS */}
                          <td className="px-4 py-3 text-gray-700">
                            <div className="flex items-center gap-2">
                              <i className="fa-solid fa-school text-gray-400" />

                              <div>
                                <div className="font-medium">
                                  {classRecord?.name ||
                                    'Unknown class'}
                                </div>

                                {classRecord?.level && (
                                  <div className="text-xs text-gray-500">
                                    {classRecord.level}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* SUBJECT */}
                          <td className="px-4 py-3 text-gray-700">
                            <div className="flex items-center gap-2">
                              <i className="fa-solid fa-book-open text-gray-400" />

                              <div>
                                <div className="font-medium">
                                  {subject?.name ||
                                    'Unknown subject'}
                                </div>

                                {subject?.code && (
                                  <div className="text-xs text-gray-500">
                                    {subject.code}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* SEMESTER */}
                          <td className="px-4 py-3 text-gray-700">
                            <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                              <i className="fa-solid fa-layer-group" />

                              {term?.name ||
                                'Unknown semester'}
                            </span>
                          </td>

                          {/* REMOVE */}
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleRemove(
                                  assignment.id
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              <i className="fa-solid fa-trash-can" />

                              Remove
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
      </div>
    </main>
  );
}

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
  teacher?: Teacher | null;
  class?: ClassRecord | null;
  subject?: Subject | null;
  term?: Term | null;
};

export default function TeacherAssignmentsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
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

  /*
   * Load the administrator's school first.
   * All teacher/class/academic data is restricted to this school.
   */
  async function getSchoolId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('You are not logged in.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, school_id, role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (profile?.role !== 'admin') {
      throw new Error('Only administrators can manage teacher assignments.');
    }

    if (!profile.school_id) {
      throw new Error('Your account is not linked to a school.');
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

      setTeachers((teachersResult.data || []) as Teacher[]);
      setAcademicYears((yearsResult.data || []) as AcademicYear[]);
      setTerms((termsResult.data || []) as Term[]);
      setClasses((classesResult.data || []) as ClassRecord[]);
      setSubjects((subjectsResult.data || []) as Subject[]);

      await loadAssignments(schoolId);
    } catch (err: any) {
      setError(err?.message || 'Unable to load teacher assignments.');
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignments(schoolId: string) {
    const { data, error: assignmentError } = await supabase
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
       * Some existing databases may not have school_id directly
       * on teacher_assignments. If that is the case, fall back to
       * loading the assignments without the school filter.
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

      setAssignments((fallback.data || []) as Assignment[]);
      return;
    }

    setAssignments((data || []) as Assignment[]);
  }

  useEffect(() => {
    loadData();
  }, []);

  /*
   * When the academic year changes, automatically clear the class
   * if that class does not belong to the selected academic year.
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
  }, [selectedYear, classes]);

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
      const teacherName =
        assignment.teacher?.full_name?.toLowerCase() || '';

      const className =
        assignment.class?.name?.toLowerCase() || '';

      const subjectName =
        assignment.subject?.name?.toLowerCase() || '';

      const subjectCode =
        assignment.subject?.code?.toLowerCase() || '';

      const termName =
        assignment.term?.name?.toLowerCase() || '';

      return (
        teacherName.includes(query) ||
        className.includes(query) ||
        subjectName.includes(query) ||
        subjectCode.includes(query) ||
        termName.includes(query)
      );
    });
  }, [assignments, search]);

  async function handleAssign(e: React.FormEvent) {
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
       * Check for an existing identical assignment first.
       * This prevents the same teacher/class/subject/semester
       * combination from being created twice.
       */
      const { data: existing, error: existingError } = await supabase
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

      /*
       * Use the existing teacher_assignments structure.
       * The academic year is represented by the selected class.
       */
      const { error: insertError } = await supabase
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

      setMessage('Teacher assignment saved successfully.');

      setSelectedClass('');
      setSelectedSubject('');

      const schoolId = await getSchoolId();
      await loadAssignments(schoolId);
    } catch (err: any) {
      setError(
        err?.message || 'Unable to save teacher assignment.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(assignmentId: string) {
    const confirmed = window.confirm(
      'Remove this teacher assignment?'
    );

    if (!confirmed) return;

    setMessage('');
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('teacher_assignments')
        .delete()
        .eq('id', assignmentId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setMessage('Teacher assignment removed.');

      const schoolId = await getSchoolId();
      await loadAssignments(schoolId);
    } catch (err: any) {
      setError(
        err?.message || 'Unable to remove teacher assignment.'
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">
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
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Teacher Assignments
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Assign teachers to classes and subjects for each
            semester.
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* Assignment form */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Assign Teacher
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Select who teaches which subject in which class.
            </p>
          </div>

          <form
            onSubmit={handleAssign}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {/* Teacher */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Teacher
              </label>

              <select
                value={selectedTeacher}
                onChange={(e) =>
                  setSelectedTeacher(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select teacher</option>

                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name || teacher.email || 'Teacher'}
                  </option>
                ))}
              </select>
            </div>

            {/* Academic Year */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Academic Year
              </label>

              <select
                value={selectedYear}
                onChange={(e) =>
                  setSelectedYear(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select academic year</option>

                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Semester */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Semester
              </label>

              <select
                value={selectedTerm}
                onChange={(e) =>
                  setSelectedTerm(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select semester</option>

                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Class */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Class
              </label>

              <select
                value={selectedClass}
                onChange={(e) =>
                  setSelectedClass(e.target.value)
                }
                disabled={!selectedYear}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none disabled:bg-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  {selectedYear
                    ? 'Select class'
                    : 'Select academic year first'}
                </option>

                {filteredClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.level ? ` — ${item.level}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Subject
              </label>

              <select
                value={selectedSubject}
                onChange={(e) =>
                  setSelectedSubject(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select subject</option>

                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                    {subject.code ? ` (${subject.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Assigning...' : 'Assign Teacher'}
              </button>
            </div>
          </form>
        </section>

        {/* Instructions */}
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">
            How teacher assignment works
          </h2>

          <div className="mt-2 space-y-1 text-sm text-blue-800">
            <p>
              1. Select the teacher.
            </p>
            <p>
              2. Select the academic year.
            </p>
            <p>
              3. Select the semester.
            </p>
            <p>
              4. Select the class.
            </p>
            <p>
              5. Select the subject.
            </p>
            <p>
              6. Tap <strong>Assign Teacher</strong>.
            </p>
          </div>

          <p className="mt-3 text-sm font-medium text-blue-900">
            The teacher will then see the assigned class under
            Teacher Portal → Classes.
          </p>
        </section>

        {/* Current assignments */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Current Teacher Assignments
              </h2>

              <p className="text-sm text-gray-500">
                {assignments.length} assignment
                {assignments.length === 1 ? '' : 's'}
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teacher, class or subject..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:w-80"
            />
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
              <p className="font-medium text-gray-700">
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
                  {filteredAssignments.map((assignment) => (
                    <tr
                      key={assignment.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {assignment.teacher?.full_name ||
                            assignment.teacher?.email ||
                            'Unknown teacher'}
                        </div>

                        {assignment.teacher?.email && (
                          <div className="text-xs text-gray-500">
                            {assignment.teacher.email}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-gray-700">
                        <div className="font-medium">
                          {assignment.class?.name || 'Unknown class'}
                        </div>

                        {assignment.class?.level && (
                          <div className="text-xs text-gray-500">
                            {assignment.class.level}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-gray-700">
                        <div className="font-medium">
                          {assignment.subject?.name ||
                            'Unknown subject'}
                        </div>

                        {assignment.subject?.code && (
                          <div className="text-xs text-gray-500">
                            {assignment.subject.code}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-gray-700">
                        {assignment.term?.name || 'Unknown semester'}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleRemove(assignment.id)
                          }
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

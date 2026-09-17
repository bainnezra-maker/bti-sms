'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  id: string;
  school_id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean | null;
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean | null;
};

type Semester = {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean | null;
};

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
  gender: string | null;
  status: string | null;
};

type Assignment = {
  id: string;
  teacher_id: string;
  academic_year_id: string;
  subject_id: string;
  programme_ids: string[];
  forms: string[];
  class_id: string | null;
  term_id: string | null;
  subject: {
    id: string;
    name: string;
    code: string | null;
  } | null;
};

type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
};

type ClassWorkspace = {
  classId: string;
  className: string;
  level: string | null;
  programmeId: string | null;
  programmeName: string | null;
  academicYearId: string;
  academicYearName: string;
  semesterId: string;
  semesterName: string;
  subjects: {
    id: string;
    name: string;
    code: string | null;
  }[];
  studentCount: number;
  students: Student[];
};

export default function TeacherClassesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);

  const [selectedYearId, setSelectedYearId] = useState('');
  const [search, setSearch] = useState('');

  const [workspaceClasses, setWorkspaceClasses] = useState<
    ClassWorkspace[]
  >([]);

  const [selectedClass, setSelectedClass] =
    useState<ClassWorkspace | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      setError('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: userProfile, error: profileError } =
        await supabase
          .from('users')
          .select(
            'id, school_id, full_name, email, role, is_active'
          )
          .eq('id', user.id)
          .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!userProfile) {
        router.replace('/login');
        return;
      }

      if (userProfile.is_active === false) {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }

      if (userProfile.role === 'admin') {
        router.replace('/');
        return;
      }

      if (userProfile.role === 'Student') {
        router.replace('/student');
        return;
      }

      if (userProfile.role !== 'teacher') {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }

      setProfile(userProfile);

      const [
        { data: yearData, error: yearError },
        { data: semesterData, error: semesterError },
        { data: assignmentData, error: assignmentError },
      ] = await Promise.all([
        supabase
          .from('academic_years')
          .select(
            'id, name, start_date, end_date, is_current'
          )
          .eq('school_id', userProfile.school_id)
          .order('start_date', { ascending: false }),

        supabase
          .from('terms')
          .select(
            `
              id,
              academic_year_id,
              name,
              start_date,
              end_date,
              is_current
            `
          )
          .order('start_date', { ascending: true }),

        supabase
          .from('teacher_assignments')
          .select(
            `
              id,
              teacher_id,
              academic_year_id,
              subject_id,
              programme_ids,
              forms,
              class_id,
              term_id,
              subject:subjects (
                id,
                name,
                code
              )
            `
          )
          .eq('teacher_id', userProfile.id),
      ]);

      if (yearError) throw yearError;
      if (semesterError) throw semesterError;
      if (assignmentError) throw assignmentError;

      const years = (yearData ?? []) as AcademicYear[];
      const semestersData = (semesterData ?? []) as Semester[];

      const assignmentRows = normalizeAssignments(
        assignmentData ?? []
      );

      setAcademicYears(years);

      setSemesters(
        semestersData.filter(
          (semester) =>
            semester.name === 'Semester 1' ||
            semester.name === 'Semester 2'
        )
      );

      setAssignments(assignmentRows);

      const currentYear =
        years.find((year) => year.is_current) ?? years[0];

      if (currentYear) {
        setSelectedYearId(currentYear.id);

        const yearSemesters = semestersData.filter(
          (semester) =>
            semester.academic_year_id === currentYear.id &&
            (semester.name === 'Semester 1' ||
              semester.name === 'Semester 2')
        );

        const currentSemester =
          yearSemesters.find(
            (semester) => semester.is_current
          ) ??
          yearSemesters.find(
            (semester) => semester.name === 'Semester 1'
          ) ??
          yearSemesters[0];

        if (currentSemester) {
          setSelectedSemesterId(currentSemester.id);
        }
      }
    } catch (err: any) {
      console.error('Teacher My Classes error:', err);

      setError(
        err?.message ||
          'Unable to load your classes right now.'
      );
    } finally {
      setLoading(false);
    }
  }

  function normalizeAssignments(rows: any[]): Assignment[] {
    return rows.map((row) => ({
      id: row.id,
      teacher_id: row.teacher_id,
      academic_year_id: row.academic_year_id,
      subject_id: row.subject_id,
      programme_ids: Array.isArray(row.programme_ids)
        ? row.programme_ids.filter(Boolean)
        : [],
      forms: Array.isArray(row.forms) ? row.forms.filter(Boolean) : [],
      class_id: row.class_id ?? null,
      term_id: row.term_id ?? null,
      subject: Array.isArray(row.subject)
        ? row.subject[0] ?? null
        : row.subject ?? null,
    }));
  }


  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return workspaceClasses;
    }

    return workspaceClasses.filter((item) => {
      const subjectText = item.subjects
        .map(
          (subject) =>
            `${subject.name} ${subject.code ?? ''}`
        )
        .join(' ')
        .toLowerCase();

      return (
        item.className.toLowerCase().includes(query) ||
        (item.level ?? '').toLowerCase().includes(query) ||
        (item.programmeName ?? '')
          .toLowerCase()
          .includes(query) ||
        item.academicYearName
          .toLowerCase()
          .includes(query) ||
        item.semesterName.toLowerCase().includes(query) ||
        subjectText.includes(query)
      );
    });
  }, [workspaceClasses, search]);

  const totalStudents = useMemo(() => {
    return workspaceClasses.reduce(
      (total, item) => total + item.studentCount,
      0
    );
  }, [workspaceClasses]);

  const totalSubjects = useMemo(() => {
    return workspaceClasses.reduce(
      (total, item) => total + item.subjects.length,
      0
    );
  }, [workspaceClasses]);

  useEffect(() => {
    if (!profile || !selectedYearId) {
      setWorkspaceClasses([]);
      return;
    }

    loadClassesForSelection();
  }, [
    profile,
    selectedYearId,
    assignments,
  ]);

  async function loadStudentsForEnrollments(
    enrollments: Enrollment[]
  ): Promise<Map<string, Student>> {
    const studentIds = Array.from(
      new Set(
        enrollments
          .map((enrollment) => enrollment.student_id)
          .filter(Boolean)
      )
    );

    if (studentIds.length === 0) {
      return new Map();
    }

    const {
      data: studentRows,
      error: studentError,
    } = await supabase
      .from('students')
      .select(
        `
          id,
          full_name,
          admission_number,
          gender,
          status
        `
      )
      .in('id', studentIds);

    if (studentError) {
      throw studentError;
    }

    return new Map(
      ((studentRows ?? []) as Student[]).map(
        (student) => [student.id, student]
      )
    );
  }

  async function loadClassesForSelection() {
    if (!profile || !selectedYearId) return;

    try {
      setLoadingClasses(true);
      setError('');

      // The assignment itself is now the source of truth:
      // Academic Year + Programme(s) + Form(s) + Subject.
      const relevantAssignments = assignments.filter(
        (assignment) => assignment.academic_year_id === selectedYearId
      );

      if (relevantAssignments.length === 0) {
        setWorkspaceClasses([]);
        setSelectedClass(null);
        return;
      }

      const programmeIds = Array.from(
        new Set(
          relevantAssignments.flatMap((assignment) =>
            assignment.programme_ids ?? []
          )
        )
      );

      const forms = Array.from(
        new Set(
          relevantAssignments.flatMap((assignment) =>
            assignment.forms ?? []
          )
        )
      );

      if (programmeIds.length === 0 || forms.length === 0) {
        setWorkspaceClasses([]);
        setSelectedClass(null);
        return;
      }

      const { data: classRows, error: classError } = await supabase
        .from('classes')
        .select(
          `
            id,
            name,
            level,
            programme_id,
            academic_year_id,
            programmes (
              id,
              name
            )
          `
        )
        .eq('school_id', profile.school_id)
        .eq('academic_year_id', selectedYearId)
        .in('programme_id', programmeIds)
        .in('level', forms)
        .order('name', { ascending: true });

      if (classError) throw classError;

      // Defense in depth: a class must match at least one complete
      // assignment tuple, not merely any selected programme/form.
      const authorizedClassRows = (classRows ?? []).filter((row: any) =>
        relevantAssignments.some(
          (assignment) =>
            assignment.programme_ids.includes(row.programme_id) &&
            assignment.forms.includes(row.level)
        )
      );

      const classIds = authorizedClassRows.map((row: any) => row.id);

      if (classIds.length === 0) {
        setWorkspaceClasses([]);
        setSelectedClass(null);
        return;
      }

      const { data: enrollmentRows, error: enrollmentError } =
        await supabase
          .from('enrollments')
          .select(
            `
              id,
              student_id,
              class_id,
              academic_year_id
            `
          )
          .in('class_id', classIds)
          .eq('academic_year_id', selectedYearId);

      if (enrollmentError) throw enrollmentError;

      const enrollments = (enrollmentRows ?? []) as Enrollment[];
      const studentsById =
        await loadStudentsForEnrollments(enrollments);

      const classMap = new Map<string, ClassWorkspace>();

      authorizedClassRows.forEach((row: any) => {
        const programme = Array.isArray(row.programmes)
          ? row.programmes[0] ?? null
          : row.programmes ?? null;

        const classAssignments = relevantAssignments.filter(
          (assignment) =>
            assignment.programme_ids.includes(row.programme_id) &&
            assignment.forms.includes(row.level)
        );

        const subjectMap = new Map<
          string,
          { id: string; name: string; code: string | null }
        >();

        classAssignments.forEach((assignment) => {
          if (assignment.subject) {
            subjectMap.set(assignment.subject.id, assignment.subject);
          }
        });

        const students = enrollments
          .filter((enrollment) => enrollment.class_id === row.id)
          .map((enrollment) =>
            studentsById.get(enrollment.student_id)
          )
          .filter(
            (student): student is Student => Boolean(student)
          );

        const semester =
          semesters.find(
            (item) =>
              item.academic_year_id === selectedYearId &&
              item.is_current
          ) ??
          semesters.find(
            (item) =>
              item.academic_year_id === selectedYearId &&
              item.name === 'Semester 1'
          ) ??
          semesters.find(
            (item) => item.academic_year_id === selectedYearId
          ) ??
          null;

        classMap.set(row.id, {
          classId: row.id,
          className: row.name,
          level: row.level ?? null,
          programmeId: row.programme_id ?? null,
          programmeName: programme?.name?.trim() ?? null,
          academicYearId: selectedYearId,
          academicYearName:
            academicYears.find(
              (year) => year.id === selectedYearId
            )?.name ?? 'Academic Year',
          // Semester is no longer part of teacher assignment.
          // Keep current semester only for existing assessment links/UI.
          semesterId: semester?.id ?? '',
          semesterName: semester?.name ?? 'Current Semester',
          subjects: Array.from(subjectMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          ),
          studentCount: students.length,
          students,
        });
      });

      const result = Array.from(classMap.values()).sort((a, b) => {
        const programmeCompare =
          (a.programmeName ?? '').localeCompare(
            b.programmeName ?? ''
          );
        return programmeCompare || a.className.localeCompare(b.className);
      });

      setWorkspaceClasses(result);

      if (
        selectedClass &&
        !result.some(
          (item) => item.classId === selectedClass.classId
        )
      ) {
        setSelectedClass(null);
      }
    } catch (err: any) {
      console.error('Loading teacher classes failed:', err);
      setError(
        err?.message || 'Unable to load your assigned classes.'
      );
      setWorkspaceClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }

  async function openClass(item: ClassWorkspace) {
    try {
      setLoadingStudents(true);
      setError('');

      /*
       * Fetch enrollment records first.
       * Do not rely on the nested students relationship.
       */
      const {
        data: enrollmentRows,
        error: enrollmentError,
      } = await supabase
        .from('enrollments')
        .select(
          `
            id,
            student_id,
            class_id,
            academic_year_id
          `
        )
        .eq('class_id', item.classId)
        .eq('academic_year_id', item.academicYearId)
        .order('created_at', {
          ascending: true,
        });

      if (enrollmentError) {
        throw enrollmentError;
      }

      const enrollments =
        (enrollmentRows ?? []) as Enrollment[];

      const studentsById =
        await loadStudentsForEnrollments(enrollments);

      const freshStudents = enrollments
        .map((enrollment) =>
          studentsById.get(enrollment.student_id)
        )
        .filter(
          (student): student is Student =>
            Boolean(student)
        );

      setSelectedClass({
        ...item,
        students: freshStudents,
        studentCount: freshStudents.length,
      });
    } catch (err: any) {
      console.error('Open class error:', err);

      /*
       * Keep the class visible even if the refresh fails.
       * The existing roster remains available.
       */
      setSelectedClass(item);

      setError(
        err?.message ||
          'Unable to refresh the student roster.'
      );
    } finally {
      setLoadingStudents(false);
    }
  }

  function closeClass() {
    setSelectedClass(null);
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase()
      )
      .join('');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <style jsx global>{`
          @keyframes btiClassesPulse {
            0%,
            100% {
              opacity: 0.45;
            }

            50% {
              opacity: 1;
            }
          }
        `}</style>

        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[70vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <i
                  className="fa-solid fa-chalkboard-user text-2xl"
                  style={{
                    animation:
                      'btiClassesPulse 1.5s ease-in-out infinite',
                  }}
                />
              </div>

              <p className="text-sm font-semibold text-slate-600">
                Loading your classes...
              </p>

              <div className="mx-auto mt-4 h-1.5 w-32 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full w-1/2 rounded-full bg-blue-600"
                  style={{
                    animation:
                      'btiClassesPulse 1.2s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <style jsx global>{`
        @keyframes btiClassesFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes btiClassesScale {
          from {
            opacity: 0;
            transform: scale(0.96);
          }

          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes btiClassesFloat {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-5px);
          }
        }

        @keyframes btiClassesPulse {
          0%,
          100% {
            opacity: 1;
          }

          50% {
            opacity: 0.55;
          }
        }

        .bti-class-card {
          animation: btiClassesFadeUp 0.55s ease both;
        }

        .bti-class-card:nth-child(2) {
          animation-delay: 0.06s;
        }

        .bti-class-card:nth-child(3) {
          animation-delay: 0.12s;
        }

        .bti-class-card:nth-child(4) {
          animation-delay: 0.18s;
        }

        .bti-class-card:nth-child(5) {
          animation-delay: 0.24s;
        }

        .bti-class-card:nth-child(6) {
          animation-delay: 0.3s;
        }

        @media (prefers-reduced-motion: reduce) {
          .bti-class-card {
            animation: none !important;
          }

          * {
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur">
                <i className="fa-solid fa-chalkboard-user" />
                Teacher Workspace
              </div>

              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                My Classes
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                Manage the classes assigned to you and quickly
                access attendance, assessments, results and
                student rosters.
              </p>

              <p className="mt-3 text-sm font-semibold text-white/90">
                Welcome, {profile?.full_name || 'Teacher'}
              </p>
            </div>

            <div
              className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/10 text-white/90 shadow-inner lg:flex"
              style={{
                animation:
                  'btiClassesFloat 4s ease-in-out infinite',
              }}
            >
              <i className="fa-solid fa-school text-4xl" />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
            <div className="flex items-start gap-3">
              <i className="fa-solid fa-circle-exclamation mt-0.5" />

              <div className="flex-1">
                <p className="font-bold">
                  Something went wrong
                </p>

                <p className="mt-1 text-sm">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  loadPage();
                }}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-700 shadow-sm ring-1 ring-red-200 transition hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Academic Year
              </label>

              <div className="relative">
                <i className="fa-solid fa-calendar-days pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                <select
                  value={selectedYearId}
                  onChange={(event) =>
                    setSelectedYearId(event.target.value)
                  }
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  {academicYears.length === 0 && (
                    <option value="">
                      No academic years found
                    </option>
                  )}

                  {academicYears.map((year) => (
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
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Search Classes
              </label>

              <div className="relative">
                <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Class, level or subject..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <i className="fa-solid fa-chalkboard" />
            </div>

            <p className="text-2xl font-black text-slate-900">
              {workspaceClasses.length}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              Assigned Classes
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <i className="fa-solid fa-users" />
            </div>

            <p className="text-2xl font-black text-slate-900">
              {totalStudents}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              Students
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <i className="fa-solid fa-book-open" />
            </div>

            <p className="text-2xl font-black text-slate-900">
              {totalSubjects}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              Subject Assignments
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <i className="fa-solid fa-calendar-check" />
            </div>

            <p className="text-2xl font-black text-slate-900">
              {selectedSemesterId
                ? semesters
                    .find(
                      (semester) =>
                        semester.id ===
                        selectedSemesterId
                    )
                    ?.name.replace(
                      'Semester ',
                      'S'
                    ) || '—'
                : '—'}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              Active Semester
            </p>
          </div>
        </div>

        {/* Classes */}
        {loadingClasses ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <i className="fa-solid fa-spinner fa-spin text-xl" />
            </div>

            <p className="font-bold text-slate-800">
              Loading your classes...
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Preparing your teacher workspace.
            </p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm sm:p-14">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <i className="fa-solid fa-chalkboard-user text-2xl" />
            </div>

            <h2 className="text-lg font-black text-slate-800">
              No assigned classes found
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              There are no classes assigned to you for the
              selected academic year. If this
              looks incorrect, please contact the
              administrator.
            </p>

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredClasses.map((item) => (
              <div
                key={`${item.classId}-${item.semesterId}`}
                className="bti-class-card group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/10"
              >
                <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-5 text-white">
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />

                  <div className="absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-white/5" />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-xl backdrop-blur">
                        <i className="fa-solid fa-chalkboard" />
                      </div>

                      <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold backdrop-blur">
                        {item.semesterName}
                      </span>
                    </div>

                    <h2 className="mt-5 text-xl font-black tracking-tight">
                      {item.className}
                    </h2>

                    <p className="mt-1 text-sm font-medium text-blue-100">
                      {item.level || 'Class'}
                      {item.programmeName
                        ? ` • ${item.programmeName}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center gap-2 text-slate-500">
                        <i className="fa-solid fa-users text-xs" />

                        <span className="text-[11px] font-bold uppercase tracking-wide">
                          Students
                        </span>
                      </div>

                      <p className="mt-1 text-xl font-black text-slate-900">
                        {item.studentCount}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center gap-2 text-slate-500">
                        <i className="fa-solid fa-book-open text-xs" />

                        <span className="text-[11px] font-bold uppercase tracking-wide">
                          Subjects
                        </span>
                      </div>

                      <p className="mt-1 text-xl font-black text-slate-900">
                        {item.subjects.length}
                      </p>
                    </div>
                  </div>

                  <div className="mb-5">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Your Subjects
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {item.subjects.length === 0 ? (
                        <span className="text-sm text-slate-500">
                          No subjects found.
                        </span>
                      ) : (
                        item.subjects.map(
                          (subject) => (
                            <span
                              key={subject.id}
                              className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700"
                            >
                              {subject.name}
                            </span>
                          )
                        )
                      )}
                    </div>
                  </div>

                  <div className="mb-5 flex items-center gap-2 text-xs text-slate-500">
                    <i className="fa-solid fa-calendar-days text-blue-500" />

                    <span>
                      {item.academicYearName}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openClass(item)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:bg-blue-700"
                  >
                    <i className="fa-solid fa-arrow-right" />
                    Open Class
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected class workspace */}
        {selectedClass && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
            <div
              className="max-h-[94vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-6xl sm:rounded-3xl"
              style={{
                animation:
                  'btiClassesScale 0.25s ease both',
              }}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-5 text-white sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold">
                        {selectedClass.semesterName}
                      </span>

                      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold">
                        {selectedClass.academicYearName}
                      </span>
                    </div>

                    <h2 className="truncate text-xl font-black sm:text-2xl">
                      {selectedClass.className}
                    </h2>

                    <p className="mt-1 text-sm text-blue-100">
                      {selectedClass.level || 'Class'}
                      {selectedClass.programmeName
                        ? ` • ${selectedClass.programmeName}`
                        : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeClass}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Close"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(94vh-112px)] overflow-y-auto p-4 sm:p-6">
                {/* Quick Actions */}
                <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Link
                    href={`/attendance?classId=${selectedClass.classId}&academicYearId=${selectedClass.academicYearId}`}
                    className="group rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:-translate-y-0.5 hover:bg-emerald-100"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
                      <i className="fa-solid fa-clipboard-check" />
                    </div>

                    <p className="font-black text-emerald-900">
                      Take Attendance
                    </p>

                    <p className="mt-1 text-xs text-emerald-700">
                      Record today's attendance.
                    </p>
                  </Link>

                  <Link
                    href={`/assessment?classId=${selectedClass.classId}&academicYearId=${selectedClass.academicYearId}${selectedClass.semesterId ? `&termId=${selectedClass.semesterId}` : ''}`}
                    className="group rounded-2xl border border-violet-200 bg-violet-50 p-4 transition hover:-translate-y-0.5 hover:bg-violet-100"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/20">
                      <i className="fa-solid fa-pen-to-square" />
                    </div>

                    <p className="font-black text-violet-900">
                      Enter Assessment
                    </p>

                    <p className="mt-1 text-xs text-violet-700">
                      Record student scores.
                    </p>
                  </Link>

                  <Link
                    href={`/results?classId=${selectedClass.classId}&academicYearId=${selectedClass.academicYearId}`}
                    className="group rounded-2xl border border-blue-200 bg-blue-50 p-4 transition hover:-translate-y-0.5 hover:bg-blue-100"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                      <i className="fa-solid fa-chart-column" />
                    </div>

                    <p className="font-black text-blue-900">
                      View Results
                    </p>

                    <p className="mt-1 text-xs text-blue-700">
                      Review class performance.
                    </p>
                  </Link>

                  <Link
                    href={`/attendance-reports?classId=${selectedClass.classId}&academicYearId=${selectedClass.academicYearId}${selectedClass.semesterId ? `&termId=${selectedClass.semesterId}` : ''}`}
                    className="group rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:-translate-y-0.5 hover:bg-amber-100"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white shadow-lg shadow-amber-600/20">
                      <i className="fa-solid fa-file-lines" />
                    </div>

                    <p className="font-black text-amber-900">
                      Attendance Report
                    </p>

                    <p className="mt-1 text-xs text-amber-700">
                      Review attendance records.
                    </p>
                  </Link>
                </div>

                {/* Subjects */}
                <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-900">
                        Subjects You Teach
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Your assignments for this class and
                        semester.
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
                      {selectedClass.subjects.length}
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedClass.subjects.map(
                      (subject) => (
                        <div
                          key={subject.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <i className="fa-solid fa-book" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {subject.name}
                            </p>

                            {subject.code && (
                              <p className="text-[11px] font-semibold text-slate-400">
                                {subject.code}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Student Roster */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-black text-slate-900">
                          Student Roster
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Students currently enrolled in this
                          class.
                        </p>
                      </div>

                      <span className="w-fit rounded-full bg-slate-900 px-3 py-1.5 text-xs font-black text-white">
                        {selectedClass.studentCount}{' '}
                        Students
                      </span>
                    </div>
                  </div>

                  {loadingStudents ? (
                    <div className="p-10 text-center">
                      <i className="fa-solid fa-spinner fa-spin text-xl text-blue-600" />

                      <p className="mt-3 text-sm font-semibold text-slate-500">
                        Loading roster...
                      </p>
                    </div>
                  ) : selectedClass.students.length ===
                    0 ? (
                    <div className="p-10 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        <i className="fa-solid fa-user-group" />
                      </div>

                      <p className="font-bold text-slate-700">
                        No students enrolled
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        There are currently no students in
                        this class.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-slate-200 bg-white">
                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">
                              #
                            </th>

                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">
                              Student
                            </th>

                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">
                              Admission Number
                            </th>

                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">
                              Gender
                            </th>

                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">
                              Status
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {selectedClass.students.map(
                            (student, index) => (
                              <tr
                                key={student.id}
                                className="border-b border-slate-100 transition hover:bg-blue-50/40"
                              >
                                <td className="px-4 py-3 text-sm font-bold text-slate-400">
                                  {index + 1}
                                </td>

                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-black text-white">
                                      {getInitials(
                                        student.full_name
                                      )}
                                    </div>

                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-bold text-slate-800">
                                        {student.full_name}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-sm font-semibold text-slate-600">
                                  {student.admission_number ||
                                    '—'}
                                </td>

                                <td className="px-4 py-3 text-sm font-medium text-slate-500">
                                  {student.gender || '—'}
                                </td>

                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${
                                      student.status ===
                                      'active'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {student.status ||
                                      'Unknown'}
                                  </span>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-5 text-center text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>
            BTI School Management System • Teacher Portal
          </p>

          <p className="font-semibold">
            <i className="fa-solid fa-shield-halved mr-1" />
            Your classes are based on your teacher
            assignments.
          </p>
        </div>
      </div>

      <script
        src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/js/all.min.js"
        crossOrigin="anonymous"
      />
    </div>
  );
}

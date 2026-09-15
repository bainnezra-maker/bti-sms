'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown,
  faArrowRight,
  faBookOpen,
  faGraduationCap,
  faLayerGroup,
  faMagnifyingGlass,
  faPenToSquare,
  faPlus,
  faTrash,
  faUserGraduate,
  faUsers,
  faUserShield,
  faBuildingColumns,
  faSchool,
  faChevronDown,
  faChevronRight,
  faCircleCheck,
  faFileArrowDown,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  admission_number: string;
  full_name: string;
  gender: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  admission_date: string;
  jhs_aggregate: number | null;
  status: string;
};

type Programme = {
  id: string;
  name: string;
};

type SchoolClass = {
  id: string;
  name: string;
  programme_id: string | null;
  level: string | null;
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
};

type Enrollment = {
  student_id: string;
  class_id: string;
  academic_year_id: string;
  programme_id: string | null;
  status: string | null;
};

type StudentAcademicInfo = {
  classId: string;
  className: string;
  programmeId: string | null;
  programmeName: string;
  academicYearName: string;
  formName: string;
};

type ClassGroup = {
  classId: string;
  className: string;
  students: Student[];
};

type ProgrammeGroup = {
  programmeId: string;
  programmeName: string;
  classes: ClassGroup[];
  students: Student[];
};

type FormGroup = {
  formName: string;
  programmes: ProgrammeGroup[];
  students: Student[];
};

export default function StudentsPage() {
  const supabase = createClient();

  const [students, setStudents] = useState<Student[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [search, setSearch] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [openForms, setOpenForms] = useState<string[]>([]);
  const [openProgrammes, setOpenProgrammes] = useState<string[]>([]);
  const [openClasses, setOpenClasses] = useState<string[]>([]);

  async function loadStudents() {
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      setError('School profile could not be found.');
      setLoading(false);
      return;
    }

    const schoolId = profile.school_id;

    const [
      studentsResult,
      programmesResult,
      classesResult,
      academicYearsResult,
      enrollmentsResult,
    ] = await Promise.all([
      supabase
        .from('students')
        .select(
          'id, admission_number, full_name, gender, guardian_name, guardian_phone, admission_date, jhs_aggregate, status'
        )
        .eq('school_id', schoolId)
        .order('full_name'),

      supabase
        .from('programmes')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name'),

      supabase
        .from('classes')
        .select('id, name, programme_id, level')
        .eq('school_id', schoolId)
        .order('name'),

      supabase
        .from('academic_years')
        .select('id, name, start_date')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false }),

      /*
       * IMPORTANT:
       * programme_id comes from the student's enrollment.
       * This allows a class to belong to a programme even when
       * classes.programme_id is NULL.
       */
      supabase
        .from('enrollments')
        .select(
          'student_id, class_id, academic_year_id, programme_id, status'
        )
        .eq('status', 'active'),
    ]);

    if (studentsResult.error) {
      setError(studentsResult.error.message);
      setLoading(false);
      return;
    }

    if (programmesResult.error) {
      setError(programmesResult.error.message);
      setLoading(false);
      return;
    }

    if (classesResult.error) {
      setError(classesResult.error.message);
      setLoading(false);
      return;
    }

    if (academicYearsResult.error) {
      setError(academicYearsResult.error.message);
      setLoading(false);
      return;
    }

    if (enrollmentsResult.error) {
      setError(enrollmentsResult.error.message);
      setLoading(false);
      return;
    }

    setStudents(studentsResult.data ?? []);
    setProgrammes(programmesResult.data ?? []);
    setClasses(classesResult.data ?? []);
    setAcademicYears(academicYearsResult.data ?? []);
    setEnrollments(enrollmentsResult.data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    loadStudents();
  }, []);

  const programmeMap = useMemo(() => {
    return new Map(
      programmes.map((programme) => [programme.id, programme])
    );
  }, [programmes]);

  const classMap = useMemo(() => {
    return new Map(
      classes.map((schoolClass) => [schoolClass.id, schoolClass])
    );
  }, [classes]);

  const academicYearMap = useMemo(() => {
    return new Map(
      academicYears.map((year) => [year.id, year])
    );
  }, [academicYears]);

  /*
   * Determine each student's current academic information.
   *
   * Priority:
   * 1. enrollment.programme_id
   * 2. classes.programme_id
   *
   * This is important because some classes have programme_id = NULL,
   * while the student's enrollment already contains the correct
   * programme.
   */
  const currentAcademicInfo = useMemo(() => {
    const infoMap = new Map<string, StudentAcademicInfo>();

    const sortedEnrollments = [...enrollments].sort((a, b) => {
      const yearA =
        academicYearMap.get(a.academic_year_id)?.start_date ?? '';

      const yearB =
        academicYearMap.get(b.academic_year_id)?.start_date ?? '';

      return yearB.localeCompare(yearA);
    });

    for (const enrollment of sortedEnrollments) {
      if (infoMap.has(enrollment.student_id)) {
        continue;
      }

      const schoolClass = classMap.get(enrollment.class_id);

      /*
       * Enrollment programme is the primary source.
       * Class programme is only the fallback.
       */
      const programmeId =
        enrollment.programme_id ??
        schoolClass?.programme_id ??
        null;

      const programme = programmeId
        ? programmeMap.get(programmeId)
        : undefined;

      const academicYear = academicYearMap.get(
        enrollment.academic_year_id
      );

      infoMap.set(enrollment.student_id, {
        classId: enrollment.class_id,
        className: schoolClass?.name ?? '',
        programmeId,
        programmeName:
          programme?.name ?? 'Unassigned Programme',
        academicYearName: academicYear?.name ?? '',
        formName:
          schoolClass?.level ?? 'Unassigned Form',
      });
    }

    return infoMap;
  }, [
    enrollments,
    academicYearMap,
    classMap,
    programmeMap,
  ]);

  /*
   * Build a map of classes connected to each programme through
   * student enrollments.
   *
   * This fixes the situation where:
   *
   * Programme
   *   ├── A Class
   *   ├── B Class
   *   ├── C Class
   *   ├── D Class
   *   ├── E Class
   *   └── F Class
   *
   * but classes.programme_id may be NULL.
   */
  const enrollmentClassProgrammeMap = useMemo(() => {
    const map = new Map<string, Set<string>>();

    for (const enrollment of enrollments) {
      if (!enrollment.programme_id) {
        continue;
      }

      if (!map.has(enrollment.programme_id)) {
        map.set(enrollment.programme_id, new Set());
      }

      map
        .get(enrollment.programme_id)!
        .add(enrollment.class_id);
    }

    return map;
  }, [enrollments]);

  /*
   * Classes available in the Class filter.
   *
   * If a programme is selected, include:
   * - classes whose own programme_id matches
   * - classes linked to that programme through enrollments
   */
  const availableClasses = useMemo(() => {
    if (programmeFilter === 'all') {
      return classes;
    }

    const enrolledClassIds =
      enrollmentClassProgrammeMap.get(programmeFilter) ??
      new Set<string>();

    return classes.filter(
      (schoolClass) =>
        schoolClass.programme_id === programmeFilter ||
        enrolledClassIds.has(schoolClass.id)
    );
  }, [
    classes,
    programmeFilter,
    enrollmentClassProgrammeMap,
  ]);

  const filteredStudents = useMemo(() => {
    const query = search.toLowerCase().trim();

    return students.filter((student) => {
      const academicInfo =
        currentAcademicInfo.get(student.id);

      const matchesSearch =
        !query ||
        student.full_name
          .toLowerCase()
          .includes(query) ||
        student.admission_number
          .toLowerCase()
          .includes(query);

      const matchesProgramme =
        programmeFilter === 'all' ||
        academicInfo?.programmeId === programmeFilter;

      const matchesClass =
        classFilter === 'all' ||
        academicInfo?.classId === classFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        student.status === statusFilter;

      return (
        matchesSearch &&
        matchesProgramme &&
        matchesClass &&
        matchesStatus
      );
    });
  }, [
    students,
    search,
    programmeFilter,
    classFilter,
    statusFilter,
    currentAcademicInfo,
  ]);

  /*
   * Build the hierarchy:
   *
   * Form
   *   └── Programme / Department
   *         └── Class
   *               └── Students
   */
  const formGroups = useMemo<FormGroup[]>(() => {
    const formMap = new Map<string, FormGroup>();

    for (const student of filteredStudents) {
      const academicInfo =
        currentAcademicInfo.get(student.id);

      const formName =
        academicInfo?.formName || 'Unassigned Form';

      const programmeName =
        academicInfo?.programmeName ||
        'Unassigned Programme';

      const programmeId =
        academicInfo?.programmeId ||
        'unassigned-programme';

      const className =
        academicInfo?.className || 'Unassigned Class';

      const classId =
        academicInfo?.classId || 'unassigned-class';

      if (!formMap.has(formName)) {
        formMap.set(formName, {
          formName,
          programmes: [],
          students: [],
        });
      }

      const formGroup = formMap.get(formName)!;

      formGroup.students.push(student);

      let programmeGroup = formGroup.programmes.find(
        (item) =>
          item.programmeId === programmeId
      );

      if (!programmeGroup) {
        programmeGroup = {
          programmeId,
          programmeName,
          classes: [],
          students: [],
        };

        formGroup.programmes.push(programmeGroup);
      }

      programmeGroup.students.push(student);

      let classGroup =
        programmeGroup.classes.find(
          (item) =>
            item.classId === classId
        );

      if (!classGroup) {
        classGroup = {
          classId,
          className,
          students: [],
        };

        programmeGroup.classes.push(classGroup);
      }

      classGroup.students.push(student);
    }

    const sortForms = (
      a: FormGroup,
      b: FormGroup
    ) => {
      const getNumber = (value: string) => {
        const match = value.match(/\d+/);
        return match
          ? Number(match[0])
          : 999;
      };

      const numberA = getNumber(a.formName);
      const numberB = getNumber(b.formName);

      if (numberA !== numberB) {
        return numberA - numberB;
      }

      return a.formName.localeCompare(
        b.formName
      );
    };

    return Array.from(formMap.values())
      .sort(sortForms)
      .map((form) => ({
        ...form,
        programmes: form.programmes
          .sort((a, b) =>
            a.programmeName.localeCompare(
              b.programmeName
            )
          )
          .map((programme) => ({
            ...programme,
            classes:
              programme.classes.sort(
                (a, b) =>
                  a.className.localeCompare(
                    b.className
                  )
              ),
          })),
      }));
  }, [
    filteredStudents,
    currentAcademicInfo,
  ]);

  const activeCount = students.filter(
    (student) =>
      student.status === 'active'
  ).length;

  const graduatedCount = students.filter(
    (student) =>
      student.status === 'graduated'
  ).length;

  const otherCount =
    students.length -
    activeCount -
    graduatedCount;

  function toggleItem(
    id: string,
    setter: Dispatch<
      SetStateAction<string[]>
    >
  ) {
    setter((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id
          )
        : [...current, id]
    );
  }

  function expandAll() {
    setOpenForms(
      formGroups.map(
        (form) => form.formName
      )
    );

    const programmeIds: string[] = [];
    const classIds: string[] = [];

    formGroups.forEach((form) => {
      form.programmes.forEach(
        (programme) => {
          programmeIds.push(
            `${form.formName}-${programme.programmeId}`
          );

          programme.classes.forEach(
            (schoolClass) => {
              classIds.push(
                `${form.formName}-${programme.programmeId}-${schoolClass.classId}`
              );
            }
          );
        }
      );
    });

    setOpenProgrammes(programmeIds);
    setOpenClasses(classIds);
  }

  function collapseAll() {
    setOpenForms([]);
    setOpenProgrammes([]);
    setOpenClasses([]);
  }

  function clearFilters() {
    setSearch('');
    setProgrammeFilter('all');
    setClassFilter('all');
    setStatusFilter('all');
  }

  async function deleteStudent(
    id: string,
    name: string
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to delete ${name}? This cannot be undone.`
      );

    if (!confirmed) return;

    const {
      error: deleteError,
    } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (deleteError) {
      alert(deleteError.message);
      return;
    }

    setStudents((current) =>
      current.filter(
        (student) =>
          student.id !== id
      )
    );
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3 text-slate-500">
            <FontAwesomeIcon
              icon={faGraduationCap}
              className="animate-bounce text-blue-600"
            />
            <p>Loading students...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
              <FontAwesomeIcon
                icon={faSchool}
                className="animate-pulse"
              />
              Student Information System
            </p>

            <h1 className="text-3xl font-bold text-slate-900">
              Students
            </h1>

            <p className="mt-1 text-slate-500">
              Search, filter and manage student records.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/students/student-account"
              className="group inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 font-semibold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-100"
            >
              <FontAwesomeIcon
                icon={faUserShield}
                className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
              />
              Create Student Login
            </Link>

            <Link
              href="/students/import"
              className="group inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100"
            >
              <FontAwesomeIcon
                icon={faFileArrowDown}
                className="transition-transform duration-300 group-hover:translate-y-1"
              />
              Bulk Import
            </Link>

            <Link
              href="/students/add"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              <FontAwesomeIcon
                icon={faPlus}
                className="transition-transform duration-300 group-hover:rotate-90"
              />
              Add Student
            </Link>
          </div>
        </div>

        {/* Statistics */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">

          <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Total Students
              </p>

              <FontAwesomeIcon
                icon={faUsers}
                className="text-blue-500 transition-transform duration-300 group-hover:scale-110"
              />
            </div>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {students.length}
            </p>
          </div>

          <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Active Students
              </p>

              <FontAwesomeIcon
                icon={faCircleCheck}
                className="text-green-500 transition-transform duration-300 group-hover:scale-110"
              />
            </div>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {activeCount}
            </p>
          </div>

          <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Other Status
              </p>

              <FontAwesomeIcon
                icon={faLayerGroup}
                className="text-orange-500 transition-transform duration-300 group-hover:scale-110"
              />
            </div>

            <p className="mt-2 text-3xl font-bold text-orange-500">
              {graduatedCount + otherCount}
            </p>
          </div>

        </div>

        {/* Search and Filters */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Search Student
              </label>

              <div className="relative">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  placeholder="Name or admission number..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Programme
              </label>

              <select
                value={programmeFilter}
                onChange={(event) => {
                  setProgrammeFilter(
                    event.target.value
                  );
                  setClassFilter('all');
                }}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="all">
                  All Programmes
                </option>

                {programmes.map(
                  (programme) => (
                    <option
                      key={programme.id}
                      value={programme.id}
                    >
                      {programme.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Class
              </label>

              <select
                value={classFilter}
                onChange={(event) =>
                  setClassFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="all">
                  All Classes
                </option>

                {availableClasses.map(
                  (schoolClass) => (
                    <option
                      key={schoolClass.id}
                      value={schoolClass.id}
                    >
                      {schoolClass.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="all">
                  All Students
                </option>

                <option value="active">
                  Active
                </option>

                <option value="graduated">
                  Graduated
                </option>

                <option value="withdrawn">
                  Withdrawn
                </option>

                <option value="suspended">
                  Suspended
                </option>

                <option value="transferred">
                  Transferred
                </option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Clear Filters
              </button>
            </div>

          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">

            <span>
              Showing{' '}
              <strong className="text-slate-900">
                {filteredStudents.length}
              </strong>{' '}
              of{' '}
              <strong className="text-slate-900">
                {students.length}
              </strong>{' '}
              students
            </span>

            <span>
              {search ||
              programmeFilter !== 'all' ||
              classFilter !== 'all' ||
              statusFilter !== 'all'
                ? 'Filters are active'
                : 'No filters applied'}
            </span>

          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Hierarchical Student Directory */}
        {filteredStudents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">

            <div className="mb-4 text-blue-500">
              <FontAwesomeIcon
                icon={faUserGraduate}
                className="text-5xl animate-bounce"
              />
            </div>

            <h2 className="text-xl font-semibold text-slate-900">
              No students found
            </h2>

            <p className="mt-2 text-slate-500">
              Try another search or change your filters.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Clear Filters
            </button>

          </div>
        ) : (
          <div>

            {/* Directory Controls */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <FontAwesomeIcon
                  icon={faSchool}
                  className="text-blue-600"
                />
                Student Directory
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Expand All
                </button>

                <button
                  type="button"
                  onClick={collapseAll}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Collapse All
                </button>
              </div>

            </div>

            {/* Forms */}
            <div className="space-y-4">

              {formGroups.map(
                (form) => {
                  const formOpen =
                    openForms.includes(
                      form.formName
                    );

                  return (
                    <div
                      key={form.formName}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >

                      {/* FORM */}
                      <button
                        type="button"
                        onClick={() =>
                          toggleItem(
                            form.formName,
                            setOpenForms
                          )
                        }
                        className="group flex w-full items-center justify-between gap-4 bg-gradient-to-r from-blue-50 to-white p-5 text-left transition hover:from-blue-100"
                      >
                        <div className="flex min-w-0 items-center gap-4">

                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-transform duration-300 group-hover:scale-105">
                            <FontAwesomeIcon
                              icon={
                                faGraduationCap
                              }
                              className={
                                formOpen
                                  ? 'animate-pulse'
                                  : ''
                              }
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                              Form
                            </p>

                            <h2 className="truncate text-xl font-bold text-slate-900">
                              {form.formName}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                              {form.students.length}{' '}
                              {form.students.length ===
                              1
                                ? 'student'
                                : 'students'}
                            </p>
                          </div>

                        </div>

                        <FontAwesomeIcon
                          icon={
                            formOpen
                              ? faChevronDown
                              : faChevronRight
                          }
                          className="shrink-0 text-blue-600 transition-transform duration-300"
                        />
                      </button>

                      {/* PROGRAMMES */}
                      {formOpen && (
                        <div className="border-t border-slate-100 bg-slate-50 p-3 sm:p-5">

                          <div className="space-y-3">

                            {form.programmes.map(
                              (programme) => {
                                const programmeKey =
                                  `${form.formName}-${programme.programmeId}`;

                                const programmeOpen =
                                  openProgrammes.includes(
                                    programmeKey
                                  );

                                return (
                                  <div
                                    key={
                                      programmeKey
                                    }
                                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                                  >

                                    {/* PROGRAMME / DEPARTMENT */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleItem(
                                          programmeKey,
                                          setOpenProgrammes
                                        )
                                      }
                                      className="group flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-slate-50"
                                    >
                                      <div className="flex min-w-0 items-center gap-3">

                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 transition-transform duration-300 group-hover:scale-105">
                                          <FontAwesomeIcon
                                            icon={
                                              faBuildingColumns
                                            }
                                            className={
                                              programmeOpen
                                                ? 'animate-pulse'
                                                : ''
                                            }
                                          />
                                        </div>

                                        <div className="min-w-0">
                                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                            Department / Programme
                                          </p>

                                          <h3 className="truncate font-bold text-slate-800">
                                            {
                                              programme.programmeName
                                            }
                                          </h3>

                                          <p className="text-xs text-slate-500">
                                            {
                                              programme.students.length
                                            }{' '}
                                            {
                                              programme.students
                                                .length ===
                                              1
                                                ? 'student'
                                                : 'students'
                                            }
                                          </p>
                                        </div>

                                      </div>

                                      <FontAwesomeIcon
                                        icon={
                                          programmeOpen
                                            ? faChevronDown
                                            : faChevronRight
                                        }
                                        className="shrink-0 text-slate-400 transition-transform duration-300"
                                      />
                                    </button>

                                    {/* CLASSES */}
                                    {programmeOpen && (
                                      <div className="border-t border-slate-100 bg-slate-50 p-3">

                                        <div className="space-y-2">

                                          {programme.classes.map(
                                            (
                                              schoolClass
                                            ) => {
                                              const classKey =
                                                `${form.formName}-${programme.programmeId}-${schoolClass.classId}`;

                                              const classOpen =
                                                openClasses.includes(
                                                  classKey
                                                );

                                              return (
                                                <div
                                                  key={
                                                    classKey
                                                  }
                                                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                                                >

                                                  {/* CLASS */}
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      toggleItem(
                                                        classKey,
                                                        setOpenClasses
                                                      )
                                                    }
                                                    className="group flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-blue-50"
                                                  >
                                                    <div className="flex min-w-0 items-center gap-3">

                                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 transition-transform duration-300 group-hover:scale-110">
                                                        <FontAwesomeIcon
                                                          icon={
                                                            faBookOpen
                                                          }
                                                          className={
                                                            classOpen
                                                              ? 'animate-pulse'
                                                              : ''
                                                          }
                                                        />
                                                      </div>

                                                      <div className="min-w-0">
                                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                                          Class
                                                        </p>

                                                        <h4 className="truncate font-semibold text-slate-800">
                                                          {
                                                            schoolClass.className
                                                          }
                                                        </h4>

                                                        <p className="text-xs text-slate-500">
                                                          {
                                                            schoolClass
                                                              .students
                                                              .length
                                                          }{' '}
                                                          {
                                                            schoolClass
                                                              .students
                                                              .length ===
                                                            1
                                                              ? 'student'
                                                              : 'students'
                                                          }
                                                        </p>
                                                      </div>

                                                    </div>

                                                    <FontAwesomeIcon
                                                      icon={
                                                        classOpen
                                                          ? faChevronDown
                                                          : faChevronRight
                                                      }
                                                      className="shrink-0 text-slate-400 transition-transform duration-300"
                                                    />
                                                  </button>

                                                  {/* STUDENTS */}
                                                  {classOpen && (
                                                    <div className="border-t border-slate-100 bg-slate-50 p-3">

                                                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">

                                                        {schoolClass.students.map(
                                                          (
                                                            student
                                                          ) => {
                                                            const academicInfo =
                                                              currentAcademicInfo.get(
                                                                student.id
                                                              );

                                                            return (
                                                              <div
                                                                key={
                                                                  student.id
                                                                }
                                                                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                                              >

                                                                {/* Student Header */}
                                                                <div className="flex items-start justify-between gap-3">

                                                                  <div className="flex min-w-0 items-center gap-3">

                                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                                                      <FontAwesomeIcon
                                                                        icon={
                                                                          faUserGraduate
                                                                        }
                                                                        className="transition-transform duration-300 hover:scale-110"
                                                                      />
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                      <h5 className="truncate font-bold text-slate-900">
                                                                        {
                                                                          student.full_name
                                                                        }
                                                                      </h5>

                                                                      <p className="text-xs text-slate-500">
                                                                        {
                                                                          student.admission_number
                                                                        }
                                                                      </p>
                                                                    </div>

                                                                  </div>

                                                                  <span
                                                                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                                      student.status ===
                                                                      'active'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : student.status ===
                                                                          'graduated'
                                                                        ? 'bg-blue-100 text-blue-700'
                                                                        : 'bg-orange-100 text-orange-700'
                                                                    }`}
                                                                  >
                                                                    {
                                                                      student.status
                                                                    }
                                                                  </span>

                                                                </div>

                                                                {/* Student Information */}
                                                                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">

                                                                  <div>
                                                                    <p className="text-[11px] text-slate-400">
                                                                      Gender
                                                                    </p>

                                                                    <p className="mt-1 text-xs font-medium text-slate-700">
                                                                      {student.gender ||
                                                                        'Not provided'}
                                                                    </p>
                                                                  </div>

                                                                  <div>
                                                                    <p className="text-[11px] text-slate-400">
                                                                      JHS Aggregate
                                                                    </p>

                                                                    <p className="mt-1 text-xs font-semibold text-blue-700">
                                                                      {student.jhs_aggregate !==
                                                                        null &&
                                                                      student.jhs_aggregate !==
                                                                        undefined
                                                                        ? student.jhs_aggregate
                                                                        : 'Not provided'}
                                                                    </p>
                                                                  </div>

                                                                  <div>
                                                                    <p className="text-[11px] text-slate-400">
                                                                      Guardian
                                                                    </p>

                                                                    <p className="mt-1 truncate text-xs font-medium text-slate-700">
                                                                      {student.guardian_name ||
                                                                        'Not provided'}
                                                                    </p>
                                                                  </div>

                                                                  <div>
                                                                    <p className="text-[11px] text-slate-400">
                                                                      Guardian Phone
                                                                    </p>

                                                                    <p className="mt-1 truncate text-xs font-medium text-slate-700">
                                                                      {student.guardian_phone ||
                                                                        'Not provided'}
                                                                    </p>
                                                                  </div>

                                                                </div>

                                                                {/* Actions */}
                                                                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3">

                                                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

                                                                    <Link
                                                                      href={`/students/${student.id}`}
                                                                      className="group inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                                                                    >
                                                                      <FontAwesomeIcon
                                                                        icon={
                                                                          faPenToSquare
                                                                        }
                                                                        className="transition-transform duration-300 group-hover:scale-110"
                                                                      />
                                                                      View Profile
                                                                    </Link>

                                                                    {student.status ===
                                                                      'active' && (
                                                                      <Link
                                                                        href="/students/student-account"
                                                                        className="group inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                                                                      >
                                                                        <FontAwesomeIcon
                                                                          icon={
                                                                            faUserPlus
                                                                          }
                                                                          className="transition-transform duration-300 group-hover:scale-110"
                                                                        />
                                                                        Create Login
                                                                      </Link>
                                                                    )}

                                                                  </div>

                                                                  <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                      deleteStudent(
                                                                        student.id,
                                                                        student.full_name
                                                                      )
                                                                    }
                                                                    className="group self-start rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                                                                  >
                                                                    <FontAwesomeIcon
                                                                      icon={
                                                                        faTrash
                                                                      }
                                                                      className="mr-2 transition-transform duration-300 group-hover:scale-110"
                                                                    />
                                                                    Delete
                                                                  </button>

                                                                </div>

                                                                {/* Academic Info */}
                                                                {academicInfo?.academicYearName && (
                                                                  <p className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                                                                    <FontAwesomeIcon
                                                                      icon={
                                                                        faCircleCheck
                                                                      }
                                                                      className="text-green-500"
                                                                    />
                                                                    {
                                                                      academicInfo.academicYearName
                                                                    }
                                                                  </p>
                                                                )}

                                                              </div>
                                                            );
                                                          }
                                                        )}

                                                      </div>

                                                    </div>
                                                  )}

                                                </div>
                                              );
                                            }
                                          )}

                                        </div>

                                      </div>
                                    )}

                                  </div>
                                );
                              }
                            )}

                          </div>

                        </div>
                      )}

                    </div>
                  );
                }
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

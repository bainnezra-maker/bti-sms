'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  school_id: string;
};

type Assignment = {
  id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
};

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
};

type Subject = {
  id: string;
  name: string;
  code: string | null;
};

type Semester = {
  id: string;
  name: string;
  academic_year_id: string;
  is_current?: boolean;
};

type AcademicYear = {
  id: string;
  name: string;
  is_current?: boolean;
};

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
  gender: string | null;
};

type Enrollment = {
  student_id: string;
  class_id: string;
  academic_year_id: string;
  status?: string | null;
};

type AttendanceRow = {
  student_id: string;
  status: string;
};

type AssessmentRecord = {
  id: string;
  student_id: string;
  subject: string;
  assessment_type: string;
  score: number;
  max_score: number;
  term: string | null;
};

type TimetableEntry = {
  id: string;
  teacher_assignment_id: string;
  academic_year_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
};

type Metric = {
  label: string;
  value: number;
  suffix?: string;
  icon: string;
  detail: string;
};

const supabase = createClient();

const ASSESSMENT_TYPES = [
  { name: 'Exercise 1', max: 10 },
  { name: 'Exercise 2', max: 10 },
  { name: 'Exercise 3', max: 10 },
  { name: 'Exercise 4', max: 10 },
  { name: 'Class Test 1', max: 20 },
  { name: 'Class Test 2', max: 20 },
  { name: 'Class Test 3', max: 20 },
  { name: 'Examination', max: 100 },
];

const quickActions = [
  {
    title: 'Take Attendance',
    description:
      'Record daily attendance for your assigned classes.',
    href: '/attendance',
    icon: 'fa-solid fa-calendar-check',
    badge: 'Daily',
  },
  {
    title: 'Enter Assessment',
    description:
      'Enter exercises, class tests and examination marks.',
    href: '/assessment',
    icon: 'fa-solid fa-clipboard-check',
    badge: 'Marks',
  },
  {
    title: 'View Results',
    description:
      'Review academic performance for your assigned classes.',
    href: '/results',
    icon: 'fa-solid fa-chart-line',
    badge: 'Results',
  },
  {
    title: 'Attendance Reports',
    description:
      'Review attendance records and percentages.',
    href: '/attendance-reports',
    icon: 'fa-solid fa-chart-column',
    badge: 'Reports',
  },
];

const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

function initials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return 'T';

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function todayLabel() {
  return new Intl.DateTimeFormat('en-GH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function percentage(score: number, max: number) {
  if (max <= 0) return 0;

  return Math.max(
    0,
    Math.min(100, (score / max) * 100)
  );
}

function formatTime(value: string) {
  const [hourPart, minutePart] =
    value.split(':');

  const hour = Number(hourPart);

  if (Number.isNaN(hour)) {
    return value;
  }

  const minute = minutePart ?? '00';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function timeToMinutes(value: string) {
  const [hour, minute] =
    value.split(':').map(Number);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return 0;
  }

  return hour * 60 + minute;
}

function useAnimatedNumber(
  target: number,
  duration = 900
) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;

    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(
        1,
        (now - start) / duration
      );

      const eased =
        1 - Math.pow(1 - progress, 3);

      setValue(Math.round(target * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

function AnimatedMetric({
  metric,
  delay = 0,
}: {
  metric: Metric;
  delay?: number;
}) {
  const value = useAnimatedNumber(metric.value);

  return (
    <div
      className="bti-card-in group rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {metric.label}
          </p>

          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {value}
            {metric.suffix}
          </p>

          <p className="mt-1 text-xs font-medium text-slate-500">
            {metric.detail}
          </p>
        </div>

        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
          <i className={metric.icon} />
        </span>
      </div>
    </div>
  );
}

async function fetchPagedAssessments(filters: {
  studentIds: string[];
  schoolId: string;
  term?: string | null;
  subjects: string[];
}) {
  if (
    !filters.studentIds.length ||
    !filters.subjects.length
  ) {
    return [] as AssessmentRecord[];
  }

  const rows: AssessmentRecord[] = [];

  const pageSize = 1000;

  for (let page = 0; page < 10; page += 1) {
    let query = supabase
      .from('assessments')
      .select(
        'id, student_id, subject, assessment_type, score, max_score, term'
      )
      .eq('school_id', filters.schoolId)
      .in('student_id', filters.studentIds)
      .in('subject', filters.subjects)
      .range(
        page * pageSize,
        page * pageSize + pageSize - 1
      );

    if (filters.term) {
      query = query.eq('term', filters.term);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const batch =
      (data ?? []) as AssessmentRecord[];

    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function fetchPagedAttendance(
  studentIds: string[]
) {
  if (!studentIds.length) {
    return [] as AttendanceRow[];
  }

  const rows: AttendanceRow[] = [];

  const pageSize = 1000;

  for (let page = 0; page < 10; page += 1) {
    const {
      data,
      error,
    } = await supabase
      .from('attendance')
      .select('student_id, status')
      .in('student_id', studentIds)
      .range(
        page * pageSize,
        page * pageSize + pageSize - 1
      );

    if (error) {
      return rows;
    }

    const batch =
      (data ?? []) as AttendanceRow[];

    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
  }

  return rows;
}

export default function TeacherDashboard() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [classes, setClasses] =
    useState<ClassItem[]>([]);

  const [subjects, setSubjects] =
    useState<Subject[]>([]);

  const [semesters, setSemesters] =
    useState<Semester[]>([]);

  const [academicYears, setAcademicYears] =
    useState<AcademicYear[]>([]);

  const [enrollments, setEnrollments] =
    useState<Enrollment[]>([]);

  const [students, setStudents] =
    useState<Student[]>([]);

  const [assessmentRows, setAssessmentRows] =
    useState<AssessmentRecord[]>([]);

  const [attendanceRows, setAttendanceRows] =
    useState<AttendanceRow[]>([]);

  const [timetableRows, setTimetableRows] =
    useState<TimetableEntry[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const {
        data: userProfile,
        error: profileError,
      } = await supabase
        .from('users')
        .select(
          'id, full_name, email, role, school_id'
        )
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile) {
        if (mounted) {
          setError(
            profileError?.message ??
              'Unable to load your teacher profile.'
          );
          setLoading(false);
        }

        return;
      }

      /*
       * --------------------------------------------------
       * ROLE PROTECTION
       * --------------------------------------------------
       */

      if (userProfile.role !== 'teacher') {
        if (userProfile.role === 'admin') {
          router.replace('/');
        } else if (
          userProfile.role === 'Student'
        ) {
          router.replace('/student');
        } else {
          await supabase.auth.signOut();
          router.replace('/login');
        }

        return;
      }

      /*
       * --------------------------------------------------
       * TEACHER ASSIGNMENTS
       * --------------------------------------------------
       */

      const {
        data: assignmentData,
        error: assignmentError,
      } = await supabase
        .from('teacher_assignments')
        .select(
          'id, class_id, subject_id, term_id'
        )
        .eq('teacher_id', user.id);

      if (assignmentError) {
        if (mounted) {
          setError(assignmentError.message);
          setLoading(false);
        }

        return;
      }

      const assignmentRows =
        (assignmentData ?? []) as Assignment[];

      const classIds = [
        ...new Set(
          assignmentRows.map(
            (row) => row.class_id
          )
        ),
      ];

      const subjectIds = [
        ...new Set(
          assignmentRows.map(
            (row) => row.subject_id
          )
        ),
      ];

      const termIds = [
        ...new Set(
          assignmentRows.map(
            (row) => row.term_id
          )
        ),
      ];

      /*
       * --------------------------------------------------
       * BASIC ACADEMIC DATA
       * --------------------------------------------------
       */

      const [
        classesResult,
        subjectsResult,
        termsResult,
        yearsResult,
      ] = await Promise.all([
        classIds.length
          ? supabase
              .from('classes')
              .select(
                'id, name, level, programme_id'
              )
              .in('id', classIds)
              .order('name')
          : Promise.resolve({
              data: [],
              error: null,
            }),

        subjectIds.length
          ? supabase
              .from('subjects')
              .select(
                'id, name, code'
              )
              .in('id', subjectIds)
              .order('name')
          : Promise.resolve({
              data: [],
              error: null,
            }),

        termIds.length
          ? supabase
              .from('terms')
              .select(
                'id, name, academic_year_id, is_current'
              )
              .in('id', termIds)
              .order('start_date')
          : Promise.resolve({
              data: [],
              error: null,
            }),

        supabase
          .from('academic_years')
          .select(
            'id, name, is_current'
          )
          .eq(
            'school_id',
            userProfile.school_id
          )
          .order('start_date', {
            ascending: false,
          }),
      ]);

      const firstError =
        classesResult.error ||
        subjectsResult.error ||
        termsResult.error ||
        yearsResult.error;

      if (firstError) {
        if (mounted) {
          setError(firstError.message);
          setLoading(false);
        }

        return;
      }

      const classRows =
        (classesResult.data ??
          []) as ClassItem[];

      const subjectRows =
        (subjectsResult.data ??
          []) as Subject[];

      const semesterRows =
        (termsResult.data ??
          []) as Semester[];

      const yearRows =
        (yearsResult.data ??
          []) as AcademicYear[];

      /*
       * --------------------------------------------------
       * CURRENT ACADEMIC CONTEXT
       * --------------------------------------------------
       */

      const currentYear =
        yearRows.find(
          (year) => year.is_current
        ) ??
        yearRows[0] ??
        null;

      const currentTerm =
        semesterRows.find(
          (term) =>
            term.is_current &&
            (!currentYear ||
              term.academic_year_id ===
                currentYear.id)
        ) ??
        semesterRows.find(
          (term) =>
            !currentYear ||
            term.academic_year_id ===
              currentYear.id
        ) ??
        semesterRows[0] ??
        null;

      /*
       * --------------------------------------------------
       * TEACHER TIMETABLE
       * --------------------------------------------------
       */

      let timetableDataRows: TimetableEntry[] =
        [];

      if (assignmentRows.length) {
        const {
          data: timetableData,
          error: timetableError,
        } = await supabase
          .from('timetable')
          .select(
            'id, teacher_assignment_id, academic_year_id, day_of_week, start_time, end_time, status, notes'
          )
          .eq(
            'school_id',
            userProfile.school_id
          )
          .in(
            'teacher_assignment_id',
            assignmentRows.map(
              (row) => row.id
            )
          )
          .order('day_of_week', {
            ascending: true,
          })
          .order('start_time', {
            ascending: true,
          });

        if (timetableError) {
          if (mounted) {
            setError(
              timetableError.message
            );
            setLoading(false);
          }

          return;
        }

        timetableDataRows =
          (timetableData ??
            []) as TimetableEntry[];
      }

      /*
       * --------------------------------------------------
       * ACTIVE ENROLLMENTS
       * --------------------------------------------------
       */

      let enrollmentQuery = supabase
        .from('enrollments')
        .select(
          'student_id, class_id, academic_year_id, status'
        )
        .in('class_id', classIds);

      if (currentYear?.id) {
        enrollmentQuery =
          enrollmentQuery.eq(
            'academic_year_id',
            currentYear.id
          );
      }

      const enrollmentResult =
        classIds.length
          ? await enrollmentQuery
          : {
              data: [],
              error: null,
            };

      if (enrollmentResult.error) {
        if (mounted) {
          setError(
            enrollmentResult.error.message
          );
          setLoading(false);
        }

        return;
      }

      const enrollmentRows =
        ((enrollmentResult.data ??
          []) as Enrollment[]).filter(
          (row) =>
            !row.status ||
            row.status.toLowerCase() ===
              'active'
        );

      const studentIds = [
        ...new Set(
          enrollmentRows.map(
            (row) => row.student_id
          )
        ),
      ];

      /*
       * --------------------------------------------------
       * STUDENTS
       * --------------------------------------------------
       */

      let studentRows: Student[] = [];

      if (studentIds.length) {
        const {
          data: studentData,
          error: studentError,
        } = await supabase
          .from('students')
          .select(
            'id, full_name, admission_number, gender'
          )
          .in('id', studentIds)
          .eq(
            'school_id',
            userProfile.school_id
          )
          .order('full_name');

        if (studentError) {
          if (mounted) {
            setError(studentError.message);
            setLoading(false);
          }

          return;
        }

        studentRows =
          (studentData ?? []) as Student[];
      }

      /*
       * --------------------------------------------------
       * ASSESSMENT ANALYTICS
       * --------------------------------------------------
       */

      const teacherSubjectNames =
        subjectRows.map(
          (subject) => subject.name
        );

      let assessmentRows: AssessmentRecord[] =
        [];

      try {
        assessmentRows =
          await fetchPagedAssessments({
            studentIds:
              studentRows.map(
                (student) => student.id
              ),
            schoolId:
              userProfile.school_id,
            term:
              currentTerm?.name ?? null,
            subjects:
              teacherSubjectNames,
          });
      } catch (assessmentError) {
        if (mounted) {
          setError(
            assessmentError instanceof Error
              ? assessmentError.message
              : 'Unable to load assessment analytics.'
          );

          setLoading(false);
        }

        return;
      }

      /*
       * --------------------------------------------------
       * ATTENDANCE ANALYTICS
       * --------------------------------------------------
       */

      const attendance =
        await fetchPagedAttendance(
          studentRows.map(
            (student) => student.id
          )
        );

      if (!mounted) return;

      setProfile(
        userProfile as Profile
      );

      setAssignments(
        assignmentRows
      );

      setClasses(classRows);
      setSubjects(subjectRows);
      setSemesters(semesterRows);
      setAcademicYears(yearRows);
      setEnrollments(enrollmentRows);
      setStudents(studentRows);
      setAssessmentRows(assessmentRows);
      setAttendanceRows(attendance);
      setTimetableRows(
        timetableDataRows
      );

      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [router]);

  /*
   * --------------------------------------------------
   * CURRENT SEMESTER
   * --------------------------------------------------
   */

  const currentSemester =
    useMemo(() => {
      return (
        semesters.find(
          (semester) =>
            semester.is_current
        ) ??
        semesters.find(
          (semester) =>
            semester.name ===
            'Semester 1'
        ) ??
        semesters[0] ??
        null
      );
    }, [semesters]);

  /*
   * --------------------------------------------------
   * CURRENT ACADEMIC YEAR
   * --------------------------------------------------
   */

  const currentAcademicYear =
    useMemo(() => {
      return (
        academicYears.find(
          (year) => year.is_current
        ) ??
        academicYears[0] ??
        null
      );
    }, [academicYears]);

  /*
   * --------------------------------------------------
   * MY SCHEDULE
   * --------------------------------------------------
   */

  const scheduleRows =
    useMemo(() => {
      if (!currentAcademicYear?.id) {
        return timetableRows;
      }

      return timetableRows.filter(
        (row) =>
          row.academic_year_id ===
          currentAcademicYear.id
      );
    }, [
      timetableRows,
      currentAcademicYear,
    ]);

  const todayNumber =
    new Date().getDay();

  const todaySchedule =
    useMemo(() => {
      if (
        todayNumber < 1 ||
        todayNumber > 5
      ) {
        return [];
      }

      return scheduleRows
        .filter(
          (row) =>
            row.day_of_week ===
            todayNumber
        )
        .sort(
          (a, b) =>
            timeToMinutes(
              a.start_time
            ) -
            timeToMinutes(
              b.start_time
            )
        );
    }, [
      scheduleRows,
      todayNumber,
    ]);

  const nextClass =
    useMemo(() => {
      const now = new Date();

      const nowMinutes =
        now.getHours() * 60 +
        now.getMinutes();

      const upcomingToday =
        todaySchedule.filter(
          (row) =>
            row.status !== 'cancelled' &&
            timeToMinutes(
              row.start_time
            ) >= nowMinutes
        );

      if (upcomingToday.length) {
        return upcomingToday[0];
      }

      const futureDays =
        scheduleRows
          .filter(
            (row) =>
              row.status !==
                'cancelled' &&
              row.day_of_week >
                todayNumber
          )
          .sort((a, b) => {
            if (
              a.day_of_week !==
              b.day_of_week
            ) {
              return (
                a.day_of_week -
                b.day_of_week
              );
            }

            return (
              timeToMinutes(
                a.start_time
              ) -
              timeToMinutes(
                b.start_time
              )
            );
          });

      return futureDays[0] ?? null;
    }, [
      todaySchedule,
      scheduleRows,
      todayNumber,
    ]);

  const getScheduleDetails = (
    timetable: TimetableEntry
  ) => {
    const assignment =
      assignments.find(
        (item) =>
          item.id ===
          timetable.teacher_assignment_id
      );

    const classItem =
      classes.find(
        (item) =>
          item.id ===
          assignment?.class_id
      );

    const subject =
      subjects.find(
        (item) =>
          item.id ===
          assignment?.subject_id
      );

    const semester =
      semesters.find(
        (item) =>
          item.id ===
          assignment?.term_id
      );

    return {
      assignment,
      classItem,
      subject,
      semester,
    };
  };

  /*
   * --------------------------------------------------
   * CLASS SUMMARIES
   * --------------------------------------------------
   */

  const classSummaries =
    useMemo(() => {
      return classes.map(
        (classItem) => ({
          ...classItem,

          students:
            new Set(
              enrollments
                .filter(
                  (enrollment) =>
                    enrollment.class_id ===
                    classItem.id
                )
                .map(
                  (enrollment) =>
                    enrollment.student_id
                )
            ).size,

          subjects:
            new Set(
              assignments
                .filter(
                  (assignment) =>
                    assignment.class_id ===
                    classItem.id
                )
                .map(
                  (assignment) =>
                    assignment.subject_id
                )
            ).size,
        })
      );
    }, [
      classes,
      enrollments,
      assignments,
    ]);

  /*
   * --------------------------------------------------
   * GENDER ANALYTICS
   * --------------------------------------------------
   */

  const gender =
    useMemo(() => {
      let male = 0;
      let female = 0;
      let other = 0;

      students.forEach(
        (student) => {
          const value =
            (
              student.gender ?? ''
            )
              .trim()
              .toLowerCase();

          if (
            value === 'male' ||
            value === 'm'
          ) {
            male += 1;
          } else if (
            value === 'female' ||
            value === 'f'
          ) {
            female += 1;
          } else {
            other += 1;
          }
        }
      );

      return {
        male,
        female,
        other,
        total: students.length,
      };
    }, [students]);

  /*
   * --------------------------------------------------
   * ASSESSMENT ANALYTICS
   * --------------------------------------------------
   */

  const analytics =
    useMemo(() => {
      const valid =
        assessmentRows.filter(
          (record) =>
            record.max_score > 0
        );

      const normalized =
        valid.map((record) =>
          percentage(
            Number(record.score),
            Number(record.max_score)
          )
        );

      const average =
        normalized.length
          ? normalized.reduce(
              (total, value) =>
                total + value,
              0
            ) / normalized.length
          : 0;

      const highest =
        normalized.length
          ? Math.max(...normalized)
          : 0;

      const lowest =
        normalized.length
          ? Math.min(...normalized)
          : 0;

      const passed =
        normalized.filter(
          (value) => value >= 50
        ).length;

      const submitted =
        assessmentRows.length;

      const expectedAssignments =
        assignments.filter(
          (assignment) =>
            !currentSemester ||
            assignment.term_id ===
              currentSemester.id
        );

      const uniquePairs: Assignment[] =
        Array.from(
          new Map<string, Assignment>(
            expectedAssignments.map(
              (assignment) => [
                `${assignment.class_id}|${assignment.subject_id}`,
                assignment,
              ]
            )
          ).values()
        );

      const expectedPerType =
        uniquePairs.reduce(
          (total, assignment) =>
            total +
            enrollments.filter(
              (enrollment) =>
                enrollment.class_id ===
                assignment.class_id
            ).length,
          0
        );

      const expected =
        expectedPerType *
        ASSESSMENT_TYPES.length;

      const notSubmitted =
        Math.max(
          0,
          expected - submitted
        );

      const completion =
        expected > 0
          ? (submitted / expected) *
            100
          : 0;

      const byType =
        ASSESSMENT_TYPES.map(
          (type) => {
            const rows =
              assessmentRows.filter(
                (record) =>
                  record.assessment_type ===
                  type.name
              );

            const values =
              rows
                .filter(
                  (record) =>
                    record.max_score > 0
                )
                .map((record) =>
                  percentage(
                    Number(
                      record.score
                    ),
                    Number(
                      record.max_score
                    )
                  )
                );

            const average =
              values.length
                ? values.reduce(
                    (total, value) =>
                      total + value,
                    0
                  ) / values.length
                : 0;

            return {
              ...type,
              submitted:
                rows.length,
              expected:
                expectedPerType,
              avg: average,
            };
          }
        );

      return {
        average,
        highest,
        lowest,

        passRate:
          valid.length
            ? (passed / valid.length) *
              100
            : 0,

        submitted,
        notSubmitted,
        expected,
        completion,
        byType,
      };
    }, [
      assessmentRows,
      assignments,
      enrollments,
      currentSemester,
    ]);

  /*
   * --------------------------------------------------
   * ATTENDANCE ANALYTICS
   * --------------------------------------------------
   */

  const attendance =
    useMemo(() => {
      const present =
        attendanceRows.filter(
          (row) =>
            [
              'present',
              'late',
            ].includes(
              row.status.toLowerCase()
            )
        ).length;

      const absent =
        attendanceRows.filter(
          (row) =>
            row.status.toLowerCase() ===
            'absent'
        ).length;

      const late =
        attendanceRows.filter(
          (row) =>
            row.status.toLowerCase() ===
            'late'
        ).length;

      const excused =
        attendanceRows.filter(
          (row) =>
            row.status.toLowerCase() ===
            'excused'
        ).length;

      const percentage =
        attendanceRows.length
          ? (present /
              attendanceRows.length) *
            100
          : 0;

      return {
        present,
        absent,
        late,
        excused,
        percentage,
      };
    }, [attendanceRows]);

  /*
   * --------------------------------------------------
   * STUDENTS NEEDING ATTENTION
   * --------------------------------------------------
   */

  const attention =
    useMemo(() => {
      const items: {
        student: Student;
        kind: string;
        detail: string;
        severity:
          | 'high'
          | 'medium';
      }[] = [];

      students.forEach(
        (student) => {
          const records =
            assessmentRows.filter(
              (record) =>
                record.student_id ===
                student.id
            );

          const hasLowScore =
            records.some(
              (record) =>
                percentage(
                  Number(record.score),
                  Number(
                    record.max_score
                  )
                ) < 40
            );

          const hasMissing =
            analytics.expected >
              0 &&
            records.length === 0;

          if (hasMissing) {
            items.push({
              student,
              kind:
                'Missing assessment',
              detail:
                'No submitted assessment yet',
              severity: 'high',
            });
          } else if (
            hasLowScore
          ) {
            items.push({
              student,
              kind:
                'Low performance',
              detail:
                'At least one score below 40%',
              severity: 'high',
            });
          }
        }
      );

      const attendanceMap =
        new Map<
          string,
          {
            total: number;
            attended: number;
          }
        >();

      attendanceRows.forEach(
        (row) => {
          const current =
            attendanceMap.get(
              row.student_id
            ) ?? {
              total: 0,
              attended: 0,
            };

          current.total += 1;

          if (
            [
              'present',
              'late',
            ].includes(
              row.status.toLowerCase()
            )
          ) {
            current.attended += 1;
          }

          attendanceMap.set(
            row.student_id,
            current
          );
        }
      );

      students.forEach(
        (student) => {
          const record =
            attendanceMap.get(
              student.id
            );

          if (
            record &&
            record.total >= 3 &&
            record.attended /
              record.total <
              0.75 &&
            !items.some(
              (item) =>
                item.student.id ===
                student.id
            )
          ) {
            items.push({
              student,
              kind:
                'Low attendance',
              detail: `${Math.round(
                (record.attended /
                  record.total) *
                  100
              )}% attendance`,
              severity: 'medium',
            });
          }
        }
      );

      return items.slice(0, 8);
    }, [
      students,
      assessmentRows,
      attendanceRows,
      analytics.expected,
    ]);

  /*
   * --------------------------------------------------
   * MAIN KPI METRICS
   * --------------------------------------------------
   */

  const metrics: Metric[] = [
    {
      label: 'Total Students',
      value: students.length,
      icon:
        'fa-solid fa-user-graduate',
      detail:
        'Across assigned classes',
    },
    {
      label: 'Male Students',
      value: gender.male,
      icon:
        'fa-solid fa-person',
      detail: `${
        gender.total
          ? Math.round(
              (gender.male /
                gender.total) *
                100
            )
          : 0
      }% of students`,
    },
    {
      label: 'Female Students',
      value: gender.female,
      icon:
        'fa-solid fa-person-dress',
      detail: `${
        gender.total
          ? Math.round(
              (gender.female /
                gender.total) *
                100
            )
          : 0
      }% of students`,
    },
    {
      label: 'Assigned Classes',
      value: classes.length,
      icon:
        'fa-solid fa-school',
      detail: `${assignments.length} teaching assignments`,
    },
  ];

  /*
   * --------------------------------------------------
   * LOADING
   * --------------------------------------------------
   */

  if (loading) {
    return (
      <>
        <style jsx global>{`
          .bti-skel {
            animation: btiPulse 1.4s
              ease-in-out infinite;
          }

          @keyframes btiPulse {
            50% {
              opacity: 0.45;
            }
          }
        `}</style>

        <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-5">
            <div className="bti-skel h-56 rounded-[2rem] bg-slate-200" />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="bti-skel h-32 rounded-3xl bg-slate-200"
                  />
                )
              )}
            </div>

            <div className="bti-skel h-96 rounded-[2rem] bg-slate-200" />
          </div>
        </div>
      </>
    );
  }

  /*
   * --------------------------------------------------
   * ERROR
   * --------------------------------------------------
   */

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-200 bg-white p-8 shadow-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <i className="fa-solid fa-triangle-exclamation" />
          </div>

          <h1 className="mt-5 text-2xl font-black text-slate-900">
            Teacher dashboard could not load
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
          >
            <i className="fa-solid fa-rotate-right mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const donutTotal =
    gender.male +
    gender.female +
    gender.other;

  const maleAngle = donutTotal
    ? (gender.male / donutTotal) *
      360
    : 0;

  const femaleAngle = donutTotal
    ? (gender.female / donutTotal) *
      360
    : 0;

  return (
    <>
      <style jsx global>{`
        @keyframes btiFadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes btiGrow {
          from {
            width: 0;
          }
        }

        @keyframes btiFloat {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-5px);
          }
        }

        .bti-card-in {
          animation: btiFadeUp
            0.55s ease-out both;
        }

        .bti-grow {
          animation: btiGrow
            1s ease-out both;
        }

        .bti-float {
          animation: btiFloat
            3.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .bti-card-in,
          .bti-grow,
          .bti-float {
            animation: none;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* HERO */}

          <section className="bti-card-in relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-7 text-white shadow-2xl sm:px-8 sm:py-8">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[.04]" />

            <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-white/[.035]" />

            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-bold text-slate-200 ring-1 ring-white/10">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                    <i className="fa-solid fa-chart-pie text-[10px]" />
                  </span>
                  Teacher Analytics Workspace
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-black text-slate-900 shadow-xl sm:flex">
                    {initials(
                      profile?.full_name ??
                        'Teacher'
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-400">
                      {todayLabel()}
                    </p>

                    <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
                      Welcome,{' '}
                      {profile?.full_name ??
                        'Teacher'}
                    </h1>
                  </div>
                </div>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  A live view of your students,
                  assessment activity, academic
                  performance and teaching workload.
                </p>
              </div>

              <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/10 backdrop-blur-md lg:min-w-[270px]">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">
                  Academic Context
                </p>

                <p className="mt-1 text-lg font-black">
                  {currentAcademicYear?.name ??
                    'Academic year'}
                </p>

                <p className="text-sm text-slate-300">
                  {currentSemester?.name ??
                    'Current semester'}
                </p>

                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Analytics live
                </div>
              </div>
            </div>
          </section>

          {/* KPI CARDS */}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(
              (metric, index) => (
                <AnimatedMetric
                  key={metric.label}
                  metric={metric}
                  delay={index * 80}
                />
              )
            )}
          </section>

          {/* MY SCHEDULE */}

          <section className="bti-card-in relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-slate-100/80" />

            <div className="relative">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-slate-500">
                    <i className="fa-solid fa-calendar-days" />
                    Teacher Schedule
                  </div>

                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                    My Schedule
                  </h2>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Your teaching timetable is now
                    available directly from your
                    dashboard.
                  </p>
                </div>

                <Link
                  href="/my-schedule"
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  <i className="fa-solid fa-calendar-week" />
                  View Full Schedule
                  <i className="fa-solid fa-arrow-right transition group-hover:translate-x-1" />
                </Link>
              </div>

              {scheduleRows.length === 0 ? (
                <div className="mt-7 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                    <i className="fa-solid fa-calendar-xmark text-xl" />
                  </div>

                  <h3 className="mt-4 text-sm font-black text-slate-800">
                    No timetable entries yet
                  </h3>

                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">
                    Once your timetable is assigned,
                    your teaching schedule will appear
                    here automatically.
                  </p>
                </div>
              ) : (
                <>
                  {/* NEXT CLASS */}

                  <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-xl">
                      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/[.05]" />

                      <div className="relative">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
                            Next Class
                          </p>

                          <span className="bti-float flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                            <i className="fa-solid fa-forward" />
                          </span>
                        </div>

                        {nextClass ? (
                          (() => {
                            const details =
                              getScheduleDetails(
                                nextClass
                              );

                            return (
                              <>
                                <p className="mt-5 text-2xl font-black">
                                  {details.subject
                                    ?.name ??
                                    'Scheduled Lesson'}
                                </p>

                                <p className="mt-1 text-sm font-semibold text-slate-300">
                                  {details.classItem
                                    ?.name ??
                                    'Assigned class'}
                                </p>

                                <div className="mt-5 flex flex-wrap gap-2">
                                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">
                                    <i className="fa-solid fa-clock mr-1.5 text-slate-400" />
                                    {formatTime(
                                      nextClass.start_time
                                    )}{' '}
                                    –{' '}
                                    {formatTime(
                                      nextClass.end_time
                                    )}
                                  </span>

                                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">
                                    <i className="fa-solid fa-calendar-day mr-1.5 text-slate-400" />
                                    {DAY_NAMES[
                                      nextClass
                                        .day_of_week
                                    ] ??
                                      'Scheduled'}
                                  </span>
                                </div>
                              </>
                            );
                          })()
                        ) : (
                          <div className="mt-6">
                            <p className="text-lg font-black">
                              No upcoming class
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Your schedule is clear for
                              the remaining timetable.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* TODAY */}

                    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
                            Today
                          </p>

                          <h3 className="mt-1 text-lg font-black text-slate-900">
                            {todayNumber >= 1 &&
                            todayNumber <= 5
                              ? DAY_NAMES[
                                  todayNumber
                                ]
                              : 'Weekend'}
                          </h3>
                        </div>

                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                          <i className="fa-solid fa-clock" />
                        </span>
                      </div>

                      {todaySchedule.length ===
                      0 ? (
                        <div className="mt-5 rounded-2xl bg-white px-4 py-5 text-center">
                          <i className="fa-solid fa-mug-hot text-slate-300" />

                          <p className="mt-2 text-xs font-black text-slate-600">
                            No classes scheduled today
                          </p>
                        </div>
                      ) : (
                        <div className="mt-5 space-y-2">
                          {todaySchedule
                            .slice(0, 4)
                            .map(
                              (entry) => {
                                const details =
                                  getScheduleDetails(
                                    entry
                                  );

                                const cancelled =
                                  entry.status ===
                                  'cancelled';

                                return (
                                  <div
                                    key={
                                      entry.id
                                    }
                                    className={`group flex items-center gap-3 rounded-2xl border p-3 transition ${
                                      cancelled
                                        ? 'border-red-100 bg-red-50/60'
                                        : 'border-white bg-white hover:-translate-y-0.5 hover:shadow-md'
                                    }`}
                                  >
                                    <div
                                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                        cancelled
                                          ? 'bg-red-100 text-red-600'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      <i
                                        className={
                                          cancelled
                                            ? 'fa-solid fa-ban'
                                            : 'fa-solid fa-book-open'
                                        }
                                      />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <p
                                        className={`truncate text-xs font-black ${
                                          cancelled
                                            ? 'text-red-700 line-through'
                                            : 'text-slate-800'
                                        }`}
                                      >
                                        {details
                                          .subject
                                          ?.name ??
                                          'Lesson'}
                                      </p>

                                      <p className="mt-0.5 truncate text-[10px] text-slate-400">
                                        {details
                                          .classItem
                                          ?.name ??
                                          'Class'}{' '}
                                        ·{' '}
                                        {formatTime(
                                          entry.start_time
                                        )}
                                      </p>
                                    </div>

                                    {cancelled ? (
                                      <span className="rounded-full bg-red-100 px-2 py-1 text-[8px] font-black uppercase text-red-600">
                                        Cancelled
                                      </span>
                                    ) : (
                                      <i className="fa-solid fa-chevron-right text-[9px] text-slate-300 transition group-hover:translate-x-0.5" />
                                    )}
                                  </div>
                                );
                              }
                            )}

                          {todaySchedule.length >
                            4 && (
                            <Link
                              href="/my-schedule"
                              className="block pt-2 text-center text-[10px] font-black text-slate-500"
                            >
                              +{' '}
                              {todaySchedule.length -
                                4}{' '}
                              more classes
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WEEKLY PREVIEW */}

                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
                        Weekly Preview
                      </p>

                      <span className="text-[10px] font-bold text-slate-400">
                        Monday – Friday
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-5">
                      {[1, 2, 3, 4, 5].map(
                        (day) => {
                          const dayEntries =
                            scheduleRows
                              .filter(
                                (entry) =>
                                  entry.day_of_week ===
                                  day
                              )
                              .sort(
                                (a, b) =>
                                  timeToMinutes(
                                    a.start_time
                                  ) -
                                  timeToMinutes(
                                    b.start_time
                                  )
                              );

                          const isToday =
                            day ===
                            todayNumber;

                          return (
                            <div
                              key={day}
                              className={`rounded-2xl border p-3 transition ${
                                isToday
                                  ? 'border-slate-900 bg-slate-950 text-white shadow-lg'
                                  : 'border-slate-100 bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <p
                                  className={`text-[10px] font-black uppercase tracking-wider ${
                                    isToday
                                      ? 'text-white'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {DAY_NAMES[day]}
                                </p>

                                {isToday && (
                                  <span className="rounded-full bg-white/10 px-2 py-1 text-[8px] font-black uppercase text-white">
                                    Today
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 space-y-2">
                                {dayEntries.length ===
                                0 ? (
                                  <p
                                    className={`py-4 text-center text-[9px] font-bold ${
                                      isToday
                                        ? 'text-slate-500'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    No classes
                                  </p>
                                ) : (
                                  dayEntries
                                    .slice(0, 3)
                                    .map(
                                      (
                                        entry
                                      ) => {
                                        const details =
                                          getScheduleDetails(
                                            entry
                                          );

                                        const cancelled =
                                          entry.status ===
                                          'cancelled';

                                        return (
                                          <div
                                            key={
                                              entry.id
                                            }
                                            className={`rounded-xl p-2.5 ${
                                              isToday
                                                ? 'bg-white/10'
                                                : 'bg-white'
                                            }`}
                                          >
                                            <p
                                              className={`truncate text-[9px] font-black ${
                                                cancelled
                                                  ? 'line-through text-red-400'
                                                  : isToday
                                                  ? 'text-white'
                                                  : 'text-slate-700'
                                              }`}
                                            >
                                              {details
                                                .subject
                                                ?.name ??
                                                'Lesson'}
                                            </p>

                                            <p
                                              className={`mt-1 text-[8px] font-semibold ${
                                                isToday
                                                  ? 'text-slate-400'
                                                  : 'text-slate-400'
                                              }`}
                                            >
                                              {formatTime(
                                                entry.start_time
                                              )}{' '}
                                              ·{' '}
                                              {details
                                                .classItem
                                                ?.name ??
                                                'Class'}
                                            </p>
                                          </div>
                                        );
                                      }
                                    )
                                )}

                                {dayEntries.length >
                                  3 && (
                                  <p
                                    className={`text-center text-[8px] font-black ${
                                      isToday
                                        ? 'text-slate-400'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    +
                                    {dayEntries.length -
                                      3}{' '}
                                    more
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* GENDER + ASSESSMENT PARTICIPATION */}

          <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">

            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Student Composition
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Gender Distribution
                  </h2>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-500">
                  {gender.total} students
                </span>
              </div>

              <div className="mt-7 flex flex-col items-center gap-7 sm:flex-row sm:justify-center">
                <div
                  className="relative h-48 w-48 shrink-0 rounded-full p-1 shadow-inner"
                  style={{
                    background: `conic-gradient(#0f172a 0deg ${maleAngle}deg,#94a3b8 ${maleAngle}deg ${
                      maleAngle + femaleAngle
                    }deg,#e2e8f0 ${
                      maleAngle + femaleAngle
                    }deg 360deg)`,
                  }}
                >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white shadow-inner">
                    <div className="text-center">
                      <p className="text-3xl font-black text-slate-950">
                        {gender.total}
                      </p>

                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Students
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-xs space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-600">
                        Male
                      </span>

                      <b>{gender.male}</b>
                    </div>

                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className="bti-grow h-2 rounded-full bg-slate-900"
                        style={{
                          width: `${
                            gender.total
                              ? (gender.male /
                                  gender.total) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-600">
                        Female
                      </span>

                      <b>{gender.female}</b>
                    </div>

                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className="bti-grow h-2 rounded-full bg-slate-400"
                        style={{
                          width: `${
                            gender.total
                              ? (gender.female /
                                  gender.total) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {gender.other > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-600">
                        Other / Unspecified
                      </span>

                      <b>{gender.other}</b>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Assessment Participation
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Submission Coverage
                  </h2>
                </div>

                <i className="fa-solid fa-clipboard-check rounded-2xl bg-slate-100 p-3 text-slate-700" />
              </div>

              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-4xl font-black text-slate-950">
                    {Math.round(
                      analytics.completion
                    )}
                    %
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Overall assessment completion
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-black text-emerald-600">
                    {analytics.submitted}{' '}
                    submitted
                  </p>

                  <p className="text-sm font-black text-slate-400">
                    {analytics.notSubmitted}{' '}
                    not submitted
                  </p>
                </div>
              </div>

              <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="bti-grow h-full rounded-full bg-gradient-to-r from-slate-950 to-slate-500"
                  style={{
                    width: `${Math.min(
                      100,
                      analytics.completion
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
                <i className="fa-solid fa-circle-info mr-2 text-slate-400" />

                A blank assessment has{' '}
                <b>no database row</b>, while a
                recorded score of <b>0</b> is
                treated as submitted. This keeps
                academic participation separate
                from performance.
              </div>
            </div>
          </section>

          {/* PERFORMANCE + ATTENDANCE */}

          <section className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Academic Performance
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Performance Snapshot
                  </h2>
                </div>

                <Link
                  href="/results"
                  className="rounded-xl bg-slate-950 px-3 py-2 text-[10px] font-black text-white"
                >
                  View Results
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">
                    Average
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {analytics.average.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">
                    Highest
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {analytics.highest.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">
                    Lowest
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {analytics.lowest.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">
                    Pass Rate
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {analytics.passRate.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>
              </div>

              <div className="mt-7 space-y-4">
                {analytics.byType.map(
                  (item) => (
                    <div key={item.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="font-bold text-slate-700">
                          {item.name}
                        </span>

                        <span className="font-black text-slate-500">
                          {item.submitted}{' '}
                          submitted ·{' '}
                          {item.avg.toFixed(0)}
                          % avg
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="bti-grow h-full rounded-full bg-slate-900"
                          style={{
                            width: `${Math.min(
                              100,
                              item.avg
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                  Attendance Health
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Attendance Overview
                </h2>
              </div>

              <div className="mt-6 flex items-center gap-5">
                <div
                  className="relative h-32 w-32 shrink-0 rounded-full"
                  style={{
                    background: `conic-gradient(#0f172a 0deg ${
                      attendance.percentage *
                      3.6
                    }deg,#e2e8f0 ${
                      attendance.percentage *
                      3.6
                    }deg 360deg)`,
                  }}
                >
                  <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white">
                    <div className="text-center">
                      <p className="text-2xl font-black">
                        {Math.round(
                          attendance.percentage
                        )}
                        %
                      </p>

                      <p className="text-[9px] font-black uppercase text-slate-400">
                        Attended
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p>
                    <b className="text-slate-900">
                      {attendance.present}
                    </b>{' '}
                    attended
                  </p>

                  <p>
                    <b className="text-amber-600">
                      {attendance.late}
                    </b>{' '}
                    late
                  </p>

                  <p>
                    <b className="text-red-600">
                      {attendance.absent}
                    </b>{' '}
                    absent
                  </p>

                  <p>
                    <b className="text-blue-600">
                      {attendance.excused}
                    </b>{' '}
                    excused
                  </p>
                </div>
              </div>

              <Link
                href="/attendance-reports"
                className="mt-6 inline-flex items-center gap-2 text-xs font-black text-slate-700"
              >
                Open attendance reports
                <i className="fa-solid fa-arrow-right" />
              </Link>
            </div>
          </section>

          {/* ASSESSMENT TYPE ACTIVITY */}

          <section className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                  Teaching Intelligence
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Assessment Activity by Type
                </h2>
              </div>

              <p className="text-xs font-semibold text-slate-400">
                Submitted scores across your current
                teaching scope
              </p>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {analytics.byType.map(
                (item) => (
                  <div
                    key={item.name}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black text-slate-700">
                        {item.name}
                      </span>

                      <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-500">
                        /{item.max}
                      </span>
                    </div>

                    <p className="mt-4 text-2xl font-black text-slate-950">
                      {item.submitted}
                    </p>

                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      submitted
                    </p>

                    <div className="mt-3 h-1.5 rounded-full bg-white">
                      <div
                        className="bti-grow h-1.5 rounded-full bg-slate-900"
                        style={{
                          width: `${
                            item.expected
                              ? Math.min(
                                  100,
                                  (item.submitted /
                                    item.expected) *
                                    100
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          {/* ATTENTION + CLASSES */}

          <section className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Student Support
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Students Needing Attention
                  </h2>
                </div>

                <span className="rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-black text-red-600">
                  {attention.length} flagged
                </span>
              </div>

              {attention.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <i className="fa-solid fa-circle-check text-xl" />
                  </div>

                  <p className="mt-4 text-sm font-black text-slate-800">
                    No immediate concerns
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Your current analytics show no
                    flagged students.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {attention.map(
                    (item) => (
                      <div
                        key={`${item.student.id}-${item.kind}`}
                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
                          {initials(
                            item.student.full_name
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-slate-800">
                            {item.student.full_name}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {item.detail}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2 py-1 text-[9px] font-black ${
                            item.severity ===
                            'high'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {item.kind}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Teaching Overview
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    My Classes
                  </h2>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-500">
                  {classes.length} classes
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {classSummaries.length ===
                0 ? (
                  <p className="py-10 text-center text-sm font-bold text-slate-400">
                    No classes assigned.
                  </p>
                ) : (
                  classSummaries
                    .slice(0, 6)
                    .map((classItem) => (
                      <div
                        key={classItem.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3.5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                            <i className="fa-solid fa-school" />
                          </div>

                          <div>
                            <p className="text-sm font-black text-slate-800">
                              {classItem.name}
                            </p>

                            <p className="text-[10px] text-slate-400">
                              {classItem.level ??
                                'Assigned class'}{' '}
                              ·{' '}
                              {classItem.students}{' '}
                              students
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-black text-slate-600">
                          {classItem.subjects}{' '}
                          subjects
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </section>

          {/* QUICK ACTIONS */}

          <section className="bti-card-in">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                  Teaching Tools
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Quick Actions
                </h2>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {quickActions.map(
                (action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        <i
                          className={
                            action.icon
                          }
                        />
                      </span>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase text-slate-500">
                        {action.badge}
                      </span>
                    </div>

                    <h3 className="mt-5 font-black text-slate-900">
                      {action.title}
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {action.description}
                    </p>

                    <div className="mt-4 text-xs font-black text-slate-700">
                      Open Tool
                      <i className="fa-solid fa-arrow-right ml-1 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                )
              )}
            </div>
          </section>

          {/* ASSIGNMENTS */}

          <section className="bti-card-in overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-6 sm:px-7">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Teaching Load
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    My Assignments
                  </h2>
                </div>

                <span className="w-fit rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
                  {assignments.length}{' '}
                  assignments
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-4">
                      Class
                    </th>

                    <th className="px-6 py-4">
                      Subject
                    </th>

                    <th className="px-6 py-4">
                      Semester
                    </th>

                    <th className="px-6 py-4">
                      Academic Year
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {assignments.map(
                    (assignment) => {
                      const classItem =
                        classes.find(
                          (item) =>
                            item.id ===
                            assignment.class_id
                        );

                      const subject =
                        subjects.find(
                          (item) =>
                            item.id ===
                            assignment.subject_id
                        );

                      const semester =
                        semesters.find(
                          (item) =>
                            item.id ===
                            assignment.term_id
                        );

                      const year =
                        academicYears.find(
                          (item) =>
                            item.id ===
                            semester?.academic_year_id
                        );

                      return (
                        <tr
                          key={assignment.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-6 py-4 font-black text-slate-800">
                            {classItem?.name ??
                              '—'}
                          </td>

                          <td className="px-6 py-4 font-bold text-slate-700">
                            {subject?.name ??
                              '—'}
                          </td>

                          <td className="px-6 py-4 text-slate-600">
                            {semester?.name ??
                              '—'}
                          </td>

                          <td className="px-6 py-4 text-slate-600">
                            {year?.name ??
                              '—'}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* FOOTER */}

          <footer className="border-t border-slate-200 pt-5 pb-4 text-center text-[11px] text-slate-400 sm:flex sm:justify-between">
            <span>
              <i className="fa-solid fa-shield-halved mr-1.5" />
              BTI-SMS Teacher Workspace
            </span>

            <span>
              <i className="fa-solid fa-graduation-cap mr-1.5" />
              Biriwa Technical Institute
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}

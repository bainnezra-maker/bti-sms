'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type UserProfile = {
  id: string;
  school_id: string;
  full_name: string;
  email: string | null;
  role: string;
  is_active: boolean | null;
  student_id: string | null;
};

type Student = {
  id: string;
  school_id: string;
  admission_number: string;
  full_name: string;
  photo_url: string | null;
  gender: string | null;
  jhs_aggregate: number | null;
  status: string;
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type Semester = {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type SchoolClass = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
};

type Programme = {
  id: string;
  name: string;
};

type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  enrollment_date: string;
  status: string | null;
};

type Assessment = {
  id: string;
  student_id: string;
  subject: string;
  assessment_type: string;
  score: number;
  max_score: number;
  term: string | null;
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  student_id: string;
  date: string;
  status: string;
};

type NewsItem = {
  id: string;
  title: string;
  content: string;
  category: string;
  is_published: boolean;
  is_urgent: boolean;
  publish_date: string;
  created_at: string;
};

type SubjectResult = {
  subject: string;
  caRaw: number;
  caContribution: number;
  examScore: number;
  examContribution: number;
  finalScore: number;
  grade: string;
};

function getGrade(score: number) {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  if (score >= 40) return 'E';
  return 'F';
}

function getGradeStyle(grade: string) {
  switch (grade) {
    case 'A':
      return 'bg-emerald-100 text-emerald-700';
    case 'B':
      return 'bg-blue-100 text-blue-700';
    case 'C':
      return 'bg-cyan-100 text-cyan-700';
    case 'D':
      return 'bg-yellow-100 text-yellow-700';
    case 'E':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-red-100 text-red-700';
  }
}

function getGradeIcon(grade: string) {
  switch (grade) {
    case 'A':
      return 'fa-star';
    case 'B':
      return 'fa-thumbs-up';
    case 'C':
      return 'fa-check';
    case 'D':
      return 'fa-circle-check';
    case 'E':
      return 'fa-triangle-exclamation';
    default:
      return 'fa-circle-xmark';
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatNewsDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getCategoryStyle(category: string, urgent: boolean) {
  if (urgent || category === 'Urgent') {
    return 'bg-red-100 text-red-700 border-red-200';
  }

  switch (category) {
    case 'Reopening':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Examination':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'Fees':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Parents':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'Academic':
      return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    case 'Event':
      return 'bg-pink-100 text-pink-700 border-pink-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function getCategoryIcon(category: string, urgent: boolean) {
  if (urgent || category === 'Urgent') return 'fa-triangle-exclamation';

  switch (category) {
    case 'Reopening':
      return 'fa-door-open';
    case 'Examination':
      return 'fa-file-pen';
    case 'Fees':
      return 'fa-money-bill-wave';
    case 'Parents':
      return 'fa-people-group';
    case 'Academic':
      return 'fa-book-open';
    case 'Event':
      return 'fa-calendar-star';
    default:
      return 'fa-bullhorn';
  }
}

export default function StudentDashboardPage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [student, setStudent] = useState<Student | null>(null);

  const [academicYear, setAcademicYear] =
    useState<AcademicYear | null>(null);

  const [semester, setSemester] =
    useState<Semester | null>(null);

  const [schoolClass, setSchoolClass] =
    useState<SchoolClass | null>(null);

  const [programme, setProgramme] =
    useState<Programme | null>(null);

  const [assessments, setAssessments] =
    useState<Assessment[]>([]);

  const [attendance, setAttendance] =
    useState<AttendanceRecord[]>([]);

  const [news, setNews] =
    useState<NewsItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  async function loadDashboard() {
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    const { data: userProfile, error: profileError } =
      await supabase
        .from('users')
        .select(
          'id, school_id, full_name, email, role, is_active, student_id'
        )
        .eq('id', user.id)
        .single();

    if (profileError || !userProfile) {
      setError('Your student account could not be found.');
      setLoading(false);
      return;
    }

    if (
      userProfile.role !== 'Student' ||
      userProfile.is_active === false ||
      !userProfile.student_id
    ) {
      setError(
        'This account is not configured as an active student account.'
      );
      setLoading(false);
      return;
    }

    setProfile(userProfile);

    const studentId = userProfile.student_id;
    const schoolId = userProfile.school_id;

    const { data: studentData, error: studentError } =
      await supabase
        .from('students')
        .select(
          'id, school_id, admission_number, full_name, photo_url, gender, jhs_aggregate, status'
        )
        .eq('id', studentId)
        .eq('school_id', schoolId)
        .single();

    if (studentError || !studentData) {
      setError('Your student record could not be loaded.');
      setLoading(false);
      return;
    }

    setStudent(studentData);

    const { data: years, error: yearsError } =
      await supabase
        .from('academic_years')
        .select(
          'id, name, start_date, end_date, is_current'
        )
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false });

    if (yearsError) {
      setError(yearsError.message);
      setLoading(false);
      return;
    }

    const currentYear =
      (years ?? []).find((year) => year.is_current) ??
      (years ?? [])[0] ??
      null;

    setAcademicYear(currentYear);

    if (!currentYear) {
      setLoading(false);
      return;
    }

    const { data: semesters, error: semesterError } =
      await supabase
        .from('terms')
        .select(
          'id, academic_year_id, name, start_date, end_date, is_current'
        )
        .eq('academic_year_id', currentYear.id)
        .order('start_date');

    if (semesterError) {
      setError(semesterError.message);
      setLoading(false);
      return;
    }

    const currentSemester =
      (semesters ?? []).find(
        (item) => item.is_current
      ) ??
      (semesters ?? [])[0] ??
      null;

    setSemester(currentSemester);

    const { data: enrollments, error: enrollmentError } =
      await supabase
        .from('enrollments')
        .select(
          'id, student_id, class_id, academic_year_id, enrollment_date, status'
        )
        .eq('student_id', studentId)
        .eq('academic_year_id', currentYear.id)
        .order('enrollment_date', {
          ascending: false,
        });

    if (enrollmentError) {
      setError(enrollmentError.message);
      setLoading(false);
      return;
    }

    const currentEnrollment =
      (enrollments ?? []).find(
        (item) => item.status === 'active'
      ) ??
      (enrollments ?? [])[0] ??
      null;

    if (currentEnrollment) {
      const { data: classData } =
        await supabase
          .from('classes')
          .select(
            'id, name, level, programme_id'
          )
          .eq('id', currentEnrollment.class_id)
          .single();

      if (classData) {
        setSchoolClass(classData);

        if (classData.programme_id) {
          const { data: programmeData } =
            await supabase
              .from('programmes')
              .select('id, name')
              .eq(
                'id',
                classData.programme_id
              )
              .single();

          if (programmeData) {
            setProgramme(programmeData);
          }
        }
      }
    }

    let assessmentQuery = supabase
      .from('assessments')
      .select(
        'id, student_id, subject, assessment_type, score, max_score, term, created_at'
      )
      .eq('student_id', studentId)
      .order('created_at', {
        ascending: false,
      });

    if (currentSemester) {
      assessmentQuery =
        assessmentQuery.eq(
          'term',
          currentSemester.name
        );
    }

    const {
      data: assessmentData,
      error: assessmentError,
    } = await assessmentQuery;

    if (assessmentError) {
      setError(assessmentError.message);
      setLoading(false);
      return;
    }

    setAssessments(assessmentData ?? []);

    const {
      data: attendanceData,
      error: attendanceError,
    } = await supabase
      .from('attendance')
      .select(
        'id, student_id, date, status'
      )
      .eq('student_id', studentId)
      .order('date', {
        ascending: false,
      });

    if (attendanceError) {
      setError(attendanceError.message);
      setLoading(false);
      return;
    }

    setAttendance(attendanceData ?? []);

    const {
      data: newsData,
      error: newsError,
    } = await supabase
      .from('school_news')
      .select(
        'id, title, content, category, is_published, is_urgent, publish_date, created_at'
      )
      .eq('school_id', schoolId)
      .eq('is_published', true)
      .order('is_urgent', {
        ascending: false,
      })
      .order('publish_date', {
        ascending: false,
      })
      .order('created_at', {
        ascending: false,
      })
      .limit(5);

    if (newsError) {
      setError(newsError.message);
      setLoading(false);
      return;
    }

    setNews(newsData ?? []);

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const subjectResults = useMemo(() => {
    const subjectMap = new Map<
      string,
      Assessment[]
    >();

    for (const assessment of assessments) {
      const existing =
        subjectMap.get(assessment.subject) ?? [];

      existing.push(assessment);

      subjectMap.set(
        assessment.subject,
        existing
      );
    }

    const results: SubjectResult[] = [];

    for (const [subject, items] of subjectMap) {
      let caRaw = 0;
      let examScore = 0;
      let hasExamination = false;

      for (const item of items) {
        const score = Number(item.score) || 0;

        const maxScore =
          Number(item.max_score) || 100;

        if (
          item.assessment_type ===
          'Examination'
        ) {
          hasExamination = true;

          if (maxScore > 0) {
            examScore =
              (score / maxScore) * 100;
          }
        } else if (
          [
            'Exercise 1',
            'Exercise 2',
            'Exercise 3',
            'Exercise 4',
            'Class Test 1',
            'Class Test 2',
            'Class Test 3',
          ].includes(
            item.assessment_type
          )
        ) {
          if (maxScore > 0) {
            caRaw +=
              (score / maxScore) *
              (maxScore === 10 ||
              maxScore === 20
                ? maxScore
                : 100);
          }
        }
      }

      /*
       * BTI official grading:
       *
       * CA = 30%
       * Examination = 70%
       *
       * Exercises = 10 each
       * Class Tests = 20 each
       * Total CA = 100
       */
      const caContribution =
        Math.min(caRaw, 100) * 0.3;

      const examContribution =
        hasExamination
          ? examScore * 0.7
          : 0;

      const finalScore =
        caContribution +
        examContribution;

      results.push({
        subject,
        caRaw,
        caContribution,
        examScore,
        examContribution,
        finalScore,
        grade: getGrade(finalScore),
      });
    }

    return results.sort(
      (a, b) =>
        b.finalScore - a.finalScore
    );
  }, [assessments]);

  const overallAverage = useMemo(() => {
    if (!subjectResults.length) return 0;

    const total = subjectResults.reduce(
      (sum, result) =>
        sum + result.finalScore,
      0
    );

    return total / subjectResults.length;
  }, [subjectResults]);

  const passedSubjects =
    subjectResults.filter(
      (result) => result.finalScore >= 50
    ).length;

  const attendanceSummary = useMemo(() => {
    const total = attendance.length;

    const present = attendance.filter(
      (item) =>
        item.status.toLowerCase() ===
        'present'
    ).length;

    const late = attendance.filter(
      (item) =>
        item.status.toLowerCase() ===
        'late'
    ).length;

    const absent = attendance.filter(
      (item) =>
        item.status.toLowerCase() ===
        'absent'
    ).length;

    const excused = attendance.filter(
      (item) =>
        item.status.toLowerCase() ===
        'excused'
    ).length;

    const attended = present + late;

    const percentage =
      total > 0
        ? (attended / total) * 100
        : 0;

    return {
      total,
      present,
      late,
      absent,
      excused,
      attended,
      percentage,
    };
  }, [attendance]);

  const firstName =
    student?.full_name
      ?.trim()
      .split(/\s+/)[0] ??
    'Student';

  const attendanceProgress = Math.min(
    attendanceSummary.percentage,
    100
  );

  const performanceProgress = Math.min(
    overallAverage,
    100
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 pt-20 lg:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="bti-fade-up rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <i className="fa-solid fa-graduation-cap fa-2x bti-pulse" />
            </div>

            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

            <p className="font-semibold text-slate-800">
              Loading your student portal...
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Please wait while we load your academic information.
            </p>
          </div>
        </div>

        <style jsx global>{`
          .bti-pulse {
            animation: btiPulse 1.8s ease-in-out infinite;
          }

          @keyframes btiPulse {
            0%,
            100% {
              transform: scale(1);
              opacity: 0.7;
            }
            50% {
              transform: scale(1.08);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 pt-20 lg:p-10">
        <div className="mx-auto max-w-3xl">
          <div className="bti-fade-up rounded-3xl border border-red-200 bg-red-50 p-7 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <i className="fa-solid fa-triangle-exclamation text-2xl" />
            </div>

            <h1 className="mt-5 text-2xl font-bold text-red-900">
              Student Portal
            </h1>

            <p className="mt-2 text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() => loadDashboard()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md"
            >
              <i className="fa-solid fa-rotate-right" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        {/* ========================================================= */}
        {/* HERO HEADER */}
        {/* ========================================================= */}

        <section className="bti-fade-up relative mb-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-800 p-6 text-white shadow-xl sm:p-8 lg:p-10">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-100 backdrop-blur">
                <i className="fa-solid fa-building-columns" />
                Biriwa Technical Institute
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                Welcome, {firstName}
                <span className="ml-2 inline-block bti-wave">
                  👋
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">
                Welcome to your student portal. Your academic
                performance, attendance, school announcements and
                important student information are all available here.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {student?.admission_number && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur">
                    <i className="fa-solid fa-id-card" />
                    {student.admission_number}
                  </div>
                )}

                {semester && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur">
                    <i className="fa-solid fa-book-open" />
                    {semester.name}
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 justify-start sm:justify-end">
              {student?.photo_url ? (
                <div className="bti-photo-float rounded-[1.5rem] bg-white/10 p-2 shadow-2xl backdrop-blur">
                  <img
                    src={student.photo_url}
                    alt={student.full_name}
                    className="h-28 w-28 rounded-[1.2rem] border-2 border-white/30 object-cover sm:h-32 sm:w-32"
                  />
                </div>
              ) : (
                <div className="bti-photo-float flex h-28 w-28 items-center justify-center rounded-[1.5rem] border border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur sm:h-32 sm:w-32">
                  <i className="fa-solid fa-user-graduate text-5xl opacity-90" />
                </div>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="bti-fade-up mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
            <i className="fa-solid fa-circle-info mt-0.5 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* ACADEMIC INFORMATION */}
        {/* ========================================================= */}

        <section className="mb-8">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              Academic Overview
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Your Academic Information
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* Programme */}
            <div className="bti-card bti-delay-1 group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition duration-300 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white">
                  <i className="fa-solid fa-graduation-cap text-xl" />
                </div>

                <i className="fa-solid fa-arrow-up-right-from-square text-xs text-slate-300 transition group-hover:text-blue-500" />
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">
                Programme
              </p>

              <p className="mt-2 truncate text-lg font-bold text-slate-900">
                {programme?.name ?? 'Not assigned'}
              </p>
            </div>

            {/* Class */}
            <div className="bti-card bti-delay-2 group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition duration-300 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white">
                  <i className="fa-solid fa-school text-xl" />
                </div>

                <i className="fa-solid fa-arrow-up-right-from-square text-xs text-slate-300 transition group-hover:text-indigo-500" />
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">
                Class
              </p>

              <p className="mt-2 truncate text-lg font-bold text-slate-900">
                {schoolClass?.name ?? 'Not assigned'}
              </p>

              {schoolClass?.level && (
                <p className="mt-1 text-xs text-slate-500">
                  Level: {schoolClass.level}
                </p>
              )}
            </div>

            {/* Academic Year */}
            <div className="bti-card bti-delay-3 group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition duration-300 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white">
                  <i className="fa-solid fa-calendar-days text-xl" />
                </div>

                <i className="fa-solid fa-circle-check text-xs text-emerald-300 transition group-hover:text-emerald-500" />
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">
                Academic Year
              </p>

              <p className="mt-2 text-lg font-bold text-slate-900">
                {academicYear?.name ?? 'Not available'}
              </p>
            </div>

            {/* Semester */}
            <div className="bti-card bti-delay-4 group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition duration-300 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white">
                  <i className="fa-solid fa-book-open-reader text-xl" />
                </div>

                <i className="fa-solid fa-circle-play text-xs text-purple-300 transition group-hover:text-purple-500" />
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">
                Current Semester
              </p>

              <p className="mt-2 text-lg font-bold text-slate-900">
                {semester?.name ?? 'Not available'}
              </p>
            </div>

          </div>
        </section>

        {/* ========================================================= */}
        {/* PERFORMANCE */}
        {/* ========================================================= */}

        <section className="mb-8">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              Performance
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Academic Performance
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            {/* Average */}
            <div className="bti-stat group relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-50 transition duration-500 group-hover:scale-150" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Overall Average
                    </p>

                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-4xl font-black text-blue-600">
                        {overallAverage.toFixed(1)}
                      </span>

                      <span className="pb-1 text-sm font-medium text-slate-400">
                        / 100
                      </span>
                    </div>
                  </div>

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition duration-300 group-hover:rotate-6 group-hover:scale-110">
                    <i className="fa-solid fa-chart-line text-xl" />
                  </div>
                </div>

                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="bti-progress h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                    style={{
                      width: `${performanceProgress}%`,
                    }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-400">
                  <span>0</span>
                  <span>100</span>
                </div>
              </div>
            </div>

            {/* Passed */}
            <div className="bti-stat group relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-50 transition duration-500 group-hover:scale-150" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Subjects Passed
                    </p>

                    <p className="mt-3 text-4xl font-black text-emerald-600">
                      {passedSubjects}
                      <span className="ml-2 text-lg font-bold text-slate-300">
                        / {subjectResults.length}
                      </span>
                    </p>
                  </div>

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition duration-300 group-hover:rotate-6 group-hover:scale-110">
                    <i className="fa-solid fa-circle-check text-xl" />
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-slate-500">
                  Subjects with a final score of 50 or above.
                </p>
              </div>
            </div>

            {/* Attendance */}
            <div className="bti-stat group relative overflow-hidden rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-purple-50 transition duration-500 group-hover:scale-150" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Attendance
                    </p>

                    <p className="mt-3 text-4xl font-black text-purple-600">
                      {attendanceSummary.percentage.toFixed(1)}%
                    </p>
                  </div>

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition duration-300 group-hover:rotate-6 group-hover:scale-110">
                    <i className="fa-solid fa-calendar-check text-xl" />
                  </div>
                </div>

                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="bti-progress h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-600"
                    style={{
                      width: `${attendanceProgress}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  {attendanceSummary.attended} attended out of{' '}
                  {attendanceSummary.total} recorded days.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================= */}
        {/* NEWS + QUICK ACCESS */}
        {/* ========================================================= */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* News */}
          <section className="lg:col-span-2">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                  School Communication
                </p>

                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                  Latest News
                </h2>
              </div>

              {news.length > 0 && (
                <div className="hidden items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 sm:flex">
                  <i className="fa-solid fa-newspaper" />
                  {news.length} latest
                </div>
              )}
            </div>

            {news.length === 0 ? (
              <div className="bti-fade-up rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <i className="fa-regular fa-newspaper text-3xl" />
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-900">
                  No announcements yet
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Important school announcements will appear here when
                  they are published by the administration.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {news.map((item, index) => (
                  <article
                    key={item.id}
                    className={`bti-news bti-delay-${Math.min(
                      index + 1,
                      4
                    )} group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg ${
                      item.is_urgent
                        ? 'border-red-200 ring-1 ring-red-100'
                        : 'border-slate-200'
                    }`}
                  >
                    {item.is_urgent && (
                      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-red-500 to-orange-500" />
                    )}

                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition duration-300 group-hover:scale-110 group-hover:rotate-3 ${
                          item.is_urgent
                            ? 'bg-red-100 text-red-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}
                      >
                        <i
                          className={`fa-solid ${
                            item.is_urgent
                              ? 'fa-triangle-exclamation'
                              : getCategoryIcon(
                                  item.category,
                                  item.is_urgent
                                )
                          } text-lg`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-slate-900 transition group-hover:text-blue-700">
                                {item.title}
                              </h3>

                              {item.is_urgent && (
                                <span className="bti-urgent inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-700">
                                  <i className="fa-solid fa-bolt" />
                                  Urgent
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${getCategoryStyle(
                                  item.category,
                                  item.is_urgent
                                )}`}
                              >
                                <i
                                  className={`fa-solid ${getCategoryIcon(
                                    item.category,
                                    item.is_urgent
                                  )}`}
                                />
                                {item.category}
                              </span>

                              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                <i className="fa-regular fa-calendar" />
                                {formatNewsDate(
                                  item.publish_date
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">
                          {item.content}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Quick Access */}
          <aside>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              Student Portal
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Quick Access
            </h2>

            <div className="mt-5 space-y-3">

              {/* Profile */}
              <Link
                href={
                  student
                    ? `/students/${student.id}`
                    : '/student'
                }
                className="bti-quick group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition duration-300 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white">
                    <i className="fa-solid fa-user text-lg" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900">
                      My Profile
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      View your student information
                    </p>
                  </div>

                  <i className="fa-solid fa-chevron-right text-xs text-slate-300 transition duration-300 group-hover:translate-x-1 group-hover:text-blue-600" />
                </div>
              </Link>

              {/* Report Card */}
              <Link
                href={
                  student
                    ? `/report-card/${student.id}`
                    : '/student'
                }
                className="bti-quick group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition duration-300 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white">
                    <i className="fa-solid fa-file-lines text-lg" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900">
                      My Report Card
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      View your academic report
                    </p>
                  </div>

                  <i className="fa-solid fa-chevron-right text-xs text-slate-300 transition duration-300 group-hover:translate-x-1 group-hover:text-emerald-600" />
                </div>
              </Link>

              {/* Attendance */}
              <div className="bti-quick group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition duration-300 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white">
                    <i className="fa-solid fa-calendar-check text-lg" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900">
                      Attendance
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {attendanceSummary.present} present ·{' '}
                      {attendanceSummary.late} late ·{' '}
                      {attendanceSummary.absent} absent
                    </p>
                  </div>
                </div>
              </div>

              {/* Academic Formula */}
              <div className="bti-quick rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                    <i className="fa-solid fa-scale-balanced" />
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900">
                      BTI Grading
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Continuous Assessment contributes{' '}
                      <strong>30%</strong> and the Examination contributes{' '}
                      <strong>70%</strong>.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </aside>
        </div>

        {/* ========================================================= */}
        {/* RESULTS */}
        {/* ========================================================= */}

        <section className="mt-10">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                Academic Performance
              </p>

              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                Current Semester Results
              </h2>
            </div>

            {semester && (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                <i className="fa-solid fa-book-open text-blue-500" />
                {semester.name}
              </span>
            )}
          </div>

          {subjectResults.length === 0 ? (
            <div className="bti-fade-up rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                <i className="fa-solid fa-chart-column text-2xl" />
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900">
                No results available yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Your assessment results will appear here when they are
                recorded by your teachers.
              </p>
            </div>
          ) : (
            <div className="bti-table overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                        Subject
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                        CA / 30
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                        Exam / 70
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                        Final
                      </th>

                      <th className="px-5 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-500">
                        Grade
                      </th>

                      <th className="px-5 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {subjectResults.map(
                      (result, index) => (
                        <tr
                          key={result.subject}
                          className="bti-row group transition duration-200 hover:bg-blue-50/40"
                          style={{
                            animationDelay: `${index * 70}ms`,
                          }}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-blue-100 group-hover:text-blue-600">
                                <i className="fa-solid fa-book" />
                              </div>

                              <p className="font-bold text-slate-900">
                                {result.subject}
                              </p>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right text-sm font-medium text-slate-600">
                            {result.caContribution.toFixed(1)}
                          </td>

                          <td className="px-5 py-4 text-right text-sm font-medium text-slate-600">
                            {result.examContribution.toFixed(1)}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <span className="font-black text-slate-900">
                              {result.finalScore.toFixed(1)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${getGradeStyle(
                                result.grade
                              )}`}
                            >
                              <i
                                className={`fa-solid ${getGradeIcon(
                                  result.grade
                                )}`}
                              />
                              {result.grade}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            {result.finalScore >= 50 ? (
                              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600">
                                <i className="fa-solid fa-circle-check" />
                                Pass
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600">
                                <i className="fa-solid fa-circle-xmark" />
                                Fail
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* ATTENDANCE */}
        {/* ========================================================= */}

        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              Attendance
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Attendance Summary
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

            <div className="bti-attendance group rounded-2xl border border-emerald-200 bg-emerald-50 p-5 transition duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Present
                </p>

                <i className="fa-solid fa-user-check text-emerald-500 transition group-hover:scale-125" />
              </div>

              <p className="mt-3 text-3xl font-black text-emerald-800">
                {attendanceSummary.present}
              </p>
            </div>

            <div className="bti-attendance group rounded-2xl border border-yellow-200 bg-yellow-50 p-5 transition duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-yellow-700">
                  Late
                </p>

                <i className="fa-solid fa-clock text-yellow-500 transition group-hover:scale-125" />
              </div>

              <p className="mt-3 text-3xl font-black text-yellow-800">
                {attendanceSummary.late}
              </p>
            </div>

            <div className="bti-attendance group rounded-2xl border border-red-200 bg-red-50 p-5 transition duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-red-700">
                  Absent
                </p>

                <i className="fa-solid fa-user-xmark text-red-500 transition group-hover:scale-125" />
              </div>

              <p className="mt-3 text-3xl font-black text-red-800">
                {attendanceSummary.absent}
              </p>
            </div>

            <div className="bti-attendance group rounded-2xl border border-purple-200 bg-purple-50 p-5 transition duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-purple-700">
                  Excused
                </p>

                <i className="fa-solid fa-file-circle-check text-purple-500 transition group-hover:scale-125" />
              </div>

              <p className="mt-3 text-3xl font-black text-purple-800">
                {attendanceSummary.excused}
              </p>
            </div>

          </div>
        </section>

        {/* ========================================================= */}
        {/* FOOTER */}
        {/* ========================================================= */}

        <footer className="mt-12 border-t border-slate-200 pt-7 pb-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500">
            <i className="fa-solid fa-building-columns text-blue-500" />
            Biriwa Technical Institute
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Student Portal · Your academic information is private and protected.
          </p>
        </footer>

      </div>

      {/* =========================================================== */}
      {/* ANIMATION STYLES */}
      {/* =========================================================== */}

      <style jsx global>{`
        .bti-fade-up {
          animation: btiFadeUp 0.65s ease both;
        }

        .bti-card,
        .bti-stat,
        .bti-news,
        .bti-quick,
        .bti-attendance {
          animation: btiFadeUp 0.6s ease both;
        }

        .bti-delay-1 {
          animation-delay: 80ms;
        }

        .bti-delay-2 {
          animation-delay: 150ms;
        }

        .bti-delay-3 {
          animation-delay: 220ms;
        }

        .bti-delay-4 {
          animation-delay: 290ms;
        }

        .bti-card {
          transition:
            transform 0.3s ease,
            box-shadow 0.3s ease,
            border-color 0.3s ease;
        }

        .bti-card:hover {
          transform: translateY(-5px);
          box-shadow:
            0 16px 35px rgba(15, 23, 42, 0.09);
          border-color: rgba(59, 130, 246, 0.25);
        }

        .bti-stat {
          transition:
            transform 0.3s ease,
            box-shadow 0.3s ease;
        }

        .bti-stat:hover {
          transform: translateY(-4px);
          box-shadow:
            0 18px 40px rgba(15, 23, 42, 0.1);
        }

        .bti-quick {
          transition:
            transform 0.3s ease,
            box-shadow 0.3s ease,
            border-color 0.3s ease;
        }

        .bti-quick:hover {
          transform: translateY(-3px);
          box-shadow:
            0 15px 30px rgba(15, 23, 42, 0.08);
          border-color: rgba(59, 130, 246, 0.25);
        }

        .bti-progress {
          transform-origin: left;
          animation: btiProgress 1.2s cubic-bezier(0.22, 1, 0.36, 1)
            both;
        }

        .bti-news {
          transition:
            transform 0.3s ease,
            box-shadow 0.3s ease;
        }

        .bti-news:hover {
          transform: translateY(-3px);
          box-shadow:
            0 16px 35px rgba(15, 23, 42, 0.09);
        }

        .bti-row {
          animation: btiRow 0.5s ease both;
        }

        .bti-urgent {
          animation: btiUrgent 1.8s ease-in-out infinite;
        }

        .bti-photo-float {
          animation: btiFloat 4s ease-in-out infinite;
        }

        .bti-wave {
          transform-origin: 70% 70%;
          animation: btiWave 2.2s ease-in-out infinite;
        }

        @keyframes btiFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes btiProgress {
          from {
            transform: scaleX(0);
          }

          to {
            transform: scaleX(1);
          }
        }

        @keyframes btiRow {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes btiFloat {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-7px);
          }
        }

        @keyframes btiWave {
          0%,
          60%,
          100% {
            transform: rotate(0deg);
          }

          10%,
          30% {
            transform: rotate(14deg);
          }

          20% {
            transform: rotate(-8deg);
          }

          40% {
            transform: rotate(4deg);
          }

          50% {
            transform: rotate(-2deg);
          }
        }

        @keyframes btiUrgent {
          0%,
          100% {
            box-shadow: 0 0 0 rgba(239, 68, 68, 0);
          }

          50% {
            box-shadow: 0 0 14px rgba(239, 68, 68, 0.22);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bti-fade-up,
          .bti-card,
          .bti-stat,
          .bti-news,
          .bti-quick,
          .bti-attendance,
          .bti-progress,
          .bti-row,
          .bti-urgent,
          .bti-photo-float,
          .bti-wave {
            animation: none !important;
          }

          .bti-card,
          .bti-stat,
          .bti-news,
          .bti-quick,
          .bti-attendance {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

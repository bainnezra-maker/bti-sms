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
      return 'bg-green-100 text-green-700';
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
    return 'bg-red-100 text-red-700';
  }

  switch (category) {
    case 'Reopening':
      return 'bg-blue-100 text-blue-700';
    case 'Examination':
      return 'bg-purple-100 text-purple-700';
    case 'Fees':
      return 'bg-amber-100 text-amber-700';
    case 'Parents':
      return 'bg-green-100 text-green-700';
    case 'Academic':
      return 'bg-cyan-100 text-cyan-700';
    case 'Event':
      return 'bg-pink-100 text-pink-700';
    default:
      return 'bg-slate-100 text-slate-700';
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

    const { data: assessmentData, error: assessmentError } =
      await assessmentQuery;

    if (assessmentError) {
      setError(assessmentError.message);
      setLoading(false);
      return;
    }

    setAssessments(assessmentData ?? []);

    const { data: attendanceData, error: attendanceError } =
      await supabase
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

    const { data: newsData, error: newsError } =
      await supabase
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
       * CA = 30%
       * Examination = 70%
       *
       * CA components are recorded out of
       * their official maximums:
       * Exercises = 10 each
       * Class Tests = 20 each
       * Total CA = 100
       */
      const caContribution =
        Math.min(caRaw, 100) * 0.3;

      const examContribution = hasExamination
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

  const passedSubjects = subjectResults.filter(
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 pt-20 lg:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <p className="font-medium text-slate-700">
              Loading your student portal...
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Please wait while we load your academic information.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 pt-20 lg:p-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-xl font-bold text-red-800">
              Student Portal
            </h1>
            <p className="mt-2 text-red-700">
              {error}
            </p>
            <button
              type="button"
              onClick={() => loadDashboard()}
              className="mt-5 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">
                Biriwa Technical Institute
              </p>

              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                Welcome, {firstName}! 👋
              </h1>

              <p className="mt-2 max-w-2xl text-blue-100">
                Welcome to your student portal. View your academic
                information, results, attendance and important school
                announcements here.
              </p>

              {student?.admission_number && (
                <div className="mt-5 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur">
                  Admission No: {student.admission_number}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-center">
              {student?.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.full_name}
                  className="h-24 w-24 rounded-2xl border-4 border-white/30 object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/15 text-5xl backdrop-blur">
                  🎓
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {error}
          </div>
        )}

        {/* Academic information */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Programme
              </p>
              <span className="text-2xl">🎓</span>
            </div>

            <p className="mt-3 text-lg font-bold text-slate-900">
              {programme?.name ?? 'Not assigned'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Class
              </p>
              <span className="text-2xl">🏫</span>
            </div>

            <p className="mt-3 text-lg font-bold text-slate-900">
              {schoolClass?.name ?? 'Not assigned'}
            </p>

            {schoolClass?.level && (
              <p className="mt-1 text-xs text-slate-500">
                Level: {schoolClass.level}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Academic Year
              </p>
              <span className="text-2xl">📅</span>
            </div>

            <p className="mt-3 text-lg font-bold text-slate-900">
              {academicYear?.name ?? 'Not available'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Current Semester
              </p>
              <span className="text-2xl">📚</span>
            </div>

            <p className="mt-3 text-lg font-bold text-slate-900">
              {semester?.name ?? 'Not available'}
            </p>
          </div>
        </div>

        {/* Performance cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Overall Average
            </p>

            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-bold text-blue-600">
                {overallAverage.toFixed(1)}
              </span>
              <span className="pb-1 text-sm text-slate-400">
                / 100
              </span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{
                  width: `${Math.min(
                    overallAverage,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Subjects Passed
            </p>

            <p className="mt-3 text-4xl font-bold text-green-600">
              {passedSubjects}
              <span className="ml-2 text-lg font-medium text-slate-400">
                / {subjectResults.length}
              </span>
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Based on the current semester results.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Attendance
            </p>

            <p className="mt-3 text-4xl font-bold text-purple-600">
              {attendanceSummary.percentage.toFixed(1)}%
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {attendanceSummary.attended} attended out of{' '}
              {attendanceSummary.total} recorded days.
            </p>
          </div>
        </div>

        {/* News + quick links */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* News */}
          <section className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                  School Communication
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Latest News
                </h2>
              </div>

              {news.length > 0 && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {news.length} latest
                </span>
              )}
            </div>

            {news.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="text-5xl">📰</div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  No announcements yet
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Important school announcements will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {news.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
                      item.is_urgent
                        ? 'border-red-200 ring-1 ring-red-100'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
                            item.is_urgent
                              ? 'bg-red-100'
                              : 'bg-blue-100'
                          }`}
                        >
                          {item.is_urgent
                            ? '🚨'
                            : '📢'}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900">
                              {item.title}
                            </h3>

                            {item.is_urgent && (
                              <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">
                                Urgent
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getCategoryStyle(
                                item.category,
                                item.is_urgent
                              )}`}
                            >
                              {item.category}
                            </span>

                            <span className="text-xs text-slate-400">
                              {formatNewsDate(
                                item.publish_date
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">
                      {item.content}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Quick actions */}
          <aside>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Student Portal
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Quick Access
            </h2>

            <div className="mt-4 space-y-3">

              <Link
                href={
                  student
                    ? `/students/${student.id}`
                    : '/student'
                }
                className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl">
                    👤
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900">
                      My Profile
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      View your student information
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href={
                  student
                    ? `/report-card/${student.id}`
                    : '/student'
                }
                className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-2xl">
                    📄
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900">
                      My Report Card
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      View your academic report
                    </p>
                  </div>
                </div>
              </Link>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-2xl">
                    🕐
                  </div>

                  <div>
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

            </div>
          </aside>
        </div>

        {/* Current semester results */}
        <section className="mt-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Academic Performance
              </p>

              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                Current Semester Results
              </h2>
            </div>

            {semester && (
              <span className="text-sm text-slate-500">
                {semester.name}
              </span>
            )}
          </div>

          {subjectResults.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="text-5xl">📊</div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                No results available yet
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Your assessment results will appear here when they are
                recorded by your teachers.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Subject
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        CA / 30
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Exam / 70
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Final
                      </th>

                      <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                        Grade
                      </th>

                      <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {subjectResults.map(
                      (result) => (
                        <tr
                          key={result.subject}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">
                              {result.subject}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-right text-sm text-slate-600">
                            {result.caContribution.toFixed(1)}
                          </td>

                          <td className="px-5 py-4 text-right text-sm text-slate-600">
                            {result.examContribution.toFixed(1)}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <span className="font-bold text-slate-900">
                              {result.finalScore.toFixed(1)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getGradeStyle(
                                result.grade
                              )}`}
                            >
                              {result.grade}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            {result.finalScore >= 50 ? (
                              <span className="text-sm font-semibold text-green-600">
                                Pass
                              </span>
                            ) : (
                              <span className="text-sm font-semibold text-red-600">
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

        {/* Attendance summary */}
        <section className="mt-8">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Attendance
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Attendance Summary
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <p className="text-sm text-green-700">
                Present
              </p>
              <p className="mt-2 text-3xl font-bold text-green-800">
                {attendanceSummary.present}
              </p>
            </div>

            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
              <p className="text-sm text-yellow-700">
                Late
              </p>
              <p className="mt-2 text-3xl font-bold text-yellow-800">
                {attendanceSummary.late}
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm text-red-700">
                Absent
              </p>
              <p className="mt-2 text-3xl font-bold text-red-800">
                {attendanceSummary.absent}
              </p>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
              <p className="text-sm text-purple-700">
                Excused
              </p>
              <p className="mt-2 text-3xl font-bold text-purple-800">
                {attendanceSummary.excused}
              </p>
            </div>

          </div>
        </section>

        {/* Footer */}
        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          <p>
            Biriwa Technical Institute · Student Portal
          </p>

          <p className="mt-1">
            Your academic information is private and protected.
          </p>
        </div>

      </div>
    </div>
  );
}

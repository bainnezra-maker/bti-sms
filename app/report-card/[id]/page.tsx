'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
  date_of_birth: string | null;
  gender: string | null;
  status: string;
  jhs_aggregate: number | null;
  photo_url: string | null;
  conduct: string | null;
  promotion_status: string | null;
  class_teacher_remark: string | null;
  hod_remark: string | null;
  next_term_begins: string | null;
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

type Term = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  academic_year_id: string;
};

type Enrollment = {
  id: string;
  class_id: string;
  programme_id: string | null;
  academic_year_id: string;
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
};

type AttendanceRecord = {
  id: string;
  date: string;
  status: string;
};

type StudentClassAverage = {
  student_id: string;
  average: number;
};

const CA_TYPES = [
  'Exercise 1',
  'Exercise 2',
  'Exercise 3',
  'Exercise 4',
  'Class Test 1',
  'Class Test 2',
  'Class Test 3',
];

function getGrade(score: number) {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  if (score >= 40) return 'E';
  return 'F';
}

function getGradeDescription(score: number) {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Pass';
  if (score >= 40) return 'Weak';
  return 'Fail';
}

function formatDate(date: string | null) {
  if (!date) return '—';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getPositionSuffix(position: number) {
  if (position % 100 >= 11 && position % 100 <= 13) {
    return 'th';
  }

  switch (position % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function formatPosition(position: number | null) {
  if (!position) return '—';
  return `${position}${getPositionSuffix(position)}`;
}

function getStatus(status: string) {
  if (status === 'present') return 'Present';
  if (status === 'absent') return 'Absent';
  if (status === 'late') return 'Late';
  if (status === 'excused') return 'Excused';
  return status;
}

export default function ReportCardPage() {
  const params = useParams();
  const router = useRouter();

  const studentId = String(params.id);

  const supabase = createClient();

  const [student, setStudent] = useState<Student | null>(null);

  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);

  const [terms, setTerms] = useState<Term[]>([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');

  const [enrollment, setEnrollment] =
    useState<Enrollment | null>(null);

  const [className, setClassName] = useState('—');
  const [programmeName, setProgrammeName] = useState('—');
  const [level, setLevel] = useState('—');

  const [assessments, setAssessments] = useState<
    Assessment[]
  >([]);

  const [attendance, setAttendance] = useState<
    AttendanceRecord[]
  >([]);

  const [classAverages, setClassAverages] = useState<
    StudentClassAverage[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] =
    useState(false);

  const [error, setError] = useState('');

  // ------------------------------------------------------------
  // LOAD STUDENT
  // ------------------------------------------------------------
  useEffect(() => {
    async function loadStudent() {
      setLoading(true);
      setError('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from('users')
          .select('school_id')
          .eq('id', user.id)
          .maybeSingle();

      if (
        profileError ||
        !profile?.school_id
      ) {
        setError(
          'Could not load your school information.'
        );
        setLoading(false);
        return;
      }

      const { data: studentData, error: studentError } =
        await supabase
          .from('students')
          .select(`
            id,
            full_name,
            admission_number,
            date_of_birth,
            gender,
            status,
            jhs_aggregate,
            photo_url,
            conduct,
            promotion_status,
            class_teacher_remark,
            hod_remark,
            next_term_begins
          `)
          .eq('id', studentId)
          .eq('school_id', profile.school_id)
          .maybeSingle();

      if (studentError || !studentData) {
        setError(
          studentError?.message ||
            'Student could not be found.'
        );
        setLoading(false);
        return;
      }

      setStudent(studentData);

      const { data: yearData, error: yearError } =
        await supabase
          .from('academic_years')
          .select(`
            id,
            name,
            start_date,
            end_date,
            is_current
          `)
          .eq('school_id', profile.school_id)
          .order('name', { ascending: false });

      if (yearError) {
        setError(yearError.message);
      } else {
        setAcademicYears(yearData || []);

        const currentYear = yearData?.find(
          (year) => year.is_current
        );

        if (currentYear) {
          setSelectedYear(currentYear.id);
        } else if (yearData?.length) {
          setSelectedYear(yearData[0].id);
        }
      }

      setLoading(false);
    }

    loadStudent();
  }, [studentId]);

  // ------------------------------------------------------------
  // LOAD TERMS FOR SELECTED YEAR
  // ------------------------------------------------------------
  useEffect(() => {
    async function loadTerms() {
      if (!selectedYear) {
        setTerms([]);
        setSelectedTerm('');
        return;
      }

      const { data, error } = await supabase
        .from('terms')
        .select(`
          id,
          name,
          start_date,
          end_date,
          is_current,
          academic_year_id
        `)
        .eq('academic_year_id', selectedYear)
        .order('start_date');

      if (error) {
        setError(error.message);
        return;
      }

      setTerms(data || []);

      const currentTerm = data?.find(
        (term) => term.is_current
      );

      if (currentTerm) {
        setSelectedTerm(currentTerm.id);
      } else if (data?.length) {
        setSelectedTerm(data[0].id);
      } else {
        setSelectedTerm('');
      }
    }

    loadTerms();
  }, [selectedYear]);

  // ------------------------------------------------------------
  // LOAD ENROLLMENT + CLASS + PROGRAMME
  // ------------------------------------------------------------
  useEffect(() => {
    async function loadEnrollment() {
      if (!student || !selectedYear) {
        setEnrollment(null);
        return;
      }

      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          class_id,
          programme_id,
          academic_year_id,
          status
        `)
        .eq('student_id', student.id)
        .eq('academic_year_id', selectedYear)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        setError(error.message);
        return;
      }

      setEnrollment(data);

      if (!data) {
        setClassName('—');
        setProgrammeName('—');
        setLevel('—');
        return;
      }

      const { data: classData } =
        await supabase
          .from('classes')
          .select(
            'id, name, level, programme_id'
          )
          .eq('id', data.class_id)
          .maybeSingle();

      if (classData) {
        setClassName(classData.name);
        setLevel(classData.level || '—');
      }

      if (data.programme_id) {
        const { data: programmeData } =
          await supabase
            .from('programmes')
            .select('id, name')
            .eq('id', data.programme_id)
            .maybeSingle();

        if (programmeData) {
          setProgrammeName(programmeData.name);
        }
      }
    }

    loadEnrollment();
  }, [student, selectedYear]);

  // ------------------------------------------------------------
  // LOAD TERM RESULTS + TERM ATTENDANCE
  // ------------------------------------------------------------
  useEffect(() => {
    async function loadTermData() {
      if (
        !student ||
        !selectedTerm ||
        !selectedYear ||
        !enrollment
      ) {
        return;
      }

      setLoadingResults(true);
      setError('');

      const selectedTermData = terms.find(
        (term) => term.id === selectedTerm
      );

      if (!selectedTermData) {
        setLoadingResults(false);
        return;
      }

      // --------------------------------------------------------
      // ASSESSMENTS
      // --------------------------------------------------------
      const { data: assessmentData, error: assessmentError } =
        await supabase
          .from('assessments')
          .select(`
            id,
            student_id,
            subject,
            assessment_type,
            score,
            max_score,
            term
          `)
          .eq('student_id', student.id)
          .eq('term', selectedTermData.name)
          .order('subject');

      if (assessmentError) {
        setError(assessmentError.message);
      } else {
        setAssessments(assessmentData || []);
      }

      // --------------------------------------------------------
      // TERM ATTENDANCE
      //
      // Only attendance records between the selected
      // term's start and end dates are counted.
      // --------------------------------------------------------
      let attendanceQuery = supabase
        .from('attendance')
        .select(`
          id,
          date,
          status
        `)
        .eq('student_id', student.id);

      if (selectedTermData.start_date) {
        attendanceQuery = attendanceQuery.gte(
          'date',
          selectedTermData.start_date
        );
      }

      if (selectedTermData.end_date) {
        attendanceQuery = attendanceQuery.lte(
          'date',
          selectedTermData.end_date
        );
      }

      const {
        data: attendanceData,
        error: attendanceError,
      } = await attendanceQuery.order('date', {
        ascending: false,
      });

      if (attendanceError) {
        setError(attendanceError.message);
      } else {
        setAttendance(
          attendanceData || []
        );
      }

      // --------------------------------------------------------
      // CLASS STUDENTS
      // --------------------------------------------------------
      const { data: classEnrollmentData } =
        await supabase
          .from('enrollments')
          .select('student_id')
          .eq(
            'class_id',
            enrollment.class_id
          )
          .eq(
            'academic_year_id',
            selectedYear
          )
          .eq('status', 'active');

      const classStudentIds =
        classEnrollmentData?.map(
          (item) => item.student_id
        ) || [];

      if (!classStudentIds.length) {
        setClassAverages([]);
        setLoadingResults(false);
        return;
      }

      // --------------------------------------------------------
      // CLASS ASSESSMENTS FOR POSITION
      // --------------------------------------------------------
      const { data: classAssessmentData } =
        await supabase
          .from('assessments')
          .select(`
            id,
            student_id,
            subject,
            assessment_type,
            score,
            max_score,
            term
          `)
          .in(
            'student_id',
            classStudentIds
          )
          .eq(
            'term',
            selectedTermData.name
          );

      const byStudent: Record<
        string,
        Record<
          string,
          {
            caRaw: number;
            examRaw: number;
          }
        >
      > = {};

      (classAssessmentData || []).forEach(
        (assessment) => {
          if (!byStudent[assessment.student_id]) {
            byStudent[assessment.student_id] = {};
          }

          if (
            !byStudent[assessment.student_id][
              assessment.subject
            ]
          ) {
            byStudent[assessment.student_id][
              assessment.subject
            ] = {
              caRaw: 0,
              examRaw: 0,
            };
          }

          const subjectData =
            byStudent[assessment.student_id][
              assessment.subject
            ];

          const score =
            Number(assessment.score) || 0;

          if (
            CA_TYPES.includes(
              assessment.assessment_type
            )
          ) {
            subjectData.caRaw += score;
          }

          if (
            assessment.assessment_type ===
            'Examination'
          ) {
            subjectData.examRaw = score;
          }
        }
      );

      const averages: StudentClassAverage[] = [];

      classStudentIds.forEach(
        (classStudentId) => {
          const subjectData =
            byStudent[classStudentId] || {};

          const finals = Object.values(
            subjectData
          ).map((subject) => {
            const caContribution =
              (subject.caRaw / 100) * 30;

            const examContribution =
              (subject.examRaw / 100) * 70;

            return (
              caContribution +
              examContribution
            );
          });

          const average =
            finals.length > 0
              ? finals.reduce(
                  (sum, value) =>
                    sum + value,
                  0
                ) / finals.length
              : 0;

          averages.push({
            student_id: classStudentId,
            average,
          });
        }
      );

      setClassAverages(averages);

      setLoadingResults(false);
    }

    loadTermData();
  }, [
    student,
    selectedTerm,
    selectedYear,
    enrollment,
    terms,
  ]);

  // ------------------------------------------------------------
  // SUBJECT RESULTS
  // ------------------------------------------------------------
  const subjectResults = useMemo(() => {
    const subjects: Record<
      string,
      {
        caRaw: number;
        caContribution: number;
        examRaw: number;
        examContribution: number;
        final: number;
      }
    > = {};

    assessments.forEach((assessment) => {
      if (!subjects[assessment.subject]) {
        subjects[assessment.subject] = {
          caRaw: 0,
          caContribution: 0,
          examRaw: 0,
          examContribution: 0,
          final: 0,
        };
      }

      const score =
        Number(assessment.score) || 0;

      if (
        CA_TYPES.includes(
          assessment.assessment_type
        )
      ) {
        subjects[
          assessment.subject
        ].caRaw += score;
      }

      if (
        assessment.assessment_type ===
        'Examination'
      ) {
        subjects[
          assessment.subject
        ].examRaw = score;
      }
    });

    return Object.entries(subjects)
      .map(([subject, values]) => {
        const caContribution =
          (values.caRaw / 100) * 30;

        const examContribution =
          (values.examRaw / 100) * 70;

        const final =
          caContribution +
          examContribution;

        return {
          subject,
          caRaw: values.caRaw,
          caContribution,
          examRaw: values.examRaw,
          examContribution,
          final,
          grade: getGrade(final),
          status:
            final >= 50
              ? 'Pass'
              : 'Fail',
        };
      })
      .sort((a, b) =>
        a.subject.localeCompare(b.subject)
      );
  }, [assessments]);

  // ------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------
  const totalFinal = useMemo(() => {
    return subjectResults.reduce(
      (sum, subject) =>
        sum + subject.final,
      0
    );
  }, [subjectResults]);

  const average = useMemo(() => {
    if (!subjectResults.length) return 0;

    return (
      totalFinal /
      subjectResults.length
    );
  }, [
    totalFinal,
    subjectResults.length,
  ]);

  const passed = subjectResults.filter(
    (subject) =>
      subject.status === 'Pass'
  ).length;

  const failed = subjectResults.filter(
    (subject) =>
      subject.status === 'Fail'
  ).length;

  const overallGrade = getGrade(average);

  // ------------------------------------------------------------
  // POSITION
  // ------------------------------------------------------------
  const studentAverage =
    classAverages.find(
      (item) =>
        item.student_id === student?.id
    )?.average || 0;

  const position = useMemo(() => {
    if (!student) return null;

    const sorted = [...classAverages].sort(
      (a, b) =>
        b.average - a.average
    );

    if (!sorted.length) return null;

    return (
      sorted.filter(
        (item) =>
          item.average >
          studentAverage
      ).length + 1
    );
  }, [
    classAverages,
    student,
    studentAverage,
  ]);

  // ------------------------------------------------------------
  // TERM ATTENDANCE SUMMARY
  // ------------------------------------------------------------
  const attendanceSummary = useMemo(() => {
    const total =
      attendance.length;

    const present =
      attendance.filter(
        (record) =>
          record.status === 'present'
      ).length;

    const absent =
      attendance.filter(
        (record) =>
          record.status === 'absent'
      ).length;

    const late =
      attendance.filter(
        (record) =>
          record.status === 'late'
      ).length;

    const excused =
      attendance.filter(
        (record) =>
          record.status === 'excused'
      ).length;

    // Present + Late are counted as attended.
    // Absent is not counted.
    // Excused remains recorded separately.
    const attended =
      present + late;

    const percentage =
      total > 0
        ? (attended / total) * 100
        : 0;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attended,
      percentage,
    };
  }, [attendance]);

  // ------------------------------------------------------------
  // SELECTED YEAR / TERM
  // ------------------------------------------------------------
  const selectedYearData =
    academicYears.find(
      (year) =>
        year.id === selectedYear
    );

  const selectedTermData =
    terms.find(
      (term) =>
        term.id === selectedTerm
    );

  // ------------------------------------------------------------
  // OVERALL REMARK
  // ------------------------------------------------------------
  const overallRemark = useMemo(() => {
    if (!subjectResults.length) {
      return 'No results recorded.';
    }

    if (average >= 80) {
      return 'Excellent performance. Keep up the good work.';
    }

    if (average >= 70) {
      return 'Very good performance. Continue to work hard.';
    }

    if (average >= 60) {
      return 'Good performance. There is room for further improvement.';
    }

    if (average >= 50) {
      return 'Satisfactory performance. More effort is encouraged.';
    }

    return 'Performance needs improvement. Greater effort and support are recommended.';
  }, [
    average,
    subjectResults.length,
  ]);

  // ------------------------------------------------------------
  // LOADING SCREEN
  // ------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 text-center shadow-sm">
          Loading report card...
        </div>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-red-600">
            {error}
          </p>

          <Link
            href="/students"
            className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
          >
            Back to Students
          </Link>
        </div>
      </div>
    );
  }

  if (!student) return null;

  // ------------------------------------------------------------
  // PAGE
  // ------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-5">

      {/* SCREEN CONTROLS */}
      <div className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 print:hidden">

        <Link
          href={`/students/${student.id}`}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
        >
          ← Student Profile
        </Link>

        <div className="flex flex-wrap gap-2">

          <select
            value={selectedYear}
            onChange={(event) =>
              setSelectedYear(
                event.target.value
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {academicYears.map(
              (year) => (
                <option
                  key={year.id}
                  value={year.id}
                >
                  {year.name}
                </option>
              )
            )}
          </select>

          <select
            value={selectedTerm}
            onChange={(event) =>
              setSelectedTerm(
                event.target.value
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {terms.map(
              (term) => (
                <option
                  key={term.id}
                  value={term.id}
                >
                  {term.name}
                </option>
              )
            )}
          </select>

          <button
            type="button"
            onClick={() =>
              window.print()
            }
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Print Report Card
          </button>

        </div>
      </div>

      {/* REPORT CARD */}
      <main className="report-card mx-auto max-w-5xl bg-white p-5 shadow-lg sm:p-8">

        {/* SCHOOL HEADER */}
        <header className="border-b-4 border-slate-900 pb-4">

          <div className="flex items-center gap-4">

            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-slate-900 text-2xl font-black">
              BTI
            </div>

            <div className="flex-1 text-center">

              <h1 className="text-2xl font-black uppercase tracking-wide sm:text-3xl">
                Biriwa Technical Institute
              </h1>

              <p className="mt-1 text-sm font-medium text-slate-600">
                Student Academic Report Card
              </p>

              <p className="mt-2 text-sm font-bold">
                {selectedYearData?.name ||
                  'Academic Year'}
                {' • '}
                {selectedTermData?.name ||
                  'Term'}
              </p>

            </div>

            {student.photo_url ? (
              <img
                src={student.photo_url}
                alt={student.full_name}
                className="h-24 w-20 shrink-0 rounded-lg border border-slate-300 object-cover"
              />
            ) : (
              <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-xs text-slate-400">
                PHOTO
              </div>
            )}

          </div>

        </header>

        {/* ERROR */}
        {error && (
          <div className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 print:hidden">
            {error}
          </div>
        )}

        {/* STUDENT INFORMATION */}
        <section className="mt-5">

          <h2 className="section-heading">
            STUDENT INFORMATION
          </h2>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-300 bg-slate-300 sm:grid-cols-4">

            <div className="bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Student Name
              </p>
              <p className="mt-1 text-sm font-bold">
                {student.full_name}
              </p>
            </div>

            <div className="bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Admission Number
              </p>
              <p className="mt-1 text-sm font-bold">
                {student.admission_number}
              </p>
            </div>

            <div className="bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Class
              </p>
              <p className="mt-1 text-sm font-bold">
                {className}
              </p>
            </div>

            <div className="bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Programme
              </p>
              <p className="mt-1 text-sm font-bold">
                {programmeName}
              </p>
            </div>

            <div className="bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Level
              </p>
              <p className="mt-1 text-sm font-bold">
                {level}
              </p>
            </div>

            <div className="bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Gender
              </p>
              <p className="mt-1 text-sm font-bold">
                {student.gender || '—'}
              </p>
            </div>

            <div className="bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                JHS Aggregate
              </p>
              <p className="mt-1 text-sm font-bold">
                {student.jhs_aggregate ??
                  '—'}
              </p>
            </div>

            <div className="bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Report Status
              </p>
              <p className="mt-1 text-sm font-bold capitalize">
                {student.status}
              </p>
            </div>

          </div>

        </section>

        {/* ACADEMIC PERFORMANCE */}
        <section className="mt-5">

          <h2 className="section-heading">
            ACADEMIC PERFORMANCE
          </h2>

          <div className="overflow-x-auto rounded-lg border border-slate-300">

            <table className="w-full min-w-[720px] border-collapse text-xs">

              <thead>
                <tr className="bg-slate-900 text-white">

                  <th className="border border-slate-700 px-2 py-2 text-left">
                    Subject
                  </th>

                  <th className="border border-slate-700 px-2 py-2">
                    CA<br />
                    <span className="font-normal">
                      /100
                    </span>
                  </th>

                  <th className="border border-slate-700 px-2 py-2">
                    CA<br />
                    <span className="font-normal">
                      /30
                    </span>
                  </th>

                  <th className="border border-slate-700 px-2 py-2">
                    Exam<br />
                    <span className="font-normal">
                      /100
                    </span>
                  </th>

                  <th className="border border-slate-700 px-2 py-2">
                    Exam<br />
                    <span className="font-normal">
                      /70
                    </span>
                  </th>

                  <th className="border border-slate-700 px-2 py-2">
                    Final<br />
                    <span className="font-normal">
                      /100
                    </span>
                  </th>

                  <th className="border border-slate-700 px-2 py-2">
                    Grade
                  </th>

                  <th className="border border-slate-700 px-2 py-2">
                    Status
                  </th>

                </tr>
              </thead>

              <tbody>

                {loadingResults ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-6 text-center text-slate-500"
                    >
                      Loading results...
                    </td>
                  </tr>
                ) : subjectResults.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-6 text-center text-slate-500"
                    >
                      No assessment results have
                      been recorded for this term.
                    </td>
                  </tr>
                ) : (
                  subjectResults.map(
                    (result) => (
                      <tr
                        key={result.subject}
                        className="even:bg-slate-50"
                      >

                        <td className="border border-slate-300 px-2 py-2 font-semibold">
                          {result.subject}
                        </td>

                        <td className="border border-slate-300 px-2 py-2 text-center">
                          {result.caRaw.toFixed(1)}
                        </td>

                        <td className="border border-slate-300 px-2 py-2 text-center">
                          {result.caContribution.toFixed(
                            1
                          )}
                        </td>

                        <td className="border border-slate-300 px-2 py-2 text-center">
                          {result.examRaw.toFixed(1)}
                        </td>

                        <td className="border border-slate-300 px-2 py-2 text-center">
                          {result.examContribution.toFixed(
                            1
                          )}
                        </td>

                        <td className="border border-slate-300 px-2 py-2 text-center font-bold">
                          {result.final.toFixed(1)}
                        </td>

                        <td className="border border-slate-300 px-2 py-2 text-center font-bold">
                          {result.grade}
                        </td>

                        <td className="border border-slate-300 px-2 py-2 text-center font-semibold">
                          {result.status}
                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

            </table>

          </div>

        </section>

        {/* PERFORMANCE SUMMARY */}
        <section className="mt-5">

          <h2 className="section-heading">
            PERFORMANCE SUMMARY
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">

            <div className="summary-box">
              <p className="summary-label">
                Subjects
              </p>
              <p className="summary-value">
                {subjectResults.length}
              </p>
            </div>

            <div className="summary-box">
              <p className="summary-label">
                Average
              </p>
              <p className="summary-value">
                {average.toFixed(1)}%
              </p>
            </div>

            <div className="summary-box">
              <p className="summary-label">
                Grade
              </p>
              <p className="summary-value">
                {overallGrade}
              </p>
            </div>

            <div className="summary-box">
              <p className="summary-label">
                Position
              </p>
              <p className="summary-value">
                {formatPosition(position)}
              </p>
            </div>

            <div className="summary-box">
              <p className="summary-label">
                Passed
              </p>
              <p className="summary-value">
                {passed}/{subjectResults.length}
              </p>
            </div>

          </div>

        </section>

        {/* OVERALL PERFORMANCE */}
        <section className="mt-5">

          <div className="rounded-lg border border-slate-300 p-4">

            <div className="flex items-center justify-between gap-3">

              <div>
                <p className="text-xs font-bold uppercase text-slate-500">
                  Overall Performance
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {getGradeDescription(
                    average
                  )}
                </p>
              </div>

              <p className="text-2xl font-black">
                {average.toFixed(1)}%
              </p>

            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">

              <div
                className="h-full rounded-full bg-slate-900"
                style={{
                  width: `${Math.min(
                    Math.max(average, 0),
                    100
                  )}%`,
                }}
              />

            </div>

            <p className="mt-3 text-xs text-slate-600">
              {overallRemark}
            </p>

          </div>

        </section>

        {/* ATTENDANCE */}
        <section className="mt-5">

          <h2 className="section-heading">
            TERM ATTENDANCE
          </h2>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-300 bg-slate-300 sm:grid-cols-6">

            <div className="attendance-box">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                School Days Recorded
              </p>
              <p className="mt-1 text-lg font-black">
                {attendanceSummary.total}
              </p>
            </div>

            <div className="attendance-box">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Present
              </p>
              <p className="mt-1 text-lg font-black">
                {attendanceSummary.present}
              </p>
            </div>

            <div className="attendance-box">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Absent
              </p>
              <p className="mt-1 text-lg font-black">
                {attendanceSummary.absent}
              </p>
            </div>

            <div className="attendance-box">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Late
              </p>
              <p className="mt-1 text-lg font-black">
                {attendanceSummary.late}
              </p>
            </div>

            <div className="attendance-box">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Excused
              </p>
              <p className="mt-1 text-lg font-black">
                {attendanceSummary.excused}
              </p>
            </div>

            <div className="attendance-box">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Attendance %
              </p>
              <p className="mt-1 text-lg font-black">
                {attendanceSummary.percentage.toFixed(
                  1
                )}
                %
              </p>
            </div>

          </div>

          {selectedTermData && (
            <p className="mt-2 text-xs text-slate-500">
              Attendance period:{' '}
              {formatDate(
                selectedTermData.start_date
              )}{' '}
              to{' '}
              {formatDate(
                selectedTermData.end_date
              )}
            </p>
          )}

        </section>

        {/* CONDUCT AND PROMOTION */}
        <section className="mt-5">

          <h2 className="section-heading">
            CONDUCT & PROMOTION
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">

            <div className="rounded-lg border border-slate-300 p-4">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Conduct / Attitude
              </p>

              <p className="mt-2 text-sm font-semibold">
                {student.conduct ||
                  'Not recorded'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-300 p-4">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Promotion Status
              </p>

              <p className="mt-2 text-sm font-semibold">
                {student.promotion_status ||
                  'Not recorded'}
              </p>
            </div>

          </div>

        </section>

        {/* REMARKS */}
        <section className="mt-5">

          <h2 className="section-heading">
            REMARKS
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">

            <div className="rounded-lg border border-slate-300 p-4">

              <p className="text-xs font-bold uppercase text-slate-500">
                Class Teacher's Remark
              </p>

              <p className="mt-3 min-h-[70px] text-sm leading-6">
                {student.class_teacher_remark ||
                  'No remark recorded.'}
              </p>

            </div>

            <div className="rounded-lg border border-slate-300 p-4">

              <p className="text-xs font-bold uppercase text-slate-500">
                HOD / Head's Remark
              </p>

              <p className="mt-3 min-h-[70px] text-sm leading-6">
                {student.hod_remark ||
                  'No remark recorded.'}
              </p>

            </div>

          </div>

        </section>

        {/* NEXT TERM */}
        <section className="mt-5">

          <div className="rounded-lg border border-slate-300 p-4">

            <p className="text-xs font-bold uppercase text-slate-500">
              Next Term Begins
            </p>

            <p className="mt-2 text-sm font-bold">
              {formatDate(
                student.next_term_begins
              )}
            </p>

          </div>

        </section>

        {/* GRADING KEY */}
        <section className="mt-5">

          <h2 className="section-heading">
            GRADING KEY
          </h2>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-6">

            <div className="rounded border p-2">
              <strong>A</strong> — 80–100
            </div>

            <div className="rounded border p-2">
              <strong>B</strong> — 70–79
            </div>

            <div className="rounded border p-2">
              <strong>C</strong> — 60–69
            </div>

            <div className="rounded border p-2">
              <strong>D</strong> — 50–59
            </div>

            <div className="rounded border p-2">
              <strong>E</strong> — 40–49
            </div>

            <div className="rounded border p-2">
              <strong>F</strong> — 0–39
            </div>

          </div>

        </section>

        {/* SIGNATURES */}
        <section className="mt-10 grid gap-10 sm:grid-cols-3">

          <div>
            <div className="signature-line" />
            <p className="mt-2 text-center text-xs font-semibold">
              Class Teacher
            </p>
          </div>

          <div>
            <div className="signature-line" />
            <p className="mt-2 text-center text-xs font-semibold">
              HOD / Head
            </p>
          </div>

          <div>
            <div className="signature-line" />
            <p className="mt-2 text-center text-xs font-semibold">
              Date
            </p>
          </div>

        </section>

        {/* FOOTER */}
        <footer className="mt-8 border-t border-slate-300 pt-3 text-center text-[10px] text-slate-500">
          Biriwa Technical Institute • Official Student Report Card
        </footer>

      </main>

      {/* PRINT STYLES */}
      <style jsx global>{`
        .section-heading {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 6px;
          margin-bottom: 10px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .summary-box {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
        }

        .summary-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
        }

        .summary-value {
          margin-top: 4px;
          font-size: 18px;
          font-weight: 900;
        }

        .attendance-box {
          background: white;
          padding: 12px;
          text-align: center;
        }

        .signature-line {
          height: 1px;
          background: #0f172a;
          width: 100%;
        }

        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }

          html,
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .report-card {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          section,
          header,
          footer {
            break-inside: avoid;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            break-inside: avoid;
          }
        }
      `}</style>

    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  admission_number: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
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
  is_current: boolean | null;
};

type Term = {
  id: string;
  name: string;
  is_current: boolean | null;
};

type Enrollment = {
  id: string;
  class_id: string;
  programme_id: string | null;
  academic_year_id: string;
  enrollment_date: string;
  status: string;
  class: {
    id: string;
    name: string;
    level: string | null;
  }[] | null;
  programme: {
    id: string;
    name: string;
    code: string | null;
  }[] | null;
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

function getGradeDescription(grade: string) {
  switch (grade) {
    case 'A':
      return 'Excellent';
    case 'B':
      return 'Very Good';
    case 'C':
      return 'Good';
    case 'D':
      return 'Credit';
    case 'E':
      return 'Pass';
    default:
      return 'Fail';
  }
}

function formatDate(date: string | null) {
  if (!date) return '—';

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return date;

  return value.toLocaleDateString('en-GB', {
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

export default function ReportCardPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [classAverages, setClassAverages] = useState<
    StudentClassAverage[]
  >([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [studentId]);

  useEffect(() => {
    if (selectedYear && student) {
      loadTerms(selectedYear);
    }
  }, [selectedYear, student]);

  useEffect(() => {
    if (selectedYear && selectedTerm && student) {
      loadReportData();
    }
  }, [selectedYear, selectedTerm, student, enrollment]);

  async function getSchoolId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return null;
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    return userProfile?.school_id || null;
  }

  async function loadInitialData() {
    setLoading(true);

    const schoolId = await getSchoolId();

    if (!schoolId) {
      setLoading(false);
      return;
    }

    const { data: studentData, error: studentError } =
      await supabase
        .from('students')
        .select(`
          id,
          admission_number,
          full_name,
          date_of_birth,
          gender,
          jhs_aggregate,
          photo_url,
          conduct,
          promotion_status,
          class_teacher_remark,
          hod_remark,
          next_term_begins
        `)
        .eq('id', studentId)
        .eq('school_id', schoolId)
        .single();

    if (studentError || !studentData) {
      setLoading(false);
      return;
    }

    setStudent(studentData as Student);

    const { data: yearsData } = await supabase
      .from('academic_years')
      .select('id, name, is_current')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false });

    const years = (yearsData || []) as AcademicYear[];

    setAcademicYears(years);

    const currentYear =
      years.find((year) => year.is_current) || years[0];

    if (currentYear) {
      setSelectedYear(currentYear.id);

      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select(`
          id,
          class_id,
          programme_id,
          academic_year_id,
          enrollment_date,
          status,
          class:classes (
            id,
            name,
            level
          ),
          programme:programmes (
            id,
            name,
            code
          )
        `)
        .eq('student_id', studentId)
        .eq('academic_year_id', currentYear.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (enrollmentData) {
        setEnrollment(enrollmentData as Enrollment);
      }
    }

    setLoading(false);
  }

  async function loadTerms(yearId: string) {
    const { data } = await supabase
      .from('terms')
      .select('id, name, is_current')
      .eq('academic_year_id', yearId)
      .order('start_date', { ascending: true });

    const loadedTerms = (data || []) as Term[];

    setTerms(loadedTerms);

    const currentTerm =
      loadedTerms.find((term) => term.is_current) ||
      loadedTerms[0];

    if (currentTerm) {
      setSelectedTerm(currentTerm.id);
    }
  }

  async function loadReportData() {
    if (!student || !selectedTerm || !selectedYear) return;

    setLoadingResults(true);

    const selectedTermObject = terms.find(
      (term) => term.id === selectedTerm
    );

    if (!selectedTermObject) {
      setLoadingResults(false);
      return;
    }

    const termName = selectedTermObject.name;

    const { data: assessmentData } = await supabase
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
      .eq('term', termName);

    setAssessments((assessmentData || []) as Assessment[]);

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select(`
        id,
        date,
        status
      `)
      .eq('student_id', student.id)
      .order('date', { ascending: false });

    setAttendance((attendanceData || []) as AttendanceRecord[]);

    if (enrollment) {
      await loadClassAverages(
        enrollment.class_id,
        selectedYear,
        termName
      );
    } else {
      setClassAverages([]);
    }

    setLoadingResults(false);
  }

  async function loadClassAverages(
    classId: string,
    yearId: string,
    termName: string
  ) {
    const { data: classEnrollmentData } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('class_id', classId)
      .eq('academic_year_id', yearId)
      .eq('status', 'active');

    if (!classEnrollmentData?.length) {
      setClassAverages([]);
      return;
    }

    const studentIds = classEnrollmentData.map(
      (item) => item.student_id
    );

    const { data: classAssessmentData } = await supabase
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
      .in('student_id', studentIds)
      .eq('term', termName);

    if (!classAssessmentData) {
      setClassAverages([]);
      return;
    }

    const studentSubjectMap: Record<
      string,
      Record<
        string,
        {
          caRaw: number;
          examRaw: number;
        }
      >
    > = {};

    classAssessmentData.forEach((assessment) => {
      const currentStudentId = assessment.student_id;

      if (!studentSubjectMap[currentStudentId]) {
        studentSubjectMap[currentStudentId] = {};
      }

      if (
        !studentSubjectMap[currentStudentId][
          assessment.subject
        ]
      ) {
        studentSubjectMap[currentStudentId][
          assessment.subject
        ] = {
          caRaw: 0,
          examRaw: 0,
        };
      }

      if (CA_TYPES.includes(assessment.assessment_type)) {
        studentSubjectMap[currentStudentId][
          assessment.subject
        ].caRaw += Number(assessment.score);
      }

      if (assessment.assessment_type === 'Examination') {
        studentSubjectMap[currentStudentId][
          assessment.subject
        ].examRaw = Number(assessment.score);
      }
    });

    const averages: StudentClassAverage[] = [];

    Object.entries(studentSubjectMap).forEach(
      ([currentStudentId, subjects]) => {
        const subjectScores = Object.values(subjects);

        if (subjectScores.length === 0) return;

        const finalScores = subjectScores.map((item) => {
          const ca = (item.caRaw / 100) * 30;
          const exam = (item.examRaw / 100) * 70;

          return ca + exam;
        });

        const average =
          finalScores.reduce(
            (sum, value) => sum + value,
            0
          ) / finalScores.length;

        averages.push({
          student_id: currentStudentId,
          average,
        });
      }
    );

    setClassAverages(averages);
  }

  const subjectResults = useMemo(() => {
    const subjectMap: Record<
      string,
      {
        caRaw: number;
        examRaw: number;
      }
    > = {};

    assessments.forEach((assessment) => {
      if (!subjectMap[assessment.subject]) {
        subjectMap[assessment.subject] = {
          caRaw: 0,
          examRaw: 0,
        };
      }

      if (CA_TYPES.includes(assessment.assessment_type)) {
        subjectMap[assessment.subject].caRaw += Number(
          assessment.score
        );
      }

      if (assessment.assessment_type === 'Examination') {
        subjectMap[assessment.subject].examRaw = Number(
          assessment.score
        );
      }
    });

    return Object.entries(subjectMap)
      .map(([subject, values]) => {
        const caRaw = values.caRaw;
        const caContribution = (caRaw / 100) * 30;

        const examRaw = values.examRaw;
        const examContribution = (examRaw / 100) * 70;

        const finalScore =
          caContribution + examContribution;

        return {
          subject,
          caRaw,
          caContribution,
          examRaw,
          examContribution,
          finalScore,
          grade: getGrade(finalScore),
          status: finalScore >= 50 ? 'Pass' : 'Fail',
        };
      })
      .sort((a, b) =>
        a.subject.localeCompare(b.subject)
      );
  }, [assessments]);

  const totalFinal = subjectResults.reduce(
    (sum, item) => sum + item.finalScore,
    0
  );

  const overallAverage =
    subjectResults.length > 0
      ? totalFinal / subjectResults.length
      : 0;

  const passedSubjects = subjectResults.filter(
    (item) => item.status === 'Pass'
  ).length;

  const failedSubjects = subjectResults.filter(
    (item) => item.status === 'Fail'
  ).length;

  const classPosition = useMemo(() => {
    if (!student || classAverages.length === 0) {
      return null;
    }

    const currentAverage = overallAverage;

    const sorted = [...classAverages].sort(
      (a, b) => b.average - a.average
    );

    return (
      sorted.filter(
        (item) => item.average > currentAverage
      ).length + 1
    );
  }, [classAverages, overallAverage, student]);

  const classSize = classAverages.length;

  const totalAttendance = attendance.length;

  const presentCount = attendance.filter(
    (item) =>
      item.status.toLowerCase() === 'present'
  ).length;

  const absentCount = attendance.filter(
    (item) =>
      item.status.toLowerCase() === 'absent'
  ).length;

  const lateCount = attendance.filter(
    (item) =>
      item.status.toLowerCase() === 'late'
  ).length;

  const excusedCount = attendance.filter(
    (item) =>
      item.status.toLowerCase() === 'excused'
  ).length;

  const attendancePercentage =
    totalAttendance > 0
      ? (presentCount / totalAttendance) * 100
      : 0;

  const overallGrade = getGrade(overallAverage);

  const overallGradeDescription =
    getGradeDescription(overallGrade);

  const overallRemark =
    overallAverage >= 80
      ? 'Excellent performance. Keep up the good work.'
      : overallAverage >= 70
        ? 'Very good performance. Continue to work hard.'
        : overallAverage >= 60
          ? 'Good performance. There is room for further improvement.'
          : overallAverage >= 50
            ? 'Satisfactory performance. More effort is encouraged.'
            : 'Performance needs improvement. Greater effort is required.';

  const currentClass =
    enrollment?.class?.[0]?.name ||
    'Not enrolled';

  const currentLevel =
    enrollment?.class?.[0]?.level || '—';

  const currentProgramme =
    enrollment?.programme?.[0]?.name || '—';

  const selectedYearName =
    academicYears.find(
      (year) => year.id === selectedYear
    )?.name || '—';

  const selectedTermName =
    terms.find(
      (term) => term.id === selectedTerm
    )?.name || '—';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 text-center shadow-sm">
          Loading report card...
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8">
          <h1 className="text-xl font-bold">
            Student not found
          </h1>

          <button
            onClick={() => router.push('/students')}
            className="mt-4 rounded-lg bg-slate-900 px-5 py-2 text-white"
          >
            Back to Students
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Screen Controls */}
      <div className="print:hidden bg-slate-100 px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => router.back()}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700"
          >
            ← Back
          </button>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedTerm('');
                setTerms([]);
                setEnrollment(null);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="">
                Select Academic Year
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

            <select
              value={selectedTerm}
              onChange={(e) =>
                setSelectedTerm(e.target.value)
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="">
                Select Term
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

            <button
              onClick={() => window.print()}
              className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
            >
              🖨️ Print Report Card
            </button>
          </div>
        </div>
      </div>

      {/* Report Card */}
      <main className="bg-slate-100 px-3 py-6 sm:px-6">
        <div
          id="report-card"
          className="report-card mx-auto max-w-5xl bg-white p-5 shadow-lg sm:p-8"
        >
          {/* School Header */}
          <header className="border-b-4 border-slate-900 pb-5">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-slate-900 bg-white">
                <span className="text-2xl font-black tracking-tight text-slate-900">
                  BTI
                </span>
              </div>

              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
                  Biriwa Technical Institute
                </p>

                <h1 className="mt-1 text-2xl font-black uppercase tracking-wide text-slate-900 sm:text-3xl">
                  Student Academic Report Card
                </h1>

                <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600 sm:justify-start">
                  <span>
                    Academic Year: {selectedYearName}
                  </span>
                  <span>•</span>
                  <span>
                    Term: {selectedTermName}
                  </span>
                </div>
              </div>

              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.full_name}
                  className="h-28 w-24 rounded-lg border-2 border-slate-400 object-cover"
                />
              ) : (
                <div className="flex h-28 w-24 items-center justify-center rounded-lg border-2 border-slate-300 bg-slate-50 text-3xl">
                  👤
                </div>
              )}
            </div>
          </header>

          {/* Student Information */}
          <section className="mt-5">
            <h2 className="section-heading">
              Student Information
            </h2>

            <div className="grid grid-cols-1 border border-slate-300 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Student Name', student.full_name],
                ['Admission No.', student.admission_number],
                ['Class', currentClass],
                ['Programme', currentProgramme],
                ['Level', currentLevel],
                ['Gender', student.gender || '—'],
                ['JHS Aggregate', student.jhs_aggregate ?? '—'],
                [
                  'Report Status',
                  student.promotion_status || '—',
                ],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`border-b border-slate-200 p-3 ${
                    index % 4 !== 3
                      ? 'lg:border-r'
                      : ''
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {label}
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Academic Results */}
          <section className="mt-5">
            <h2 className="section-heading">
              Academic Performance
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse border border-slate-400 text-xs">
                <thead>
                  <tr className="bg-slate-200">
                    <th
                      rowSpan={2}
                      className="border border-slate-400 px-2 py-2 text-left"
                    >
                      Subject
                    </th>

                    <th
                      colSpan={2}
                      className="border border-slate-400 px-2 py-2 text-center"
                    >
                      Continuous Assessment
                    </th>

                    <th
                      colSpan={2}
                      className="border border-slate-400 px-2 py-2 text-center"
                    >
                      Examination
                    </th>

                    <th
                      rowSpan={2}
                      className="border border-slate-400 px-2 py-2 text-center"
                    >
                      Final
                      <br />
                      /100
                    </th>

                    <th
                      rowSpan={2}
                      className="border border-slate-400 px-2 py-2 text-center"
                    >
                      Grade
                    </th>

                    <th
                      rowSpan={2}
                      className="border border-slate-400 px-2 py-2 text-center"
                    >
                      Status
                    </th>
                  </tr>

                  <tr className="bg-slate-50">
                    <th className="border border-slate-400 px-2 py-1 text-center">
                      Raw /100
                    </th>

                    <th className="border border-slate-400 px-2 py-1 text-center">
                      /30
                    </th>

                    <th className="border border-slate-400 px-2 py-1 text-center">
                      Raw /100
                    </th>

                    <th className="border border-slate-400 px-2 py-1 text-center">
                      /70
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {subjectResults.map((result) => (
                    <tr key={result.subject}>
                      <td className="border border-slate-400 px-2 py-2 font-semibold">
                        {result.subject}
                      </td>

                      <td className="border border-slate-400 px-2 py-2 text-center">
                        {result.caRaw.toFixed(1)}
                      </td>

                      <td className="border border-slate-400 px-2 py-2 text-center">
                        {result.caContribution.toFixed(1)}
                      </td>

                      <td className="border border-slate-400 px-2 py-2 text-center">
                        {result.examRaw.toFixed(1)}
                      </td>

                      <td className="border border-slate-400 px-2 py-2 text-center">
                        {result.examContribution.toFixed(1)}
                      </td>

                      <td className="border border-slate-400 px-2 py-2 text-center font-black">
                        {result.finalScore.toFixed(1)}
                      </td>

                      <td className="border border-slate-400 px-2 py-2 text-center font-black">
                        {result.grade}
                      </td>

                      <td
                        className={`border border-slate-400 px-2 py-2 text-center font-bold ${
                          result.status === 'Pass'
                            ? 'text-green-700'
                            : 'text-red-700'
                        }`}
                      >
                        {result.status}
                      </td>
                    </tr>
                  ))}

                  {subjectResults.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="border border-slate-400 px-4 py-8 text-center text-slate-500"
                      >
                        {loadingResults
                          ? 'Loading results...'
                          : 'No results recorded for this term.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Performance Summary */}
          <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
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
                {overallAverage.toFixed(1)}%
              </p>
            </div>

            <div className="summary-box">
              <p className="summary-label">
                Overall Grade
              </p>
              <p className="summary-value">
                {overallGrade}
              </p>
              <p className="text-[9px] text-slate-500">
                {overallGradeDescription}
              </p>
            </div>

            <div className="summary-box">
              <p className="summary-label">
                Position
              </p>
              <p className="summary-value">
                {formatPosition(classPosition)}
              </p>
              {classPosition && (
                <p className="text-[9px] text-slate-500">
                  out of {classSize}
                </p>
              )}
            </div>

            <div className="summary-box">
              <p className="summary-label">
                Result
              </p>
              <p
                className={`mt-1 text-xl font-black ${
                  overallAverage >= 50
                    ? 'text-green-700'
                    : 'text-red-700'
                }`}
              >
                {overallAverage >= 50
                  ? 'PASS'
                  : 'FAIL'}
              </p>
            </div>
          </section>

          {/* Overall Performance */}
          <section className="mt-5 border border-slate-300 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Overall Performance
              </h3>

              <span className="text-sm font-black">
                {overallAverage.toFixed(1)}%
              </span>
            </div>

            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900"
                style={{
                  width: `${Math.min(
                    Math.max(overallAverage, 0),
                    100
                  )}%`,
                }}
              />
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-600">
              {overallRemark}
            </p>
          </section>

          {/* Attendance */}
          <section className="mt-5">
            <h2 className="section-heading">
              Attendance
            </h2>

            <div className="grid grid-cols-2 border border-slate-300 sm:grid-cols-5">
              <div className="attendance-box">
                <p className="summary-label">
                  Days Recorded
                </p>
                <p className="summary-value">
                  {totalAttendance}
                </p>
              </div>

              <div className="attendance-box">
                <p className="summary-label">
                  Present
                </p>
                <p className="summary-value text-green-700">
                  {presentCount}
                </p>
              </div>

              <div className="attendance-box">
                <p className="summary-label">
                  Absent
                </p>
                <p className="summary-value text-red-700">
                  {absentCount}
                </p>
              </div>

              <div className="attendance-box">
                <p className="summary-label">
                  Late
                </p>
                <p className="summary-value">
                  {lateCount}
                </p>
              </div>

              <div className="attendance-box">
                <p className="summary-label">
                  Attendance
                </p>
                <p className="summary-value">
                  {attendancePercentage.toFixed(1)}%
                </p>
              </div>
            </div>

            {excusedCount > 0 && (
              <p className="mt-2 text-[10px] text-slate-500">
                Excused absences: {excusedCount}
              </p>
            )}
          </section>

          {/* Conduct and Promotion */}
          <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="border border-slate-300 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Conduct / Attitude
              </h3>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {student.conduct || 'Not provided'}
              </p>
            </div>

            <div className="border border-slate-300 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Promotion Status
              </h3>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {student.promotion_status ||
                  'Not provided'}
              </p>
            </div>
          </section>

          {/* Remarks */}
          <section className="mt-5">
            <h2 className="section-heading">
              Official Remarks
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-h-[90px] border border-slate-300 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Class Teacher's Remark
                </p>

                <p className="mt-3 text-sm leading-6 text-slate-800">
                  {student.class_teacher_remark ||
                    'No class teacher remark entered.'}
                </p>
              </div>

              <div className="min-h-[90px] border border-slate-300 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  HOD / Head's Remark
                </p>

                <p className="mt-3 text-sm leading-6 text-slate-800">
                  {student.hod_remark ||
                    'No HOD / Head remark entered.'}
                </p>
              </div>
            </div>
          </section>

          {/* Next Term */}
          <section className="mt-5 border border-slate-300 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Next Term Begins
                </p>

                <p className="mt-1 text-sm font-bold text-slate-900">
                  {formatDate(student.next_term_begins)}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Overall Result
                </p>

                <p
                  className={`mt-1 text-sm font-black ${
                    overallAverage >= 50
                      ? 'text-green-700'
                      : 'text-red-700'
                  }`}
                >
                  {overallAverage >= 50
                    ? 'PASS'
                    : 'FAIL'}
                </p>
              </div>
            </div>
          </section>

          {/* Grading Key */}
          <section className="mt-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
              Grading Key
            </h2>

            <div className="grid grid-cols-2 border border-slate-300 text-xs sm:grid-cols-6">
              {[
                ['A', '80–100', 'Excellent'],
                ['B', '70–79', 'Very Good'],
                ['C', '60–69', 'Good'],
                ['D', '50–59', 'Credit'],
                ['E', '40–49', 'Pass'],
                ['F', '0–39', 'Fail'],
              ].map(([grade, range, description]) => (
                <div
                  key={grade}
                  className="border-b border-slate-200 p-2 text-center sm:border-r"
                >
                  <p className="font-black">
                    {grade}
                  </p>
                  <p>{range}</p>
                  <p className="text-[9px] text-slate-500">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Signatures */}
          <section className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3">
            <div className="signature-line">
              Class Teacher
            </div>

            <div className="signature-line">
              HOD
            </div>

            <div className="signature-line">
              Head of Institution
            </div>
          </section>

          <footer className="mt-8 border-t border-slate-300 pt-3 text-center text-[9px] text-slate-500">
            Biriwa Technical Institute • Official Student Academic Report
          </footer>
        </div>
      </main>

      <style jsx global>{`
        .section-heading {
          margin-bottom: 0.75rem;
          background: #0f172a;
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: white;
        }

        .summary-box {
          border: 1px solid #cbd5e1;
          padding: 0.75rem;
          text-align: center;
        }

        .summary-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
        }

        .summary-value {
          margin-top: 0.25rem;
          font-size: 1.25rem;
          font-weight: 900;
          color: #0f172a;
        }

        .attendance-box {
          border-right: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          padding: 0.75rem;
          text-align: center;
        }

        .signature-line {
          border-top: 1px solid #64748b;
          padding-top: 0.5rem;
          text-align: center;
          font-size: 0.75rem;
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

          .print\\:hidden {
            display: none !important;
          }

          .report-card {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          section,
          header,
          footer {
            page-break-inside: avoid;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          .section-heading {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}
      </style>
    </>
  );
}

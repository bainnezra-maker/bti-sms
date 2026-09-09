'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
  gender: string | null;
  date_of_birth: string | null;
  jhs_aggregate: number | null;
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
  academic_year_id: string;
  programme_id: string | null;
  status: string | null;
};

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
};

type Programme = {
  id: string;
  name: string;
  code: string | null;
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

type SubjectResult = {
  subject: string;
  caRaw: number;
  caContribution: number;
  examRaw: number;
  examContribution: number;
  finalScore: number;
  grade: string;
  status: string;
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

function getRemark(score: number) {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Pass';
  if (score >= 40) return 'Fair';
  return 'Needs Improvement';
}

function getPositionLabel(position: number | null) {
  if (!position) return '—';

  if (position % 100 >= 11 && position % 100 <= 13) {
    return `${position}th`;
  }

  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}

export default function StudentReportCardPage() {
  const params = useParams();
  const router = useRouter();

  const studentId = params?.id as string;

  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');

  const [student, setStudent] = useState<Student | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');

  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [programme, setProgramme] = useState<Programme | null>(null);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [results, setResults] = useState<SubjectResult[]>([]);

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [classAverages, setClassAverages] = useState<
    StudentClassAverage[]
  >([]);

  useEffect(() => {
    if (!studentId) return;

    async function loadInitialData() {
      setLoading(true);
      setError('');

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('school_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.school_id) {
          throw new Error('Unable to identify the school.');
        }

        const schoolId = profile.school_id;

        const { data: studentData, error: studentError } =
          await supabase
            .from('students')
            .select(`
              id,
              full_name,
              admission_number,
              gender,
              date_of_birth,
              jhs_aggregate
            `)
            .eq('id', studentId)
            .eq('school_id', schoolId)
            .single();

        if (studentError || !studentData) {
          throw new Error('Student could not be found.');
        }

        setStudent(studentData);

        const { data: years, error: yearsError } = await supabase
          .from('academic_years')
          .select('id, name, is_current')
          .eq('school_id', schoolId)
          .order('name', { ascending: false });

        if (yearsError) {
          throw new Error(yearsError.message);
        }

        setAcademicYears(years || []);

        const currentYear =
          years?.find((year) => year.is_current) || years?.[0];

        if (currentYear) {
          setSelectedYear(currentYear.id);
        }
      } catch (err: any) {
        setError(err.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [studentId]);

  useEffect(() => {
    if (!selectedYear) {
      setTerms([]);
      setSelectedTerm('');
      return;
    }

    async function loadTerms() {
      const { data, error } = await supabase
        .from('terms')
        .select('id, name, is_current')
        .eq('academic_year_id', selectedYear)
        .order('start_date', { ascending: true });

      if (error) {
        setError(error.message);
        return;
      }

      setTerms(data || []);

      const currentTerm =
        data?.find((term) => term.is_current) || data?.[0];

      setSelectedTerm(currentTerm?.id || '');
    }

    loadTerms();
  }, [selectedYear]);

  useEffect(() => {
    if (!studentId || !selectedYear || !selectedTerm) return;

    async function loadReportCard() {
      setCalculating(true);
      setError('');

      try {
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
            .single();

        if (profileError || !profile?.school_id) {
          throw new Error('Unable to identify school.');
        }

        const schoolId = profile.school_id;

        const selectedTermObject = terms.find(
          (term) => term.id === selectedTerm
        );

        if (!selectedTermObject) {
          return;
        }

        /*
         * ---------------------------------------------------------
         * STUDENT ENROLLMENT
         * ---------------------------------------------------------
         */

        const { data: enrollmentData, error: enrollmentError } =
          await supabase
            .from('enrollments')
            .select(`
              id,
              class_id,
              academic_year_id,
              programme_id,
              status
            `)
            .eq('student_id', studentId)
            .eq('academic_year_id', selectedYear)
            .eq('status', 'active')
            .maybeSingle();

        if (enrollmentError) {
          throw new Error(enrollmentError.message);
        }

        if (!enrollmentData) {
          setEnrollment(null);
          setClassItem(null);
          setProgramme(null);
          setAssessments([]);
          setResults([]);
          setAttendance([]);
          setClassAverages([]);
          return;
        }

        setEnrollment(enrollmentData);

        /*
         * ---------------------------------------------------------
         * CLASS
         * ---------------------------------------------------------
         */

        const { data: classData, error: classError } =
          await supabase
            .from('classes')
            .select('id, name, level')
            .eq('id', enrollmentData.class_id)
            .eq('school_id', schoolId)
            .maybeSingle();

        if (classError) {
          throw new Error(classError.message);
        }

        setClassItem(classData);

        /*
         * ---------------------------------------------------------
         * PROGRAMME
         * ---------------------------------------------------------
         */

        if (enrollmentData.programme_id) {
          const { data: programmeData, error: programmeError } =
            await supabase
              .from('programmes')
              .select('id, name, code')
              .eq('id', enrollmentData.programme_id)
              .eq('school_id', schoolId)
              .maybeSingle();

          if (programmeError) {
            throw new Error(programmeError.message);
          }

          setProgramme(programmeData);
        } else {
          setProgramme(null);
        }

        /*
         * ---------------------------------------------------------
         * STUDENT ASSESSMENTS
         * ---------------------------------------------------------
         */

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
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .eq('term', selectedTermObject.name)
            .order('subject', { ascending: true });

        if (assessmentError) {
          throw new Error(assessmentError.message);
        }

        const safeAssessments: Assessment[] =
          (assessmentData || []).map((item) => ({
            ...item,
            score: Number(item.score) || 0,
            max_score: Number(item.max_score) || 0,
          }));

        setAssessments(safeAssessments);

        /*
         * ---------------------------------------------------------
         * CALCULATE SUBJECT RESULTS
         * ---------------------------------------------------------
         */

        const subjectNames = Array.from(
          new Set(
            safeAssessments
              .map((item) => item.subject)
              .filter(Boolean)
          )
        );

        const calculated: SubjectResult[] = subjectNames.map(
          (subject) => {
            const subjectAssessments = safeAssessments.filter(
              (item) => item.subject === subject
            );

            let caRaw = 0;

            CA_TYPES.forEach((type) => {
              const assessment = subjectAssessments.find(
                (item) => item.assessment_type === type
              );

              if (assessment) {
                caRaw += assessment.score;
              }
            });

            const caContribution = (caRaw / 100) * 30;

            const examination = subjectAssessments.find(
              (item) => item.assessment_type === 'Examination'
            );

            const examRaw = examination
              ? examination.score
              : 0;

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
              status:
                finalScore >= 50 ? 'Pass' : 'Fail',
            };
          }
        );

        calculated.sort((a, b) =>
          a.subject.localeCompare(b.subject)
        );

        setResults(calculated);

        /*
         * ---------------------------------------------------------
         * ATTENDANCE
         * ---------------------------------------------------------
         *
         * Attendance is taken from the existing attendance table.
         * The system uses the student's attendance records for the
         * selected academic report period.
         */

        const { data: attendanceData, error: attendanceError } =
          await supabase
            .from('attendance')
            .select(`
              id,
              date,
              status
            `)
            .eq('student_id', studentId)
            .order('date', { ascending: false });

        if (attendanceError) {
          throw new Error(attendanceError.message);
        }

        setAttendance(attendanceData || []);

        /*
         * ---------------------------------------------------------
         * CLASS POSITION
         * ---------------------------------------------------------
         *
         * First get all active students in the same class/year.
         * Then get their assessments for the selected term.
         * Position is based on overall average final score.
         */

        const { data: classEnrollmentData, error: classEnrollmentError } =
          await supabase
            .from('enrollments')
            .select('student_id')
            .eq('class_id', enrollmentData.class_id)
            .eq('academic_year_id', selectedYear)
            .eq('status', 'active');

        if (classEnrollmentError) {
          throw new Error(classEnrollmentError.message);
        }

        const classStudentIds = Array.from(
          new Set(
            (classEnrollmentData || [])
              .map((item) => item.student_id)
              .filter(Boolean)
          )
        );

        if (classStudentIds.length > 0) {
          const { data: classAssessmentData, error: classAssessmentError } =
            await supabase
              .from('assessments')
              .select(`
                student_id,
                subject,
                assessment_type,
                score
              `)
              .eq('school_id', schoolId)
              .eq('term', selectedTermObject.name)
              .in('student_id', classStudentIds);

          if (classAssessmentError) {
            throw new Error(classAssessmentError.message);
          }

          const classAssessmentRows = classAssessmentData || [];

          const studentSubjectScores: Record<
            string,
            Record<string, number>
          > = {};

          classStudentIds.forEach((id) => {
            studentSubjectScores[id] = {};
          });

          const classSubjects = Array.from(
            new Set(
              classAssessmentRows
                .map((item) => item.subject)
                .filter(Boolean)
            )
          );

          classSubjects.forEach((subject) => {
            classStudentIds.forEach((id) => {
              const rows = classAssessmentRows.filter(
                (item) =>
                  item.student_id === id &&
                  item.subject === subject
              );

              let caRaw = 0;

              CA_TYPES.forEach((type) => {
                const row = rows.find(
                  (item) =>
                    item.assessment_type === type
                );

                if (row) {
                  caRaw += Number(row.score) || 0;
                }
              });

              const exam = rows.find(
                (item) =>
                  item.assessment_type === 'Examination'
              );

              const examRaw = exam
                ? Number(exam.score) || 0
                : 0;

              const finalScore =
                (caRaw / 100) * 30 +
                (examRaw / 100) * 70;

              if (!studentSubjectScores[id]) {
                studentSubjectScores[id] = {};
              }

              studentSubjectScores[id][subject] =
                finalScore;
            });
          });

          const calculatedAverages: StudentClassAverage[] =
            classStudentIds.map((id) => {
              const subjectScores =
                Object.values(
                  studentSubjectScores[id] || {}
                );

              const average =
                subjectScores.length > 0
                  ? subjectScores.reduce(
                      (sum, value) => sum + value,
                      0
                    ) / subjectScores.length
                  : 0;

              return {
                student_id: id,
                average,
              };
            });

          calculatedAverages.sort(
            (a, b) => b.average - a.average
          );

          setClassAverages(calculatedAverages);
        } else {
          setClassAverages([]);
        }
      } catch (err: any) {
        setError(
          err.message ||
            'Unable to generate report card.'
        );
      } finally {
        setCalculating(false);
      }
    }

    loadReportCard();
  }, [
    studentId,
    selectedYear,
    selectedTerm,
    terms,
  ]);

  /*
   * -------------------------------------------------------------
   * SUMMARY
   * -------------------------------------------------------------
   */

  const summary = useMemo(() => {
    const totalSubjects = results.length;

    const totalFinal = results.reduce(
      (sum, result) => sum + result.finalScore,
      0
    );

    const average =
      totalSubjects > 0
        ? totalFinal / totalSubjects
        : 0;

    const passed = results.filter(
      (result) => result.status === 'Pass'
    ).length;

    const failed = results.filter(
      (result) => result.status === 'Fail'
    ).length;

    return {
      totalSubjects,
      totalFinal,
      average,
      passed,
      failed,
    };
  }, [results]);

  /*
   * -------------------------------------------------------------
   * CLASS POSITION
   * -------------------------------------------------------------
   */

  const classPosition = useMemo(() => {
    if (!studentId || classAverages.length === 0) {
      return null;
    }

    const sorted = [...classAverages].sort(
      (a, b) => b.average - a.average
    );

    const studentIndex = sorted.findIndex(
      (item) => item.student_id === studentId
    );

    if (studentIndex === -1) {
      return null;
    }

    /*
     * Competition ranking:
     * 1st, 2nd, 2nd, 4th
     */

    const studentAverage =
      sorted[studentIndex].average;

    const position =
      sorted.filter(
        (item) => item.average > studentAverage
      ).length + 1;

    return {
      position,
      totalStudents: sorted.length,
      average: studentAverage,
    };
  }, [studentId, classAverages]);

  /*
   * -------------------------------------------------------------
   * ATTENDANCE SUMMARY
   * -------------------------------------------------------------
   */

  const attendanceSummary = useMemo(() => {
    const total = attendance.length;

    const present = attendance.filter(
      (item) =>
        item.status.toLowerCase() === 'present'
    ).length;

    const absent = attendance.filter(
      (item) =>
        item.status.toLowerCase() === 'absent'
    ).length;

    const late = attendance.filter(
      (item) =>
        item.status.toLowerCase() === 'late'
    ).length;

    const excused = attendance.filter(
      (item) =>
        item.status.toLowerCase() === 'excused'
    ).length;

    const attendancePercentage =
      total > 0 ? (present / total) * 100 : 0;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendancePercentage,
    };
  }, [attendance]);

  const selectedYearName =
    academicYears.find(
      (year) => year.id === selectedYear
    )?.name || '';

  const selectedTermName =
    terms.find(
      (term) => term.id === selectedTerm
    )?.name || '';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-slate-600">
              Loading student report card...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">
              Student Not Found
            </h1>

            <button
              onClick={() => router.push('/students')}
              className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Back to Students
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl">

          {/* TOP NAVIGATION */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div>
              <button
                onClick={() =>
                  router.push(
                    `/students/${student.id}`
                  )
                }
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                ← Back to Student Profile
              </button>

              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Individual Student Report Card
              </h1>

              <p className="text-sm text-slate-500">
                Official academic performance summary
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              🖨️ Print Report Card
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 print:hidden">
              {error}
            </div>
          )}

          {/* REPORT PERIOD */}
          <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm print:hidden">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Report Period
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Academic Year
                </label>

                <select
                  value={selectedYear}
                  onChange={(e) =>
                    setSelectedYear(e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
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

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Term
                </label>

                <select
                  value={selectedTerm}
                  onChange={(e) =>
                    setSelectedTerm(e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">
                    Select term
                  </option>

                  {terms.map((term) => (
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
            </div>
          </div>

          {calculating ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <p className="text-slate-600">
                Calculating report card...
              </p>
            </div>
          ) : (
            <div className="report-card mx-auto rounded-2xl bg-white p-5 shadow-sm sm:p-8">

              {/* =================================================
                  SCHOOL HEADER
                 ================================================= */}

              <div className="border-2 border-slate-900 p-5 text-center">

                <div className="flex items-center justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-slate-900 text-center text-xs font-bold">
                    BTI
                  </div>
                </div>

                <h2 className="mt-3 text-3xl font-extrabold uppercase tracking-wide text-slate-900">
                  Biriwa Technical Institute
                </h2>

                <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-600">
                  Student Academic Report
                </p>

                <div className="mx-auto mt-3 h-px max-w-xl bg-slate-400" />

                <p className="mt-3 text-sm font-bold text-slate-900">
                  {selectedYearName}
                </p>

                <p className="text-sm text-slate-600">
                  {selectedTermName}
                </p>
              </div>

              {/* =================================================
                  STUDENT INFORMATION
                 ================================================= */}

              <div className="mt-6 border border-slate-400">

                <div className="bg-slate-900 px-4 py-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                    Student Information
                  </h3>
                </div>

                <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Student Name
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {student.full_name}
                    </p>
                  </div>

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Admission Number
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {student.admission_number}
                    </p>
                  </div>

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Class
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {classItem?.name || '—'}
                    </p>
                  </div>

                  <div className="border-b border-slate-300 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Programme
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {programme?.name || '—'}
                    </p>
                  </div>

                  <div className="border-r border-slate-300 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Level
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {classItem?.level || '—'}
                    </p>
                  </div>

                  <div className="border-r border-slate-300 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Gender
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {student.gender || '—'}
                    </p>
                  </div>

                  <div className="border-r border-slate-300 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      JHS Aggregate
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {student.jhs_aggregate ?? '—'}
                    </p>
                  </div>

                  <div className="p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Report Status
                    </p>
                    <p
                      className={`mt-1 text-sm font-bold ${
                        results.length > 0
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}
                    >
                      {results.length > 0
                        ? 'Available'
                        : 'No Results'}
                    </p>
                  </div>

                </div>
              </div>

              {/* =================================================
                  RESULTS
                 ================================================= */}

              <div className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-bold uppercase text-slate-900">
                    Academic Performance
                  </h3>

                  <p className="text-xs text-slate-500">
                    CA 30% + Examination 70%
                  </p>
                </div>

                {results.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                    <p className="font-medium text-slate-700">
                      No results available for this term.
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Enter the student's assessments first.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-400">
                    <table className="w-full min-w-[850px] border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-200 text-left">
                          <th className="border border-slate-400 px-2 py-2 text-center">
                            #
                          </th>

                          <th className="border border-slate-400 px-2 py-2">
                            Subject
                          </th>

                          <th className="border border-slate-400 px-2 py-2 text-center">
                            CA /100
                          </th>

                          <th className="border border-slate-400 px-2 py-2 text-center">
                            CA /30
                          </th>

                          <th className="border border-slate-400 px-2 py-2 text-center">
                            Exam /100
                          </th>

                          <th className="border border-slate-400 px-2 py-2 text-center">
                            Exam /70
                          </th>

                          <th className="border border-slate-400 px-2 py-2 text-center">
                            Final /100
                          </th>

                          <th className="border border-slate-400 px-2 py-2 text-center">
                            Grade
                          </th>

                          <th className="border border-slate-400 px-2 py-2 text-center">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {results.map((result, index) => (
                          <tr key={result.subject}>
                            <td className="border border-slate-300 px-2 py-2 text-center">
                              {index + 1}
                            </td>

                            <td className="border border-slate-300 px-2 py-2 font-semibold">
                              {result.subject}
                            </td>

                            <td className="border border-slate-300 px-2 py-2 text-center">
                              {result.caRaw.toFixed(2)}
                            </td>

                            <td className="border border-slate-300 px-2 py-2 text-center">
                              {result.caContribution.toFixed(2)}
                            </td>

                            <td className="border border-slate-300 px-2 py-2 text-center">
                              {result.examRaw.toFixed(2)}
                            </td>

                            <td className="border border-slate-300 px-2 py-2 text-center">
                              {result.examContribution.toFixed(2)}
                            </td>

                            <td className="border border-slate-300 px-2 py-2 text-center font-bold">
                              {result.finalScore.toFixed(2)}
                            </td>

                            <td className="border border-slate-300 px-2 py-2 text-center font-bold">
                              {result.grade}
                            </td>

                            <td className="border border-slate-300 px-2 py-2 text-center">
                              <span
                                className={
                                  result.status === 'Pass'
                                    ? 'font-bold text-green-700'
                                    : 'font-bold text-red-700'
                                }
                              >
                                {result.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* =================================================
                  PERFORMANCE SUMMARY
                 ================================================= */}

              <div className="mt-7 border border-slate-400">

                <div className="bg-slate-900 px-4 py-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                    Performance Summary
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-6">

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] uppercase text-slate-500">
                      Subjects
                    </p>
                    <p className="mt-1 text-xl font-bold">
                      {summary.totalSubjects}
                    </p>
                  </div>

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] uppercase text-slate-500">
                      Total
                    </p>
                    <p className="mt-1 text-xl font-bold">
                      {summary.totalFinal.toFixed(2)}
                    </p>
                  </div>

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] uppercase text-slate-500">
                      Average
                    </p>
                    <p className="mt-1 text-xl font-bold">
                      {summary.average.toFixed(2)}%
                    </p>
                  </div>

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] uppercase text-slate-500">
                      Passed
                    </p>
                    <p className="mt-1 text-xl font-bold text-green-700">
                      {summary.passed}
                    </p>
                  </div>

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] uppercase text-slate-500">
                      Failed
                    </p>
                    <p className="mt-1 text-xl font-bold text-red-700">
                      {summary.failed}
                    </p>
                  </div>

                  <div className="border-b border-slate-300 p-3">
                    <p className="text-[10px] uppercase text-slate-500">
                      Class Position
                    </p>

                    <p className="mt-1 text-xl font-bold">
                      {getPositionLabel(
                        classPosition?.position || null
                      )}
                    </p>

                    <p className="text-[10px] text-slate-500">
                      of {classPosition?.totalStudents || '—'}
                    </p>
                  </div>

                </div>
              </div>

              {/* =================================================
                  ATTENDANCE
                 ================================================= */}

              <div className="mt-7 border border-slate-400">

                <div className="bg-slate-900 px-4 py-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                    Attendance Record
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-0 sm:grid-cols-5">

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] uppercase text-slate-500">
                      Recorded
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {attendanceSummary.total}
                    </p>
                  </div>

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] uppercase text-slate-500">
                      Present
                    </p>
                    <p className="mt-1 text-lg font-bold text-green-700">
                      {attendanceSummary.present}
                    </p>
                  </div>

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] uppercase text-slate-500">
                      Absent
                    </p>
                    <p className="mt-1 text-lg font-bold text-red-700">
                      {attendanceSummary.absent}
                    </p>
                  </div>

                  <div className="border-b border-r border-slate-300 p-3">
                    <p className="text-[10px] uppercase text-slate-500">
                      Late
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {attendanceSummary.late}
                    </p>
                  </div>

                  <div className="border-b border-slate-300 p-3">
                    <p className="text-[10px] uppercase text-slate-500">
                      Attendance
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {attendanceSummary.attendancePercentage.toFixed(
                        1
                      )}
                      %
                    </p>
                  </div>

                </div>

                <div className="border-t border-slate-300 p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">
                      Attendance Performance
                    </span>

                    <span className="font-bold">
                      {attendanceSummary.attendancePercentage.toFixed(
                        1
                      )}
                      %
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-slate-900"
                      style={{
                        width: `${Math.min(
                          attendanceSummary.attendancePercentage,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* =================================================
                  OVERALL PERFORMANCE
                 ================================================= */}

              <div className="mt-7 border border-slate-400 p-5">

                <div className="flex items-center justify-between">
                  <h3 className="font-bold uppercase text-slate-900">
                    Overall Performance
                  </h3>

                  <span className="text-2xl font-extrabold">
                    {summary.average.toFixed(2)}%
                  </span>
                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-slate-900"
                    style={{
                      width: `${Math.min(
                        summary.average,
                        100
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                  <p className="text-slate-600">
                    Overall Remark:
                    <span className="ml-1 font-bold text-slate-900">
                      {getRemark(summary.average)}
                    </span>
                  </p>

                  <p className="text-slate-600">
                    Class Position:
                    <span className="ml-1 font-bold text-slate-900">
                      {getPositionLabel(
                        classPosition?.position || null
                      )}{' '}
                      of{' '}
                      {classPosition?.totalStudents || '—'}
                    </span>
                  </p>
                </div>
              </div>

              {/* =================================================
                  REMARKS
                 ================================================= */}

              <div className="mt-7 grid gap-6 sm:grid-cols-2">

                <div>
                  <h3 className="text-sm font-bold uppercase text-slate-900">
                    Class Teacher's Remarks
                  </h3>

                  <div className="mt-3 h-28 border border-slate-400">
                    <div className="h-full" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase text-slate-900">
                    Head of Department / Head of Institution's Remarks
                  </h3>

                  <div className="mt-3 h-28 border border-slate-400">
                    <div className="h-full" />
                  </div>
                </div>

              </div>

              {/* =================================================
                  SIGNATURES
                 ================================================= */}

              <div className="mt-12 grid gap-10 sm:grid-cols-3">

                <div>
                  <div className="border-b border-slate-500 pb-2" />
                  <p className="mt-2 text-center text-xs font-medium">
                    Class Teacher
                  </p>
                  <p className="text-center text-[10px] text-slate-500">
                    Signature & Date
                  </p>
                </div>

                <div>
                  <div className="border-b border-slate-500 pb-2" />
                  <p className="mt-2 text-center text-xs font-medium">
                    Head of Department
                  </p>
                  <p className="text-center text-[10px] text-slate-500">
                    Signature & Date
                  </p>
                </div>

                <div>
                  <div className="border-b border-slate-500 pb-2" />
                  <p className="mt-2 text-center text-xs font-medium">
                    Head of Institution
                  </p>
                  <p className="text-center text-[10px] text-slate-500">
                    Signature & Date
                  </p>
                </div>

              </div>

              {/* FOOTER */}

              <div className="mt-10 border-t border-slate-300 pt-4 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Biriwa Technical Institute
                </p>

                <p className="mt-1 text-[9px] text-slate-400">
                  Generated by BTI School Management System
                </p>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* =========================================================
          PRINT STYLING
         ========================================================= */}

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          html,
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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

          button {
            display: none !important;
          }

          table {
            page-break-inside: avoid;
          }

          tr {
            page-break-inside: avoid;
          }

          .report-card > div {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}

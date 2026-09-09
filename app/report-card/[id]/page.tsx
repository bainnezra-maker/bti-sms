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
  subject: string;
  assessment_type: string;
  score: number;
  max_score: number;
  term: string | null;
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

        const { data: studentData, error: studentError } = await supabase
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

          const { data: termData, error: termError } = await supabase
            .from('terms')
            .select('id, name, is_current')
            .eq('academic_year_id', currentYear.id)
            .order('start_date', { ascending: true });

          if (termError) {
            throw new Error(termError.message);
          }

          setTerms(termData || []);

          const currentTerm =
            termData?.find((term) => term.is_current) || termData?.[0];

          if (currentTerm) {
            setSelectedTerm(currentTerm.id);
          }
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

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('school_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.school_id) {
          throw new Error('Unable to identify school.');
        }

        const schoolId = profile.school_id;

        // Get student's enrollment for the selected academic year.
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
          return;
        }

        setEnrollment(enrollmentData);

        // Load class.
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('id, name, level')
          .eq('id', enrollmentData.class_id)
          .eq('school_id', schoolId)
          .maybeSingle();

        if (classError) {
          throw new Error(classError.message);
        }

        setClassItem(classData);

        // Load programme.
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

        // Get selected term name.
        const selectedTermObject = terms.find(
          (term) => term.id === selectedTerm
        );

        if (!selectedTermObject) {
          setResults([]);
          return;
        }

        // Load all assessments for the student for this term.
        const { data: assessmentData, error: assessmentError } =
          await supabase
            .from('assessments')
            .select(`
              id,
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

        const safeAssessments = (assessmentData || []).map((item) => ({
          ...item,
          score: Number(item.score) || 0,
          max_score: Number(item.max_score) || 0,
        }));

        setAssessments(safeAssessments);

        // Find all subjects represented in the student's assessments.
        const subjectNames = Array.from(
          new Set(safeAssessments.map((item) => item.subject))
        );

        const calculated: SubjectResult[] = subjectNames.map((subject) => {
          const subjectAssessments = safeAssessments.filter(
            (item) => item.subject === subject
          );

          // Calculate CA from the seven official components.
          let caRaw = 0;

          CA_TYPES.forEach((type) => {
            const assessment = subjectAssessments.find(
              (item) => item.assessment_type === type
            );

            if (assessment) {
              caRaw += assessment.score;
            }
          });

          // CA is officially out of 100.
          const caContribution = (caRaw / 100) * 30;

          const examination = subjectAssessments.find(
            (item) => item.assessment_type === 'Examination'
          );

          const examRaw = examination ? examination.score : 0;

          // Examination is officially out of 100.
          const examContribution = (examRaw / 100) * 70;

          const finalScore = caContribution + examContribution;

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
        });

        calculated.sort((a, b) =>
          a.subject.localeCompare(b.subject)
        );

        setResults(calculated);
      } catch (err: any) {
        setError(err.message || 'Unable to generate report card.');
      } finally {
        setCalculating(false);
      }
    }

    loadReportCard();
  }, [studentId, selectedYear, selectedTerm, terms]);

  const summary = useMemo(() => {
    const totalSubjects = results.length;

    const totalFinal = results.reduce(
      (sum, result) => sum + result.finalScore,
      0
    );

    const average =
      totalSubjects > 0 ? totalFinal / totalSubjects : 0;

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

  const selectedYearName =
    academicYears.find((year) => year.id === selectedYear)?.name || '';

  const selectedTermName =
    terms.find((term) => term.id === selectedTerm)?.name || '';

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

          {/* Top navigation */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <button
                onClick={() => router.push(`/students/${student.id}`)}
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
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Selection */}
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
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Select academic year</option>

                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                      {year.is_current ? ' (Current)' : ''}
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
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Select term</option>

                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                      {term.is_current ? ' (Current)' : ''}
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
            <div className="report-card rounded-2xl bg-white p-5 shadow-sm sm:p-8">

              {/* School header */}
              <div className="border-b-2 border-slate-900 pb-5 text-center">
                <h2 className="text-2xl font-extrabold uppercase tracking-wide text-slate-900">
                  Biriwa Technical Institute
                </h2>

                <p className="mt-1 text-sm font-medium text-slate-600">
                  STUDENT ACADEMIC REPORT CARD
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  {selectedYearName} — {selectedTermName}
                </p>
              </div>

              {/* Student information */}
              <div className="mt-6 grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Student Name
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {student.full_name}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Admission Number
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {student.admission_number}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Class
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {classItem?.name || '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Programme
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {programme?.name || '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Level
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {classItem?.level || '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Gender
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {student.gender || '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    JHS Aggregate
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {student.jhs_aggregate ?? '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Report Status
                  </p>

                  <p className="mt-1 font-bold text-green-700">
                    {results.length > 0 ? 'Available' : 'No Results'}
                  </p>
                </div>
              </div>

              {/* Results table */}
              <div className="mt-7">
                <h3 className="mb-3 text-lg font-bold text-slate-900">
                  Academic Performance
                </h3>

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
                  <div className="overflow-x-auto rounded-xl border border-slate-300">
                    <table className="w-full min-w-[850px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-left">
                          <th className="border-b border-slate-300 px-3 py-3">
                            #
                          </th>

                          <th className="border-b border-slate-300 px-3 py-3">
                            Subject
                          </th>

                          <th className="border-b border-slate-300 px-3 py-3 text-center">
                            CA /100
                          </th>

                          <th className="border-b border-slate-300 px-3 py-3 text-center">
                            CA /30
                          </th>

                          <th className="border-b border-slate-300 px-3 py-3 text-center">
                            Exam /100
                          </th>

                          <th className="border-b border-slate-300 px-3 py-3 text-center">
                            Exam /70
                          </th>

                          <th className="border-b border-slate-300 px-3 py-3 text-center">
                            Final /100
                          </th>

                          <th className="border-b border-slate-300 px-3 py-3 text-center">
                            Grade
                          </th>

                          <th className="border-b border-slate-300 px-3 py-3 text-center">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {results.map((result, index) => (
                          <tr
                            key={result.subject}
                            className="hover:bg-slate-50"
                          >
                            <td className="border-b border-slate-200 px-3 py-3">
                              {index + 1}
                            </td>

                            <td className="border-b border-slate-200 px-3 py-3 font-semibold">
                              {result.subject}
                            </td>

                            <td className="border-b border-slate-200 px-3 py-3 text-center">
                              {result.caRaw.toFixed(2)}
                            </td>

                            <td className="border-b border-slate-200 px-3 py-3 text-center">
                              {result.caContribution.toFixed(2)}
                            </td>

                            <td className="border-b border-slate-200 px-3 py-3 text-center">
                              {result.examRaw.toFixed(2)}
                            </td>

                            <td className="border-b border-slate-200 px-3 py-3 text-center">
                              {result.examContribution.toFixed(2)}
                            </td>

                            <td className="border-b border-slate-200 px-3 py-3 text-center font-bold">
                              {result.finalScore.toFixed(2)}
                            </td>

                            <td className="border-b border-slate-200 px-3 py-3 text-center font-bold">
                              {result.grade}
                            </td>

                            <td className="border-b border-slate-200 px-3 py-3 text-center">
                              <span
                                className={`font-semibold ${
                                  result.status === 'Pass'
                                    ? 'text-green-700'
                                    : 'text-red-700'
                                }`}
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

              {/* Summary */}
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase text-slate-500">
                    Subjects
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {summary.totalSubjects}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase text-slate-500">
                    Total Final
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {summary.totalFinal.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase text-slate-500">
                    Average
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {summary.average.toFixed(2)}%
                  </p>
                </div>

                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs uppercase text-green-700">
                    Passed
                  </p>
                  <p className="mt-1 text-2xl font-bold text-green-700">
                    {summary.passed}
                  </p>
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs uppercase text-red-700">
                    Failed
                  </p>
                  <p className="mt-1 text-2xl font-bold text-red-700">
                    {summary.failed}
                  </p>
                </div>
              </div>

              {/* Overall performance */}
              <div className="mt-7 rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">
                    Overall Performance
                  </h3>

                  <span className="text-xl font-extrabold">
                    {summary.average.toFixed(2)}%
                  </span>
                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{
                      width: `${Math.min(summary.average, 100)}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-sm text-slate-600">
                  Overall remark:{' '}
                  <span className="font-bold text-slate-900">
                    {getRemark(summary.average)}
                  </span>
                </p>
              </div>

              {/* Remarks */}
              <div className="mt-7 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="font-bold text-slate-900">
                    Class Teacher's Remarks
                  </h3>

                  <div className="mt-3 h-24 rounded-xl border border-slate-300" />
                </div>

                <div>
                  <h3 className="font-bold text-slate-900">
                    Head of Department / Head of Institution's Remarks
                  </h3>

                  <div className="mt-3 h-24 rounded-xl border border-slate-300" />
                </div>
              </div>

              {/* Signatures */}
              <div className="mt-10 grid gap-10 sm:grid-cols-3">
                <div>
                  <div className="border-b border-slate-400 pb-2" />
                  <p className="mt-2 text-center text-sm">
                    Class Teacher
                  </p>
                </div>

                <div>
                  <div className="border-b border-slate-400 pb-2" />
                  <p className="mt-2 text-center text-sm">
                    Head of Department
                  </p>
                </div>

                <div>
                  <div className="border-b border-slate-400 pb-2" />
                  <p className="mt-2 text-center text-sm">
                    Head of Institution
                  </p>
                </div>
              </div>

              <div className="mt-8 text-center text-xs text-slate-500">
                Generated by BTI School Management System
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print styling */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          body {
            background: white !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          .report-card {
            box-shadow: none !important;
            border-radius: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }

          button {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}

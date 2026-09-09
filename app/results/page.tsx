'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type AcademicYear = {
  id: string;
  name: string;
};

type Term = {
  id: string;
  name: string;
  academic_year_id: string;
};

type Programme = {
  id: string;
  name: string;
  code: string | null;
};

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
  academic_year_id: string | null;
};

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
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

type StudentResult = {
  student: Student;
  subjects: SubjectResult[];
  overallAverage: number;
  totalMarks: number;
  subjectCount: number;
};

const supabase = createClient();

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

function getStatus(score: number) {
  return score >= 50 ? 'Pass' : 'Fail';
}

export default function ResultsPage() {
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);

  const [terms, setTerms] = useState<Term[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<
    Assessment[]
  >([]);

  const [selectedAcademicYear, setSelectedAcademicYear] =
    useState('');

  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedProgramme, setSelectedProgramme] =
    useState('');

  const [selectedClass, setSelectedClass] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState('');

  /*
   * ---------------------------------------------------------
   * LOAD CURRENT USER / SCHOOL
   * ---------------------------------------------------------
   */
  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error: profileError } =
        await supabase
          .from('users')
          .select('school_id')
          .eq('id', user.id)
          .single();

      if (profileError) {
        setError(profileError.message);
        return;
      }

      setSchoolId(data?.school_id ?? null);
    }

    loadProfile();
  }, []);

  /*
   * ---------------------------------------------------------
   * LOAD ACADEMIC DATA
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (!schoolId) return;

    async function loadAcademicData() {
      setLoading(true);
      setError('');

      const [
        yearsResult,
        programmesResult,
        classesResult,
      ] = await Promise.all([
        supabase
          .from('academic_years')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('start_date', {
            ascending: false,
          }),

        supabase
          .from('programmes')
          .select('id, name, code')
          .eq('school_id', schoolId)
          .order('name'),

        supabase
          .from('classes')
          .select(
            'id, name, level, programme_id, academic_year_id'
          )
          .eq('school_id', schoolId)
          .order('name'),
      ]);

      if (yearsResult.error) {
        setError(yearsResult.error.message);
      } else {
        setAcademicYears(yearsResult.data ?? []);
      }

      if (programmesResult.error) {
        setError(programmesResult.error.message);
      } else {
        setProgrammes(
          programmesResult.data ?? []
        );
      }

      if (classesResult.error) {
        setError(classesResult.error.message);
      } else {
        setClasses(classesResult.data ?? []);
      }

      setLoading(false);
    }

    loadAcademicData();
  }, [schoolId]);

  /*
   * ---------------------------------------------------------
   * LOAD TERMS
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (!selectedAcademicYear) {
      setTerms([]);
      setSelectedTerm('');
      return;
    }

    async function loadTerms() {
      const { data, error: termError } =
        await supabase
          .from('terms')
          .select(
            'id, name, academic_year_id'
          )
          .eq(
            'academic_year_id',
            selectedAcademicYear
          )
          .order('start_date');

      if (termError) {
        setError(termError.message);
        return;
      }

      setTerms(data ?? []);
    }

    loadTerms();
  }, [selectedAcademicYear]);

  /*
   * ---------------------------------------------------------
   * FILTER CLASSES
   * ---------------------------------------------------------
   */
  const filteredClasses = useMemo(() => {
    return classes.filter((item) => {
      const matchesProgramme =
        !selectedProgramme ||
        item.programme_id === selectedProgramme;

      const matchesYear =
        !selectedAcademicYear ||
        !item.academic_year_id ||
        item.academic_year_id ===
          selectedAcademicYear;

      return (
        matchesProgramme && matchesYear
      );
    });
  }, [
    classes,
    selectedProgramme,
    selectedAcademicYear,
  ]);

  /*
   * ---------------------------------------------------------
   * RESET INVALID CLASS
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (
      selectedClass &&
      !filteredClasses.some(
        (item) => item.id === selectedClass
      )
    ) {
      setSelectedClass('');
    }
  }, [filteredClasses, selectedClass]);

  /*
   * ---------------------------------------------------------
   * LOAD CLASS RESULTS
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (
      !schoolId ||
      !selectedAcademicYear ||
      !selectedTerm ||
      !selectedClass
    ) {
      setStudents([]);
      setAssessments([]);
      return;
    }

    async function loadResults() {
      setLoadingResults(true);
      setError('');

      /*
       * Get active students in the selected class.
       */
      const {
        data: enrollmentData,
        error: enrollmentError,
      } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', selectedClass)
        .eq(
          'academic_year_id',
          selectedAcademicYear
        )
        .eq('status', 'active');

      if (enrollmentError) {
        setError(enrollmentError.message);
        setLoadingResults(false);
        return;
      }

      const studentIds =
        enrollmentData?.map(
          (item) => item.student_id
        ) ?? [];

      if (studentIds.length === 0) {
        setStudents([]);
        setAssessments([]);
        setLoadingResults(false);
        return;
      }

      /*
       * Get students.
       */
      const {
        data: studentData,
        error: studentError,
      } = await supabase
        .from('students')
        .select(
          'id, full_name, admission_number'
        )
        .in('id', studentIds)
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('full_name');

      if (studentError) {
        setError(studentError.message);
        setLoadingResults(false);
        return;
      }

      /*
       * Get all assessments for these students
       * in the selected term.
       */
      const {
        data: assessmentData,
        error: assessmentError,
      } = await supabase
        .from('assessments')
        .select(
          `
            id,
            student_id,
            subject,
            assessment_type,
            score,
            max_score,
            term
          `
        )
        .eq('school_id', schoolId)
        .eq('term', selectedTerm)
        .in('student_id', studentIds);

      if (assessmentError) {
        setError(
          assessmentError.message
        );
        setLoadingResults(false);
        return;
      }

      setStudents(studentData ?? []);
      setAssessments(
        (assessmentData ?? []) as Assessment[]
      );

      setLoadingResults(false);
    }

    loadResults();
  }, [
    schoolId,
    selectedAcademicYear,
    selectedTerm,
    selectedClass,
  ]);

  /*
   * ---------------------------------------------------------
   * BUILD STUDENT RESULTS
   * ---------------------------------------------------------
   */
  const studentResults = useMemo(() => {
    const results: StudentResult[] = [];

    students.forEach((student) => {
      const studentAssessments =
        assessments.filter(
          (assessment) =>
            assessment.student_id ===
            student.id
        );

      const subjectNames = Array.from(
        new Set(
          studentAssessments.map(
            (assessment) =>
              assessment.subject
          )
        )
      ).sort();

      const subjects: SubjectResult[] = [];

      subjectNames.forEach((subjectName) => {
        const subjectAssessments =
          studentAssessments.filter(
            (assessment) =>
              assessment.subject ===
              subjectName
          );

        /*
         * Calculate CA out of 100.
         */
        let caRaw = 0;

        CA_TYPES.forEach((type) => {
          const record =
            subjectAssessments.find(
              (assessment) =>
                assessment.assessment_type ===
                type
            );

          if (record) {
            caRaw += Number(
              record.score
            );
          }
        });

        /*
         * Scale CA /100 to CA /30.
         */
        const caContribution =
          (caRaw / 100) * 30;

        /*
         * Find examination.
         */
        const exam =
          subjectAssessments.find(
            (assessment) =>
              assessment.assessment_type ===
              'Examination'
          );

        const examRaw = exam
          ? Number(exam.score)
          : 0;

        /*
         * Scale Examination /100 to /70.
         */
        const examContribution =
          (examRaw / 100) * 70;

        /*
         * Final score.
         */
        const finalScore =
          caContribution +
          examContribution;

        subjects.push({
          subject: subjectName,
          caRaw,
          caContribution,
          examRaw,
          examContribution,
          finalScore,
          grade: getGrade(finalScore),
          status: getStatus(finalScore),
        });
      });

      const totalMarks = subjects.reduce(
        (sum, subject) =>
          sum + subject.finalScore,
        0
      );

      const overallAverage =
        subjects.length > 0
          ? totalMarks /
            subjects.length
          : 0;

      results.push({
        student,
        subjects,
        overallAverage,
        totalMarks,
        subjectCount: subjects.length,
      });
    });

    return results;
  }, [students, assessments]);

  /*
   * ---------------------------------------------------------
   * CLASS STATISTICS
   * ---------------------------------------------------------
   */
  const statistics = useMemo(() => {
    const averages =
      studentResults
        .filter(
          (result) =>
            result.subjectCount > 0
        )
        .map(
          (result) =>
            result.overallAverage
        );

    if (averages.length === 0) {
      return {
        students: students.length,
        withResults: 0,
        average: 0,
        highest: 0,
        lowest: 0,
      };
    }

    const total = averages.reduce(
      (sum, value) =>
        sum + value,
      0
    );

    return {
      students: students.length,
      withResults: averages.length,
      average:
        total / averages.length,
      highest: Math.max(...averages),
      lowest: Math.min(...averages),
    };
  }, [students, studentResults]);

  /*
   * ---------------------------------------------------------
   * DISPLAY
   * ---------------------------------------------------------
   */
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Results
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Calculate and review official BTI
            student results.
          </p>
        </div>

        {/* FORMULA */}
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="font-semibold text-blue-900">
            BTI 30% + 70% Grading
          </h2>

          <p className="mt-2 text-sm text-blue-800">
            CA /100 → /30 &nbsp; + &nbsp;
            Examination /100 → /70 &nbsp; =
            &nbsp; Final /100
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* SELECTION */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Select Class
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* ACADEMIC YEAR */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Academic Year
              </label>

              <select
                value={
                  selectedAcademicYear
                }
                onChange={(event) => {
                  setSelectedAcademicYear(
                    event.target.value
                  );
                  setSelectedTerm('');
                  setSelectedClass('');
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select Academic Year
                </option>

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
            </div>

            {/* TERM */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Term
              </label>

              <select
                value={selectedTerm}
                onChange={(event) =>
                  setSelectedTerm(
                    event.target.value
                  )
                }
                disabled={
                  !selectedAcademicYear
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none disabled:bg-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select Term
                </option>

                {terms.map((term) => (
                  <option
                    key={term.id}
                    value={term.name}
                  >
                    {term.name}
                  </option>
                ))}
              </select>
            </div>

            {/* PROGRAMME */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Programme
              </label>

              <select
                value={selectedProgramme}
                onChange={(event) => {
                  setSelectedProgramme(
                    event.target.value
                  );
                  setSelectedClass('');
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select Programme
                </option>

                {programmes.map(
                  (programme) => (
                    <option
                      key={programme.id}
                      value={programme.id}
                    >
                      {programme.name}
                      {programme.code
                        ? ` (${programme.code})`
                        : ''}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* CLASS */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Class
              </label>

              <select
                value={selectedClass}
                onChange={(event) =>
                  setSelectedClass(
                    event.target.value
                  )
                }
                disabled={
                  !selectedAcademicYear
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none disabled:bg-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select Class
                </option>

                {filteredClasses.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>

        {/* STATISTICS */}
        {selectedClass &&
          selectedTerm && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Class Students
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {statistics.students}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Students with Results
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {statistics.withResults}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Class Average
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {statistics.average.toFixed(
                    1
                  )}%
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Highest Average
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {statistics.highest.toFixed(
                    1
                  )}%
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Lowest Average
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {statistics.lowest.toFixed(
                    1
                  )}%
                </p>
              </div>
            </div>
          )}

        {/* RESULTS TABLE */}
        {selectedClass &&
          selectedTerm && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-200 p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Class Results
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Official result calculation using
                  the BTI 30% CA + 70% examination
                  structure.
                </p>
              </div>

              {loadingResults ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Calculating results...
                </div>
              ) : students.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No active students are enrolled
                  in this class for the selected
                  academic year.
                </div>
              ) : studentResults.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No results have been entered
                  yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          #
                        </th>

                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Student
                        </th>

                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Admission No.
                        </th>

                        <th className="px-4 py-3 text-center font-semibold text-slate-700">
                          Subjects
                        </th>

                        <th className="px-4 py-3 text-center font-semibold text-slate-700">
                          Total
                        </th>

                        <th className="px-4 py-3 text-center font-semibold text-slate-700">
                          Average
                        </th>

                        <th className="px-4 py-3 text-center font-semibold text-slate-700">
                          Grade
                        </th>

                        <th className="px-4 py-3 text-center font-semibold text-slate-700">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {studentResults.map(
                        (result, index) => {
                          const overallGrade =
                            getGrade(
                              result.overallAverage
                            );

                          return (
                            <tr
                              key={
                                result.student
                                  .id
                              }
                              className="hover:bg-slate-50"
                            >
                              <td className="px-4 py-3 text-slate-500">
                                {index + 1}
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                                {
                                  result
                                    .student
                                    .full_name
                                }
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                {
                                  result
                                    .student
                                    .admission_number
                                }
                              </td>

                              <td className="px-4 py-3 text-center">
                                {
                                  result.subjectCount
                                }
                              </td>

                              <td className="px-4 py-3 text-center font-medium">
                                {result.totalMarks.toFixed(
                                  1
                                )}
                              </td>

                              <td className="px-4 py-3 text-center font-bold">
                                {result.overallAverage.toFixed(
                                  1
                                )}
                                %
                              </td>

                              <td className="px-4 py-3 text-center">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                  {overallGrade}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const element =
                                      document.getElementById(
                                        `student-${result.student.id}`
                                      );

                                    element?.scrollIntoView(
                                      {
                                        behavior:
                                          'smooth',
                                        block:
                                          'center',
                                      }
                                    );
                                  }}
                                  className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        {/* DETAILED SUBJECT RESULTS */}
        {studentResults.length > 0 && (
          <div className="mt-6 space-y-6">
            {studentResults.map(
              (result) => (
                <div
                  id={`student-${result.student.id}`}
                  key={result.student.id}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 p-4 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          {
                            result.student
                              .full_name
                          }
                        </h2>

                        <p className="text-sm text-slate-500">
                          {
                            result.student
                              .admission_number
                          }
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                        <p className="text-xs text-slate-500">
                          Overall Average
                        </p>

                        <p className="text-xl font-bold text-slate-900">
                          {result.overallAverage.toFixed(
                            1
                          )}
                          %
                        </p>

                        <p className="text-xs font-semibold text-slate-600">
                          Grade:{' '}
                          {getGrade(
                            result.overallAverage
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {result.subjects.length ===
                  0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      No assessment records
                      found for this student.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">
                              Subject
                            </th>

                            <th className="px-4 py-3 text-center font-semibold text-slate-700">
                              CA /100
                            </th>

                            <th className="px-4 py-3 text-center font-semibold text-slate-700">
                              CA /30
                            </th>

                            <th className="px-4 py-3 text-center font-semibold text-slate-700">
                              Exam /100
                            </th>

                            <th className="px-4 py-3 text-center font-semibold text-slate-700">
                              Exam /70
                            </th>

                            <th className="px-4 py-3 text-center font-semibold text-slate-700">
                              Final /100
                            </th>

                            <th className="px-4 py-3 text-center font-semibold text-slate-700">
                              Grade
                            </th>

                            <th className="px-4 py-3 text-center font-semibold text-slate-700">
                              Status
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {result.subjects.map(
                            (subject) => (
                              <tr
                                key={
                                  subject.subject
                                }
                                className="hover:bg-slate-50"
                              >
                                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                                  {
                                    subject.subject
                                  }
                                </td>

                                <td className="px-4 py-3 text-center">
                                  {subject.caRaw.toFixed(
                                    1
                                  )}
                                </td>

                                <td className="px-4 py-3 text-center">
                                  {subject.caContribution.toFixed(
                                    1
                                  )}
                                </td>

                                <td className="px-4 py-3 text-center">
                                  {subject.examRaw.toFixed(
                                    1
                                  )}
                                </td>

                                <td className="px-4 py-3 text-center">
                                  {subject.examContribution.toFixed(
                                    1
                                  )}
                                </td>

                                <td className="px-4 py-3 text-center font-bold">
                                  {subject.finalScore.toFixed(
                                    1
                                  )}
                                </td>

                                <td className="px-4 py-3 text-center font-bold">
                                  {
                                    subject.grade
                                  }
                                </td>

                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      subject.status ===
                                      'Pass'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {
                                      subject.status
                                    }
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
              )
            )}
          </div>
        )}

        {/* FORMULA INFORMATION */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Calculation Method
          </h2>

          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p>
              <strong>CA Raw:</strong> Exercise 1
              + Exercise 2 + Exercise 3 + Exercise
              4 + Class Test 1 + Class Test 2 +
              Class Test 3 = /100
            </p>

            <p>
              <strong>CA /30:</strong> (CA Raw ÷
              100) × 30
            </p>

            <p>
              <strong>Exam /70:</strong> (Exam Raw
              ÷ 100) × 70
            </p>

            <p>
              <strong>Final /100:</strong> CA /30 +
              Exam /70
            </p>

            <p>
              <strong>Grade:</strong> A = 80–100,
              B = 70–79, C = 60–69, D = 50–59,
              E = 40–49, F = below 40
            </p>
          </div>
        </div>

        {loading && (
          <div className="mt-6 text-center text-sm text-slate-500">
            Loading academic information...
          </div>
        )}
      </div>
    </div>
  );
}

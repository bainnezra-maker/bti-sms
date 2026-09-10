'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type AcademicYear = {
  id: string;
  name: string;
};

type Semester = {
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

type Subject = {
  id: string;
  name: string;
  code: string | null;
};

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
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

const supabase = createClient();

const CA_TYPES = [
  { value: 'Exercise 1', label: 'Exercise 1', max: 10 },
  { value: 'Exercise 2', label: 'Exercise 2', max: 10 },
  { value: 'Exercise 3', label: 'Exercise 3', max: 10 },
  { value: 'Exercise 4', label: 'Exercise 4', max: 10 },
  { value: 'Class Test 1', label: 'Class Test 1', max: 20 },
  { value: 'Class Test 2', label: 'Class Test 2', max: 20 },
  { value: 'Class Test 3', label: 'Class Test 3', max: 20 },
];

const EXAM_TYPE = {
  value: 'Examination',
  label: 'Examination',
  max: 100,
};

function getPercentage(score: number, maxScore: number) {
  return maxScore > 0 ? (score / maxScore) * 100 : 0;
}

function getGrade(percentage: number) {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
}

function getStatus(percentage: number) {
  return percentage >= 50 ? 'Pass' : 'Fail';
}

export default function AssessmentPage() {
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [students, setStudents] = useState<Student[]>([]);
  const [existingAssessments, setExistingAssessments] = useState<
    AssessmentRecord[]
  >([]);

  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedProgramme, setSelectedProgramme] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState('');

  const [scores, setScores] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  /*
   * ---------------------------------------------------------
   * GET CURRENT USER + SCHOOL
   * ---------------------------------------------------------
   */
  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error: profileError } = await supabase
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
   * LOAD ACADEMIC YEARS, PROGRAMMES, SUBJECTS AND CLASSES
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (!schoolId) return;

    async function loadAcademicData() {
      setLoading(true);
      setError('');

      const [
        academicYearsResult,
        programmesResult,
        subjectsResult,
        classesResult,
      ] = await Promise.all([
        supabase
          .from('academic_years')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: false }),

        supabase
          .from('programmes')
          .select('id, name, code')
          .eq('school_id', schoolId)
          .order('name'),

        supabase
          .from('subjects')
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

      if (academicYearsResult.error) {
        setError(academicYearsResult.error.message);
      } else {
        setAcademicYears(academicYearsResult.data ?? []);
      }

      if (programmesResult.error) {
        setError(programmesResult.error.message);
      } else {
        setProgrammes(programmesResult.data ?? []);
      }

      if (subjectsResult.error) {
        setError(subjectsResult.error.message);
      } else {
        setSubjects(subjectsResult.data ?? []);
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
   * LOAD SEMESTERS WHEN ACADEMIC YEAR CHANGES
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (!selectedAcademicYear) {
      setSemesters([]);
      setSelectedSemester('');
      return;
    }

    async function loadSemesters() {
      setError('');

      const { data, error: semestersError } = await supabase
        .from('terms')
        .select('id, name, academic_year_id')
        .eq('academic_year_id', selectedAcademicYear)
        .in('name', ['Semester 1', 'Semester 2'])
        .order('start_date');

      if (semestersError) {
        setError(semestersError.message);
        setSemesters([]);
        return;
      }

      setSemesters(data ?? []);
    }

    loadSemesters();
  }, [selectedAcademicYear]);

  /*
   * ---------------------------------------------------------
   * FILTER CLASSES BY PROGRAMME + ACADEMIC YEAR
   * ---------------------------------------------------------
   */
  const filteredClasses = useMemo(() => {
    return classes.filter((item) => {
      const matchesProgramme =
        !selectedProgramme ||
        item.programme_id === selectedProgramme;

      const matchesAcademicYear =
        !selectedAcademicYear ||
        !item.academic_year_id ||
        item.academic_year_id === selectedAcademicYear;

      return matchesProgramme && matchesAcademicYear;
    });
  }, [
    classes,
    selectedProgramme,
    selectedAcademicYear,
  ]);

  /*
   * ---------------------------------------------------------
   * RESET CLASS WHEN PROGRAMME / YEAR CHANGES
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (
      selectedClass &&
      !filteredClasses.some((item) => item.id === selectedClass)
    ) {
      setSelectedClass('');
    }
  }, [filteredClasses, selectedClass]);

  /*
   * ---------------------------------------------------------
   * LOAD STUDENTS FOR SELECTED CLASS
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (!selectedClass || !selectedAcademicYear) {
      setStudents([]);
      setScores({});
      setExistingAssessments([]);
      return;
    }

    async function loadStudents() {
      setLoadingStudents(true);
      setError('');

      const { data: enrollmentData, error: enrollmentError } =
        await supabase
          .from('enrollments')
          .select('student_id')
          .eq('class_id', selectedClass)
          .eq('academic_year_id', selectedAcademicYear)
          .eq('status', 'active');

      if (enrollmentError) {
        setError(enrollmentError.message);
        setLoadingStudents(false);
        return;
      }

      const studentIds =
        enrollmentData?.map((item) => item.student_id) ?? [];

      if (studentIds.length === 0) {
        setStudents([]);
        setScores({});
        setExistingAssessments([]);
        setLoadingStudents(false);
        return;
      }

      const { data: studentData, error: studentError } =
        await supabase
          .from('students')
          .select('id, full_name, admission_number')
          .in('id', studentIds)
          .eq('school_id', schoolId)
          .eq('status', 'active')
          .order('full_name');

      if (studentError) {
        setError(studentError.message);
        setLoadingStudents(false);
        return;
      }

      setStudents(studentData ?? []);
      setLoadingStudents(false);
    }

    loadStudents();
  }, [
    selectedClass,
    selectedAcademicYear,
    schoolId,
  ]);

  /*
   * ---------------------------------------------------------
   * LOAD EXISTING SCORES
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (
      !schoolId ||
      !selectedClass ||
      !selectedAcademicYear ||
      !selectedSemester ||
      !selectedSubject ||
      !selectedAssessmentType ||
      students.length === 0
    ) {
      setExistingAssessments([]);
      setScores({});
      return;
    }

    async function loadExistingScores() {
      setError('');

      const { data, error: assessmentError } =
        await supabase
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
          .eq('subject', selectedSubject)
          .eq(
            'assessment_type',
            selectedAssessmentType
          )
          .eq('term', selectedSemester)
          .in(
            'student_id',
            students.map((student) => student.id)
          );

      if (assessmentError) {
        setError(assessmentError.message);
        return;
      }

      const records = (data ?? []) as AssessmentRecord[];

      setExistingAssessments(records);

      const scoreMap: Record<string, string> = {};

      records.forEach((record) => {
        scoreMap[record.student_id] =
          String(record.score);
      });

      setScores(scoreMap);
    }

    loadExistingScores();
  }, [
    schoolId,
    selectedClass,
    selectedAcademicYear,
    selectedSemester,
    selectedSubject,
    selectedAssessmentType,
    students,
  ]);

  /*
   * ---------------------------------------------------------
   * CURRENT MAX SCORE
   * ---------------------------------------------------------
   */
  const currentAssessment = useMemo(() => {
    if (selectedAssessmentType === EXAM_TYPE.value) {
      return EXAM_TYPE;
    }

    return (
      CA_TYPES.find(
        (item) =>
          item.value === selectedAssessmentType
      ) ?? null
    );
  }, [selectedAssessmentType]);

  const maxScore = currentAssessment?.max ?? 0;

  /*
   * ---------------------------------------------------------
   * SCORE CHANGE
   * ---------------------------------------------------------
   */
  function handleScoreChange(
    studentId: string,
    value: string
  ) {
    if (value === '') {
      setScores((previous) => ({
        ...previous,
        [studentId]: '',
      }));
      return;
    }

    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) return;

    if (numericValue > maxScore) {
      setScores((previous) => ({
        ...previous,
        [studentId]: String(maxScore),
      }));
      return;
    }

    if (numericValue < 0) {
      setScores((previous) => ({
        ...previous,
        [studentId]: '0',
      }));
      return;
    }

    setScores((previous) => ({
      ...previous,
      [studentId]: value,
    }));
  }

  /*
   * ---------------------------------------------------------
   * SAVE ALL SCORES
   * ---------------------------------------------------------
   */
  async function saveScores() {
    if (!schoolId) {
      setError('School information could not be found.');
      return;
    }

    if (
      !selectedAcademicYear ||
      !selectedSemester ||
      !selectedClass ||
      !selectedSubject ||
      !selectedAssessmentType
    ) {
      setError(
        'Please select Academic Year, Semester, Class, Subject and Assessment Type.'
      );
      return;
    }

    if (!currentAssessment) {
      setError('Please select an assessment type.');
      return;
    }

    if (students.length === 0) {
      setError('There are no students in this class.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      for (const student of students) {
        const rawValue = scores[student.id];

        if (
          rawValue === undefined ||
          rawValue === ''
        ) {
          continue;
        }

        const numericScore = Number(rawValue);

        if (
          Number.isNaN(numericScore) ||
          numericScore < 0 ||
          numericScore > currentAssessment.max
        ) {
          throw new Error(
            `Invalid score for ${student.full_name}.`
          );
        }

        const existing = existingAssessments.find(
          (record) =>
            record.student_id === student.id
        );

        if (existing) {
          const { error: updateError } =
            await supabase
              .from('assessments')
              .update({
                score: numericScore,
                max_score: currentAssessment.max,
              })
              .eq('id', existing.id)
              .eq('school_id', schoolId);

          if (updateError) {
            throw updateError;
          }
        } else {
          const { error: insertError } =
            await supabase
              .from('assessments')
              .insert({
                school_id: schoolId,
                student_id: student.id,
                subject: selectedSubject,
                assessment_type:
                  selectedAssessmentType,
                score: numericScore,
                max_score:
                  currentAssessment.max,
                term: selectedSemester,
              });

          if (insertError) {
            throw insertError;
          }
        }
      }

      setMessage(
        'All entered scores have been saved successfully.'
      );

      /*
       * Reload existing records so that the screen
       * immediately reflects saved data.
       */
      const { data, error: reloadError } =
        await supabase
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
          .eq('subject', selectedSubject)
          .eq(
            'assessment_type',
            selectedAssessmentType
          )
          .eq('term', selectedSemester)
          .in(
            'student_id',
            students.map((student) => student.id)
          );

      if (!reloadError) {
        setExistingAssessments(
          (data ?? []) as AssessmentRecord[]
        );
      }
    } catch (saveError: any) {
      setError(
        saveError?.message ??
          'Something went wrong while saving scores.'
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * QUICK FILL
   * ---------------------------------------------------------
   */
  function quickFill(value: number) {
    if (!maxScore || students.length === 0) return;

    const adjustedValue = Math.min(
      value,
      maxScore
    );

    const newScores: Record<string, string> = {};

    students.forEach((student) => {
      newScores[student.id] =
        String(adjustedValue);
    });

    setScores(newScores);
  }

  /*
   * ---------------------------------------------------------
   * CLEAR SCORES
   * ---------------------------------------------------------
   */
  function clearScores() {
    setScores({});
  }

  /*
   * ---------------------------------------------------------
   * STATISTICS
   * ---------------------------------------------------------
   */
  const statistics = useMemo(() => {
    if (
      students.length === 0 ||
      !maxScore
    ) {
      return {
        entered: 0,
        average: 0,
        highest: 0,
        lowest: 0,
        passRate: 0,
      };
    }

    const enteredScores = students
      .map((student) => {
        const value = scores[student.id];

        if (
          value === undefined ||
          value === ''
        ) {
          return null;
        }

        const numeric = Number(value);

        return Number.isNaN(numeric)
          ? null
          : numeric;
      })
      .filter(
        (value): value is number =>
          value !== null
      );

    if (enteredScores.length === 0) {
      return {
        entered: 0,
        average: 0,
        highest: 0,
        lowest: 0,
        passRate: 0,
      };
    }

    const percentages = enteredScores.map(
      (score) =>
        getPercentage(score, maxScore)
    );

    const average =
      percentages.reduce(
        (sum, value) => sum + value,
        0
      ) / percentages.length;

    const highest = Math.max(
      ...percentages
    );

    const lowest = Math.min(
      ...percentages
    );

    const passed = percentages.filter(
      (percentage) => percentage >= 50
    ).length;

    const passRate =
      (passed / percentages.length) * 100;

    return {
      entered: enteredScores.length,
      average,
      highest,
      lowest,
      passRate,
    };
  }, [students, scores, maxScore]);

  /*
   * ---------------------------------------------------------
   * CA SUMMARY
   *
   * This section calculates the student's current
   * seven-component CA total.
   * ---------------------------------------------------------
   */
  const caSummary = useMemo(() => {
    return students.map((student) => {
      const studentAssessments =
        existingAssessments.filter(
          (record) =>
            record.student_id === student.id
        );

      let rawTotal = 0;

      CA_TYPES.forEach((type) => {
        const record =
          studentAssessments.find(
            (item) =>
              item.assessment_type ===
              type.value
          );

        if (record) {
          rawTotal += Number(record.score);
        }
      });

      const caContribution =
        (rawTotal / 100) * 30;

      const examRecord =
        studentAssessments.find(
          (item) =>
            item.assessment_type ===
            EXAM_TYPE.value
        );

      const examRaw = examRecord
        ? Number(examRecord.score)
        : 0;

      const examContribution =
        (examRaw / 100) * 70;

      const finalScore =
        caContribution +
        examContribution;

      return {
        studentId: student.id,
        rawTotal,
        caContribution,
        examRaw,
        examContribution,
        finalScore,
      };
    });
  }, [students, existingAssessments]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Assessment
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Enter BTI continuous assessment and
            examination scores.
          </p>
        </div>

        {/* BTI MARKING STRUCTURE */}
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="font-semibold text-blue-900">
            BTI Marking Structure
          </h2>

          <div className="mt-2 grid gap-2 text-sm text-blue-800 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              Exercises: <strong>4 × 10 = 40</strong>
            </div>

            <div>
              Class Tests: <strong>3 × 20 = 60</strong>
            </div>

            <div>
              CA: <strong>100 → 30%</strong>
            </div>

            <div>
              Examination: <strong>100 → 70%</strong>
            </div>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {message && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* SELECTION PANEL */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Select Class and Assessment
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {/* ACADEMIC YEAR */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Academic Year
              </label>

              <select
                value={selectedAcademicYear}
                onChange={(event) => {
                  setSelectedAcademicYear(
                    event.target.value
                  );
                  setSelectedSemester('');
                  setSelectedClass('');
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
            </div>

            {/* SEMESTER */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Semester
              </label>

              <select
                value={selectedSemester}
                onChange={(event) =>
                  setSelectedSemester(
                    event.target.value
                  )
                }
                disabled={!selectedAcademicYear}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none disabled:bg-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select Semester
                </option>

                {semesters.map((semester) => (
                  <option
                    key={semester.id}
                    value={semester.name}
                  >
                    {semester.name}
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

                {programmes.map((programme) => (
                  <option
                    key={programme.id}
                    value={programme.id}
                  >
                    {programme.name}
                    {programme.code
                      ? ` (${programme.code})`
                      : ''}
                  </option>
                ))}
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
                disabled={!selectedAcademicYear}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none disabled:bg-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select Class
                </option>

                {filteredClasses.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            {/* SUBJECT */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Subject
              </label>

              <select
                value={selectedSubject}
                onChange={(event) =>
                  setSelectedSubject(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select Subject
                </option>

                {subjects.map((subject) => (
                  <option
                    key={subject.id}
                    value={subject.name}
                  >
                    {subject.name}
                    {subject.code
                      ? ` (${subject.code})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* ASSESSMENT TYPE */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Assessment Type
              </label>

              <select
                value={selectedAssessmentType}
                onChange={(event) =>
                  setSelectedAssessmentType(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select Assessment
                </option>

                <optgroup label="Continuous Assessment">
                  {CA_TYPES.map((type) => (
                    <option
                      key={type.value}
                      value={type.value}
                    >
                      {type.label} — /{type.max}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="Examination">
                  <option
                    value={EXAM_TYPE.value}
                  >
                    {EXAM_TYPE.label} — /100
                  </option>
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {/* CLASS STATISTICS */}
        {students.length > 0 &&
          selectedAssessmentType && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Students
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {students.length}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Scores Entered
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {statistics.entered}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Average
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {statistics.average.toFixed(1)}%
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Highest
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {statistics.highest.toFixed(1)}%
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Pass Rate
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {statistics.passRate.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

        {/* SCORE SHEET */}
        {selectedAssessmentType &&
          selectedSubject &&
          selectedClass &&
          selectedSemester &&
          selectedAcademicYear && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-200 p-4 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Score Sheet
                    </h2>

                    <p className="mt-1 text-sm text-slate-600">
                      {selectedSubject} •{' '}
                      {selectedAssessmentType} •{' '}
                      Maximum: {maxScore}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        quickFill(0)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Fill 0
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        quickFill(5)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Fill 5
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        quickFill(10)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Fill 10
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        quickFill(15)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Fill 15
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        quickFill(20)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Fill 20
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        quickFill(25)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Fill 25
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        quickFill(30)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Fill 30
                    </button>

                    <button
                      type="button"
                      onClick={clearScores}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {loadingStudents ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Loading class students...
                </div>
              ) : students.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No active students are enrolled
                  in this class for the selected
                  academic year.
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
                          Score /{maxScore}
                        </th>

                        <th className="px-4 py-3 text-center font-semibold text-slate-700">
                          %
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
                      {students.map(
                        (student, index) => {
                          const rawScore =
                            scores[student.id] ??
                            '';

                          const numericScore =
                            rawScore === ''
                              ? 0
                              : Number(
                                  rawScore
                                );

                          const percentage =
                            rawScore === ''
                              ? 0
                              : getPercentage(
                                  numericScore,
                                  maxScore
                                );

                          const grade =
                            rawScore === ''
                              ? '-'
                              : getGrade(
                                  percentage
                                );

                          const status =
                            rawScore === ''
                              ? '-'
                              : getStatus(
                                  percentage
                                );

                          const existing =
                            existingAssessments.find(
                              (record) =>
                                record.student_id ===
                                student.id
                            );

                          return (
                            <tr
                              key={student.id}
                              className="hover:bg-slate-50"
                            >
                              <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                                {index + 1}
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                                {student.full_name}
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                {student.admission_number}
                              </td>

                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={maxScore}
                                  step="0.01"
                                  value={rawScore}
                                  onChange={(event) =>
                                    handleScoreChange(
                                      student.id,
                                      event.target.value
                                    )
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-center outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-center font-medium text-slate-700">
                                {rawScore === ''
                                  ? '-'
                                  : `${percentage.toFixed(
                                      1
                                    )}%`}
                              </td>

                              <td className="px-4 py-3 text-center">
                                <span className="font-semibold text-slate-800">
                                  {grade}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-center">
                                {status === '-' ? (
                                  <span className="text-slate-400">
                                    -
                                  </span>
                                ) : (
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      status ===
                                      'Pass'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {status}
                                  </span>
                                )}

                                {existing && (
                                  <div className="mt-1 text-[10px] text-slate-400">
                                    Saved
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {students.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <p className="text-xs text-slate-500">
                    Entered scores are automatically
                    limited to the maximum mark of{' '}
                    {maxScore}.
                  </p>

                  <button
                    type="button"
                    onClick={saveScores}
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? 'Saving...'
                      : 'Save All Scores'}
                  </button>
                </div>
              )}
            </div>
          )}

        {/* CA CALCULATION PREVIEW */}
        {students.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Results Calculation Preview
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                The system keeps the seven CA
                components and calculates the official
                30% + 70% result automatically.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      Student
                    </th>

                    <th className="px-4 py-3 text-center font-semibold text-slate-700">
                      CA Raw /100
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
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {caSummary.map((item) => {
                    const student =
                      students.find(
                        (studentItem) =>
                          studentItem.id ===
                          item.studentId
                      );

                    const grade =
                      item.finalScore > 0
                        ? getGrade(
                            item.finalScore
                          )
                        : '-';

                    return (
                      <tr
                        key={item.studentId}
                        className="hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {student?.full_name}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {item.rawTotal.toFixed(1)}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {item.caContribution.toFixed(
                            1
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {item.examRaw.toFixed(1)}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {item.examContribution.toFixed(
                            1
                          )}
                        </td>

                        <td className="px-4 py-3 text-center font-bold text-slate-900">
                          {item.finalScore.toFixed(
                            1
                          )}
                        </td>

                        <td className="px-4 py-3 text-center font-bold">
                          {grade}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MARKING FORMULA */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            BTI Result Formula
          </h2>

          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p>
              <strong>CA Raw:</strong> Exercise 1 +
              Exercise 2 + Exercise 3 + Exercise 4 +
              Class Test 1 + Class Test 2 + Class Test
              3 = /100
            </p>

            <p>
              <strong>CA Contribution:</strong> (CA
              Raw ÷ 100) × 30 = /30
            </p>

            <p>
              <strong>Exam Contribution:</strong> (Exam
              Raw ÷ 100) × 70 = /70
            </p>

            <p>
              <strong>Final Score:</strong> CA
              Contribution + Exam Contribution = /100
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

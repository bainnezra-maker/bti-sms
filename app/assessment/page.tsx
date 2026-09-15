'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

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

type UserProfile = {
  id: string;
  school_id: string;
  role: string;
  is_active: boolean | null;
};

type PerformanceRow = {
  student: Student;
  score: number;
  percentage: number;
  grade: string;
  status: string;
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

function gradeClass(grade: string) {
  switch (grade) {
    case 'A':
      return 'bg-emerald-100 text-emerald-700';
    case 'B':
      return 'bg-blue-100 text-blue-700';
    case 'C':
      return 'bg-cyan-100 text-cyan-700';
    case 'D':
      return 'bg-amber-100 text-amber-700';
    case 'E':
      return 'bg-orange-100 text-orange-700';
    case 'F':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-500';
  }
}

function getFormFromLevel(level: string | null) {
  if (!level) return '';

  const value = level.trim().toLowerCase();

  if (
    value.includes('form 1') ||
    value === '1' ||
    value === 'form1'
  ) {
    return 'Form 1';
  }

  if (
    value.includes('form 2') ||
    value === '2' ||
    value === 'form2'
  ) {
    return 'Form 2';
  }

  if (
    value.includes('form 3') ||
    value === '3' ||
    value === 'form3'
  ) {
    return 'Form 3';
  }

  return level;
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : '0.0';
}

export default function AssessmentPage() {
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState('');

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
  const [selectedForm, setSelectedForm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState('');

  const [scores, setScores] = useState<Record<string, string>>({});
  const [studentSearch, setStudentSearch] = useState('');

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

      if (!user) {
        setError('You are not logged in.');
        return;
      }

      const { data, error: profileError } = await supabase
        .from('users')
        .select('id, school_id, role, is_active')
        .eq('id', user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
        return;
      }

      const profile = data as UserProfile;

      setUserId(profile.id);
      setSchoolId(profile.school_id);
      setUserRole(profile.role);
    }

    loadProfile();
  }, []);

  /*
   * ---------------------------------------------------------
   * LOAD ACADEMIC DATA
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (!schoolId || !userId) return;

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
        setLoading(false);
        return;
      }

      if (programmesResult.error) {
        setError(programmesResult.error.message);
        setLoading(false);
        return;
      }

      if (subjectsResult.error) {
        setError(subjectsResult.error.message);
        setLoading(false);
        return;
      }

      if (classesResult.error) {
        setError(classesResult.error.message);
        setLoading(false);
        return;
      }

      const loadedAcademicYears =
        academicYearsResult.data ?? [];

      const loadedProgrammes =
        programmesResult.data ?? [];

      const loadedSubjects =
        subjectsResult.data ?? [];

      let loadedClasses =
        classesResult.data ?? [];

      /*
       * TEACHER CLASS RESTRICTION
       */
      if (userRole === 'teacher') {
        const {
          data: assignments,
          error: assignmentError,
        } = await supabase
          .from('teacher_assignments')
          .select('class_id')
          .eq('teacher_id', userId);

        if (assignmentError) {
          setError(assignmentError.message);
          setLoading(false);
          return;
        }

        const assignedClassIds = new Set(
          (assignments ?? []).map(
            (assignment) => assignment.class_id
          )
        );

        loadedClasses = loadedClasses.filter(
          (classItem) =>
            assignedClassIds.has(classItem.id)
        );

        if (loadedClasses.length === 1) {
          const onlyClass = loadedClasses[0];

          setSelectedClass(onlyClass.id);

          if (onlyClass.academic_year_id) {
            setSelectedAcademicYear(
              onlyClass.academic_year_id
            );
          }

          setSelectedProgramme(
            onlyClass.programme_id ?? ''
          );

          setSelectedForm(
            getFormFromLevel(onlyClass.level)
          );
        } else if (loadedClasses.length > 1) {
          const matchingYear =
            loadedAcademicYears.find((year) =>
              loadedClasses.some(
                (classItem) =>
                  classItem.academic_year_id ===
                  year.id
              )
            );

          if (matchingYear) {
            setSelectedAcademicYear(
              matchingYear.id
            );
          }
        }
      }

      setAcademicYears(loadedAcademicYears);
      setProgrammes(loadedProgrammes);
      setSubjects(loadedSubjects);
      setClasses(loadedClasses);

      if (
        !selectedAcademicYear &&
        userRole !== 'teacher' &&
        loadedAcademicYears.length > 0
      ) {
        setSelectedAcademicYear(
          loadedAcademicYears[0].id
        );
      }

      setLoading(false);
    }

    loadAcademicData();
  }, [schoolId, userId, userRole]);

  /*
   * ---------------------------------------------------------
   * LOAD SEMESTERS
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

      const {
        data,
        error: semestersError,
      } = await supabase
        .from('terms')
        .select('id, name, academic_year_id')
        .eq(
          'academic_year_id',
          selectedAcademicYear
        )
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
   * AVAILABLE FORMS
   * ---------------------------------------------------------
   */
  const availableForms = useMemo(() => {
    const forms = classes
      .filter((item) => {
        const matchesYear =
          !selectedAcademicYear ||
          !item.academic_year_id ||
          item.academic_year_id === selectedAcademicYear;

        const matchesProgramme =
          !selectedProgramme ||
          item.programme_id === selectedProgramme;

        return matchesYear && matchesProgramme;
      })
      .map((item) => getFormFromLevel(item.level))
      .filter(Boolean);

    return Array.from(new Set(forms)).sort((a, b) => {
      const order = ['Form 1', 'Form 2', 'Form 3'];

      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      return a.localeCompare(b);
    });
  }, [
    classes,
    selectedAcademicYear,
    selectedProgramme,
  ]);

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

      const matchesAcademicYear =
        !selectedAcademicYear ||
        !item.academic_year_id ||
        item.academic_year_id === selectedAcademicYear;

      const matchesForm =
        !selectedForm ||
        getFormFromLevel(item.level) === selectedForm;

      return (
        matchesProgramme &&
        matchesAcademicYear &&
        matchesForm
      );
    });
  }, [
    classes,
    selectedProgramme,
    selectedAcademicYear,
    selectedForm,
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
   * AUTO SELECT ONE CLASS
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (
      filteredClasses.length === 1 &&
      selectedClass !== filteredClasses[0].id
    ) {
      setSelectedClass(
        filteredClasses[0].id
      );
    }
  }, [filteredClasses, selectedClass]);

  /*
   * ---------------------------------------------------------
   * LOAD STUDENTS
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (
      !selectedClass ||
      !selectedAcademicYear
    ) {
      setStudents([]);
      setScores({});
      setExistingAssessments([]);
      return;
    }

    async function loadStudents() {
      setLoadingStudents(true);
      setError('');

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
        setLoadingStudents(false);
        return;
      }

      const studentIds =
        enrollmentData?.map(
          (item) => item.student_id
        ) ?? [];

      if (studentIds.length === 0) {
        setStudents([]);
        setScores({});
        setExistingAssessments([]);
        setLoadingStudents(false);
        return;
      }

      /*
       * NOTE:
       * We intentionally do not filter students by
       * students.status because that column has not
       * been confirmed as part of the students schema.
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

      const {
        data,
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
        .eq('subject', selectedSubject)
        .eq(
          'assessment_type',
          selectedAssessmentType
        )
        .eq('term', selectedSemester)
        .in(
          'student_id',
          students.map(
            (student) => student.id
          )
        );

      if (assessmentError) {
        setError(assessmentError.message);
        return;
      }

      const records =
        (data ?? []) as AssessmentRecord[];

      setExistingAssessments(records);

      const scoreMap: Record<
        string,
        string
      > = {};

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
   * CURRENT ASSESSMENT
   * ---------------------------------------------------------
   */
  const currentAssessment = useMemo(() => {
    if (
      selectedAssessmentType ===
      EXAM_TYPE.value
    ) {
      return EXAM_TYPE;
    }

    return (
      CA_TYPES.find(
        (item) =>
          item.value ===
          selectedAssessmentType
      ) ?? null
    );
  }, [selectedAssessmentType]);

  const maxScore =
    currentAssessment?.max ?? 0;

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
   * SAVE SCORES
   * ---------------------------------------------------------
   */
  async function saveScores() {
    if (!schoolId) {
      setError(
        'School information could not be found.'
      );
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
      setError(
        'Please select an assessment type.'
      );
      return;
    }

    if (students.length === 0) {
      setError(
        'There are no students in this class.'
      );
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      for (const student of students) {
        const rawValue =
          scores[student.id];

        if (
          rawValue === undefined ||
          rawValue === ''
        ) {
          continue;
        }

        const numericScore =
          Number(rawValue);

        if (
          Number.isNaN(numericScore) ||
          numericScore < 0 ||
          numericScore >
            currentAssessment.max
        ) {
          throw new Error(
            `Invalid score for ${student.full_name}.`
          );
        }

        const existing =
          existingAssessments.find(
            (record) =>
              record.student_id ===
              student.id
          );

        if (existing) {
          const {
            error: updateError,
          } = await supabase
            .from('assessments')
            .update({
              score: numericScore,
              max_score:
                currentAssessment.max,
            })
            .eq('id', existing.id)
            .eq(
              'school_id',
              schoolId
            );

          if (updateError) {
            throw updateError;
          }
        } else {
          const {
            error: insertError,
          } = await supabase
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

      const {
        data,
        error: reloadError,
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
        .eq('subject', selectedSubject)
        .eq(
          'assessment_type',
          selectedAssessmentType
        )
        .eq('term', selectedSemester)
        .in(
          'student_id',
          students.map(
            (student) => student.id
          )
        );

      if (!reloadError) {
        setExistingAssessments(
          (data ??
            []) as AssessmentRecord[]
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
    if (
      !maxScore ||
      students.length === 0
    ) {
      return;
    }

    const adjustedValue = Math.min(
      value,
      maxScore
    );

    const newScores: Record<
      string,
      string
    > = {};

    students.forEach((student) => {
      newScores[student.id] =
        String(adjustedValue);
    });

    setScores(newScores);
  }

  /*
   * ---------------------------------------------------------
   * CLEAR
   * ---------------------------------------------------------
   */
  function clearScores() {
    setScores({});
  }

  /*
   * ---------------------------------------------------------
   * PERFORMANCE DATA
   * ---------------------------------------------------------
   */
  const performanceRows = useMemo(() => {
    if (!maxScore) return [];

    return students
      .map((student) => {
        const rawValue =
          scores[student.id];

        if (
          rawValue === undefined ||
          rawValue === ''
        ) {
          return null;
        }

        const score = Number(rawValue);

        if (Number.isNaN(score)) {
          return null;
        }

        const percentage =
          getPercentage(
            score,
            maxScore
          );

        return {
          student,
          score,
          percentage,
          grade: getGrade(percentage),
          status: getStatus(percentage),
        };
      })
      .filter(
        (
          item
        ): item is PerformanceRow =>
          item !== null
      );
  }, [
    students,
    scores,
    maxScore,
  ]);

  /*
   * ---------------------------------------------------------
   * STATISTICS
   * ---------------------------------------------------------
   */
  const statistics = useMemo(() => {
    const enteredScores =
      performanceRows.map(
        (item) => item.score
      );

    if (
      enteredScores.length === 0 ||
      !maxScore
    ) {
      return {
        entered: 0,
        completionRate: 0,
        average: 0,
        highest: 0,
        lowest: 0,
        passRate: 0,
        passCount: 0,
        failCount: 0,
      };
    }

    const percentages =
      performanceRows.map(
        (item) => item.percentage
      );

    const average =
      percentages.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / percentages.length;

    const highest = Math.max(
      ...percentages
    );

    const lowest = Math.min(
      ...percentages
    );

    const passCount =
      percentages.filter(
        (percentage) =>
          percentage >= 50
      ).length;

    const failCount =
      percentages.length -
      passCount;

    return {
      entered: enteredScores.length,
      completionRate:
        students.length > 0
          ? (enteredScores.length /
              students.length) *
            100
          : 0,
      average,
      highest,
      lowest,
      passRate:
        (passCount /
          percentages.length) *
        100,
      passCount,
      failCount,
    };
  }, [
    performanceRows,
    students.length,
    maxScore,
  ]);

  /*
   * ---------------------------------------------------------
   * GRADE DISTRIBUTION
   * ---------------------------------------------------------
   */
  const gradeDistribution = useMemo(() => {
    const grades = [
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
    ];

    return grades.map((grade) => ({
      grade,
      count:
        performanceRows.filter(
          (item) =>
            item.grade === grade
        ).length,
    }));
  }, [performanceRows]);

  /*
   * ---------------------------------------------------------
   * TOP STUDENTS
   * ---------------------------------------------------------
   */
  const topStudents = useMemo(() => {
    return [...performanceRows]
      .sort(
        (a, b) =>
          b.percentage -
          a.percentage
      )
      .slice(0, 5);
  }, [performanceRows]);

  /*
   * ---------------------------------------------------------
   * FILTERED STUDENTS
   * ---------------------------------------------------------
   */
  const visibleStudents = useMemo(() => {
    const query =
      studentSearch.trim().toLowerCase();

    if (!query) return students;

    return students.filter(
      (student) =>
        student.full_name
          .toLowerCase()
          .includes(query) ||
        student.admission_number
          .toLowerCase()
          .includes(query)
    );
  }, [
    students,
    studentSearch,
  ]);

  /*
   * ---------------------------------------------------------
   * CA SUMMARY
   * ---------------------------------------------------------
   */
  const caSummary = useMemo(() => {
    return students.map((student) => {
      const studentAssessments =
        existingAssessments.filter(
          (record) =>
            record.student_id ===
            student.id
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
          rawTotal += Number(
            record.score
          );
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
  }, [
    students,
    existingAssessments,
  ]);

  /*
   * ---------------------------------------------------------
   * EXPORT EXCEL
   * ---------------------------------------------------------
   */
  function exportExcel() {
    if (!students.length) {
      setError(
        'There are no students to export.'
      );
      return;
    }

    const selectedClassName =
      classes.find(
        (item) =>
          item.id === selectedClass
      )?.name ?? '';

    const selectedProgrammeName =
      programmes.find(
        (item) =>
          item.id === selectedProgramme
      )?.name ?? '';

    const academicYearName =
      academicYears.find(
        (item) =>
          item.id === selectedAcademicYear
      )?.name ?? '';

    const rows = students.map(
      (student, index) => {
        const rawScore =
          scores[student.id] ?? '';

        const numericScore =
          rawScore === ''
            ? ''
            : Number(rawScore);

        const percentage =
          rawScore === ''
            ? ''
            : getPercentage(
                Number(rawScore),
                maxScore
              );

        const grade =
          rawScore === ''
            ? ''
            : getGrade(
                Number(percentage)
              );

        const status =
          rawScore === ''
            ? ''
            : getStatus(
                Number(percentage)
              );

        return {
          No: index + 1,
          'Student Name':
            student.full_name,
          'Admission Number':
            student.admission_number,
          Programme:
            selectedProgrammeName,
          Form: selectedForm,
          Class: selectedClassName,
          'Academic Year':
            academicYearName,
          Semester:
            selectedSemester,
          Subject:
            selectedSubject,
          'Assessment Type':
            selectedAssessmentType,
          'Score':
            numericScore,
          'Maximum Score':
            maxScore,
          Percentage:
            percentage === ''
              ? ''
              : Number(
                  Number(percentage).toFixed(
                    1
                  )
                ),
          Grade: grade,
          Status: status,
        };
      }
    );

    const summaryRows = [
      {
        Metric: 'Students',
        Value: students.length,
      },
      {
        Metric: 'Scores Entered',
        Value: statistics.entered,
      },
      {
        Metric: 'Completion Rate',
        Value: `${statistics.completionRate.toFixed(
          1
        )}%`,
      },
      {
        Metric: 'Average',
        Value: `${statistics.average.toFixed(
          1
        )}%`,
      },
      {
        Metric: 'Highest',
        Value: `${statistics.highest.toFixed(
          1
        )}%`,
      },
      {
        Metric: 'Lowest',
        Value: `${statistics.lowest.toFixed(
          1
        )}%`,
      },
      {
        Metric: 'Pass Rate',
        Value: `${statistics.passRate.toFixed(
          1
        )}%`,
      },
      {
        Metric: 'Passed',
        Value: statistics.passCount,
      },
      {
        Metric: 'Failed',
        Value: statistics.failCount,
      },
    ];

    const workbook =
      XLSX.utils.book_new();

    const scoreSheet =
      XLSX.utils.json_to_sheet(rows);

    const summarySheet =
      XLSX.utils.json_to_sheet(
        summaryRows
      );

    XLSX.utils.book_append_sheet(
      workbook,
      scoreSheet,
      'Assessment Scores'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      summarySheet,
      'Statistics'
    );

    const safeClassName =
      selectedClassName
        .replace(
          /[^a-z0-9]+/gi,
          '-'
        )
        .replace(
          /^-+|-+$/g,
          ''
        ) || 'class';

    const safeAssessment =
      selectedAssessmentType
        .replace(
          /[^a-z0-9]+/gi,
          '-'
        )
        .replace(
          /^-+|-+$/g,
          ''
        ) || 'assessment';

    XLSX.writeFile(
      workbook,
      `BTI-Assessment-${safeClassName}-${safeAssessment}.xlsx`
    );
  }

  /*
   * ---------------------------------------------------------
   * SELECTED NAMES
   * ---------------------------------------------------------
   */
  const selectedClassName =
    classes.find(
      (item) =>
        item.id === selectedClass
    )?.name ?? '';

  const selectedAcademicYearName =
    academicYears.find(
      (item) =>
        item.id === selectedAcademicYear
    )?.name ?? '';

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */
  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* =====================================================
            PREMIUM HEADER
        ===================================================== */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-xl sm:p-7">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-400/20 blur-2xl" />
          <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-cyan-400/10 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
                  <i className="fa-solid fa-chart-line animate-pulse" />
                  BTI-SMS
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                  <i className="fa-solid fa-circle-check" />
                  Assessment Portal
                </span>

                {userRole === 'teacher' && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-100">
                    <i className="fa-solid fa-user-tie" />
                    Teacher
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                Assessment Management
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                Enter, review and analyse student
                continuous assessment and examination
                performance using the BTI marking
                structure.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportExcel}
                disabled={students.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="fa-solid fa-file-excel text-emerald-600" />
                Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* =====================================================
            MARKING STRUCTURE
        ===================================================== */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
              <i className="fa-solid fa-calculator" />
            </div>

            <div>
              <h2 className="font-bold text-blue-950">
                BTI Marking Structure
              </h2>
              <p className="text-xs text-blue-700">
                Official continuous assessment and examination formula
              </p>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
              <i className="fa-solid fa-pen-to-square mb-2 text-blue-600" />
              <p className="text-xs font-medium text-slate-500">
                Exercises
              </p>
              <p className="mt-1 font-bold text-slate-900">
                4 × 10 = 40
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
              <i className="fa-solid fa-file-pen mb-2 text-indigo-600" />
              <p className="text-xs font-medium text-slate-500">
                Class Tests
              </p>
              <p className="mt-1 font-bold text-slate-900">
                3 × 20 = 60
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
              <i className="fa-solid fa-percent mb-2 text-emerald-600" />
              <p className="text-xs font-medium text-slate-500">
                Continuous Assessment
              </p>
              <p className="mt-1 font-bold text-slate-900">
                100 → 30%
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
              <i className="fa-solid fa-graduation-cap mb-2 text-purple-600" />
              <p className="text-xs font-medium text-slate-500">
                Examination
              </p>
              <p className="mt-1 font-bold text-slate-900">
                100 → 70%
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================
            ERROR / SUCCESS
        ===================================================== */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            <i className="fa-solid fa-circle-exclamation mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">
            <i className="fa-solid fa-circle-check mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {/* =====================================================
            FILTER / SELECTION PANEL
        ===================================================== */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <i className="fa-solid fa-sliders" />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">
                Assessment Setup
              </h2>
              <p className="text-xs text-slate-500">
                Select the academic context before entering scores.
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">

            {/* ACADEMIC YEAR */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Academic Year
              </label>

              <div className="relative">
                <i className="fa-solid fa-calendar-days pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />

                <select
                  value={selectedAcademicYear}
                  onChange={(event) => {
                    setSelectedAcademicYear(
                      event.target.value
                    );
                    setSelectedSemester('');
                    setSelectedClass('');
                    setSelectedForm('');
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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

                <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
              </div>
            </div>

            {/* SEMESTER */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Semester
              </label>

              <div className="relative">
                <i className="fa-solid fa-calendar-week pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500" />

                <select
                  value={selectedSemester}
                  onChange={(event) =>
                    setSelectedSemester(
                      event.target.value
                    )
                  }
                  disabled={
                    !selectedAcademicYear
                  }
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  <option value="">
                    Select Semester
                  </option>

                  {semesters.map(
                    (semester) => (
                      <option
                        key={semester.id}
                        value={semester.name}
                      >
                        {semester.name}
                      </option>
                    )
                  )}
                </select>

                <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
              </div>
            </div>

            {/* PROGRAMME */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Programme
              </label>

              <div className="relative">
                <i className="fa-solid fa-book-open pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />

                <select
                  value={selectedProgramme}
                  onChange={(event) => {
                    setSelectedProgramme(
                      event.target.value
                    );
                    setSelectedForm('');
                    setSelectedClass('');
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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

                <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
              </div>
            </div>

            {/* FORM */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Form
              </label>

              <div className="relative">
                <i className="fa-solid fa-layer-group pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-purple-500" />

                <select
                  value={selectedForm}
                  onChange={(event) => {
                    setSelectedForm(
                      event.target.value
                    );
                    setSelectedClass('');
                  }}
                  disabled={
                    !selectedAcademicYear
                  }
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  <option value="">
                    All Forms
                  </option>

                  {availableForms.map(
                    (form) => (
                      <option
                        key={form}
                        value={form}
                      >
                        {form}
                      </option>
                    )
                  )}
                </select>

                <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
              </div>
            </div>

            {/* CLASS */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Class
              </label>

              <div className="relative">
                <i className="fa-solid fa-users pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-orange-500" />

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
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
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

                <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
              </div>

              {userRole === 'teacher' &&
                filteredClasses.length ===
                  1 && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-blue-600">
                    <i className="fa-solid fa-wand-magic-sparkles" />
                    Assigned class selected automatically.
                  </p>
                )}
            </div>

            {/* SUBJECT */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Subject
              </label>

              <div className="relative">
                <i className="fa-solid fa-book pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500" />

                <select
                  value={selectedSubject}
                  onChange={(event) =>
                    setSelectedSubject(
                      event.target.value
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">
                    Select Subject
                  </option>

                  {subjects.map(
                    (subject) => (
                      <option
                        key={subject.id}
                        value={subject.name}
                      >
                        {subject.name}
                        {subject.code
                          ? ` (${subject.code})`
                          : ''}
                      </option>
                    )
                  )}
                </select>

                <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
              </div>
            </div>

            {/* ASSESSMENT */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Assessment Type
              </label>

              <div className="relative">
                <i className="fa-solid fa-file-signature pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rose-500" />

                <select
                  value={
                    selectedAssessmentType
                  }
                  onChange={(event) =>
                    setSelectedAssessmentType(
                      event.target.value
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">
                    Select Assessment
                  </option>

                  <optgroup label="Continuous Assessment">
                    {CA_TYPES.map(
                      (type) => (
                        <option
                          key={type.value}
                          value={type.value}
                        >
                          {type.label} — /{type.max}
                        </option>
                      )
                    )}
                  </optgroup>

                  <optgroup label="Examination">
                    <option
                      value={
                        EXAM_TYPE.value
                      }
                    >
                      {EXAM_TYPE.label} — /100
                    </option>
                  </optgroup>
                </select>

                <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            ACTIVE CONTEXT
        ===================================================== */}
        {selectedClass && (
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
            <i className="fa-solid fa-location-dot text-blue-600" />

            <span className="font-semibold">
              {selectedAcademicYearName}
            </span>

            {selectedSemester && (
              <>
                <i className="fa-solid fa-chevron-right text-[9px] text-blue-400" />
                <span>{selectedSemester}</span>
              </>
            )}

            {selectedProgramme && (
              <>
                <i className="fa-solid fa-chevron-right text-[9px] text-blue-400" />
                <span>
                  {
                    programmes.find(
                      (item) =>
                        item.id ===
                        selectedProgramme
                    )?.name
                  }
                </span>
              </>
            )}

            {selectedForm && (
              <>
                <i className="fa-solid fa-chevron-right text-[9px] text-blue-400" />
                <span>{selectedForm}</span>
              </>
            )}

            <i className="fa-solid fa-chevron-right text-[9px] text-blue-400" />

            <span className="font-bold">
              {selectedClassName}
            </span>
          </div>
        )}

        {/* =====================================================
            STATISTICS
        ===================================================== */}
        {students.length > 0 &&
          selectedAssessmentType && (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">

                {/* STUDENTS */}
                <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition group-hover:scale-110">
                      <i className="fa-solid fa-users" />
                    </div>
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Students
                  </p>

                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {students.length}
                  </p>
                </div>

                {/* ENTERED */}
                <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition group-hover:scale-110">
                      <i className="fa-solid fa-check-double" />
                    </div>
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Scores Entered
                  </p>

                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {statistics.entered}
                  </p>
                </div>

                {/* COMPLETION */}
                <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600 transition group-hover:scale-110">
                      <i className="fa-solid fa-bars-progress" />
                    </div>
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Completion
                  </p>

                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {statistics.completionRate.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>

                {/* AVERAGE */}
                <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 transition group-hover:scale-110">
                      <i className="fa-solid fa-chart-line" />
                    </div>
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Average
                  </p>

                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {statistics.average.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>

                {/* HIGHEST */}
                <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 transition group-hover:scale-110">
                      <i className="fa-solid fa-arrow-up" />
                    </div>
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Highest
                  </p>

                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {statistics.highest.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>

                {/* LOWEST */}
                <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 transition group-hover:scale-110">
                      <i className="fa-solid fa-arrow-down" />
                    </div>
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Lowest
                  </p>

                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {statistics.lowest.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>

                {/* PASS RATE */}
                <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition group-hover:scale-110">
                      <i className="fa-solid fa-trophy" />
                    </div>
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Pass Rate
                  </p>

                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {statistics.passRate.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>
              </div>

              {/* PROGRESS */}
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Score Entry Completion
                  </span>

                  <span className="text-sm font-black text-blue-700">
                    {statistics.entered}/
                    {students.length}
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-700"
                    style={{
                      width: `${Math.min(
                        100,
                        statistics.completionRate
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </>
          )}

        {/* =====================================================
            ANALYTICS
        ===================================================== */}
        {students.length > 0 &&
          selectedAssessmentType && (
            <div className="mt-6 grid gap-6 lg:grid-cols-3">

              {/* GRADE DISTRIBUTION */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <i className="fa-solid fa-chart-column" />
                  </div>

                  <div>
                    <h2 className="font-bold text-slate-900">
                      Grade Distribution
                    </h2>
                    <p className="text-xs text-slate-500">
                      Current assessment performance
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {gradeDistribution.map(
                    (item) => {
                      const percentage =
                        statistics.entered > 0
                          ? (item.count /
                              statistics.entered) *
                            100
                          : 0;

                      return (
                        <div
                          key={item.grade}
                        >
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg font-black ${gradeClass(
                                item.grade
                              )}`}
                            >
                              {item.grade}
                            </span>

                            <span className="font-bold text-slate-600">
                              {item.count}
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all duration-700"
                              style={{
                                width: `${percentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* PASS / FAIL */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <i className="fa-solid fa-chart-pie" />
                  </div>

                  <div>
                    <h2 className="font-bold text-slate-900">
                      Class Performance
                    </h2>
                    <p className="text-xs text-slate-500">
                      Pass and fail overview
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div
                    className="relative flex h-40 w-40 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(#10b981 ${
                        statistics.passRate
                      }%, #ef4444 ${
                        statistics.passRate
                      }% 100%)`,
                    }}
                  >
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                      <span className="text-2xl font-black text-slate-900">
                        {statistics.passRate.toFixed(
                          0
                        )}
                        %
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Pass Rate
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 p-3 text-center">
                    <p className="text-xs text-emerald-600">
                      Passed
                    </p>
                    <p className="mt-1 text-xl font-black text-emerald-700">
                      {statistics.passCount}
                    </p>
                  </div>

                  <div className="rounded-xl bg-red-50 p-3 text-center">
                    <p className="text-xs text-red-600">
                      Failed
                    </p>
                    <p className="mt-1 text-xl font-black text-red-700">
                      {statistics.failCount}
                    </p>
                  </div>
                </div>
              </div>

              {/* TOP STUDENTS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <i className="fa-solid fa-ranking-star" />
                  </div>

                  <div>
                    <h2 className="font-bold text-slate-900">
                      Top Performers
                    </h2>
                    <p className="text-xs text-slate-500">
                      Highest current scores
                    </p>
                  </div>
                </div>

                {topStudents.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    No scores entered yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topStudents.map(
                      (item, index) => (
                        <div
                          key={
                            item.student.id
                          }
                          className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 transition hover:bg-blue-50"
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-black ${
                              index === 0
                                ? 'bg-amber-100 text-amber-700'
                                : index === 1
                                ? 'bg-slate-200 text-slate-700'
                                : index === 2
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {
                                item.student
                                  .full_name
                              }
                            </p>

                            <p className="text-[10px] text-slate-400">
                              {
                                item.student
                                  .admission_number
                              }
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="font-black text-blue-700">
                              {item.percentage.toFixed(
                                1
                              )}
                              %
                            </p>

                            <span
                              className={`text-[10px] font-black ${
                                gradeClass(
                                  item.grade
                                )
                                  .replace(
                                    'bg-',
                                    'text-'
                                  )
                              }`}
                            >
                              Grade {item.grade}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* =====================================================
            SCORE SHEET
        ===================================================== */}
        {selectedAssessmentType &&
          selectedSubject &&
          selectedClass &&
          selectedSemester &&
          selectedAcademicYear && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              {/* SCORE HEADER */}
              <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 p-4 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                        <i className="fa-solid fa-clipboard-check" />
                        Score Sheet
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                        <i className="fa-solid fa-star text-amber-500" />
                        Max {maxScore}
                      </span>
                    </div>

                    <h2 className="mt-3 text-xl font-black text-slate-900">
                      {selectedSubject}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedAssessmentType} •{' '}
                      {selectedClassName} •{' '}
                      {selectedSemester}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[0, 5, 10, 15, 20, 25, 30]
                      .filter(
                        (value) =>
                          value <= maxScore
                      )
                      .map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            quickFill(value)
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          Fill {value}
                        </button>
                      ))}

                    <button
                      type="button"
                      onClick={clearScores}
                      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 transition hover:-translate-y-0.5 hover:bg-red-50"
                    >
                      <i className="fa-solid fa-eraser mr-1" />
                      Clear
                    </button>
                  </div>
                </div>

                {/* SEARCH */}
                <div className="mt-5 max-w-md">
                  <div className="relative">
                    <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(event) =>
                        setStudentSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search student name or admission number..."
                      className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </div>

              {/* TABLE */}
              {loadingStudents ? (
                <div className="p-10 text-center">
                  <i className="fa-solid fa-spinner fa-spin text-2xl text-blue-600" />
                  <p className="mt-3 text-sm text-slate-500">
                    Loading class students...
                  </p>
                </div>
              ) : students.length === 0 ? (
                <div className="p-10 text-center">
                  <i className="fa-solid fa-users-slash text-3xl text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-600">
                    No active students are enrolled
                    in this class for the selected
                    academic year.
                  </p>
                </div>
              ) : visibleStudents.length === 0 ? (
                <div className="p-10 text-center">
                  <i className="fa-solid fa-magnifying-glass text-3xl text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">
                    No student matches your search.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold">
                          #
                        </th>

                        <th className="px-4 py-3 text-left font-bold">
                          Student
                        </th>

                        <th className="px-4 py-3 text-left font-bold">
                          Admission No.
                        </th>

                        <th className="px-4 py-3 text-center font-bold">
                          Score /{maxScore}
                        </th>

                        <th className="px-4 py-3 text-center font-bold">
                          %
                        </th>

                        <th className="px-4 py-3 text-center font-bold">
                          Grade
                        </th>

                        <th className="px-4 py-3 text-center font-bold">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {visibleStudents.map(
                        (
                          student,
                          index
                        ) => {
                          const rawScore =
                            scores[
                              student.id
                            ] ?? '';

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
                              (
                                record
                              ) =>
                                record.student_id ===
                                student.id
                            );

                          return (
                            <tr
                              key={
                                student.id
                              }
                              className="transition hover:bg-blue-50/50"
                            >
                              <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-400">
                                {index + 1}
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">
                                    {student.full_name
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>

                                  <span className="whitespace-nowrap font-bold text-slate-900">
                                    {
                                      student.full_name
                                    }
                                  </span>
                                </div>
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                                {
                                  student.admission_number
                                }
                              </td>

                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={maxScore}
                                  step="0.01"
                                  value={
                                    rawScore
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleScoreChange(
                                      student.id,
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  className="w-24 rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-center font-bold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-center font-bold text-slate-700">
                                {rawScore === ''
                                  ? '-'
                                  : `${percentage.toFixed(
                                      1
                                    )}%`}
                              </td>

                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${gradeClass(
                                    grade
                                  )}`}
                                >
                                  {grade}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-center">
                                {status === '-' ? (
                                  <span className="text-slate-300">
                                    —
                                  </span>
                                ) : (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                                      status === 'Pass'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    <i
                                      className={`fa-solid ${
                                        status ===
                                        'Pass'
                                          ? 'fa-check'
                                          : 'fa-xmark'
                                      }`}
                                    />
                                    {status}
                                  </span>
                                )}

                                {existing && (
                                  <div className="mt-1 text-[10px] font-semibold text-emerald-500">
                                    <i className="fa-solid fa-cloud-check mr-1" />
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

              {/* SAVE FOOTER */}
              {students.length > 0 && (
                <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      Entered scores are automatically
                      limited to /{maxScore}.
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {statistics.entered} of{' '}
                      {students.length} student scores
                      currently entered.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={saveScores}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin" />
                        Saving Scores...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-floppy-disk" />
                        Save All Scores
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

        {/* =====================================================
            RESULTS CALCULATION PREVIEW
        ===================================================== */}
        {students.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-gradient-to-r from-white to-indigo-50 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <i className="fa-solid fa-square-poll-vertical" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Results Calculation Preview
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Official 30% CA + 70% Examination
                    calculation.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-700">
                      Student
                    </th>

                    <th className="px-4 py-3 text-center font-bold text-slate-700">
                      CA Raw /100
                    </th>

                    <th className="px-4 py-3 text-center font-bold text-slate-700">
                      CA /30
                    </th>

                    <th className="px-4 py-3 text-center font-bold text-slate-700">
                      Exam /100
                    </th>

                    <th className="px-4 py-3 text-center font-bold text-slate-700">
                      Exam /70
                    </th>

                    <th className="px-4 py-3 text-center font-bold text-slate-700">
                      Final /100
                    </th>

                    <th className="px-4 py-3 text-center font-bold text-slate-700">
                      Grade
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {caSummary.map(
                    (item) => {
                      const student =
                        students.find(
                          (
                            studentItem
                          ) =>
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
                          key={
                            item.studentId
                          }
                          className="transition hover:bg-indigo-50/40"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">
                            {
                              student?.full_name
                            }
                          </td>

                          <td className="px-4 py-3 text-center">
                            {item.rawTotal.toFixed(
                              1
                            )}
                          </td>

                          <td className="px-4 py-3 text-center font-semibold text-blue-700">
                            {item.caContribution.toFixed(
                              1
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {item.examRaw.toFixed(
                              1
                            )}
                          </td>

                          <td className="px-4 py-3 text-center font-semibold text-indigo-700">
                            {item.examContribution.toFixed(
                              1
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span className="rounded-lg bg-slate-900 px-3 py-1.5 font-black text-white">
                              {item.finalScore.toFixed(
                                1
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${gradeClass(
                                grade
                              )}`}
                            >
                              {grade}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================
            FORMULA
        ===================================================== */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <i className="fa-solid fa-square-root-variable" />
              </div>

              <div>
                <h2 className="font-black text-slate-900">
                  BTI Result Formula
                </h2>

                <p className="text-xs text-slate-500">
                  How the final student result is calculated.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                CA Raw
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-700">
                Exercise 1 + Exercise 2 +
                Exercise 3 + Exercise 4 +
                Class Test 1 + Class Test 2 +
                Class Test 3
              </p>

              <p className="mt-2 font-black text-blue-700">
                /100
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                CA Contribution
              </p>

              <p className="mt-2 text-sm font-semibold text-blue-900">
                (CA Raw ÷ 100) × 30
              </p>

              <p className="mt-2 font-black text-blue-700">
                /30
              </p>
            </div>

            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">
                Exam Contribution
              </p>

              <p className="mt-2 text-sm font-semibold text-indigo-900">
                (Exam Raw ÷ 100) × 70
              </p>

              <p className="mt-2 font-black text-indigo-700">
                /70
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-500">
                Final Score
              </p>

              <p className="mt-2 text-sm font-semibold text-emerald-900">
                CA Contribution + Exam Contribution
              </p>

              <p className="mt-2 font-black text-emerald-700">
                /100
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================
            LOADING
        ===================================================== */}
        {loading && (
          <div className="mt-6 flex items-center justify-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-700">
            <i className="fa-solid fa-spinner fa-spin" />
            Loading academic information...
          </div>
        )}

        {/* FOOTER */}
        <div className="py-8 text-center text-xs text-slate-400">
          <i className="fa-solid fa-shield-halved mr-1" />
          BTI-SMS Assessment Management
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

type AcademicYear = {
  id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
};

type Programme = {
  id: string;
  name: string;
  code?: string | null;
};

type ClassItem = {
  id: string;
  name: string;
  level?: string | null;
  programme_id?: string | null;
  academic_year_id?: string | null;
};

type Student = {
  id: string;
  full_name: string;
  admission_number?: string | null;
};

type AssessmentRecord = {
  id: string;
  school_id?: string | null;
  student_id: string;
  subject: string;
  assessment_type: string;
  score: number | null;
  max_score: number | null;
  term: string;
  recorded_by?: string | null;
  academic_year_id?: string | null;
  term_id?: string | null;
  subject_id?: string | null;
  class_id?: string | null;
  submitted_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type AssessmentRow = {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  subject: string;
  assessment_type: string;
  score: number;
  max_score: number;
  percentage: number;
  term: string;
  programme: string;
  form: string;
  class_name: string;
  teacher_name: string;
  recorded_by: string;
  created_at: string;
};

type TeacherInfo = {
  id: string;
  name: string;
};

const supabase = createClient();

const getFormFromLevel = (level?: string | null) => {
  const value = String(level ?? '').trim().toLowerCase();

  if (
    value.includes('form 1') ||
    value.includes('form1') ||
    value === '1'
  ) {
    return 'Form 1';
  }

  if (
    value.includes('form 2') ||
    value.includes('form2') ||
    value === '2'
  ) {
    return 'Form 2';
  }

  if (
    value.includes('form 3') ||
    value.includes('form3') ||
    value === '3'
  ) {
    return 'Form 3';
  }

  return level || 'Unknown';
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getPercentage = (
  score: number | null | undefined,
  maxScore: number | null | undefined
) => {
  if (
    score === null ||
    score === undefined ||
    maxScore === null ||
    maxScore === undefined ||
    Number(maxScore) <= 0
  ) {
    return 0;
  }

  return Math.round((Number(score) / Number(maxScore)) * 100);
};

const getGrade = (percentage: number) => {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
};

const getStatus = (percentage: number) => {
  return percentage >= 50 ? 'Pass' : 'Fail';
};

const getUserDisplayName = (user: any) => {
  if (!user) return 'Unknown Teacher';

  return (
    user.full_name ||
    user.name ||
    user.display_name ||
    user.username ||
    user.email ||
    'Unknown Teacher'
  );
};

export default function AssessmentReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState('');
  const [schoolId, setSchoolId] = useState('');

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);

  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedProgramme, setSelectedProgramme] = useState('');
  const [selectedForm, setSelectedForm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');

  const [search, setSearch] = useState('');

  const [reportRows, setReportRows] = useState<AssessmentRow[]>([]);

  /*
   * ---------------------------------------------------------
   * LOAD INITIAL DATA
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError('');

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          throw new Error('You are not logged in.');
        }

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!profile?.school_id) {
          throw new Error('Your account is not linked to a school.');
        }

        const currentSchoolId = profile.school_id as string;

        setSchoolId(currentSchoolId);

        const [
          academicYearResult,
          programmeResult,
          classResult,
          studentResult,
          assessmentResult,
          teacherResult,
        ] = await Promise.all([
          supabase
            .from('academic_years')
            .select('*')
            .eq('school_id', currentSchoolId)
            .order('start_date', { ascending: false }),

          supabase
            .from('programmes')
            .select('*')
            .eq('school_id', currentSchoolId)
            .order('name'),

          supabase
            .from('classes')
            .select('*')
            .eq('school_id', currentSchoolId)
            .order('name'),

          supabase
            .from('students')
            .select('id, full_name, admission_number')
            .eq('school_id', currentSchoolId)
            .order('full_name'),

          supabase
            .from('assessments')
            .select(
              `
              id,
              school_id,
              student_id,
              subject,
              assessment_type,
              score,
              max_score,
              term,
              recorded_by,
              academic_year_id,
              term_id,
              subject_id,
              class_id,
              submitted_at,
              updated_at,
              created_at
            `
            )
            .eq('school_id', currentSchoolId)
            .order('created_at', { ascending: false }),

          supabase
            .from('users')
            .select('*')
            .eq('school_id', currentSchoolId),
        ]);

        if (academicYearResult.error) {
          throw academicYearResult.error;
        }

        if (programmeResult.error) {
          throw programmeResult.error;
        }

        if (classResult.error) {
          throw classResult.error;
        }

        if (studentResult.error) {
          throw studentResult.error;
        }

        if (assessmentResult.error) {
          throw assessmentResult.error;
        }

        if (teacherResult.error) {
          throw teacherResult.error;
        }

        const years = (academicYearResult.data || []) as AcademicYear[];
        const programmeData = (programmeResult.data || []) as Programme[];
        const classData = (classResult.data || []) as ClassItem[];
        const studentData = (studentResult.data || []) as Student[];
        const assessmentData = (assessmentResult.data ||
          []) as AssessmentRecord[];

        const teacherData: TeacherInfo[] = (teacherResult.data || []).map(
          (item: any) => ({
            id: item.id,
            name: getUserDisplayName(item),
          })
        );

        setAcademicYears(years);
        setProgrammes(programmeData);
        setClasses(classData);
        setStudents(studentData);
        setAssessments(assessmentData);
        setTeachers(teacherData);

        const currentYear =
          years.find((year) => year.is_current) || years[0];

        if (currentYear) {
          setSelectedAcademicYear(currentYear.id);
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Unable to load assessment reports.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  /*
   * ---------------------------------------------------------
   * DERIVED FILTER OPTIONS
   * ---------------------------------------------------------
   */

  const filteredProgrammes = useMemo(() => {
    if (!selectedAcademicYear) return programmes;

    const programmeIds = new Set(
      classes
        .filter(
          (item) => item.academic_year_id === selectedAcademicYear
        )
        .map((item) => item.programme_id)
        .filter(Boolean)
    );

    return programmes.filter((programme) =>
      programmeIds.has(programme.id)
    );
  }, [classes, programmes, selectedAcademicYear]);

  const filteredClasses = useMemo(() => {
    return classes.filter((item) => {
      if (
        selectedAcademicYear &&
        item.academic_year_id !== selectedAcademicYear
      ) {
        return false;
      }

      if (
        selectedProgramme &&
        item.programme_id !== selectedProgramme
      ) {
        return false;
      }

      if (
        selectedForm &&
        getFormFromLevel(item.level) !== selectedForm
      ) {
        return false;
      }

      return true;
    });
  }, [
    classes,
    selectedAcademicYear,
    selectedProgramme,
    selectedForm,
  ]);

  const forms = useMemo(() => {
    const values = filteredClasses
      .map((item) => getFormFromLevel(item.level))
      .filter(
        (value) =>
          value &&
          value !== 'Unknown'
      );

    return Array.from(new Set(values)).sort();
  }, [filteredClasses]);

  const yearAssessments = useMemo(() => {
    return assessments.filter(
      (item) =>
        !selectedAcademicYear ||
        item.academic_year_id === selectedAcademicYear
    );
  }, [assessments, selectedAcademicYear]);

  const terms = useMemo(() => {
    const values = yearAssessments
      .map((item) => item.term)
      .filter(Boolean);

    return Array.from(new Set(values)).sort();
  }, [yearAssessments]);

  const subjects = useMemo(() => {
    const values = yearAssessments
      .filter((item) => !selectedTerm || item.term === selectedTerm)
      .map((item) => item.subject)
      .filter(Boolean);

    return Array.from(new Set(values)).sort();
  }, [yearAssessments, selectedTerm]);

  const assessmentTypes = useMemo(() => {
    const values = yearAssessments
      .filter((item) => !selectedTerm || item.term === selectedTerm)
      .filter((item) => !selectedSubject || item.subject === selectedSubject)
      .map((item) => item.assessment_type)
      .filter(Boolean);

    return Array.from(new Set(values)).sort();
  }, [yearAssessments, selectedTerm, selectedSubject]);

  /*
   * ---------------------------------------------------------
   * BUILD REPORT — CANONICAL ASSESSMENT CONTEXT
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!schoolId) return;

    setReportLoading(true);

    const timer = window.setTimeout(() => {
      try {
        const studentMap = new Map(
          students.map((student) => [student.id, student])
        );

        const classMap = new Map(
          classes.map((item) => [item.id, item])
        );

        const programmeMap = new Map(
          programmes.map((programme) => [programme.id, programme])
        );

        const teacherMap = new Map(
          teachers.map((teacher) => [teacher.id, teacher.name])
        );

        const rows: AssessmentRow[] = assessments
          .filter((assessment) => {
            if (
              selectedAcademicYear &&
              assessment.academic_year_id !== selectedAcademicYear
            ) {
              return false;
            }

            if (selectedTerm && assessment.term !== selectedTerm) {
              return false;
            }

            if (
              selectedSubject &&
              assessment.subject !== selectedSubject
            ) {
              return false;
            }

            if (
              selectedAssessmentType &&
              assessment.assessment_type !== selectedAssessmentType
            ) {
              return false;
            }

            if (
              selectedTeacher &&
              assessment.recorded_by !== selectedTeacher
            ) {
              return false;
            }

            const classItem = assessment.class_id
              ? classMap.get(assessment.class_id)
              : undefined;

            if (!classItem) return false;

            if (
              selectedProgramme &&
              classItem.programme_id !== selectedProgramme
            ) {
              return false;
            }

            if (
              selectedClass &&
              assessment.class_id !== selectedClass
            ) {
              return false;
            }

            if (
              selectedForm &&
              getFormFromLevel(classItem.level) !== selectedForm
            ) {
              return false;
            }

            return true;
          })
          .map((assessment) => {
            const student = studentMap.get(assessment.student_id);

            const classItem = assessment.class_id
              ? classMap.get(assessment.class_id)
              : undefined;

            const programme = classItem?.programme_id
              ? programmeMap.get(classItem.programme_id)
              : undefined;

            const percentage = getPercentage(
              assessment.score,
              assessment.max_score
            );

            const recordedBy = assessment.recorded_by || '';

            return {
              id: assessment.id,
              student_id: assessment.student_id,
              student_name: student?.full_name || 'Unknown Student',
              admission_number: student?.admission_number || '—',
              subject: assessment.subject || '—',
              assessment_type: assessment.assessment_type || '—',
              score: Number(assessment.score || 0),
              max_score: Number(assessment.max_score || 0),
              percentage,
              term: assessment.term || '—',
              programme: programme?.name || '—',
              form: getFormFromLevel(classItem?.level),
              class_name: classItem?.name || '—',
              teacher_name:
                teacherMap.get(recordedBy) ||
                (recordedBy
                  ? `User ${recordedBy.slice(0, 8)}`
                  : 'Not recorded'),
              recorded_by: recordedBy,
              created_at:
                assessment.submitted_at ||
                assessment.updated_at ||
                assessment.created_at ||
                '',
            };
          });

        rows.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });

        setReportRows(rows);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message || 'Unable to prepare assessment report.'
        );
        setReportRows([]);
      } finally {
        setReportLoading(false);
      }
    }, 100);

    return () => window.clearTimeout(timer);
  }, [
    schoolId,
    assessments,
    students,
    classes,
    programmes,
    teachers,
    selectedAcademicYear,
    selectedTerm,
    selectedProgramme,
    selectedForm,
    selectedClass,
    selectedSubject,
    selectedAssessmentType,
    selectedTeacher,
  ]);

  /*
   * ---------------------------------------------------------
   * SEARCH
   * ---------------------------------------------------------
   */

  const searchedRows = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return reportRows;

    return reportRows.filter((row) => {
      return (
        row.student_name.toLowerCase().includes(value) ||
        row.admission_number.toLowerCase().includes(value) ||
        row.subject.toLowerCase().includes(value) ||
        row.class_name.toLowerCase().includes(value)
      );
    });
  }, [reportRows, search]);

  /*
   * ---------------------------------------------------------
   * STATISTICS
   * ---------------------------------------------------------
   */

  const statistics = useMemo(() => {
    const totalRecords = searchedRows.length;

    const uniqueStudents = new Set(
      searchedRows.map((row) => row.student_id)
    ).size;

    const percentages = searchedRows.map(
      (row) => row.percentage
    );

    const average =
      percentages.length > 0
        ? percentages.reduce((sum, value) => sum + value, 0) /
          percentages.length
        : 0;

    const highest =
      percentages.length > 0
        ? Math.max(...percentages)
        : 0;

    const lowest =
      percentages.length > 0
        ? Math.min(...percentages)
        : 0;

    const passed = searchedRows.filter(
      (row) => row.percentage >= 50
    ).length;

    const failed = searchedRows.filter(
      (row) => row.percentage < 50
    ).length;

    const passRate =
      totalRecords > 0
        ? (passed / totalRecords) * 100
        : 0;

    const caRecords = searchedRows.filter(
      (row) =>
        !row.assessment_type
          .toLowerCase()
          .includes('exam')
    ).length;

    const examRecords = searchedRows.filter(
      (row) =>
        row.assessment_type
          .toLowerCase()
          .includes('exam')
    ).length;

    return {
      totalRecords,
      uniqueStudents,
      average,
      highest,
      lowest,
      passed,
      failed,
      passRate,
      caRecords,
      examRecords,
    };
  }, [searchedRows]);

  const gradeDistribution = useMemo(() => {
    const grades = ['A', 'B', 'C', 'D', 'E', 'F'];

    return grades.map((grade) => ({
      grade,
      count: searchedRows.filter(
        (row) => getGrade(row.percentage) === grade
      ).length,
    }));
  }, [searchedRows]);

  const teacherStatistics = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        count: number;
        average: number;
      }
    >();

    searchedRows.forEach((row) => {
      const key = row.recorded_by || row.teacher_name;

      const existing = map.get(key);

      if (existing) {
        existing.count += 1;
        existing.average += row.percentage;
      } else {
        map.set(key, {
          name: row.teacher_name,
          count: 1,
          average: row.percentage,
        });
      }
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        average:
          item.count > 0
            ? item.average / item.count
            : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [searchedRows]);

  /*
   * ---------------------------------------------------------
   * EXCEL EXPORT
   * ---------------------------------------------------------
   */

  const exportExcel = () => {
    if (searchedRows.length === 0) {
      alert('There are no assessment records to export.');
      return;
    }

    const detailSheet = searchedRows.map((row) => ({
      Student: row.student_name,
      'Admission Number': row.admission_number,
      Programme: row.programme,
      Form: row.form,
      Class: row.class_name,
      Subject: row.subject,
      'Assessment Type': row.assessment_type,
      Score: row.score,
      'Maximum Score': row.max_score,
      Percentage: `${row.percentage}%`,
      Grade: getGrade(row.percentage),
      Status: getStatus(row.percentage),
      Term: row.term,
      'Recorded By': row.teacher_name,
      'Date Recorded': formatDateTime(row.created_at),
    }));

    const summarySheet = [
      {
        Metric: 'Total Assessment Records',
        Value: statistics.totalRecords,
      },
      {
        Metric: 'Students Assessed',
        Value: statistics.uniqueStudents,
      },
      {
        Metric: 'Average Performance',
        Value: `${statistics.average.toFixed(1)}%`,
      },
      {
        Metric: 'Highest Performance',
        Value: `${statistics.highest}%`,
      },
      {
        Metric: 'Lowest Performance',
        Value: `${statistics.lowest}%`,
      },
      {
        Metric: 'Passed',
        Value: statistics.passed,
      },
      {
        Metric: 'Failed',
        Value: statistics.failed,
      },
      {
        Metric: 'Pass Rate',
        Value: `${statistics.passRate.toFixed(1)}%`,
      },
      {
        Metric: 'CA Records',
        Value: statistics.caRecords,
      },
      {
        Metric: 'Examination Records',
        Value: statistics.examRecords,
      },
    ];

    const workbook = XLSX.utils.book_new();

    const detailWorksheet =
      XLSX.utils.json_to_sheet(detailSheet);

    const summaryWorksheet =
      XLSX.utils.json_to_sheet(summarySheet);

    XLSX.utils.book_append_sheet(
      workbook,
      summaryWorksheet,
      'Statistics'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      detailWorksheet,
      'Assessment Records'
    );

    const yearName =
      academicYears.find(
        (year) => year.id === selectedAcademicYear
      )?.name || 'All Years';

    const filename =
      `BTI-Assessment-Report-${yearName.replace(
        /\s+/g,
        '-'
      )}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  /*
   * ---------------------------------------------------------
   * RESET FILTERS
   * ---------------------------------------------------------
   */

  const resetFilters = () => {
    const currentYear =
      academicYears.find((year) => year.is_current) ||
      academicYears[0];

    setSelectedAcademicYear(
      currentYear?.id || ''
    );

    setSelectedTerm('');
    setSelectedProgramme('');
    setSelectedForm('');
    setSelectedClass('');
    setSelectedSubject('');
    setSelectedAssessmentType('');
    setSelectedTeacher('');
    setSearch('');
  };

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
 */

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-700 text-white flex items-center justify-center mx-auto mb-5 shadow-xl animate-pulse">
            <i className="fa-solid fa-chart-column text-2xl" />
          </div>

          <h2 className="text-xl font-bold text-slate-800">
            Loading Assessment Reports
          </h2>

          <p className="text-sm text-slate-500 mt-2">
            Preparing your academic performance dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      {/* HEADER */}
      <section className="bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg">
                  <i className="fa-solid fa-chart-line text-xl animate-pulse" />
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-blue-200 font-semibold">
                    BTI-SMS
                  </p>

                  <p className="text-sm text-blue-100">
                    Administrator Portal
                  </p>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Assessment Reports
              </h1>

              <p className="text-blue-100 text-sm mt-2 max-w-2xl">
                Read-only academic assessment analytics,
                student performance and teacher submission
                records.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-300/20 text-emerald-100 text-xs font-bold">
                <i className="fa-solid fa-lock" />
                READ ONLY
              </span>

              <button
                onClick={exportExcel}
                disabled={searchedRows.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-900 font-bold text-sm shadow-lg hover:-translate-y-0.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-file-excel text-emerald-600" />
                Export Excel
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-5">
        {/* ERROR */}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-5 py-4 flex items-start gap-3 shadow-sm">
            <i className="fa-solid fa-circle-exclamation mt-0.5" />

            <div>
              <p className="font-bold text-sm">
                Report Error
              </p>

              <p className="text-sm mt-1">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* FILTER CARD */}
        <section className="bg-white rounded-3xl shadow-xl border border-slate-200 p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-sliders text-blue-700" />

                <h2 className="font-black text-slate-800">
                  Report Filters
                </h2>
              </div>

              <p className="text-xs text-slate-500 mt-1">
                Narrow the report without changing any
                assessment data.
              </p>
            </div>

            <button
              onClick={resetFilters}
              className="text-sm font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-2"
            >
              <i className="fa-solid fa-rotate-left" />
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* ACADEMIC YEAR */}
            <label className="block">
              <span className="text-xs font-bold text-slate-600">
                Academic Year
              </span>

              <select
                value={selectedAcademicYear}
                onChange={(event) => {
                  setSelectedAcademicYear(
                    event.target.value
                  );
                  setSelectedTerm('');
                  setSelectedSubject('');
                  setSelectedAssessmentType('');
                  setSelectedTeacher('');
                  setSelectedProgramme('');
                  setSelectedForm('');
                  setSelectedClass('');
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  All Academic Years
                </option>

                {academicYears.map((year) => (
                  <option
                    key={year.id}
                    value={year.id}
                  >
                    {year.name}
                    {year.is_current
                      ? ' — Current'
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            {/* TERM */}
            <label className="block">
              <span className="text-xs font-bold text-slate-600">
                Semester / Term
              </span>

              <select
                value={selectedTerm}
                onChange={(event) => {
                  setSelectedTerm(event.target.value);
                  setSelectedSubject('');
                  setSelectedAssessmentType('');
                  setSelectedTeacher('');
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  All Terms
                </option>

                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </label>

            {/* PROGRAMME */}
            <label className="block">
              <span className="text-xs font-bold text-slate-600">
                Programme
              </span>

              <select
                value={selectedProgramme}
                onChange={(event) => {
                  setSelectedProgramme(
                    event.target.value
                  );
                  setSelectedForm('');
                  setSelectedClass('');
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  All Programmes
                </option>

                {filteredProgrammes.map((programme) => (
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
            </label>

            {/* FORM */}
            <label className="block">
              <span className="text-xs font-bold text-slate-600">
                Form
              </span>

              <select
                value={selectedForm}
                onChange={(event) => {
                  setSelectedForm(event.target.value);
                  setSelectedClass('');
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  All Forms
                </option>

                {forms.map((form) => (
                  <option key={form} value={form}>
                    {form}
                  </option>
                ))}
              </select>
            </label>

            {/* CLASS */}
            <label className="block">
              <span className="text-xs font-bold text-slate-600">
                Class
              </span>

              <select
                value={selectedClass}
                onChange={(event) =>
                  setSelectedClass(event.target.value)
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  All Classes
                </option>

                {filteredClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            {/* SUBJECT */}
            <label className="block">
              <span className="text-xs font-bold text-slate-600">
                Subject
              </span>

              <select
                value={selectedSubject}
                onChange={(event) => {
                  setSelectedSubject(event.target.value);
                  setSelectedAssessmentType('');
                  setSelectedTeacher('');
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  All Subjects
                </option>

                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </label>

            {/* ASSESSMENT TYPE */}
            <label className="block">
              <span className="text-xs font-bold text-slate-600">
                Assessment
              </span>

              <select
                value={selectedAssessmentType}
                onChange={(event) =>
                  setSelectedAssessmentType(
                    event.target.value
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  All Assessments
                </option>

                {assessmentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            {/* TEACHER */}
            <label className="block">
              <span className="text-xs font-bold text-slate-600">
                Recorded By
              </span>

              <select
                value={selectedTeacher}
                onChange={(event) =>
                  setSelectedTeacher(event.target.value)
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  All Teachers
                </option>

                {teachers
                  .filter((teacher) =>
                    searchedRows.some(
                      (row) =>
                        row.recorded_by === teacher.id
                    )
                  )
                  .sort((a, b) =>
                    a.name.localeCompare(b.name)
                  )
                  .map((teacher) => (
                    <option
                      key={teacher.id}
                      value={teacher.id}
                    >
                      {teacher.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {/* SEARCH */}
          <div className="mt-5">
            <label className="text-xs font-bold text-slate-600">
              Search Student / Admission Number
            </label>

            <div className="relative mt-1.5">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Type a student's name or admission number..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        {/* STATISTICS */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:-translate-y-1 transition">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <i className="fa-solid fa-file-pen" />
              </div>

              <span className="text-xs font-bold text-slate-400">
                RECORDS
              </span>
            </div>

            <p className="text-2xl font-black text-slate-800 mt-4">
              {statistics.totalRecords}
            </p>

            <p className="text-xs text-slate-500">
              Assessment records
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:-translate-y-1 transition">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <i className="fa-solid fa-users" />
              </div>

              <span className="text-xs font-bold text-slate-400">
                STUDENTS
              </span>
            </div>

            <p className="text-2xl font-black text-slate-800 mt-4">
              {statistics.uniqueStudents}
            </p>

            <p className="text-xs text-slate-500">
              Students assessed
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:-translate-y-1 transition">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <i className="fa-solid fa-chart-line" />
              </div>

              <span className="text-xs font-bold text-slate-400">
                AVERAGE
              </span>
            </div>

            <p className="text-2xl font-black text-slate-800 mt-4">
              {statistics.average.toFixed(1)}%
            </p>

            <p className="text-xs text-slate-500">
              Average performance
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:-translate-y-1 transition">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <i className="fa-solid fa-trophy" />
              </div>

              <span className="text-xs font-bold text-slate-400">
                HIGHEST
              </span>
            </div>

            <p className="text-2xl font-black text-slate-800 mt-4">
              {statistics.highest}%
            </p>

            <p className="text-xs text-slate-500">
              Highest performance
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:-translate-y-1 transition">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <i className="fa-solid fa-circle-check" />
              </div>

              <span className="text-xs font-bold text-slate-400">
                PASS RATE
              </span>
            </div>

            <p className="text-2xl font-black text-slate-800 mt-4">
              {statistics.passRate.toFixed(1)}%
            </p>

            <p className="text-xs text-slate-500">
              Overall pass rate
            </p>
          </div>
        </section>

        {/* PERFORMANCE OVERVIEW */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-black text-slate-800">
                  Performance Overview
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  Current filtered assessment performance
                </p>
              </div>

              <i className="fa-solid fa-chart-simple text-blue-700 text-xl" />
            </div>

            <div className="space-y-4">
              {gradeDistribution.map((item) => {
                const percentage =
                  statistics.totalRecords > 0
                    ? (item.count /
                        statistics.totalRecords) *
                      100
                    : 0;

                return (
                  <div key={item.grade}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-700">
                        Grade {item.grade}
                      </span>

                      <span className="text-xs font-bold text-slate-500">
                        {item.count} records
                      </span>
                    </div>

                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-700"
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                <p className="text-xs font-bold text-emerald-700">
                  PASSED
                </p>

                <p className="text-2xl font-black text-emerald-800 mt-1">
                  {statistics.passed}
                </p>
              </div>

              <div className="rounded-2xl bg-red-50 border border-red-100 p-4">
                <p className="text-xs font-bold text-red-700">
                  FAILED
                </p>

                <p className="text-2xl font-black text-red-800 mt-1">
                  {statistics.failed}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-950 to-slate-950 text-white rounded-3xl shadow-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-blue-200 font-bold">
                  Assessment Mix
                </p>

                <h2 className="text-xl font-black mt-1">
                  CA vs Examination
                </h2>
              </div>

              <i className="fa-solid fa-chart-pie text-2xl text-blue-200" />
            </div>

            <div className="mt-8 space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Continuous Assessment</span>
                  <strong>
                    {statistics.caRecords}
                  </strong>
                </div>

                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400 transition-all duration-700"
                    style={{
                      width: `${
                        statistics.totalRecords
                          ? (statistics.caRecords /
                              statistics.totalRecords) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Examinations</span>
                  <strong>
                    {statistics.examRecords}
                  </strong>
                </div>

                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                    style={{
                      width: `${
                        statistics.totalRecords
                          ? (statistics.examRecords /
                              statistics.totalRecords) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-white/10 border border-white/10 p-4">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-lock text-blue-200" />

                <div>
                  <p className="font-bold text-sm">
                    Administrator Read-Only View
                  </p>

                  <p className="text-xs text-blue-100 mt-1">
                    Assessment scores cannot be changed from
                    this report.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TEACHER ACCOUNTABILITY */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 mt-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-black text-slate-800">
                Assessment Submission Accountability
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                Teachers who recorded the assessment records
                shown in this report.
              </p>
            </div>

            <i className="fa-solid fa-user-check text-blue-700 text-xl" />
          </div>

          {teacherStatistics.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <i className="fa-solid fa-user-clock text-2xl mb-2" />

              <p className="text-sm">
                No teacher submission records found.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teacherStatistics.map((teacher) => (
                <div
                  key={teacher.name}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:-translate-y-1 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                      <i className="fa-solid fa-user-tie" />
                    </div>

                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">
                        {teacher.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        Assessment recorder
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <p className="text-[10px] uppercase font-bold text-slate-400">
                        Records
                      </p>

                      <p className="text-lg font-black text-slate-800">
                        {teacher.count}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <p className="text-[10px] uppercase font-bold text-slate-400">
                        Average
                      </p>

                      <p className="text-lg font-black text-slate-800">
                        {teacher.average.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SEARCH RESULT / ASSESSMENT TABLE */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm mt-5 overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-table-list text-blue-700" />

                <h2 className="font-black text-slate-800">
                  Assessment Records
                </h2>
              </div>

              <p className="text-xs text-slate-500 mt-1">
                Detailed read-only assessment information.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold">
              <i className="fa-solid fa-database" />
              {searchedRows.length} records
            </span>
          </div>

          {reportLoading ? (
            <div className="py-16 text-center">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-blue-700" />

              <p className="text-sm text-slate-500 mt-3">
                Preparing report...
              </p>
            </div>
          ) : searchedRows.length === 0 ? (
            <div className="py-16 text-center px-5">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <i className="fa-solid fa-magnifying-glass text-2xl" />
              </div>

              <h3 className="font-bold text-slate-700 mt-4">
                No assessment records found
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Try changing your filters or search for
                another student.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="text-left px-4 py-4">
                      Student
                    </th>

                    <th className="text-left px-4 py-4">
                      Programme
                    </th>

                    <th className="text-left px-4 py-4">
                      Form / Class
                    </th>

                    <th className="text-left px-4 py-4">
                      Subject
                    </th>

                    <th className="text-left px-4 py-4">
                      Assessment
                    </th>

                    <th className="text-left px-4 py-4">
                      Score
                    </th>

                    <th className="text-left px-4 py-4">
                      %
                    </th>

                    <th className="text-left px-4 py-4">
                      Grade
                    </th>

                    <th className="text-left px-4 py-4">
                      Recorded By
                    </th>

                    <th className="text-left px-4 py-4">
                      Date
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {searchedRows.map((row) => {
                    const grade = getGrade(
                      row.percentage
                    );

                    const passed =
                      row.percentage >= 50;

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-blue-50/40 transition"
                      >
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-bold text-slate-800">
                              {row.student_name}
                            </p>

                            <p className="text-xs text-slate-500">
                              {row.admission_number}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-slate-600">
                          {row.programme}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-700">
                            {row.form}
                          </p>

                          <p className="text-xs text-slate-500">
                            {row.class_name}
                          </p>
                        </td>

                        <td className="px-4 py-4 font-semibold text-slate-700">
                          {row.subject}
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                            <i className="fa-solid fa-clipboard-check" />
                            {row.assessment_type}
                          </span>

                          <p className="text-[11px] text-slate-400 mt-1">
                            {row.term}
                          </p>
                        </td>

                        <td className="px-4 py-4 font-black text-slate-800">
                          {row.score}
                          <span className="text-slate-400 font-medium">
                            /{row.max_score}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`font-black ${
                              passed
                                ? 'text-emerald-600'
                                : 'text-red-600'
                            }`}
                          >
                            {row.percentage}%
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="w-9 h-9 inline-flex items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-black">
                            {grade}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center">
                              <i className="fa-solid fa-user" />
                            </div>

                            <div>
                              <p className="font-semibold text-slate-700">
                                {row.teacher_name}
                              </p>

                              <p className="text-[10px] text-slate-400">
                                Submitted / recorded
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-xs text-slate-500">
                          {formatDateTime(
                            row.created_at
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* STUDENT SEARCH HELP */}
        {search.trim() && searchedRows.length > 0 && (
          <section className="mt-5 rounded-3xl bg-blue-950 text-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-user-graduate" />
              </div>

              <div>
                <p className="font-black">
                  Student Search Active
                </p>

                <p className="text-sm text-blue-100 mt-1">
                  Showing {searchedRows.length} assessment
                  record
                  {searchedRows.length === 1
                    ? ''
                    : 's'} matching{' '}
                  <strong>
                    "{search}"
                  </strong>
                  .
                </p>
              </div>
            </div>
          </section>
        )}

        {/* FOOTER */}
        <footer className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            BTI-SMS Assessment Reports • Read-only
            administrator analytics
          </p>

          <p className="text-[11px] text-slate-400 mt-1">
            Assessment data is entered by authorized
            teachers and displayed here for administrative
            monitoring.
          </p>
        </footer>
      </div>
    </main>
  );
}

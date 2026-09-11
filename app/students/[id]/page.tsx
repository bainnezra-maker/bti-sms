'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  admission_number: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  address: string | null;
  admission_date: string;
  status: string;
  jhs_aggregate: number | null;
  photo_url: string | null;
  conduct: string | null;
  promotion_status: string | null;
  class_teacher_remark: string | null;
  hod_remark: string | null;
  next_term_begins: string | null;
};

type Enrollment = {
  id: string;
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
  academic_year: {
    id: string;
    name: string;
    start_date?: string | null;
    end_date?: string | null;
  }[] | null;
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
};

type Semester = {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
};

type AttendanceRecord = {
  id: string;
  date: string;
  status: string;
  class_id: string;
};

type Assessment = {
  id: string;
  subject: string;
  assessment_type: string;
  score: number;
  max_score: number;
  term: string | null;
  created_at: string;
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

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not provided';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-GB');
}

function normalizeName(value: string | null) {
  return (value || '').trim().toLowerCase();
}

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);

  const [enrollments, setEnrollments] = useState<Enrollment[]>(
    []
  );

  const [attendance, setAttendance] = useState<
    AttendanceRecord[]
  >([]);

  const [assessments, setAssessments] = useState<Assessment[]>(
    []
  );

  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);

  const [semesters, setSemesters] = useState<Semester[]>(
    []
  );

  const [selectedAcademicYearId, setSelectedAcademicYearId] =
    useState('');

  const [selectedSemesterId, setSelectedSemesterId] =
    useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    photo_url: '',
    conduct: '',
    promotion_status: '',
    class_teacher_remark: '',
    hod_remark: '',
    next_term_begins: '',
  });

  useEffect(() => {
    loadStudent();
  }, [studentId]);

  async function loadStudent() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const {
      data: userProfile,
      error: userProfileError,
    } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (userProfileError || !userProfile?.school_id) {
      setLoading(false);
      return;
    }

    const schoolId = userProfile.school_id;

    const [
      studentResult,
      enrollmentResult,
      attendanceResult,
      assessmentResult,
      academicYearResult,
      semesterResult,
    ] = await Promise.all([
      supabase
        .from('students')
        .select(`
          id,
          admission_number,
          full_name,
          date_of_birth,
          gender,
          guardian_name,
          guardian_phone,
          address,
          admission_date,
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
        .eq('school_id', schoolId)
        .single(),

      supabase
        .from('enrollments')
        .select(`
          id,
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
          ),
          academic_year:academic_years (
            id,
            name,
            start_date,
            end_date
          )
        `)
        .eq('student_id', studentId)
        .order('enrollment_date', {
          ascending: false,
        }),

      supabase
        .from('attendance')
        .select(`
          id,
          date,
          status,
          class_id
        `)
        .eq('student_id', studentId)
        .order('date', {
          ascending: false,
        }),

      supabase
        .from('assessments')
        .select(`
          id,
          subject,
          assessment_type,
          score,
          max_score,
          term,
          created_at
        `)
        .eq('student_id', studentId)
        .order('created_at', {
          ascending: false,
        }),

      supabase
        .from('academic_years')
        .select(`
          id,
          name,
          start_date,
          end_date,
          is_current
        `)
        .eq('school_id', schoolId)
        .order('start_date', {
          ascending: false,
        }),

      supabase
        .from('terms')
        .select(`
          id,
          academic_year_id,
          name,
          start_date,
          end_date,
          is_current
        `)
        .order('start_date', {
          ascending: true,
        }),
    ]);

    if (studentResult.error || !studentResult.data) {
      console.error(
        'Student loading error:',
        studentResult.error
      );

      setLoading(false);
      return;
    }

    const typedStudent =
      studentResult.data as Student;

    setStudent(typedStudent);

    setForm({
      photo_url: typedStudent.photo_url || '',
      conduct: typedStudent.conduct || '',
      promotion_status:
        typedStudent.promotion_status || '',
      class_teacher_remark:
        typedStudent.class_teacher_remark || '',
      hod_remark:
        typedStudent.hod_remark || '',
      next_term_begins:
        typedStudent.next_term_begins || '',
    });

    setEnrollments(
      (enrollmentResult.data || []) as Enrollment[]
    );

    setAttendance(
      (attendanceResult.data || []) as AttendanceRecord[]
    );

    setAssessments(
      (assessmentResult.data || []) as Assessment[]
    );

    const years =
      (academicYearResult.data || []) as AcademicYear[];

    const terms =
      (semesterResult.data || []) as Semester[];

    setAcademicYears(years);
    setSemesters(terms);

    /*
     * Prefer the academic year from the student's latest
     * enrollment. If it cannot be determined, use the
     * current academic year.
     */
    const latestEnrollment =
      enrollmentResult.data?.[0] as
        | Enrollment
        | undefined;

    const enrollmentYearId =
      latestEnrollment?.academic_year?.[0]?.id || '';

    const currentYear =
      years.find((year) => year.is_current);

    const initialYearId =
      enrollmentYearId ||
      currentYear?.id ||
      years[0]?.id ||
      '';

    setSelectedAcademicYearId(initialYearId);

    /*
     * Select the current semester belonging to the
     * selected academic year, or the first semester.
     */
    const yearSemesters = terms.filter(
      (semester) =>
        semester.academic_year_id ===
        initialYearId
    );

    const currentSemester =
      yearSemesters.find(
        (semester) => semester.is_current
      );

    setSelectedSemesterId(
      currentSemester?.id ||
        yearSemesters[0]?.id ||
        ''
    );

    setLoading(false);
  }

  async function saveReportCardInfo() {
    if (!student) return;

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        alert(
          'Your session has expired. Please log in again.'
        );

        router.push('/login');
        return;
      }

      const {
        data: userProfile,
        error: userProfileError,
      } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (
        userProfileError ||
        !userProfile?.school_id
      ) {
        alert(
          'Could not identify your school. Please log in again.'
        );

        return;
      }

      const updateData = {
        photo_url:
          form.photo_url.trim() || null,

        conduct:
          form.conduct.trim() || null,

        promotion_status:
          form.promotion_status.trim() || null,

        class_teacher_remark:
          form.class_teacher_remark.trim() || null,

        hod_remark:
          form.hod_remark.trim() || null,

        next_term_begins:
          form.next_term_begins || null,
      };

      const {
        data: updatedStudent,
        error: updateError,
      } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', student.id)
        .eq('school_id', userProfile.school_id)
        .select(`
          id,
          admission_number,
          full_name,
          date_of_birth,
          gender,
          guardian_name,
          guardian_phone,
          address,
          admission_date,
          status,
          jhs_aggregate,
          photo_url,
          conduct,
          promotion_status,
          class_teacher_remark,
          hod_remark,
          next_term_begins
        `)
        .maybeSingle();

      if (updateError) {
        console.error(
          'Report card update error:',
          updateError
        );

        alert(
          `Could not save report card information:\n\n${updateError.message}`
        );

        return;
      }

      if (!updatedStudent) {
        alert(
          'The information was NOT saved. Supabase did not return the updated student record. Please check the students UPDATE permission (RLS policy).'
        );

        return;
      }

      const savedStudent =
        updatedStudent as Student;

      setStudent(savedStudent);

      setForm({
        photo_url:
          savedStudent.photo_url || '',

        conduct:
          savedStudent.conduct || '',

        promotion_status:
          savedStudent.promotion_status || '',

        class_teacher_remark:
          savedStudent.class_teacher_remark || '',

        hod_remark:
          savedStudent.hod_remark || '',

        next_term_begins:
          savedStudent.next_term_begins || '',
      });

      alert(
        'Report card information saved successfully.'
      );
    } catch (error) {
      console.error(
        'Unexpected save error:',
        error
      );

      alert(
        'An unexpected error occurred while saving the report card information.'
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * Semesters belonging to the selected academic year.
   */
  const availableSemesters = useMemo(() => {
    return semesters.filter(
      (semester) =>
        semester.academic_year_id ===
        selectedAcademicYearId
    );
  }, [
    semesters,
    selectedAcademicYearId,
  ]);

  /*
   * When academic year changes, automatically select
   * Semester 1 or the current semester for that year.
   */
  function handleAcademicYearChange(
    academicYearId: string
  ) {
    setSelectedAcademicYearId(
      academicYearId
    );

    const yearSemesters = semesters.filter(
      (semester) =>
        semester.academic_year_id ===
        academicYearId
    );

    const currentSemester =
      yearSemesters.find(
        (semester) => semester.is_current
      );

    setSelectedSemesterId(
      currentSemester?.id ||
        yearSemesters[0]?.id ||
        ''
    );
  }

  const selectedSemester = semesters.find(
    (semester) =>
      semester.id === selectedSemesterId
  );

  const selectedAcademicYear =
    academicYears.find(
      (year) =>
        year.id === selectedAcademicYearId
    );

  /*
   * Filter assessments for the selected semester.
   *
   * The assessments table stores the semester name
   * in the "term" column. We intentionally keep the
   * database column named "term" for compatibility,
   * while the user sees "Semester" throughout the UI.
   */
  const semesterAssessments = useMemo(() => {
    if (!selectedSemester) {
      return [];
    }

    const semesterName =
      normalizeName(selectedSemester.name);

    return assessments.filter(
      (assessment) =>
        normalizeName(assessment.term) ===
        semesterName
    );
  }, [
    assessments,
    selectedSemester,
  ]);

  /*
   * Filter attendance using the selected semester's
   * start and end dates.
   */
  const semesterAttendance = useMemo(() => {
    if (!selectedSemester) {
      return [];
    }

    return attendance.filter((record) => {
      if (!selectedSemester.start_date) {
        return true;
      }

      if (
        record.date <
        selectedSemester.start_date
      ) {
        return false;
      }

      if (
        selectedSemester.end_date &&
        record.date >
          selectedSemester.end_date
      ) {
        return false;
      }

      return true;
    });
  }, [
    attendance,
    selectedSemester,
  ]);

  /*
   * Calculate official BTI subject results.
   *
   * CA:
   *   Raw CA = 100
   *   Contribution = 30%
   *
   * Examination:
   *   Raw examination = 100
   *   Contribution = 70%
   *
   * Final = CA contribution + Examination contribution
   */
  const subjectResults = useMemo<SubjectResult[]>(
    () => {
      const subjectMap: Record<
        string,
        {
          caRaw: number;
          examRaw: number;
        }
      > = {};

      semesterAssessments.forEach(
        (assessment) => {
          if (!subjectMap[assessment.subject]) {
            subjectMap[assessment.subject] = {
              caRaw: 0,
              examRaw: 0,
            };
          }

          if (
            CA_TYPES.includes(
              assessment.assessment_type
            )
          ) {
            subjectMap[
              assessment.subject
            ].caRaw += Number(
              assessment.score
            );
          }

          if (
            assessment.assessment_type ===
            'Examination'
          ) {
            subjectMap[
              assessment.subject
            ].examRaw = Number(
              assessment.score
            );
          }
        }
      );

      return Object.entries(subjectMap)
        .map(([subject, values]) => {
          const caContribution =
            (values.caRaw / 100) * 30;

          const examContribution =
            (values.examRaw / 100) * 70;

          const finalScore =
            caContribution +
            examContribution;

          return {
            subject,
            caRaw: values.caRaw,
            caContribution,
            examRaw: values.examRaw,
            examContribution,
            finalScore,
            grade: getGrade(finalScore),
            status: getStatus(finalScore),
          };
        })
        .sort((a, b) =>
          a.subject.localeCompare(b.subject)
        );
    },
    [semesterAssessments]
  );

  const overallAverage = useMemo(() => {
    if (subjectResults.length === 0) {
      return 0;
    }

    return (
      subjectResults.reduce(
        (sum, item) =>
          sum + item.finalScore,
        0
      ) / subjectResults.length
    );
  }, [subjectResults]);

  /*
   * Semester attendance:
   * Present + Late = Attended
   * Absent = not attended
   * Excused = separate category
   */
  const attendanceSummary = useMemo(() => {
    const total =
      semesterAttendance.length;

    const present =
      semesterAttendance.filter(
        (item) =>
          item.status.toLowerCase() ===
          'present'
      ).length;

    const late =
      semesterAttendance.filter(
        (item) =>
          item.status.toLowerCase() ===
          'late'
      ).length;

    const absent =
      semesterAttendance.filter(
        (item) =>
          item.status.toLowerCase() ===
          'absent'
      ).length;

    const excused =
      semesterAttendance.filter(
        (item) =>
          item.status.toLowerCase() ===
          'excused'
      ).length;

    const attended =
      present + late;

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
  }, [semesterAttendance]);

  /*
   * Determine current enrollment.
   */
  const activeEnrollment =
    enrollments.find(
      (item) => item.status === 'active'
    ) || enrollments[0];

  const currentClass =
    activeEnrollment?.class?.[0]?.name ||
    'Not enrolled';

  const currentLevel =
    activeEnrollment?.class?.[0]?.level ||
    '';

  const currentProgramme =
    activeEnrollment?.programme?.[0]?.name ||
    'Not assigned';

  const currentAcademicYear =
    activeEnrollment?.academic_year?.[0]?.name ||
    'Not assigned';

  /*
   * Enrollment history sorted newest first.
   */
  const sortedEnrollments = useMemo(() => {
    return [...enrollments].sort((a, b) =>
      b.enrollment_date.localeCompare(
        a.enrollment_date
      )
    );
  }, [enrollments]);

  /*
   * Find enrollment for selected academic year.
   * This allows us to show the historical class/programme
   * connected to the selected academic year.
   */
  const selectedYearEnrollment =
    enrollments.find(
      (enrollment) =>
        enrollment.academic_year?.[0]?.id ===
        selectedAcademicYearId
    );

  const selectedYearClass =
    selectedYearEnrollment?.class?.[0]?.name ||
    'No enrollment recorded';

  const selectedYearProgramme =
    selectedYearEnrollment?.programme?.[0]?.name ||
    'No programme recorded';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            Loading student profile...
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">
              Student not found
            </h1>

            <Link
              href="/students"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2 font-medium text-white"
            >
              ← Back to Students
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Student Management
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Student Profile
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Complete student information, academic history,
              semester results, attendance and promotion status.
            </p>
          </div>

          <Link
            href="/students"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Back to Students
          </Link>
        </div>

        {/* Student Overview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">

            <div className="flex justify-center sm:justify-start">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.full_name}
                  className="h-32 w-32 rounded-2xl object-cover ring-4 ring-slate-100"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-slate-100 text-5xl">
                  👤
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {student.full_name}
                  </h2>

                  <p className="mt-1 text-slate-500">
                    Admission No: {student.admission_number}
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
                    student.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : student.status === 'graduated'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {student.status}
                </span>

              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">

                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-xs text-blue-600">
                    Current Class
                  </p>

                  <p className="mt-1 font-bold text-blue-900">
                    {currentClass}
                  </p>

                  {currentLevel && (
                    <p className="mt-1 text-xs text-blue-700">
                      {currentLevel}
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-purple-50 p-4">
                  <p className="text-xs text-purple-600">
                    Programme
                  </p>

                  <p className="mt-1 font-bold text-purple-900">
                    {currentProgramme}
                  </p>
                </div>

                <div className="rounded-xl bg-green-50 p-4">
                  <p className="text-xs text-green-600">
                    Academic Year
                  </p>

                  <p className="mt-1 font-bold text-green-900">
                    {currentAcademicYear}
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 text-lg font-bold text-slate-900">
            👤 Student Bio-data
          </h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Full Name
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {student.full_name}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Admission Number
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {student.admission_number}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Gender
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {student.gender || 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Date of Birth
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {formatDate(student.date_of_birth)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Admission Date
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {formatDate(student.admission_date)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                JHS Aggregate
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {student.jhs_aggregate ??
                  'Not provided'}
              </p>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-medium uppercase text-slate-400">
                Address
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {student.address || 'Not provided'}
              </p>
            </div>

          </div>
        </div>

        {/* Guardian */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 text-lg font-bold text-slate-900">
            👨‍👩‍👧 Guardian Information
          </h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Guardian Name
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {student.guardian_name ||
                  'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Guardian Phone
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {student.guardian_phone ||
                  'Not provided'}
              </p>
            </div>

          </div>
        </div>

        {/* Academic Year / Semester Selector */}
        <div className="mt-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              📚 Academic Record Viewer
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select an academic year and semester to view
              the student's historical academic performance
              and attendance.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Academic Year
              </label>

              <select
                value={selectedAcademicYearId}
                onChange={(event) =>
                  handleAcademicYearChange(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                    {year.is_current
                      ? ' — Current'
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Semester
              </label>

              <select
                value={selectedSemesterId}
                onChange={(event) =>
                  setSelectedSemesterId(
                    event.target.value
                  )
                }
                disabled={
                  availableSemesters.length === 0
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="">
                  {availableSemesters.length === 0
                    ? 'No semesters available'
                    : 'Select Semester'}
                </option>

                {availableSemesters.map(
                  (semester) => (
                    <option
                      key={semester.id}
                      value={semester.id}
                    >
                      {semester.name}
                      {semester.is_current
                        ? ' — Current'
                        : ''}
                    </option>
                  )
                )}
              </select>
            </div>

          </div>

          {selectedAcademicYear && (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Selected Academic Year
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {selectedAcademicYear.name}
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-xs text-blue-600">
                  Class
                </p>

                <p className="mt-1 font-semibold text-blue-900">
                  {selectedYearClass}
                </p>
              </div>

              <div className="rounded-xl bg-purple-50 p-4">
                <p className="text-xs text-purple-600">
                  Programme
                </p>

                <p className="mt-1 font-semibold text-purple-900">
                  {selectedYearProgramme}
                </p>
              </div>

            </div>
          )}

        </div>

        {/* Semester Results */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                📊 Semester Results
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {selectedAcademicYear?.name ||
                  'Select academic year'}
                {' • '}
                {selectedSemester?.name ||
                  'Select semester'}
              </p>
            </div>

            <Link
              href="/results"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Open Results →
            </Link>

          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Subjects
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {subjectResults.length}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-sm text-blue-700">
                Overall Average
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-700">
                {overallAverage.toFixed(1)}%
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-sm text-green-700">
                Subjects Passed
              </p>

              <p className="mt-1 text-2xl font-bold text-green-700">
                {
                  subjectResults.filter(
                    (item) =>
                      item.status === 'Pass'
                  ).length
                }
              </p>
            </div>

          </div>

          {subjectResults.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center">

              <p className="font-medium text-slate-700">
                No results found for this semester.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Make sure assessments have been recorded
                for this academic period.
              </p>

            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">

              <table className="min-w-full text-left text-sm">

                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Subject
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      CA / 30
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Exam / 70
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Final / 100
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Grade
                    </th>

                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {subjectResults.map(
                    (result) => (
                      <tr
                        key={result.subject}
                        className="border-b border-slate-100"
                      >

                        <td className="px-4 py-4 font-semibold text-slate-900">
                          {result.subject}
                        </td>

                        <td className="px-4 py-4 text-slate-700">
                          {result.caContribution.toFixed(1)}
                        </td>

                        <td className="px-4 py-4 text-slate-700">
                          {result.examContribution.toFixed(1)}
                        </td>

                        <td className="px-4 py-4 font-bold text-slate-900">
                          {result.finalScore.toFixed(1)}
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-lg bg-slate-100 px-3 py-1 font-bold text-slate-800">
                            {result.grade}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              result.status === 'Pass'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {result.status}
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

        {/* Semester Attendance */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              📅 Semester Attendance
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Attendance for{' '}
              {selectedSemester?.name ||
                'the selected semester'}
              .
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Recorded Days
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {attendanceSummary.total}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-xs text-green-700">
                Present
              </p>

              <p className="mt-1 text-2xl font-bold text-green-700">
                {attendanceSummary.present}
              </p>
            </div>

            <div className="rounded-xl bg-yellow-50 p-4">
              <p className="text-xs text-yellow-700">
                Late
              </p>

              <p className="mt-1 text-2xl font-bold text-yellow-700">
                {attendanceSummary.late}
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-xs text-red-700">
                Absent
              </p>

              <p className="mt-1 text-2xl font-bold text-red-700">
                {attendanceSummary.absent}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs text-blue-700">
                Excused
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-700">
                {attendanceSummary.excused}
              </p>
            </div>

            <div className="rounded-xl bg-purple-50 p-4">
              <p className="text-xs text-purple-700">
                Attended
              </p>

              <p className="mt-1 text-2xl font-bold text-purple-700">
                {attendanceSummary.attended}
              </p>
            </div>

          </div>

          <div className="mt-6">

            <div className="mb-2 flex items-center justify-between">

              <span className="text-sm font-semibold text-slate-700">
                Attendance Percentage
              </span>

              <span className="text-sm font-bold text-slate-900">
                {attendanceSummary.percentage.toFixed(1)}%
              </span>

            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-200">

              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{
                  width: `${Math.min(
                    attendanceSummary.percentage,
                    100
                  )}%`,
                }}
              />

            </div>

            <p className="mt-2 text-xs text-slate-400">
              Attendance percentage is calculated as
              Present + Late divided by recorded attendance
              days.
            </p>

          </div>

          {semesterAttendance.length > 0 && (
            <div className="mt-6 overflow-x-auto">

              <table className="min-w-full text-left text-sm">

                <thead>
                  <tr className="border-b border-slate-200">

                    <th className="px-3 py-3 font-semibold text-slate-600">
                      Date
                    </th>

                    <th className="px-3 py-3 font-semibold text-slate-600">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {semesterAttendance
                    .slice(0, 15)
                    .map((record) => (
                      <tr
                        key={record.id}
                        className="border-b border-slate-100"
                      >

                        <td className="px-3 py-3">
                          {formatDate(record.date)}
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              record.status.toLowerCase() ===
                              'present'
                                ? 'bg-green-100 text-green-700'
                                : record.status.toLowerCase() ===
                                  'late'
                                ? 'bg-yellow-100 text-yellow-700'
                                : record.status.toLowerCase() ===
                                  'absent'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>

                      </tr>
                    ))}

                </tbody>

              </table>

              {semesterAttendance.length >
                15 && (
                <p className="mt-3 text-xs text-slate-400">
                  Showing the latest 15 attendance
                  records.
                </p>
              )}

            </div>
          )}

        </div>

        {/* Academic History */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              🏫 Academic History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Previous and current enrollments are preserved
              here.
            </p>
          </div>

          {sortedEnrollments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No academic history found.
            </p>
          ) : (
            <div className="space-y-3">

              {sortedEnrollments.map(
                (enrollment, index) => {
                  const academicYear =
                    enrollment.academic_year?.[0];

                  const schoolClass =
                    enrollment.class?.[0];

                  const programme =
                    enrollment.programme?.[0];

                  const isCurrent =
                    enrollment.status ===
                    'active';

                  return (
                    <div
                      key={enrollment.id}
                      className={`rounded-xl border p-4 ${
                        isCurrent
                          ? 'border-green-200 bg-green-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >

                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                        <div className="flex items-start gap-4">

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">
                            {index + 1}
                          </div>

                          <div>

                            <div className="flex flex-wrap items-center gap-2">

                              <p className="font-bold text-slate-900">
                                {academicYear?.name ||
                                  'Academic year unavailable'}
                              </p>

                              {isCurrent && (
                                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                                  Current
                                </span>
                              )}

                            </div>

                            <p className="mt-1 text-sm font-medium text-slate-700">
                              {schoolClass?.name ||
                                'Class unavailable'}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {programme?.name ||
                                'Programme unavailable'}
                            </p>

                          </div>

                        </div>

                        <div className="text-sm text-slate-500 lg:text-right">

                          <p>
                            Enrollment Date:{' '}
                            <span className="font-medium text-slate-700">
                              {formatDate(
                                enrollment.enrollment_date
                              )}
                            </span>
                          </p>

                          <p className="mt-1">
                            Status:{' '}
                            <span className="font-medium capitalize text-slate-700">
                              {enrollment.status}
                            </span>
                          </p>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </div>

        {/* Conduct & Promotion */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <h2 className="mb-5 text-lg font-bold text-slate-900">
              🧑‍🏫 Conduct & Remarks
            </h2>

            <div className="space-y-5">

              <div>
                <p className="text-xs font-medium uppercase text-slate-400">
                  Conduct / Attitude
                </p>

                <p className="mt-1 font-semibold text-slate-800">
                  {student.conduct ||
                    'Not recorded'}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-400">
                  Class Teacher's Remark
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {student.class_teacher_remark ||
                    'Not recorded'}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-400">
                  HOD / Head's Remark
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {student.hod_remark ||
                    'Not recorded'}
                </p>
              </div>

            </div>

          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <h2 className="mb-5 text-lg font-bold text-slate-900">
              🎓 Promotion Status
            </h2>

            <div className="space-y-5">

              <div>
                <p className="text-xs font-medium uppercase text-slate-400">
                  Current Promotion Status
                </p>

                <div className="mt-2">

                  <span
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      student.promotion_status ===
                      'Promoted'
                        ? 'bg-green-100 text-green-700'
                        : student.promotion_status ===
                          'Repeated'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {student.promotion_status ||
                      'Not yet recorded'}
                  </span>

                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-400">
                  Current Class
                </p>

                <p className="mt-1 font-semibold text-slate-800">
                  {currentClass}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-400">
                  Next Semester Begins
                </p>

                <p className="mt-1 font-semibold text-slate-800">
                  {formatDate(
                    student.next_term_begins
                  )}
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* Report Card Information Editor */}
        <div className="mt-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              📝 Update Report Card Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Update the information that appears on the
              student's report card.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5">

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Student Photo URL
              </label>

              <input
                type="url"
                value={form.photo_url}
                onChange={(event) =>
                  setForm({
                    ...form,
                    photo_url:
                      event.target.value,
                  })
                }
                placeholder="Paste student's photo URL"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-1 text-xs text-slate-400">
                Direct photo upload can be connected later
                through Supabase Storage.
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Conduct / Attitude
              </label>

              <select
                value={form.conduct}
                onChange={(event) =>
                  setForm({
                    ...form,
                    conduct:
                      event.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">
                  Select conduct
                </option>

                <option value="Excellent">
                  Excellent
                </option>

                <option value="Very Good">
                  Very Good
                </option>

                <option value="Good">
                  Good
                </option>

                <option value="Satisfactory">
                  Satisfactory
                </option>

                <option value="Needs Improvement">
                  Needs Improvement
                </option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Promotion Status
              </label>

              <select
                value={form.promotion_status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    promotion_status:
                      event.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">
                  Select promotion status
                </option>

                <option value="Promoted">
                  Promoted
                </option>

                <option value="Repeated">
                  Repeated
                </option>

                <option value="Referred">
                  Referred
                </option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Class Teacher's Remark
              </label>

              <textarea
                value={form.class_teacher_remark}
                onChange={(event) =>
                  setForm({
                    ...form,
                    class_teacher_remark:
                      event.target.value,
                  })
                }
                rows={4}
                placeholder="Enter class teacher's remark..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                HOD / Head's Remark
              </label>

              <textarea
                value={form.hod_remark}
                onChange={(event) =>
                  setForm({
                    ...form,
                    hod_remark:
                      event.target.value,
                  })
                }
                rows={4}
                placeholder="Enter HOD / Head's remark..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Next Semester Begins
              </label>

              <input
                type="date"
                value={form.next_term_begins}
                onChange={(event) =>
                  setForm({
                    ...form,
                    next_term_begins:
                      event.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={saveReportCardInfo}
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
            >
              {saving
                ? 'Saving...'
                : '💾 Save Report Card Information'}
            </button>

          </div>

        </div>

        {/* Historical Report Card */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              📄 Report Card
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Open the student's report card.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">

            <Link
              href={`/report-card/${student.id}`}
              className="rounded-xl bg-slate-900 px-6 py-3 text-center font-semibold text-white hover:bg-slate-800"
            >
              📄 Open Report Card
            </Link>

            <Link
              href="/results"
              className="rounded-xl border border-slate-300 px-6 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
            >
              📊 View Results
            </Link>

          </div>

          <p className="mt-4 text-xs text-slate-400">
            Historical report-card selection by academic year
            and semester will be connected to the report-card
            viewer in the next student-management stage.
          </p>

        </div>

        {/* Bottom Actions */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">

          <Link
            href="/students"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-center font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to Students
          </Link>

          <Link
            href={`/students/${student.id}/edit`}
            className="rounded-xl bg-blue-600 px-6 py-3 text-center font-semibold text-white hover:bg-blue-700"
          >
            ✏️ Edit Student
          </Link>

          <Link
            href="/promotion"
            className="rounded-xl bg-purple-600 px-6 py-3 text-center font-semibold text-white hover:bg-purple-700"
          >
            🎓 Promotion
          </Link>

        </div>

      </div>
    </div>
  );
}

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
  }[];
  programme: {
    id: string;
    name: string;
    code: string | null;
  }[];
  academic_year: {
    id: string;
    name: string;
  }[];
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

type Semester = {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
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

function formatDate(date: string | null) {
  if (!date) return 'Not provided';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString('en-GB');
}

function normalizeRelation<T>(
  value: T | T[] | null | undefined
): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const studentId = params.id as string;

  const [student, setStudent] =
    useState<Student | null>(null);

  const [enrollments, setEnrollments] =
    useState<Enrollment[]>([]);

  const [academicYears, setAcademicYears] =
    useState<AcademicYear[]>([]);

  const [semesters, setSemesters] =
    useState<Semester[]>([]);

  const [attendance, setAttendance] =
    useState<AttendanceRecord[]>([]);

  const [assessments, setAssessments] =
    useState<Assessment[]>([]);

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

    if (
      userProfileError ||
      !userProfile?.school_id
    ) {
      setLoading(false);
      return;
    }

    const schoolId = userProfile.school_id;

    const {
      data: studentData,
      error: studentError,
    } = await supabase
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
      .single();

    if (studentError || !studentData) {
      console.error(
        'Student loading error:',
        studentError
      );

      setLoading(false);
      return;
    }

    const typedStudent =
      studentData as Student;

    setStudent(typedStudent);

    setForm({
      photo_url:
        typedStudent.photo_url || '',
      conduct:
        typedStudent.conduct || '',
      promotion_status:
        typedStudent.promotion_status || '',
      class_teacher_remark:
        typedStudent.class_teacher_remark || '',
      hod_remark:
        typedStudent.hod_remark || '',
      next_term_begins:
        typedStudent.next_term_begins || '',
    });

    const {
      data: enrollmentData,
      error: enrollmentError,
    } = await supabase
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
          name
        )
      `)
      .eq('student_id', studentId)
      .order('enrollment_date', {
        ascending: false,
      });

    if (enrollmentError) {
      console.error(
        'Enrollment loading error:',
        enrollmentError
      );
    }

    const normalizedEnrollments: Enrollment[] =
      (enrollmentData || []).map(
        (item: any) => ({
          id: item.id,
          enrollment_date:
            item.enrollment_date,
          status:
            item.status || 'active',
          class: normalizeRelation(
            item.class
          ),
          programme: normalizeRelation(
            item.programme
          ),
          academic_year:
            normalizeRelation(
              item.academic_year
            ),
        })
      );

    setEnrollments(
      normalizedEnrollments
    );

    const {
      data: academicYearData,
      error: academicYearError,
    } = await supabase
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
      });

    if (academicYearError) {
      console.error(
        'Academic year loading error:',
        academicYearError
      );
    }

    const loadedAcademicYears =
      (academicYearData ||
        []) as AcademicYear[];

    setAcademicYears(
      loadedAcademicYears
    );

    const {
      data: semesterData,
      error: semesterError,
    } = await supabase
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
      });

    if (semesterError) {
      console.error(
        'Semester loading error:',
        semesterError
      );
    }

    const loadedSemesters =
      (semesterData ||
        []) as Semester[];

    setSemesters(
      loadedSemesters
    );

    const currentEnrollment =
      normalizedEnrollments.find(
        (item) =>
          item.status === 'active'
      ) ||
      normalizedEnrollments[0];

    const currentAcademicYearId =
      currentEnrollment
        ?.academic_year?.[0]?.id ||
      loadedAcademicYears.find(
        (year) => year.is_current
      )?.id ||
      loadedAcademicYears[0]?.id ||
      '';

    setSelectedAcademicYearId(
      currentAcademicYearId
    );

    const currentSemester =
      loadedSemesters.find(
        (semester) =>
          semester.academic_year_id ===
            currentAcademicYearId &&
          semester.is_current
      ) ||
      loadedSemesters.find(
        (semester) =>
          semester.academic_year_id ===
          currentAcademicYearId
      );

    setSelectedSemesterId(
      currentSemester?.id || ''
    );

    const {
      data: attendanceData,
      error: attendanceError,
    } = await supabase
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
      });

    if (attendanceError) {
      console.error(
        'Attendance loading error:',
        attendanceError
      );
    }

    setAttendance(
      (attendanceData ||
        []) as AttendanceRecord[]
    );

    const {
      data: assessmentData,
      error: assessmentError,
    } = await supabase
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
      });

    if (assessmentError) {
      console.error(
        'Assessment loading error:',
        assessmentError
      );
    }

    setAssessments(
      (assessmentData ||
        []) as Assessment[]
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

      const schoolId =
        userProfile.school_id;

      const updateData = {
        photo_url:
          form.photo_url.trim() || null,

        conduct:
          form.conduct.trim() || null,

        promotion_status:
          form.promotion_status.trim() || null,

        class_teacher_remark:
          form.class_teacher_remark.trim() ||
          null,

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
        .eq('school_id', schoolId)
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
          'The information was NOT saved. Supabase did not return the updated student record. This usually means the students UPDATE permission (RLS policy) needs to be enabled.'
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
          savedStudent.promotion_status ||
          '',
        class_teacher_remark:
          savedStudent.class_teacher_remark ||
          '',
        hod_remark:
          savedStudent.hod_remark || '',
        next_term_begins:
          savedStudent.next_term_begins ||
          '',
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

  const selectedSemester =
    semesters.find(
      (semester) =>
        semester.id ===
        selectedSemesterId
    ) || null;

  const semesterOptions =
    semesters.filter(
      (semester) =>
        semester.academic_year_id ===
        selectedAcademicYearId
    );

  const currentEnrollment =
    enrollments.find(
      (item) =>
        item.status === 'active'
    ) || enrollments[0];

  const currentClass =
    currentEnrollment?.class?.[0]?.name ||
    'Not enrolled';

  const currentProgramme =
    currentEnrollment
      ?.programme?.[0]?.name ||
    'Not assigned';

  const selectedYear =
    academicYears.find(
      (year) =>
        year.id ===
        selectedAcademicYearId
    ) || null;

  const semesterAssessments =
    useMemo(() => {
      if (!selectedSemester) {
        return [];
      }

      const startDate =
        selectedSemester.start_date;

      const endDate =
        selectedSemester.end_date;

      return assessments.filter(
        (assessment) => {
          if (
            assessment.term &&
            assessment.term ===
              selectedSemester.name
          ) {
            if (
              !startDate ||
              !endDate
            ) {
              return true;
            }
          }

          if (
            startDate &&
            endDate &&
            assessment.created_at
          ) {
            const assessmentDate =
              assessment.created_at.slice(
                0,
                10
              );

            return (
              assessmentDate >=
                startDate &&
              assessmentDate <=
                endDate
            );
          }

          return (
            assessment.term ===
            selectedSemester.name
          );
        }
      );
    }, [
      assessments,
      selectedSemester,
    ]);

  const semesterAttendance =
    useMemo(() => {
      if (!selectedSemester) {
        return [];
      }

      const startDate =
        selectedSemester.start_date;

      const endDate =
        selectedSemester.end_date;

      if (!startDate || !endDate) {
        return attendance;
      }

      return attendance.filter(
        (record) =>
          record.date >= startDate &&
          record.date <= endDate
      );
    }, [
      attendance,
      selectedSemester,
    ]);

  const subjectResults =
    useMemo(() => {
      const subjectMap: Record<
        string,
        {
          caRaw: number;
          examRaw: number;
        }
      > = {};

      semesterAssessments.forEach(
        (assessment) => {
          if (
            !subjectMap[
              assessment.subject
            ]
          ) {
            subjectMap[
              assessment.subject
            ] = {
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

      return Object.entries(
        subjectMap
      )
        .map(
          ([subject, values]) => {
            const caContribution =
              (values.caRaw / 100) *
              30;

            const examContribution =
              (values.examRaw / 100) *
              70;

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
              grade:
                getGrade(finalScore),
              status:
                getStatus(finalScore),
            };
          }
        )
        .sort((a, b) =>
          a.subject.localeCompare(
            b.subject
          )
        );
    }, [
      semesterAssessments,
    ]);

  const overallAverage =
    subjectResults.length > 0
      ? subjectResults.reduce(
          (sum, item) =>
            sum + item.finalScore,
          0
        ) /
        subjectResults.length
      : 0;

  const totalAttendance =
    semesterAttendance.length;

  const presentCount =
    semesterAttendance.filter(
      (item) =>
        item.status.toLowerCase() ===
        'present'
    ).length;

  const absentCount =
    semesterAttendance.filter(
      (item) =>
        item.status.toLowerCase() ===
        'absent'
    ).length;

  const lateCount =
    semesterAttendance.filter(
      (item) =>
        item.status.toLowerCase() ===
        'late'
    ).length;

  const excusedCount =
    semesterAttendance.filter(
      (item) =>
        item.status.toLowerCase() ===
        'excused'
    ).length;

  const attendedCount =
    presentCount + lateCount;

  const attendancePercentage =
    totalAttendance > 0
      ? (attendedCount /
          totalAttendance) *
        100
      : 0;

  function handleAcademicYearChange(
    value: string
  ) {
    setSelectedAcademicYearId(value);

    const firstSemester =
      semesters.find(
        (semester) =>
          semester.academic_year_id ===
          value
      );

    setSelectedSemesterId(
      firstSemester?.id || ''
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
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
        <div className="mx-auto max-w-6xl">
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
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Student Profile
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Complete student information, academic history,
                semester results, attendance and report-card details.
              </p>
            </div>

            <Link
              href="/students"
              className="inline-flex w-fit rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Back to Students
            </Link>
          </div>
        </div>

        {/* Student Overview */}
        <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">

            <div className="flex justify-center sm:justify-start">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.full_name}
                  className="h-28 w-28 rounded-2xl object-cover ring-4 ring-slate-100"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-slate-100 text-4xl">
                  👤
                </div>
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900">
                {student.full_name}
              </h2>

              <p className="mt-1 text-slate-500">
                {student.admission_number}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  {currentClass}
                </span>

                <span className="rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">
                  {currentProgramme}
                </span>

                <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium capitalize text-green-700">
                  {student.status}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Academic Period Selector */}
        <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              📚 Academic Period
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select an academic year and semester to view the student's
              semester-specific results and attendance.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Academic Year
              </label>

              <select
                value={selectedAcademicYearId}
                onChange={(e) =>
                  handleAcademicYearChange(
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
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
                      {year.is_current
                        ? ' (Current)'
                        : ''}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Semester
              </label>

              <select
                value={selectedSemesterId}
                onChange={(e) =>
                  setSelectedSemesterId(
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">
                  Select Semester
                </option>

                {semesterOptions.map(
                  (semester) => (
                    <option
                      key={semester.id}
                      value={semester.id}
                    >
                      {semester.name}
                      {semester.is_current
                        ? ' (Current)'
                        : ''}
                    </option>
                  )
                )}
              </select>
            </div>

          </div>

          {selectedYear && selectedSemester && (
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Viewing
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {selectedYear.name} — {selectedSemester.name}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {formatDate(selectedSemester.start_date)}
                {' '}to{' '}
                {formatDate(selectedSemester.end_date)}
              </p>
            </div>
          )}
        </div>

        {/* Personal Information */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 text-lg font-bold text-slate-900">
            Personal Information
          </h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">

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

            <div>
              <p className="text-xs font-medium uppercase text-slate-400">
                Status
              </p>
              <p className="mt-1 font-semibold capitalize text-slate-800">
                {student.status}
              </p>
            </div>

          </div>
        </div>

        {/* Guardian Information */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 text-lg font-bold text-slate-900">
            Guardian Information
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

            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase text-slate-400">
                Address
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {student.address ||
                  'Not provided'}
              </p>
            </div>

          </div>
        </div>

        {/* Report Card Information */}
        <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              📋 Report Card Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              These details will appear on the student's official report card.
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
                onChange={(e) =>
                  setForm({
                    ...form,
                    photo_url:
                      e.target.value,
                  })
                }
                placeholder="Paste the student's photo URL"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />

              <p className="mt-1 text-xs text-slate-400">
                Direct photo upload can be connected later.
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Conduct / Attitude
              </label>

              <select
                value={form.conduct}
                onChange={(e) =>
                  setForm({
                    ...form,
                    conduct:
                      e.target.value,
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
                onChange={(e) =>
                  setForm({
                    ...form,
                    promotion_status:
                      e.target.value,
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
                onChange={(e) =>
                  setForm({
                    ...form,
                    class_teacher_remark:
                      e.target.value,
                  })
                }
                rows={4}
                placeholder="Enter class teacher's remark..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                HOD / Head's Remark
              </label>

              <textarea
                value={form.hod_remark}
                onChange={(e) =>
                  setForm({
                    ...form,
                    hod_remark:
                      e.target.value,
                  })
                }
                rows={4}
                placeholder="Enter HOD / Head's remark..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Next Semester Begins
              </label>

              <input
                type="date"
                value={form.next_term_begins}
                onChange={(e) =>
                  setForm({
                    ...form,
                    next_term_begins:
                      e.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={saveReportCardInfo}
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {saving
                ? 'Saving...'
                : '💾 Save Report Card Information'}
            </button>

          </div>
        </div>

        {/* Academic History */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              🏫 Academic History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Previous and current enrollments are preserved here.
            </p>
          </div>

          {enrollments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No enrollment history found.
            </p>
          ) : (
            <div className="space-y-3">
              {enrollments.map(
                (enrollment) => (
                  <div
                    key={enrollment.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {enrollment.class?.[0]?.name ||
                              'Class not available'}
                          </p>

                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              enrollment.status ===
                              'active'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {enrollment.status}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {enrollment.programme?.[0]?.name ||
                            'Programme not available'}
                        </p>

                        {enrollment.programme?.[0]?.code && (
                          <p className="mt-1 text-xs text-slate-400">
                            Code: {enrollment.programme[0].code}
                          </p>
                        )}
                      </div>

                      <div className="text-left text-sm sm:text-right">
                        <p className="font-medium text-slate-700">
                          {enrollment.academic_year?.[0]?.name ||
                            'Academic year unavailable'}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Enrolled:{' '}
                          {formatDate(
                            enrollment.enrollment_date
                          )}
                        </p>
                      </div>

                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Semester Attendance */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                📅 Semester Attendance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {selectedSemester
                  ? `${selectedSemester.name} attendance`
                  : 'Select an academic period above'}
              </p>
            </div>

            <Link
              href="/attendance"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Manage Attendance →
            </Link>

          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Recorded
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {totalAttendance}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-xs text-green-700">
                Present
              </p>

              <p className="mt-1 text-2xl font-bold text-green-700">
                {presentCount}
              </p>
            </div>

            <div className="rounded-xl bg-yellow-50 p-4">
              <p className="text-xs text-yellow-700">
                Late
              </p>

              <p className="mt-1 text-2xl font-bold text-yellow-700">
                {lateCount}
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-xs text-red-700">
                Absent
              </p>

              <p className="mt-1 text-2xl font-bold text-red-700">
                {absentCount}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs text-blue-700">
                Excused
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-700">
                {excusedCount}
              </p>
            </div>

            <div className="rounded-xl bg-purple-50 p-4">
              <p className="text-xs text-purple-700">
                Attended
              </p>

              <p className="mt-1 text-2xl font-bold text-purple-700">
                {attendedCount}
              </p>
            </div>

          </div>

          <div className="mt-5">

            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-600">
                Attendance Percentage
              </span>

              <span className="font-bold text-slate-900">
                {attendancePercentage.toFixed(1)}%
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-green-500"
                style={{
                  width: `${Math.min(
                    attendancePercentage,
                    100
                  )}%`,
                }}
              />
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Attendance percentage is calculated using Present + Late as attended.
            </p>

          </div>

          {semesterAttendance.length > 0 ? (
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
                  {semesterAttendance.map(
                    (record) => (
                      <tr
                        key={record.id}
                        className="border-b border-slate-100"
                      >
                        <td className="px-3 py-3">
                          {formatDate(
                            record.date
                          )}
                        </td>

                        <td className="px-3 py-3 capitalize">
                          {record.status}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>

              </table>

            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-500">
              No attendance records found for the selected semester.
            </p>
          )}

        </div>

        {/* Semester Results */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                📊 Semester Result
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Results for{' '}
                {selectedYear?.name ||
                  'selected academic year'}
                {' — '}
                {selectedSemester?.name ||
                  'selected semester'}
              </p>
            </div>

            <Link
              href="/assessment"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Manage Assessments →
            </Link>

          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Assessments
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {semesterAssessments.length}
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

            <div className="rounded-xl bg-purple-50 p-4">
              <p className="text-sm text-purple-700">
                Subjects
              </p>

              <p className="mt-1 text-2xl font-bold text-purple-700">
                {subjectResults.length}
              </p>
            </div>

          </div>

          {subjectResults.length > 0 ? (
            <div className="mt-6 overflow-x-auto">

              <table className="min-w-full text-left text-sm">

                <thead>
                  <tr className="border-b border-slate-200">

                    <th className="px-3 py-3 font-semibold text-slate-600">
                      Subject
                    </th>

                    <th className="px-3 py-3 font-semibold text-slate-600">
                      CA Raw
                    </th>

                    <th className="px-3 py-3 font-semibold text-slate-600">
                      CA / 30
                    </th>

                    <th className="px-3 py-3 font-semibold text-slate-600">
                      Exam / 100
                    </th>

                    <th className="px-3 py-3 font-semibold text-slate-600">
                      Exam / 70
                    </th>

                    <th className="px-3 py-3 font-semibold text-slate-600">
                      Final / 100
                    </th>

                    <th className="px-3 py-3 font-semibold text-slate-600">
                      Grade
                    </th>

                    <th className="px-3 py-3 font-semibold text-slate-600">
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

                        <td className="px-3 py-3 font-semibold text-slate-900">
                          {result.subject}
                        </td>

                        <td className="px-3 py-3">
                          {result.caRaw.toFixed(1)}
                        </td>

                        <td className="px-3 py-3">
                          {result.caContribution.toFixed(1)}
                        </td>

                        <td className="px-3 py-3">
                          {result.examRaw.toFixed(1)}
                        </td>

                        <td className="px-3 py-3">
                          {result.examContribution.toFixed(1)}
                        </td>

                        <td className="px-3 py-3 font-bold">
                          {result.finalScore.toFixed(1)}
                        </td>

                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-lg bg-slate-100 px-3 py-1 font-bold text-slate-800">
                            {result.grade}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              result.status ===
                              'Pass'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
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
          ) : (
            <p className="mt-6 text-sm text-slate-500">
              No assessment results have been recorded for the selected semester.
            </p>
          )}

        </div>

        {/* Conduct and Promotion */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">

          <h2 className="mb-5 text-lg font-bold text-slate-900">
            📝 Conduct & Promotion
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase text-slate-400">
                Conduct / Attitude
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {student.conduct ||
                  'Not recorded'}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase text-slate-400">
                Promotion Status
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {student.promotion_status ||
                  'Not recorded'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase text-slate-400">
                Class Teacher's Remark
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-700">
                {student.class_teacher_remark ||
                  'No remark recorded.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase text-slate-400">
                HOD / Head's Remark
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-700">
                {student.hod_remark ||
                  'No remark recorded.'}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4 sm:col-span-2">
              <p className="text-xs font-medium uppercase text-blue-600">
                Next Semester Begins
              </p>

              <p className="mt-2 font-semibold text-blue-900">
                {formatDate(
                  student.next_term_begins
                )}
              </p>
            </div>

          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">

          <Link
            href={`/students/${student.id}/edit`}
            className="rounded-xl bg-blue-600 px-6 py-3 text-center font-semibold text-white hover:bg-blue-700"
          >
            ✏️ Edit Student
          </Link>

          <Link
            href={`/report-card/${student.id}`}
            className="rounded-xl bg-slate-900 px-6 py-3 text-center font-semibold text-white hover:bg-slate-800"
          >
            📄 View Report Card
          </Link>

          <Link
            href="/promotion"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
          >
            ⬆️ Student Promotion
          </Link>

        </div>

      </div>
    </div>
  );
}

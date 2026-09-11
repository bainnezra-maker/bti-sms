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

type DisciplineAction = {
  id: string;
  student_id: string;
  action_type:
    | 'bond'
    | 'suspension'
    | 'dismissal'
    | 'reinstatement';
  action_date: string;
  suspension_start_date: string | null;
  suspension_end_date: string | null;
  bond_details: string | null;
  bond_conditions: string | null;
  bond_review_date: string | null;
  reason: string | null;
  notes: string | null;
  recorded_by: string | null;
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

function getActionLabel(
  actionType: DisciplineAction['action_type']
) {
  switch (actionType) {
    case 'bond':
      return 'Bond';
    case 'suspension':
      return 'Suspension';
    case 'dismissal':
      return 'Permanent Dismissal';
    case 'reinstatement':
      return 'Reinstatement';
    default:
      return actionType;
  }
}

function getActionIcon(
  actionType: DisciplineAction['action_type']
) {
  switch (actionType) {
    case 'bond':
      return 'fa-file-signature';
    case 'suspension':
      return 'fa-user-clock';
    case 'dismissal':
      return 'fa-user-slash';
    case 'reinstatement':
      return 'fa-user-check';
    default:
      return 'fa-circle-info';
  }
}

function getActionBadgeClass(
  actionType: DisciplineAction['action_type']
) {
  switch (actionType) {
    case 'bond':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'suspension':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'dismissal':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'reinstatement':
      return 'bg-green-50 text-green-700 border-green-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
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

  const [disciplineActions, setDisciplineActions] =
    useState<DisciplineAction[]>([]);

  const [selectedAcademicYearId, setSelectedAcademicYearId] =
    useState('');

  const [selectedSemesterId, setSelectedSemesterId] =
    useState('');

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [disciplineSaving, setDisciplineSaving] =
    useState(false);

  const [showDisciplineModal, setShowDisciplineModal] =
    useState(false);

  const [showDisciplineHistory, setShowDisciplineHistory] =
    useState(false);

  const [disciplineModalType, setDisciplineModalType] =
    useState<
      'bond' |
      'suspension' |
      'dismissal' |
      'reinstatement'
    >('bond');

  const [disciplineForm, setDisciplineForm] =
    useState({
      action_date: new Date()
        .toISOString()
        .slice(0, 10),
      suspension_start_date: '',
      suspension_end_date: '',
      bond_details: '',
      bond_conditions: '',
      bond_review_date: '',
      reason: '',
      notes: '',
    });

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

    await loadDisciplineActions();

    setLoading(false);
  }

  async function loadDisciplineActions() {
    const {
      data,
      error,
    } = await supabase
      .from('student_disciplinary_actions')
      .select(`
        id,
        student_id,
        action_type,
        action_date,
        suspension_start_date,
        suspension_end_date,
        bond_details,
        bond_conditions,
        bond_review_date,
        reason,
        notes,
        recorded_by,
        created_at
      `)
      .eq('student_id', studentId)
      .order('action_date', {
        ascending: false,
      })
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      console.error(
        'Disciplinary history loading error:',
        error
      );

      setDisciplineActions([]);
      return;
    }

    setDisciplineActions(
      (data || []) as DisciplineAction[]
    );
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

  function openDisciplineModal(
    type:
      | 'bond'
      | 'suspension'
      | 'dismissal'
      | 'reinstatement'
  ) {
    setDisciplineModalType(type);

    setDisciplineForm({
      action_date: new Date()
        .toISOString()
        .slice(0, 10),
      suspension_start_date:
        type === 'suspension'
          ? new Date()
              .toISOString()
              .slice(0, 10)
          : '',
      suspension_end_date: '',
      bond_details: '',
      bond_conditions: '',
      bond_review_date: '',
      reason: '',
      notes: '',
    });

    setShowDisciplineModal(true);
  }

  function closeDisciplineModal() {
    if (disciplineSaving) return;

    setShowDisciplineModal(false);
  }

  async function saveDisciplineAction() {
    if (!student) return;

    if (
      disciplineModalType ===
        'bond' &&
      !disciplineForm.bond_details.trim()
    ) {
      alert(
        'Please describe what the student has agreed not to do.'
      );
      return;
    }

    if (
      disciplineModalType ===
        'suspension' &&
      !disciplineForm.suspension_start_date
    ) {
      alert(
        'Please enter the suspension start date.'
      );
      return;
    }

    if (
      disciplineModalType ===
        'suspension' &&
      !disciplineForm.suspension_end_date
    ) {
      alert(
        'Please enter the suspension end date.'
      );
      return;
    }

    if (
      disciplineModalType ===
        'suspension' &&
      disciplineForm.suspension_end_date <
        disciplineForm.suspension_start_date
    ) {
      alert(
        'Suspension end date cannot be earlier than the start date.'
      );
      return;
    }

    if (
      disciplineModalType ===
        'dismissal' &&
      !disciplineForm.reason.trim()
    ) {
      alert(
        'Please enter the reason for permanent dismissal.'
      );
      return;
    }

    if (
      disciplineModalType ===
        'reinstatement' &&
      !disciplineForm.reason.trim()
    ) {
      alert(
        'Please enter the reason or authorization for reinstatement.'
      );
      return;
    }

    setDisciplineSaving(true);

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

      const payload = {
        student_id: student.id,
        action_type: disciplineModalType,
        action_date:
          disciplineForm.action_date ||
          new Date()
            .toISOString()
            .slice(0, 10),
        suspension_start_date:
          disciplineModalType ===
          'suspension'
            ? disciplineForm.suspension_start_date ||
              null
            : null,
        suspension_end_date:
          disciplineModalType ===
          'suspension'
            ? disciplineForm.suspension_end_date ||
              null
            : null,
        bond_details:
          disciplineModalType === 'bond'
            ? disciplineForm.bond_details.trim() ||
              null
            : null,
        bond_conditions:
          disciplineModalType === 'bond'
            ? disciplineForm.bond_conditions.trim() ||
              null
            : null,
        bond_review_date:
          disciplineModalType === 'bond'
            ? disciplineForm.bond_review_date ||
              null
            : null,
        reason:
          disciplineForm.reason.trim() ||
          null,
        notes:
          disciplineForm.notes.trim() ||
          null,
        recorded_by: user.id,
      };

      const {
        error,
      } = await supabase
        .from('student_disciplinary_actions')
        .insert(payload);

      if (error) {
        console.error(
          'Discipline save error:',
          error
        );

        alert(
          `Could not save the disciplinary record:\n\n${error.message}`
        );

        return;
      }

      await loadDisciplineActions();

      setShowDisciplineModal(false);

      alert(
        `${getActionLabel(
          disciplineModalType
        )} recorded successfully.`
      );
    } catch (error) {
      console.error(
        'Unexpected discipline save error:',
        error
      );

      alert(
        'An unexpected error occurred while saving the disciplinary record.'
      );
    } finally {
      setDisciplineSaving(false);
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

  const sortedDisciplineActions =
    useMemo(() => {
      return [...disciplineActions].sort(
        (a, b) => {
          const dateA =
            `${a.action_date} ${a.created_at}`;
          const dateB =
            `${b.action_date} ${b.created_at}`;

          return dateB.localeCompare(dateA);
        }
      );
    }, [disciplineActions]);

  const latestDisciplineAction =
    sortedDisciplineActions[0] || null;

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const hasLaterReinstatement =
    latestDisciplineAction?.action_type ===
    'reinstatement';

  const activeSuspension =
    !hasLaterReinstatement &&
    latestDisciplineAction?.action_type ===
      'suspension' &&
    !!latestDisciplineAction.suspension_start_date &&
    !!latestDisciplineAction.suspension_end_date &&
    latestDisciplineAction.suspension_start_date <=
      today &&
    latestDisciplineAction.suspension_end_date >=
      today;

  const activeBond =
    !hasLaterReinstatement &&
    latestDisciplineAction?.action_type ===
      'bond' &&
    (
      !latestDisciplineAction.bond_review_date ||
      latestDisciplineAction.bond_review_date >=
        today
    );

  const permanentlyDismissed =
    !hasLaterReinstatement &&
    latestDisciplineAction?.action_type ===
      'dismissal';

  const disciplineStatus = activeSuspension
    ? 'Suspended'
    : permanentlyDismissed
    ? 'Permanently Dismissed'
    : activeBond
    ? 'Bond Active'
    : 'No Active Disciplinary Action';

  const disciplineStatusClass =
    activeSuspension
      ? 'border-orange-200 bg-orange-50 text-orange-800'
      : permanentlyDismissed
      ? 'border-red-200 bg-red-50 text-red-800'
      : activeBond
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-green-200 bg-green-50 text-green-800';

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
    <div className="min-h-screen bg-slate-50 p-4 font-sans sm:p-6">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Student Profile
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Complete student information, academic history,
                semester results, attendance, discipline and report-card details.
              </p>
            </div>

            <Link
              href="/students"
              className="inline-flex w-fit rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <i className="fa-solid fa-arrow-left mr-2" />
              Back to Students
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
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-slate-100 text-3xl text-slate-400">
                  <i className="fa-solid fa-user" />
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

        {/* Discipline Status */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <i className="fa-solid fa-shield-halved" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Conduct & Discipline
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Official disciplinary records, bonds, suspensions and student conduct actions.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowDisciplineHistory(
                  !showDisciplineHistory
                )
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <i className="fa-solid fa-clock-rotate-left mr-2" />
              {showDisciplineHistory
                ? 'Hide History'
                : 'View History'}
            </button>
          </div>

          {/* Current Status */}
          <div
            className={`rounded-xl border p-4 ${disciplineStatusClass}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80">
                  <i
                    className={`fa-solid ${
                      activeSuspension
                        ? 'fa-user-clock'
                        : permanentlyDismissed
                        ? 'fa-user-slash'
                        : activeBond
                        ? 'fa-file-signature'
                        : 'fa-circle-check'
                    }`}
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                    Current Discipline Status
                  </p>

                  <p className="mt-1 text-lg font-bold">
                    {disciplineStatus}
                  </p>
                </div>
              </div>

              {activeSuspension &&
                latestDisciplineAction && (
                  <div className="text-left text-sm sm:text-right">
                    <p className="font-semibold">
                      {formatDate(
                        latestDisciplineAction.suspension_start_date
                      )}{' '}
                      —{' '}
                      {formatDate(
                        latestDisciplineAction.suspension_end_date
                      )}
                    </p>

                    <p className="mt-1 text-xs opacity-75">
                      Suspension period
                    </p>
                  </div>
                )}

              {activeBond &&
                latestDisciplineAction && (
                  <div className="text-left text-sm sm:text-right">
                    <p className="font-semibold">
                      Bond recorded{' '}
                      {formatDate(
                        latestDisciplineAction.action_date
                      )}
                    </p>

                    <p className="mt-1 text-xs opacity-75">
                      {latestDisciplineAction.bond_review_date
                        ? `Review: ${formatDate(
                            latestDisciplineAction.bond_review_date
                          )}`
                        : 'No review date specified'}
                    </p>
                  </div>
                )}
            </div>

            {activeBond &&
              latestDisciplineAction?.bond_details && (
                <div className="mt-4 border-t border-current/10 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                    Bond Agreement
                  </p>

                  <p className="mt-2 text-sm font-medium leading-6">
                    {latestDisciplineAction.bond_details}
                  </p>

                  {latestDisciplineAction.bond_conditions && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                        Bond Conditions
                      </p>

                      <p className="mt-1 text-sm leading-6">
                        {latestDisciplineAction.bond_conditions}
                      </p>
                    </div>
                  )}
                </div>
              )}

            {permanentlyDismissed &&
              latestDisciplineAction?.reason && (
                <div className="mt-4 border-t border-current/10 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                    Reason
                  </p>

                  <p className="mt-1 text-sm leading-6">
                    {latestDisciplineAction.reason}
                  </p>
                </div>
              )}
          </div>

          {/* Action Buttons */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <button
              type="button"
              onClick={() =>
                openDisciplineModal('bond')
              }
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              <i className="fa-solid fa-file-signature mr-2" />
              Record Bond
              <span className="mt-1 block text-xs font-normal opacity-75">
                Record a student's formal undertaking.
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                openDisciplineModal('suspension')
              }
              className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-left font-semibold text-orange-800 transition hover:bg-orange-100"
            >
              <i className="fa-solid fa-user-clock mr-2" />
              Record Suspension
              <span className="mt-1 block text-xs font-normal opacity-75">
                Record suspension dates and reason.
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                openDisciplineModal('dismissal')
              }
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left font-semibold text-red-800 transition hover:bg-red-100"
            >
              <i className="fa-solid fa-user-slash mr-2" />
              Permanent Dismissal
              <span className="mt-1 block text-xs font-normal opacity-75">
                Record an official dismissal decision.
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                openDisciplineModal('reinstatement')
              }
              className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-left font-semibold text-green-800 transition hover:bg-green-100"
            >
              <i className="fa-solid fa-user-check mr-2" />
              Reinstate Student
              <span className="mt-1 block text-xs font-normal opacity-75">
                Record an authorized reinstatement.
              </span>
            </button>

          </div>

          {/* History */}
          {showDisciplineHistory && (
            <div className="mt-6 border-t border-slate-200 pt-6">

              <div className="mb-4">
                <h3 className="font-bold text-slate-900">
                  Disciplinary History
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Previous disciplinary records are preserved and are not automatically overwritten.
                </p>
              </div>

              {sortedDisciplineActions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                    <i className="fa-solid fa-shield-halved" />
                  </div>

                  <p className="mt-3 font-semibold text-slate-700">
                    No disciplinary records
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    No bond, suspension, dismissal or reinstatement has been recorded for this student.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedDisciplineActions.map(
                    (action) => (
                      <div
                        key={action.id}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                          <div className="flex gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                              <i
                                className={`fa-solid ${getActionIcon(
                                  action.action_type
                                )}`}
                              />
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-slate-900">
                                  {getActionLabel(
                                    action.action_type
                                  )}
                                </h4>

                                <span
                                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getActionBadgeClass(
                                    action.action_type
                                  )}`}
                                >
                                  {action.action_type ===
                                  'reinstatement'
                                    ? 'Status Restored'
                                    : 'Recorded'}
                                </span>
                              </div>

                              <p className="mt-1 text-sm text-slate-500">
                                Action date:{' '}
                                {formatDate(
                                  action.action_date
                                )}
                              </p>
                            </div>
                          </div>

                        </div>

                        {action.action_type ===
                          'bond' && (
                          <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl bg-amber-50 p-4 sm:grid-cols-2">

                            <div className="sm:col-span-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                Student Agreed Not To
                              </p>

                              <p className="mt-1 text-sm leading-6 text-slate-700">
                                {action.bond_details ||
                                  'Not specified'}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                Conditions
                              </p>

                              <p className="mt-1 text-sm leading-6 text-slate-700">
                                {action.bond_conditions ||
                                  'No additional conditions recorded.'}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                Review Date
                              </p>

                              <p className="mt-1 text-sm font-semibold text-slate-700">
                                {formatDate(
                                  action.bond_review_date
                                )}
                              </p>
                            </div>

                          </div>
                        )}

                        {action.action_type ===
                          'suspension' && (
                          <div className="mt-4 rounded-xl bg-orange-50 p-4">

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                                  Suspension Start
                                </p>

                                <p className="mt-1 text-sm font-semibold text-slate-700">
                                  {formatDate(
                                    action.suspension_start_date
                                  )}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                                  Suspension End
                                </p>

                                <p className="mt-1 text-sm font-semibold text-slate-700">
                                  {formatDate(
                                    action.suspension_end_date
                                  )}
                                </p>
                              </div>

                              {action.reason && (
                                <div className="sm:col-span-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                                    Reason
                                  </p>

                                  <p className="mt-1 text-sm leading-6 text-slate-700">
                                    {action.reason}
                                  </p>
                                </div>
                              )}

                            </div>

                          </div>
                        )}

                        {action.action_type ===
                          'dismissal' &&
                          action.reason && (
                            <div className="mt-4 rounded-xl bg-red-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                                Reason for Permanent Dismissal
                              </p>

                              <p className="mt-1 text-sm leading-6 text-slate-700">
                                {action.reason}
                              </p>
                            </div>
                          )}

                        {action.action_type ===
                          'reinstatement' &&
                          action.reason && (
                            <div className="mt-4 rounded-xl bg-green-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                                Reinstatement Remarks
                              </p>

                              <p className="mt-1 text-sm leading-6 text-slate-700">
                                {action.reason}
                              </p>
                            </div>
                          )}

                        {action.notes && (
                          <div className="mt-4 border-t border-slate-100 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Notes
                            </p>

                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {action.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Academic Period Selector */}
        <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              <i className="fa-solid fa-book-open mr-2 text-blue-600" />
              Academic Period
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
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
              <i className="fa-solid fa-file-lines mr-2 text-blue-600" />
              Report Card Information
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
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              onClick={saveReportCardInfo}
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <i
                className={`fa-solid ${
                  saving
                    ? 'fa-spinner fa-spin'
                    : 'fa-floppy-disk'
                } mr-2`}
              />
              {saving
                ? 'Saving...'
                : 'Save Report Card Information'}
            </button>

          </div>
        </div>

        {/* Academic History */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">

          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              <i className="fa-solid fa-school mr-2 text-slate-600" />
              Academic History
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
                    className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"
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
                <i className="fa-solid fa-calendar-check mr-2 text-green-600" />
                Semester Attendance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {selectedSemester
                  ? `${selectedSemester.name} attendance`
                  : 'Select an academic period above'}
              </p>
            </div>

            <Link
              href="/attendance"
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
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
                className="h-full rounded-full bg-green-500 transition-all"
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
                <i className="fa-solid fa-chart-column mr-2 text-purple-600" />
                Semester Result
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
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
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
            <i className="fa-solid fa-clipboard-check mr-2 text-slate-600" />
            Conduct & Promotion
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
            className="rounded-xl bg-blue-600 px-6 py-3 text-center font-semibold text-white transition hover:bg-blue-700"
          >
            <i className="fa-solid fa-pen-to-square mr-2" />
            Edit Student
          </Link>

          <Link
            href={`/report-card/${student.id}`}
            className="rounded-xl bg-slate-900 px-6 py-3 text-center font-semibold text-white transition hover:bg-slate-800"
          >
            <i className="fa-solid fa-file-lines mr-2" />
            View Report Card
          </Link>

          <Link
            href="/promotion"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <i className="fa-solid fa-arrow-up mr-2" />
            Student Promotion
          </Link>

        </div>

      </div>

      {/* Discipline Modal */}
      {showDisciplineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">

          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">

              <div className="flex items-center justify-between gap-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <i
                      className={`fa-solid ${getActionIcon(
                        disciplineModalType
                      )}`}
                    />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Record{' '}
                      {getActionLabel(
                        disciplineModalType
                      )}
                    </h2>

                    <p className="text-sm text-slate-500">
                      {student.full_name}
                    </p>
                  </div>

                </div>

                <button
                  type="button"
                  onClick={
                    closeDisciplineModal
                  }
                  disabled={
                    disciplineSaving
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                >
                  <i className="fa-solid fa-xmark" />
                </button>

              </div>

            </div>

            <div className="space-y-5 p-5 sm:p-6">

              {/* Action Date */}
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Action Date
                </label>

                <input
                  type="date"
                  value={
                    disciplineForm.action_date
                  }
                  onChange={(e) =>
                    setDisciplineForm({
                      ...disciplineForm,
                      action_date:
                        e.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Bond */}
              {disciplineModalType ===
                'bond' && (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex gap-3">
                      <i className="fa-solid fa-circle-info mt-0.5 text-amber-600" />

                      <div>
                        <p className="font-semibold text-amber-900">
                          Bond Agreement
                        </p>

                        <p className="mt-1 text-sm leading-6 text-amber-800">
                          Record the specific conduct or action the student has agreed not to repeat.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      What has the student agreed not to do?
                    </label>

                    <textarea
                      value={
                        disciplineForm.bond_details
                      }
                      onChange={(e) =>
                        setDisciplineForm({
                          ...disciplineForm,
                          bond_details:
                            e.target.value,
                        })
                      }
                      rows={4}
                      placeholder="Example: The student has agreed not to engage in fighting, bullying or physical aggression toward other students."
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Bond Conditions
                    </label>

                    <textarea
                      value={
                        disciplineForm.bond_conditions
                      }
                      onChange={(e) =>
                        setDisciplineForm({
                          ...disciplineForm,
                          bond_conditions:
                            e.target.value,
                        })
                      }
                      rows={4}
                      placeholder="Enter any conditions attached to the bond..."
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Bond Review Date
                    </label>

                    <input
                      type="date"
                      value={
                        disciplineForm.bond_review_date
                      }
                      onChange={(e) =>
                        setDisciplineForm({
                          ...disciplineForm,
                          bond_review_date:
                            e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </>
              )}

              {/* Suspension */}
              {disciplineModalType ===
                'suspension' && (
                <>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        Suspension Start Date
                      </label>

                      <input
                        type="date"
                        value={
                          disciplineForm.suspension_start_date
                        }
                        onChange={(e) =>
                          setDisciplineForm({
                            ...disciplineForm,
                            suspension_start_date:
                              e.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        Suspension End Date
                      </label>

                      <input
                        type="date"
                        value={
                          disciplineForm.suspension_end_date
                        }
                        onChange={(e) =>
                          setDisciplineForm({
                            ...disciplineForm,
                            suspension_end_date:
                              e.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Reason for Suspension
                    </label>

                    <textarea
                      value={
                        disciplineForm.reason
                      }
                      onChange={(e) =>
                        setDisciplineForm({
                          ...disciplineForm,
                          reason:
                            e.target.value,
                        })
                      }
                      rows={4}
                      placeholder="Enter the reason for the suspension..."
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </>
              )}

              {/* Dismissal */}
              {disciplineModalType ===
                'dismissal' && (
                <>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="flex gap-3">
                      <i className="fa-solid fa-triangle-exclamation mt-0.5 text-red-600" />

                      <div>
                        <p className="font-semibold text-red-900">
                          Permanent Dismissal
                        </p>

                        <p className="mt-1 text-sm leading-6 text-red-800">
                          This creates an official permanent dismissal record. The student's existing academic history will remain preserved.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Reason for Permanent Dismissal
                    </label>

                    <textarea
                      value={
                        disciplineForm.reason
                      }
                      onChange={(e) =>
                        setDisciplineForm({
                          ...disciplineForm,
                          reason:
                            e.target.value,
                        })
                      }
                      rows={5}
                      placeholder="Enter the official reason for the dismissal..."
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </>
              )}

              {/* Reinstatement */}
              {disciplineModalType ===
                'reinstatement' && (
                <>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="flex gap-3">
                      <i className="fa-solid fa-circle-check mt-0.5 text-green-600" />

                      <div>
                        <p className="font-semibold text-green-900">
                          Reinstatement
                        </p>

                        <p className="mt-1 text-sm leading-6 text-green-800">
                          Record the authorized decision to restore the student's active standing.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Reinstatement Reason / Authorization
                    </label>

                    <textarea
                      value={
                        disciplineForm.reason
                      }
                      onChange={(e) =>
                        setDisciplineForm({
                          ...disciplineForm,
                          reason:
                            e.target.value,
                        })
                      }
                      rows={4}
                      placeholder="Enter the reason, authorization or decision supporting reinstatement..."
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Additional Notes
                </label>

                <textarea
                  value={
                    disciplineForm.notes
                  }
                  onChange={(e) =>
                    setDisciplineForm({
                      ...disciplineForm,
                      notes:
                        e.target.value,
                    })
                  }
                  rows={4}
                  placeholder="Add any additional official notes..."
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={
                    closeDisciplineModal
                  }
                  disabled={
                    disciplineSaving
                  }
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    saveDisciplineAction
                  }
                  disabled={
                    disciplineSaving
                  }
                  className={`rounded-xl px-5 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    disciplineModalType ===
                    'dismissal'
                      ? 'bg-red-600 hover:bg-red-700'
                      : disciplineModalType ===
                        'suspension'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : disciplineModalType ===
                        'bond'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  <i
                    className={`fa-solid ${
                      disciplineSaving
                        ? 'fa-spinner fa-spin'
                        : 'fa-floppy-disk'
                    } mr-2`}
                  />

                  {disciplineSaving
                    ? 'Saving...'
                    : `Save ${getActionLabel(
                        disciplineModalType
                      )}`}
                </button>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

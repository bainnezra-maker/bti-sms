'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import StudentFaceEnrollment from '@/components/student-face-enrollment';

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
  resident: string | null;
  house: string | null;
  health_insurance_number: string | null;
  health_insurance_expiry_date: string | null;
  region: string | null;
  place_of_birth: string | null;
  religion: string | null;
  bece_index_number: string | null;
  health_issues: string | null;
  father_name: string | null;
  father_contact: string | null;
  mother_name: string | null;
  mother_contact: string | null;
  residential_address: string | null;
  digital_address: string | null;
  whatsapp_number: string | null;
  house_number: string | null;
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

const STUDENT_PHOTO_BUCKET = 'student-photos';
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

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

  const [schoolId, setSchoolId] = useState('');

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
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [photoUploading, setPhotoUploading] =
    useState(false);

  const [selectedPhoto, setSelectedPhoto] =
    useState<File | null>(null);

  const [photoPreview, setPhotoPreview] =
    useState<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

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

    const currentSchoolId = userProfile.school_id;

    setSchoolId(currentSchoolId);

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
        next_term_begins,
        resident,
        house,
        health_insurance_number,
        health_insurance_expiry_date,
        region,
        place_of_birth,
        religion,
        bece_index_number,
        health_issues,
        father_name,
        father_contact,
        mother_name,
        mother_contact,
        residential_address,
        digital_address,
        whatsapp_number,
        house_number
      `)
      .eq('id', studentId)
      .eq('school_id', currentSchoolId)
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
      .eq('school_id', currentSchoolId)
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
      (academicYearData || []) as AcademicYear[];

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
      (semesterData || []) as Semester[];

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
      (attendanceData || []) as AttendanceRecord[]
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
      (assessmentData || []) as Assessment[]
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

  function handlePhotoChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.type !== 'image/jpeg' &&
      file.type !== 'image/png'
    ) {
      alert(
        'Please select a JPG or PNG image.'
      );

      event.target.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      alert(
        'The student photo must not be larger than 2 MB.'
      );

      event.target.value = '';
      return;
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    const previewUrl =
      URL.createObjectURL(file);

    setSelectedPhoto(file);
    setPhotoPreview(previewUrl);
  }

  function clearSelectedPhoto() {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setSelectedPhoto(null);
    setPhotoPreview(null);
  }

  async function uploadStudentPhoto(): Promise<
    string | null
  > {
    if (!selectedPhoto || !schoolId || !student) {
      return form.photo_url.trim() || null;
    }

    setPhotoUploading(true);

    try {
      const extension =
        selectedPhoto.type === 'image/png'
          ? 'png'
          : 'jpg';

      const safeStudentName =
        student.full_name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') ||
        'student';

      const uniqueFileName =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}-${safeStudentName}.${extension}`;

      const filePath =
        `${schoolId}/${student.id}/${uniqueFileName}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from(STUDENT_PHOTO_BUCKET)
        .upload(
          filePath,
          selectedPhoto,
          {
            cacheControl: '3600',
            upsert: false,
            contentType:
              selectedPhoto.type,
          }
        );

      if (uploadError) {
        console.error(
          'Student photo upload error:',
          uploadError
        );

        throw new Error(
          `Photo upload failed: ${uploadError.message}`
        );
      }

      const {
        data: publicUrlData,
      } = supabase.storage
        .from(STUDENT_PHOTO_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl =
        publicUrlData.publicUrl;

      if (!publicUrl) {
        throw new Error(
          'The photo was uploaded, but its public URL could not be generated.'
        );
      }

      return publicUrl;
    } finally {
      setPhotoUploading(false);
    }
  }

  async function saveReportCardInfo() {
    if (!student) return;

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      router.push('/login');
      return;
    }

    try {
      const uploadedPhotoUrl =
        await uploadStudentPhoto();

      const finalPhotoUrl =
        uploadedPhotoUrl ||
        form.photo_url.trim() ||
        null;

      const { error } = await supabase
        .from('students')
        .update({
          photo_url: finalPhotoUrl,
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
        })
        .eq('id', student.id);

      if (error) {
        throw new Error(
          `Unable to save report card information: ${error.message}`
        );
      }

      setStudent({
        ...student,
        photo_url: finalPhotoUrl,
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
      });

      setForm({
        ...form,
        photo_url: finalPhotoUrl || '',
      });

      clearSelectedPhoto();

      alert(
        'Report card information saved successfully.'
      );
    } catch (error) {
      console.error(
        'Report card save error:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to save report card information.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function archiveStudent() {
    if (!student) return;

    setDeleteSaving(true);

    try {
      const { data, error } = await supabase.rpc(
        'admin_archive_student',
        { p_student_id: student.id }
      );

      if (error) throw new Error(error.message);

      const result = data as { message?: string } | null;
      alert(result?.message || 'Student archived successfully. School history was preserved.');

      setShowDeleteModal(false);
      setDeleteConfirmation('');
      router.push('/students');
      router.refresh();
    } catch (error) {
      console.error('Student delete/archive error:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Unable to delete or archive this student.'
      );
    } finally {
      setDeleteSaving(false);
    }
  }

  async function permanentlyDeleteStudent() {
    if (!student || deleteConfirmation !== 'DELETE') return;

    setDeleteSaving(true);

    try {
      const { data, error } = await supabase.rpc(
        'admin_permanently_delete_student',
        { p_student_id: student.id }
      );

      if (error) throw new Error(error.message);

      const result = data as { message?: string } | null;
      alert(result?.message || 'Student and associated school records were permanently deleted.');

      setShowDeleteModal(false);
      setDeleteConfirmation('');
      router.push('/students');
      router.refresh();
    } catch (error) {
      console.error('Permanent student delete error:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Unable to permanently delete this student.'
      );
    } finally {
      setDeleteSaving(false);
    }
  }

  function openDisciplineModal(
    type: DisciplineAction['action_type']
  ) {
    setDisciplineModalType(type);

    setDisciplineForm({
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

    setShowDisciplineModal(true);
  }

  async function saveDisciplineAction() {
    if (!student) return;

    setDisciplineSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setDisciplineSaving(false);
      router.push('/login');
      return;
    }

    if (
      disciplineModalType === 'bond' &&
      !disciplineForm.bond_details.trim()
    ) {
      alert(
        'Please enter what the bond entails.'
      );
      setDisciplineSaving(false);
      return;
    }

    if (
      disciplineModalType === 'suspension' &&
      !disciplineForm.suspension_start_date
    ) {
      alert(
        'Please enter the suspension start date.'
      );
      setDisciplineSaving(false);
      return;
    }

    if (
      disciplineModalType === 'suspension' &&
      disciplineForm.suspension_end_date &&
      disciplineForm.suspension_end_date <
        disciplineForm.suspension_start_date
    ) {
      alert(
        'Suspension end date cannot be earlier than the start date.'
      );
      setDisciplineSaving(false);
      return;
    }

    const { error } = await supabase
      .from('student_disciplinary_actions')
      .insert({
        student_id: student.id,
        action_type: disciplineModalType,
        action_date:
          disciplineForm.action_date ||
          new Date()
            .toISOString()
            .slice(0, 10),
        suspension_start_date:
          disciplineModalType === 'suspension'
            ? disciplineForm.suspension_start_date ||
              null
            : null,
        suspension_end_date:
          disciplineModalType === 'suspension'
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
      });

    if (error) {
      alert(
        `Unable to save disciplinary action: ${error.message}`
      );
      setDisciplineSaving(false);
      return;
    }

    await loadDisciplineActions();

    setShowDisciplineModal(false);
    setDisciplineSaving(false);

    alert(
      `${getActionLabel(
        disciplineModalType
      )} recorded successfully.`
    );
  }

  const selectedAcademicYear = useMemo(
    () =>
      academicYears.find(
        (year) =>
          year.id ===
          selectedAcademicYearId
      ),
    [
      academicYears,
      selectedAcademicYearId,
    ]
  );

  const selectedSemester = useMemo(
    () =>
      semesters.find(
        (semester) =>
          semester.id ===
          selectedSemesterId
      ),
    [
      semesters,
      selectedSemesterId,
    ]
  );

  const semesterAssessments = useMemo(() => {
    if (!selectedSemester) return [];

    return assessments.filter(
      (assessment) => {
        if (
          assessment.term &&
          assessment.term ===
            selectedSemester.name
        ) {
          return true;
        }

        const createdDate =
          new Date(
            assessment.created_at
          );

        if (
          Number.isNaN(
            createdDate.getTime()
          )
        ) {
          return false;
        }

        if (
          selectedSemester.start_date &&
          createdDate <
            new Date(
              `${selectedSemester.start_date}T00:00:00`
            )
        ) {
          return false;
        }

        if (
          selectedSemester.end_date &&
          createdDate >
            new Date(
              `${selectedSemester.end_date}T23:59:59`
            )
        ) {
          return false;
        }

        return true;
      }
    );
  }, [
    assessments,
    selectedSemester,
  ]);

  const semesterAttendance = useMemo(() => {
    if (!selectedSemester) return [];

    return attendance.filter(
      (record) => {
        if (
          selectedSemester.start_date &&
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
      }
    );
  }, [
    attendance,
    selectedSemester,
  ]);

  const subjectResults = useMemo(() => {
    const subjects = Array.from(
      new Set(
        semesterAssessments.map(
          (item) => item.subject
        )
      )
    );

    return subjects
      .map((subject) => {
        const records =
          semesterAssessments.filter(
            (item) =>
              item.subject === subject
          );

        let caRaw = 0;

        CA_TYPES.forEach(
          (type) => {
            const record = records.find(
              (item) =>
                item.assessment_type ===
                type
            );

            if (record) {
              const max =
                Number(
                  record.max_score
                ) || 100;

              const score =
                Number(
                  record.score
                ) || 0;

              caRaw +=
                (score / max) *
                (type.startsWith(
                  'Exercise'
                )
                  ? 10
                  : 20);
            }
          }
        );

        const caContribution =
          (caRaw / 100) * 30;

        const exam =
          records.find(
            (item) =>
              item.assessment_type ===
              'Examination'
          );

        const examPercentage = exam
          ? ((Number(exam.score) || 0) /
              (Number(exam.max_score) ||
                100)) *
            100
          : 0;

        const examContribution =
          (examPercentage / 100) * 70;

        const finalScore =
          caContribution +
          examContribution;

        return {
          subject,
          caRaw,
          caContribution,
          examPercentage,
          examContribution,
          finalScore,
          grade:
            getGrade(finalScore),
          status:
            getStatus(finalScore),
        };
      })
      .sort((a, b) =>
        a.subject.localeCompare(
          b.subject
        )
      );
  }, [semesterAssessments]);

  const overallAverage = useMemo(() => {
    if (!subjectResults.length) return 0;

    return (
      subjectResults.reduce(
        (sum, item) =>
          sum + item.finalScore,
        0
      ) / subjectResults.length
    );
  }, [subjectResults]);

  const attendanceSummary = useMemo(() => {
    const total =
      semesterAttendance.length;

    const present =
      semesterAttendance.filter(
        (item) =>
          item.status === 'present'
      ).length;

    const late =
      semesterAttendance.filter(
        (item) =>
          item.status === 'late'
      ).length;

    const absent =
      semesterAttendance.filter(
        (item) =>
          item.status === 'absent'
      ).length;

    const excused =
      semesterAttendance.filter(
        (item) =>
          item.status === 'excused'
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

  const latestDisciplineAction =
    disciplineActions[0] || null;

  const activeSuspension =
    disciplineActions.find(
      (action) => {
        if (
          action.action_type !==
          'suspension'
        ) {
          return false;
        }

        if (
          !action.suspension_start_date
        ) {
          return false;
        }

        const today =
          new Date()
            .toISOString()
            .slice(0, 10);

        if (
          today <
          action.suspension_start_date
        ) {
          return false;
        }

        if (
          action.suspension_end_date &&
          today >
            action.suspension_end_date
        ) {
          return false;
        }

        return true;
      }
    ) || null;

  const isDismissed =
    latestDisciplineAction
      ?.action_type === 'dismissal' &&
    !disciplineActions.some(
      (action, index) =>
        index <
          disciplineActions.indexOf(
            latestDisciplineAction
          ) &&
        action.action_type ===
          'reinstatement'
    );

  const latestBond =
    disciplineActions.find(
      (action) =>
        action.action_type === 'bond'
    ) || null;

  const latestReinstatement =
    disciplineActions.find(
      (action) =>
        action.action_type ===
        'reinstatement'
    ) || null;

  function changeAcademicYear(
    value: string
  ) {
    setSelectedAcademicYearId(value);

    const available =
      semesters.filter(
        (semester) =>
          semester.academic_year_id ===
          value
      );

    const current =
      available.find(
        (semester) =>
          semester.is_current
      ) || available[0];

    setSelectedSemesterId(
      current?.id || ''
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-slate-200 border-t-slate-700 animate-spin" />
          <p className="text-sm font-medium text-slate-600">
            Loading student profile...
          </p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <i className="fa-solid fa-user-slash text-xl" />
          </div>

          <h1 className="text-xl font-bold text-slate-900">
            Student Not Found
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            The student profile could not be
            loaded.
          </p>

          <Link
            href="/students"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <i className="fa-solid fa-arrow-left" />
            Back to Students
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @keyframes btiFaceEnrollmentFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .bti-face-enrollment-fade {
          animation: btiFaceEnrollmentFadeUp 0.35s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .bti-face-enrollment-fade { animation: none; }
        }
      `}</style>

    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-4">
              <Link
                href="/students"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
              >
                <i className="fa-solid fa-arrow-left" />
              </Link>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  BTI Student Profile
                </p>

                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                  {student.full_name}
                </h1>

                <p className="mt-1 text-sm text-slate-300">
                  Admission No.{' '}
                  <span className="font-semibold text-white">
                    {student.admission_number}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/report-card/${student.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                <i className="fa-solid fa-file-lines" />
                Report Card
              </Link>

              {/* CORRECT EDIT ROUTE */}
              <Link
                href={`/students/edit/${student.id}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <i className="fa-solid fa-pen" />
                Edit Student
              </Link>
            </div>
          </div>
        </div>

        {/* CURRENT DISCIPLINE ALERT */}
        {(activeSuspension ||
          isDismissed ||
          latestBond) && (
          <div
            className={`overflow-hidden rounded-2xl border shadow-sm ${
              isDismissed
                ? 'border-red-300 bg-red-50'
                : activeSuspension
                ? 'border-orange-300 bg-orange-50'
                : 'border-amber-300 bg-amber-50'
            }`}
          >
            <div className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                <div className="flex gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      isDismissed
                        ? 'bg-red-100 text-red-700'
                        : activeSuspension
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    <i
                      className={`fa-solid text-lg ${
                        isDismissed
                          ? 'fa-user-slash'
                          : activeSuspension
                          ? 'fa-user-clock'
                          : 'fa-file-signature'
                      }`}
                    />
                  </div>

                  <div>
                    <p
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isDismissed
                          ? 'text-red-700'
                          : activeSuspension
                          ? 'text-orange-700'
                          : 'text-amber-700'
                      }`}
                    >
                      Current Disciplinary Status
                    </p>

                    <h2
                      className={`mt-1 text-xl font-bold ${
                        isDismissed
                          ? 'text-red-900'
                          : activeSuspension
                          ? 'text-orange-900'
                          : 'text-amber-900'
                      }`}
                    >
                      {isDismissed
                        ? 'Permanently Dismissed'
                        : activeSuspension
                        ? 'Currently Suspended'
                        : 'Bond on Record'}
                    </h2>

                    {activeSuspension && (
                      <p className="mt-1 text-sm text-orange-800">
                        Suspension:{' '}
                        {formatDate(
                          activeSuspension.suspension_start_date
                        )}{' '}
                        to{' '}
                        {formatDate(
                          activeSuspension.suspension_end_date
                        )}
                      </p>
                    )}

                    {isDismissed &&
                      latestDisciplineAction && (
                        <p className="mt-1 text-sm text-red-800">
                          Dismissal date:{' '}
                          {formatDate(
                            latestDisciplineAction.action_date
                          )}
                        </p>
                      )}

                    {!isDismissed &&
                      !activeSuspension &&
                      latestBond && (
                        <p className="mt-2 max-w-3xl text-sm text-amber-900">
                          <span className="font-semibold">
                            Bond entails:
                          </span>{' '}
                          {latestBond.bond_details}
                        </p>
                      )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowDisciplineHistory(true)
                  }
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <i className="fa-solid fa-clock-rotate-left" />
                  View History
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OVERVIEW */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Current Class
            </p>

            <p className="mt-2 text-lg font-bold text-slate-900">
              {enrollments[0]
                ?.class?.[0]?.name ||
                'Not enrolled'}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {enrollments[0]
                ?.programme?.[0]?.name ||
                'No programme'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Academic Year
            </p>

            <p className="mt-2 text-lg font-bold text-slate-900">
              {enrollments[0]
                ?.academic_year?.[0]?.name ||
                'Not available'}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {enrollments[0]?.status ||
                'No status'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Overall Average
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {overallAverage.toFixed(2)}%
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {subjectResults.length}{' '}
              subject
              {subjectResults.length === 1
                ? ''
                : 's'} recorded
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Attendance
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {attendanceSummary.percentage.toFixed(
                1
              )}
              %
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {attendanceSummary.attended}{' '}
              attended of{' '}
              {attendanceSummary.total}
            </p>
          </div>
        </div>

        {/* DISCIPLINE MANAGEMENT */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <i className="fa-solid fa-shield-halved" />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Discipline & Student Conduct
                    </h2>

                    <p className="text-sm text-slate-500">
                      Bonds, suspensions, dismissal and reinstatement records
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openDisciplineModal(
                      'bond'
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  <i className="fa-solid fa-file-signature" />
                  Bond
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openDisciplineModal(
                      'suspension'
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  <i className="fa-solid fa-user-clock" />
                  Suspend
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openDisciplineModal(
                      'dismissal'
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                >
                  <i className="fa-solid fa-user-slash" />
                  Dismiss
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openDisciplineModal(
                      'reinstatement'
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <i className="fa-solid fa-user-check" />
                  Reinstate
                </button>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Bond
                  </span>
                  <i className="fa-solid fa-file-signature text-amber-600" />
                </div>

                <p className="mt-2 text-sm font-semibold text-amber-900">
                  {latestBond
                    ? 'Bond on record'
                    : 'No bond recorded'}
                </p>

                {latestBond && (
                  <p className="mt-1 text-xs text-amber-800">
                    Signed:{' '}
                    {formatDate(
                      latestBond.action_date
                    )}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-700">
                    Suspension
                  </span>
                  <i className="fa-solid fa-user-clock text-orange-600" />
                </div>

                <p className="mt-2 text-sm font-semibold text-orange-900">
                  {activeSuspension
                    ? 'Currently suspended'
                    : 'Not currently suspended'}
                </p>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                    Dismissal
                  </span>
                  <i className="fa-solid fa-user-slash text-red-600" />
                </div>

                <p className="mt-2 text-sm font-semibold text-red-900">
                  {isDismissed
                    ? 'Permanently dismissed'
                    : 'Not dismissed'}
                </p>
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-green-700">
                    Reinstatement
                  </span>
                  <i className="fa-solid fa-user-check text-green-600" />
                </div>

                <p className="mt-2 text-sm font-semibold text-green-900">
                  {latestReinstatement
                    ? `Reinstated ${formatDate(
                        latestReinstatement.action_date
                      )}`
                    : 'No reinstatement recorded'}
                </p>
              </div>
            </div>

            {latestBond && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Bond Details
                </p>

                <p className="mt-2 text-sm leading-6 text-amber-950">
                  {latestBond.bond_details ||
                    'No bond details provided.'}
                </p>

                {latestBond.bond_conditions && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-amber-700">
                      Conditions
                    </p>
                    <p className="mt-1 text-sm leading-6 text-amber-900">
                      {latestBond.bond_conditions}
                    </p>
                  </div>
                )}

                {latestBond.bond_review_date && (
                  <p className="mt-3 text-xs text-amber-800">
                    Review date:{' '}
                    <span className="font-semibold">
                      {formatDate(
                        latestBond.bond_review_date
                      )}
                    </span>
                  </p>
                )}
              </div>
            )}

            {disciplineActions.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setShowDisciplineHistory(true)
                }
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950"
              >
                <i className="fa-solid fa-clock-rotate-left" />
                View complete disciplinary history (
                {disciplineActions.length})
                <i className="fa-solid fa-arrow-right text-xs" />
              </button>
            )}
          </div>
        </section>

        {/* ACADEMIC PERIOD */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <i className="fa-solid fa-calendar-days" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Academic Period
              </h2>

              <p className="text-sm text-slate-500">
                Select the semester for academic and attendance information.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Academic Year
              </label>

              <select
                value={
                  selectedAcademicYearId
                }
                onChange={(event) =>
                  changeAcademicYear(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              >
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

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Semester
              </label>

              <select
                value={
                  selectedSemesterId
                }
                onChange={(event) =>
                  setSelectedSemesterId(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              >
                <option value="">
                  Select Semester
                </option>

                {semesters
                  .filter(
                    (semester) =>
                      semester.academic_year_id ===
                      selectedAcademicYearId
                  )
                  .map(
                    (semester) => (
                      <option
                        key={semester.id}
                        value={semester.id}
                      >
                        {semester.name}
                      </option>
                    )
                  )}
              </select>
            </div>
          </div>
        </section>

        {/* PERSONAL INFORMATION */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <i className="fa-solid fa-id-card" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Student Identity & Academic Profile
                </h2>
                <p className="text-sm text-slate-500">
                  Core identity, admission and academic placement information.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[160px_1fr]">
            <div className="flex justify-center lg:justify-start">
              <div className="aspect-[35/45] w-32 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm sm:w-36">
                {student.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={student.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                    <i className="fa-solid fa-user text-4xl" />
                    <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide">
                      No Photo
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem label="Full Name" value={student.full_name} />
              <InfoItem label="Student ID / Admission Number" value={student.admission_number || 'Not provided'} />
              <InfoItem label="BECE Index Number" value={student.bece_index_number || 'Not provided'} />
              <InfoItem label="Gender" value={student.gender || 'Not provided'} />
              <InfoItem label="Date of Birth" value={formatDate(student.date_of_birth)} />
              <InfoItem label="Place of Birth" value={student.place_of_birth || 'Not provided'} />
              <InfoItem label="Region" value={student.region || 'Not provided'} />
              <InfoItem label="Religion" value={student.religion || 'Not provided'} />
              <InfoItem label="Admission Date" value={formatDate(student.admission_date)} />
              <InfoItem
                label="JHS Aggregate"
                value={student.jhs_aggregate !== null ? String(student.jhs_aggregate) : 'Not provided'}
              />
              <InfoItem label="Student Status" value={student.status || 'Not provided'} />
              <InfoItem
                label="Current Class"
                value={enrollments[0]?.class?.[0]?.name || 'Not enrolled'}
              />
              <InfoItem
                label="Programme"
                value={enrollments[0]?.programme?.[0]?.name || 'Not provided'}
              />
            </div>
          </div>
        </section>

        {/* FACE ENROLLMENT */}
        <div className="bti-face-enrollment-fade">
          <StudentFaceEnrollment
            student={{
              id: student.id,
              full_name: student.full_name,
              admission_number: student.admission_number,
            }}
          />
        </div>

        {/* RESIDENCE & CONTACT INFORMATION */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <i className="fa-solid fa-house" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Residence & Contact Information
                </h2>
                <p className="text-sm text-slate-500">
                  Residential, boarding and direct contact details.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            <InfoItem label="Residence Status" value={student.resident || 'Not provided'} />
            <InfoItem
              label="Boarding House"
              value={student.resident === 'Day' ? 'Not applicable' : student.house || 'Not provided'}
            />
            <InfoItem label="House Number" value={student.house_number || 'Not provided'} />
            <InfoItem
              label="Residential Address"
              value={student.residential_address || student.address || 'Not provided'}
            />
            <InfoItem label="Digital Address" value={student.digital_address || 'Not provided'} />
            <InfoItem label="WhatsApp Number" value={student.whatsapp_number || 'Not provided'} />
          </div>
        </section>

        {/* PARENT / GUARDIAN INFORMATION */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <i className="fa-solid fa-people-roof" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Parent & Guardian Information
                </h2>
                <p className="text-sm text-slate-500">
                  Parent and guardian names and contact information.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            <InfoItem label="Father's Name" value={student.father_name || 'Not provided'} />
            <InfoItem label="Father's Contact" value={student.father_contact || 'Not provided'} />
            <InfoItem label="Mother's Name" value={student.mother_name || 'Not provided'} />
            <InfoItem label="Mother's Contact" value={student.mother_contact || 'Not provided'} />
            <InfoItem label="Guardian Name" value={student.guardian_name || 'Not provided'} />
            <InfoItem label="Guardian Phone" value={student.guardian_phone || 'Not provided'} />
          </div>
        </section>

        {/* HEALTH INFORMATION */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <i className="fa-solid fa-notes-medical" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Health Information
                </h2>
                <p className="text-sm text-slate-500">
                  Health insurance and important health information recorded for the student.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            <InfoItem
              label="Health Insurance Number"
              value={student.health_insurance_number || 'Not provided'}
            />
            <InfoItem
              label="Health Insurance Expiry Date"
              value={formatDate(student.health_insurance_expiry_date)}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Health Issues
              </p>
              <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-800">
                  {student.health_issues || 'No health issues recorded.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* REPORT CARD INFORMATION */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Report Card Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Information used when generating the student report card.
            </p>
          </div>

          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">

            {/* REAL STUDENT PHOTO UPLOAD */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">

                  <div className="shrink-0">
                    <p className="mb-2 text-sm font-semibold text-slate-700">
                      Student Photo
                    </p>

                    <div className="aspect-[35/45] w-32 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      {photoPreview ||
                      student.photo_url ? (
                        <img
                          src={
                            photoPreview ||
                            student.photo_url ||
                            ''
                          }
                          alt={`${student.full_name} student photo`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                          <i className="fa-solid fa-user text-3xl" />
                          <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide">
                            No Photo
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Upload Student Photo
                    </label>

                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={
                        handlePhotoChange
                      }
                      className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm text-slate-600 file:mr-4 file:border-0 file:bg-slate-900 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
                    />

                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <div className="flex gap-3">
                        <i className="fa-solid fa-camera mt-0.5 text-blue-600" />

                        <div>
                          <p className="text-sm font-semibold text-blue-900">
                            Passport-size photo
                          </p>

                          <p className="mt-1 text-xs leading-5 text-blue-800">
                            Recommended size:
                            {' '}
                            <strong>
                              35 × 45 mm
                            </strong>
                            {' '}
                            (approximately
                            {' '}
                            <strong>
                              413 × 531 px
                            </strong>
                            {' '}
                            at 300 DPI).
                          </p>

                          <p className="mt-1 text-xs leading-5 text-blue-800">
                            Accepted formats:
                            {' '}
                            <strong>
                              JPG or PNG
                            </strong>
                            .
                            {' '}
                            Maximum file size:
                            {' '}
                            <strong>
                              2 MB
                            </strong>
                            .
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedPhoto && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                          <i className="fa-solid fa-circle-check" />
                          New photo selected
                        </span>

                        <span className="text-xs text-slate-500">
                          {(
                            selectedPhoto.size /
                            1024 /
                            1024
                          ).toFixed(2)}{' '}
                          MB
                        </span>

                        <button
                          type="button"
                          onClick={
                            clearSelectedPhoto
                          }
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Remove selected photo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Conduct
              </label>

              <textarea
                value={form.conduct}
                onChange={(event) =>
                  setForm({
                    ...form,
                    conduct:
                      event.target.value,
                  })
                }
                rows={4}
                placeholder="Enter conduct remark..."
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Promotion Status
              </label>

              <textarea
                value={
                  form.promotion_status
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    promotion_status:
                      event.target.value,
                  })
                }
                rows={4}
                placeholder="Promoted / Repeated / etc."
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Class Teacher Remark
              </label>

              <textarea
                value={
                  form.class_teacher_remark
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    class_teacher_remark:
                      event.target.value,
                  })
                }
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                HOD / Head Remark
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
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Next Semester Begins
              </label>

              <input
                type="date"
                value={
                  form.next_term_begins
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    next_term_begins:
                      event.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={
                  saveReportCardInfo
                }
                disabled={
                  saving ||
                  photoUploading
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <i
                  className={`fa-solid ${
                    saving ||
                    photoUploading
                      ? 'fa-spinner fa-spin'
                      : 'fa-floppy-disk'
                  }`}
                />

                {photoUploading
                  ? 'Uploading Photo...'
                  : saving
                  ? 'Saving...'
                  : 'Save Report Card Information'}
              </button>
            </div>
          </div>
        </section>

        {/* ATTENDANCE */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Semester Attendance
                </h2>

                <p className="text-sm text-slate-500">
                  {selectedSemester?.name ||
                    'Select a semester'}
                </p>
              </div>

              <Link
                href="/attendance-reports"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950"
              >
                View Attendance Reports
                <i className="fa-solid fa-arrow-right text-xs" />
              </Link>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-6 sm:p-6">

            <SummaryCard
              label="Days"
              value={
                attendanceSummary.total
              }
              icon="fa-calendar-days"
            />

            <SummaryCard
              label="Present"
              value={
                attendanceSummary.present
              }
              icon="fa-circle-check"
            />

            <SummaryCard
              label="Late"
              value={
                attendanceSummary.late
              }
              icon="fa-clock"
            />

            <SummaryCard
              label="Absent"
              value={
                attendanceSummary.absent
              }
              icon="fa-circle-xmark"
            />

            <SummaryCard
              label="Excused"
              value={
                attendanceSummary.excused
              }
              icon="fa-file-circle-check"
            />

            <SummaryCard
              label="Attendance %"
              value={`${attendanceSummary.percentage.toFixed(
                1
              )}%`}
              icon="fa-chart-line"
            />
          </div>
        </section>

        {/* RESULTS */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Semester Results
              </h2>

              <p className="text-sm text-slate-500">
                CA contributes 30% and Examination contributes 70%.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {subjectResults.length === 0 ? (
              <div className="p-10 text-center">
                <i className="fa-solid fa-chart-column text-3xl text-slate-300" />

                <p className="mt-3 text-sm font-semibold text-slate-600">
                  No results recorded for this semester.
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-bold">
                      Subject
                    </th>

                    <th className="px-5 py-4 text-center font-bold">
                      CA / 30
                    </th>

                    <th className="px-5 py-4 text-center font-bold">
                      Exam / 70
                    </th>

                    <th className="px-5 py-4 text-center font-bold">
                      Final / 100
                    </th>

                    <th className="px-5 py-4 text-center font-bold">
                      Grade
                    </th>

                    <th className="px-5 py-4 text-center font-bold">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {subjectResults.map(
                    (result) => (
                      <tr
                        key={
                          result.subject
                        }
                        className="hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {result.subject}
                        </td>

                        <td className="px-5 py-4 text-center text-slate-700">
                          {result.caContribution.toFixed(
                            2
                          )}
                        </td>

                        <td className="px-5 py-4 text-center text-slate-700">
                          {result.examContribution.toFixed(
                            2
                          )}
                        </td>

                        <td className="px-5 py-4 text-center font-bold text-slate-900">
                          {result.finalScore.toFixed(
                            2
                          )}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-800">
                            {result.grade}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
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
            )}
          </div>
        </section>

        {/* ACADEMIC HISTORY */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Academic History
            </h2>

            <p className="text-sm text-slate-500">
              Previous and current student enrollments.
            </p>
          </div>

          <div className="overflow-x-auto">
            {enrollments.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No enrollment history found.
              </div>
            ) : (
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-bold">
                      Academic Year
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Class
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Programme
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Enrollment Date
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {enrollments.map(
                    (enrollment) => (
                      <tr
                        key={
                          enrollment.id
                        }
                        className="hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {enrollment
                            .academic_year?.[0]
                            ?.name ||
                            '—'}
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {enrollment
                            .class?.[0]
                            ?.name ||
                            '—'}
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {enrollment
                            .programme?.[0]
                            ?.name ||
                            '—'}
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {formatDate(
                            enrollment.enrollment_date
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {enrollment.status}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* CONDUCT & PROMOTION */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Conduct & Promotion
            </h2>
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-2 sm:p-6">
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Conduct
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {student.conduct ||
                  'No conduct remark recorded.'}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Promotion Status
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {student.promotion_status ||
                  'No promotion status recorded.'}
              </p>
            </div>
          </div>
        </section>

        {/* DANGER ZONE */}
        <section className="rounded-2xl border border-red-200 bg-white shadow-sm">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-red-700">
                  Archive or Delete Student
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Archive a student to preserve school history, or permanently delete the student
                  and associated school records when complete removal is required.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmation('');
                  setShowDeleteModal(true);
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                <i className="fa-solid fa-trash-can" />
                Manage Student Record
              </button>
            </div>
          </div>
        </section>

        {/* FOOTER ACTIONS */}
        <div className="flex flex-col gap-3 pb-8 sm:flex-row sm:justify-between">
          <Link
            href="/students"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <i className="fa-solid fa-arrow-left" />
            Back to Students
          </Link>

          <Link
            href={`/report-card/${student.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <i className="fa-solid fa-file-lines" />
            Open Report Card
          </Link>
        </div>
      </div>

      {/* ARCHIVE / PERMANENT DELETE STUDENT MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-red-100 bg-red-50 px-5 py-5 sm:px-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                  <i className="fa-solid fa-triangle-exclamation" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-red-900">
                    Manage Student Record
                  </h2>
                  <p className="mt-1 text-sm text-red-800">
                    Available to active Administrators and the Owner.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{student.full_name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Student ID / Admission No. {student.admission_number || '—'}
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <i className="fa-solid fa-box-archive mt-0.5 text-amber-700" />
                  <div>
                    <p className="font-bold text-amber-900">Archive Student</p>
                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      Removes the student from active status but preserves academic, attendance,
                      financial, disciplinary and residential history.
                    </p>
                    <button
                      type="button"
                      disabled={deleteSaving}
                      onClick={archiveStudent}
                      className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <i className={`fa-solid ${deleteSaving ? 'fa-spinner fa-spin' : 'fa-box-archive'}`} />
                      {deleteSaving ? 'Processing...' : 'Archive Student'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex gap-3">
                  <i className="fa-solid fa-trash-can mt-0.5 text-red-700" />
                  <div className="w-full">
                    <p className="font-bold text-red-900">Permanently Delete Student</p>
                    <p className="mt-1 text-sm leading-6 text-red-800">
                      Completely removes the student and associated school records. This action cannot be undone.
                    </p>

                    <label className="mb-2 mt-4 block text-sm font-semibold text-red-900">
                      Type <span className="font-black">DELETE</span> to confirm permanent deletion
                    </label>
                    <input
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      autoComplete="off"
                      placeholder="DELETE"
                      className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    />

                    <button
                      type="button"
                      disabled={deleteSaving || deleteConfirmation !== 'DELETE'}
                      onClick={permanentlyDeleteStudent}
                      className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <i className={`fa-solid ${deleteSaving ? 'fa-spinner fa-spin' : 'fa-trash-can'}`} />
                      {deleteSaving ? 'Processing...' : 'Permanently Delete Student'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
              <button
                type="button"
                disabled={deleteSaving}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISCIPLINE MODAL */}
      {showDisciplineModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    disciplineModalType ===
                    'bond'
                      ? 'bg-amber-50 text-amber-600'
                      : disciplineModalType ===
                        'suspension'
                      ? 'bg-orange-50 text-orange-600'
                      : disciplineModalType ===
                        'dismissal'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-green-50 text-green-600'
                  }`}
                >
                  <i
                    className={`fa-solid ${getActionIcon(
                      disciplineModalType
                    )}`}
                  />
                </div>

                <div>
                  <h2 className="font-bold text-slate-900">
                    Record{' '}
                    {getActionLabel(
                      disciplineModalType
                    )}
                  </h2>

                  <p className="text-xs text-slate-500">
                    {student.full_name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowDisciplineModal(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Action Date
                </label>

                <input
                  type="date"
                  value={
                    disciplineForm.action_date
                  }
                  onChange={(event) =>
                    setDisciplineForm({
                      ...disciplineForm,
                      action_date:
                        event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              {disciplineModalType ===
                'bond' && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      What does the bond entail?
                      <span className="text-red-500">
                        {' '}
                        *
                      </span>
                    </label>

                    <textarea
                      value={
                        disciplineForm.bond_details
                      }
                      onChange={(event) =>
                        setDisciplineForm({
                          ...disciplineForm,
                          bond_details:
                            event.target.value,
                        })
                      }
                      rows={5}
                      placeholder="Describe the action or behaviour the student has signed a bond not to repeat..."
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Bond Conditions
                    </label>

                    <textarea
                      value={
                        disciplineForm.bond_conditions
                      }
                      onChange={(event) =>
                        setDisciplineForm({
                          ...disciplineForm,
                          bond_conditions:
                            event.target.value,
                        })
                      }
                      rows={4}
                      placeholder="Enter conditions, expectations or consequences..."
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Bond Review Date
                    </label>

                    <input
                      type="date"
                      value={
                        disciplineForm.bond_review_date
                      }
                      onChange={(event) =>
                        setDisciplineForm({
                          ...disciplineForm,
                          bond_review_date:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>
                </>
              )}

              {disciplineModalType ===
                'suspension' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Suspension Start
                        <span className="text-red-500">
                          {' '}
                          *
                        </span>
                      </label>

                      <input
                        type="date"
                        value={
                          disciplineForm.suspension_start_date
                        }
                        onChange={(event) =>
                          setDisciplineForm({
                            ...disciplineForm,
                            suspension_start_date:
                              event.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Suspension End
                      </label>

                      <input
                        type="date"
                        value={
                          disciplineForm.suspension_end_date
                        }
                        onChange={(event) =>
                          setDisciplineForm({
                            ...disciplineForm,
                            suspension_end_date:
                              event.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                    <i className="fa-solid fa-circle-info mr-2" />
                    The student will be shown as
                    currently suspended while the
                    current date falls within the
                    recorded suspension period.
                  </div>
                </>
              )}

              {disciplineModalType ===
                'dismissal' && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex gap-3">
                    <i className="fa-solid fa-triangle-exclamation mt-0.5 text-red-600" />

                    <div>
                      <p className="font-semibold text-red-900">
                        Permanent Dismissal
                      </p>

                      <p className="mt-1 text-sm leading-6 text-red-800">
                        This record will prominently
                        indicate that the student has
                        been permanently dismissed.
                        A later reinstatement can be
                        recorded if the school reverses
                        the decision.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {disciplineModalType ===
                'reinstatement' && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex gap-3">
                    <i className="fa-solid fa-user-check mt-0.5 text-green-600" />

                    <div>
                      <p className="font-semibold text-green-900">
                        Reinstatement
                      </p>

                      <p className="mt-1 text-sm leading-6 text-green-800">
                        Record that the student has
                        been officially reinstated after
                        a previous disciplinary action.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Reason
                </label>

                <textarea
                  value={
                    disciplineForm.reason
                  }
                  onChange={(event) =>
                    setDisciplineForm({
                      ...disciplineForm,
                      reason:
                        event.target.value,
                    })
                  }
                  rows={4}
                  placeholder="Enter the reason for this disciplinary action..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Notes
                </label>

                <textarea
                  value={
                    disciplineForm.notes
                  }
                  onChange={(event) =>
                    setDisciplineForm({
                      ...disciplineForm,
                      notes:
                        event.target.value,
                    })
                  }
                  rows={4}
                  placeholder="Additional notes..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowDisciplineModal(
                      false
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
                  className={`rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                    disciplineModalType ===
                    'bond'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : disciplineModalType ===
                        'suspension'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : disciplineModalType ===
                        'dismissal'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  <i
                    className={`fa-solid mr-2 ${
                      disciplineSaving
                        ? 'fa-spinner fa-spin'
                        : 'fa-floppy-disk'
                    }`}
                  />

                  {disciplineSaving
                    ? 'Saving...'
                    : `Record ${getActionLabel(
                        disciplineModalType
                      )}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DISCIPLINE HISTORY MODAL */}
      {showDisciplineHistory && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Disciplinary History
                </h2>

                <p className="text-sm text-slate-500">
                  {student.full_name}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowDisciplineHistory(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5 sm:p-6">

              {disciplineActions.length ===
              0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <i className="fa-solid fa-shield-halved text-xl" />
                  </div>

                  <p className="mt-4 font-semibold text-slate-700">
                    No disciplinary records
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    No bond, suspension,
                    dismissal or reinstatement
                    has been recorded for this
                    student.
                  </p>
                </div>
              ) : (
                <div className="relative space-y-4">
                  {disciplineActions.map(
                    (action) => (
                      <div
                        key={action.id}
                        className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row">

                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                              action.action_type ===
                              'bond'
                                ? 'bg-amber-50 text-amber-600'
                                : action.action_type ===
                                  'suspension'
                                ? 'bg-orange-50 text-orange-600'
                                : action.action_type ===
                                  'dismissal'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-green-50 text-green-600'
                            }`}
                          >
                            <i
                              className={`fa-solid ${getActionIcon(
                                action.action_type
                              )}`}
                            />
                          </div>

                          <div className="min-w-0 flex-1">

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full border px-3 py-1 text-xs font-bold ${getActionBadgeClass(
                                    action.action_type
                                  )}`}
                                >
                                  {getActionLabel(
                                    action.action_type
                                  )}
                                </span>

                                <span className="text-xs text-slate-400">
                                  {formatDate(
                                    action.action_date
                                  )}
                                </span>
                              </div>
                            </div>

                            {action.action_type ===
                              'bond' && (
                              <div className="mt-4 space-y-3">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    What the Bond Entails
                                  </p>

                                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                    {action.bond_details ||
                                      'Not provided'}
                                  </p>
                                </div>

                                {action.bond_conditions && (
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                      Conditions
                                    </p>

                                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                      {
                                        action.bond_conditions
                                      }
                                    </p>
                                  </div>
                                )}

                                {action.bond_review_date && (
                                  <p className="text-xs text-slate-500">
                                    Review date:{' '}
                                    <span className="font-semibold text-slate-700">
                                      {formatDate(
                                        action.bond_review_date
                                      )}
                                    </span>
                                  </p>
                                )}
                              </div>
                            )}

                            {action.action_type ===
                              'suspension' && (
                              <div className="mt-4 rounded-xl bg-orange-50 p-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <p className="text-xs font-semibold text-orange-700">
                                      Start Date
                                    </p>

                                    <p className="mt-1 text-sm font-bold text-orange-900">
                                      {formatDate(
                                        action.suspension_start_date
                                      )}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold text-orange-700">
                                      End Date
                                    </p>

                                    <p className="mt-1 text-sm font-bold text-orange-900">
                                      {formatDate(
                                        action.suspension_end_date
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {action.reason && (
                              <div className="mt-4">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                  Reason
                                </p>

                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                  {action.reason}
                                </p>
                              </div>
                            )}

                            {action.notes && (
                              <div className="mt-4">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                  Notes
                                </p>

                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                  {action.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 text-right sm:px-6">
              <button
                type="button"
                onClick={() =>
                  setShowDisciplineHistory(
                    false
                  )
                }
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>

        <i
          className={`fa-solid ${icon} text-slate-400`}
        />
      </div>

      <p className="mt-2 text-xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

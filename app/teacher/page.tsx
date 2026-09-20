'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import StaffPerformanceStars from '@/components/staff-performance-stars';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  school_id: string;
};

type Assignment = {
  id: string;
  class_id: string | null;
  subject_id: string;
  term_id: string | null;
  academic_year_id: string | null;
  programme_ids: string[] | null;
  forms: string[] | null;
};

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
};

type Subject = {
  id: string;
  name: string;
  code: string | null;
};

type Semester = {
  id: string;
  name: string;
  academic_year_id: string;
  is_current?: boolean;
};

type AcademicYear = {
  id: string;
  name: string;
  is_current?: boolean;
};

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
  gender: string | null;
};

type Enrollment = {
  student_id: string;
  class_id: string;
  academic_year_id: string;
  programme_id?: string | null;
  status?: string | null;
};

type DocumentType =
  | 'unit_specification'
  | 'learning_session_plan'
  | 'particulars_of_work_done';

type TeachingDocument = {
  id: string;
  staff_id: string;
  document_type: DocumentType;
  academic_year_id: string | null;
  semester_id: string | null;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
  notes: string | null;
};

type AttendanceRow = {
  student_id: string;
  status: string;
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

type TimetableEntry = {
  id: string;
  teacher_assignment_id: string;
  academic_year_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
};

type Metric = {
  label: string;
  value: number;
  suffix?: string;
  icon: string;
  detail: string;
};

const supabase = createClient();

const ASSESSMENT_TYPES = [
  { name: 'Exercise 1', max: 10 },
  { name: 'Exercise 2', max: 10 },
  { name: 'Exercise 3', max: 10 },
  { name: 'Exercise 4', max: 10 },
  { name: 'Class Test 1', max: 20 },
  { name: 'Class Test 2', max: 20 },
  { name: 'Class Test 3', max: 20 },
  { name: 'Examination', max: 100 },
];

const quickActions = [
  {
    title: 'Take Attendance',
    description:
      'Record daily attendance for your assigned classes.',
    href: '/attendance',
    icon: 'fa-solid fa-calendar-check',
    badge: 'Daily',
  },
  {
    title: 'Enter Assessment',
    description:
      'Enter exercises, class tests and examination marks.',
    href: '/assessment',
    icon: 'fa-solid fa-clipboard-check',
    badge: 'Marks',
  },
  {
    title: 'View Results',
    description:
      'Review academic performance for your assigned classes.',
    href: '/results',
    icon: 'fa-solid fa-chart-line',
    badge: 'Results',
  },
  {
    title: 'Attendance Reports',
    description:
      'Review attendance records and percentages.',
    href: '/attendance-reports',
    icon: 'fa-solid fa-chart-column',
    badge: 'Reports',
  },
];


const DOCUMENT_LABELS: Record<DocumentType, string> = {
  unit_specification: 'Unit Specification Breakdown (USB)',
  learning_session_plan: 'Learning Session Plan (LSP)',
  particulars_of_work_done: 'Particulars of Work Done (POWD)',
};

const DOCUMENT_ICONS: Record<DocumentType, string> = {
  unit_specification: 'fa-solid fa-list-check',
  learning_session_plan: 'fa-solid fa-chalkboard-user',
  particulars_of_work_done: 'fa-solid fa-file-circle-check',
};

const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

function initials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return 'T';

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function todayLabel() {
  return new Intl.DateTimeFormat('en-GH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function percentage(score: number, max: number) {
  if (max <= 0) return 0;

  return Math.max(
    0,
    Math.min(100, (score / max) * 100)
  );
}

function formatTime(value: string) {
  const [hourPart, minutePart] =
    value.split(':');

  const hour = Number(hourPart);

  if (Number.isNaN(hour)) {
    return value;
  }

  const minute = minutePart ?? '00';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function timeToMinutes(value: string) {
  const [hour, minute] =
    value.split(':').map(Number);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return 0;
  }

  return hour * 60 + minute;
}

function useAnimatedNumber(
  target: number,
  duration = 900
) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;

    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(
        1,
        (now - start) / duration
      );

      const eased =
        1 - Math.pow(1 - progress, 3);

      setValue(Math.round(target * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

function AnimatedMetric({
  metric,
  delay = 0,
}: {
  metric: Metric;
  delay?: number;
}) {
  const value = useAnimatedNumber(metric.value);

  return (
    <div
      className="bti-card-in group rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {metric.label}
          </p>

          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {value}
            {metric.suffix}
          </p>

          <p className="mt-1 text-xs font-medium text-slate-500">
            {metric.detail}
          </p>
        </div>

        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
          <i className={metric.icon} />
        </span>
      </div>
    </div>
  );
}

async function fetchPagedAssessments(filters: {
  studentIds: string[];
  schoolId: string;
  term?: string | null;
  subjects: string[];
}) {
  if (
    !filters.studentIds.length ||
    !filters.subjects.length
  ) {
    return [] as AssessmentRecord[];
  }

  const rows: AssessmentRecord[] = [];

  const pageSize = 1000;

  for (let page = 0; page < 10; page += 1) {
    let query = supabase
      .from('assessments')
      .select(
        'id, student_id, subject, assessment_type, score, max_score, term'
      )
      .eq('school_id', filters.schoolId)
      .in('student_id', filters.studentIds)
      .in('subject', filters.subjects)
      .range(
        page * pageSize,
        page * pageSize + pageSize - 1
      );

    if (filters.term) {
      query = query.eq('term', filters.term);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const batch =
      (data ?? []) as AssessmentRecord[];

    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function fetchPagedAttendance(
  studentIds: string[]
) {
  if (!studentIds.length) {
    return [] as AttendanceRow[];
  }

  const rows: AttendanceRow[] = [];

  const pageSize = 1000;

  for (let page = 0; page < 10; page += 1) {
    const {
      data,
      error,
    } = await supabase
      .from('attendance')
      .select('student_id, status')
      .in('student_id', studentIds)
      .range(
        page * pageSize,
        page * pageSize + pageSize - 1
      );

    if (error) {
      return rows;
    }

    const batch =
      (data ?? []) as AttendanceRow[];

    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
  }

  return rows;
}

export default function TeacherDashboard() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [classes, setClasses] =
    useState<ClassItem[]>([]);

  const [subjects, setSubjects] =
    useState<Subject[]>([]);

  const [semesters, setSemesters] =
    useState<Semester[]>([]);

  const [academicYears, setAcademicYears] =
    useState<AcademicYear[]>([]);

  const [enrollments, setEnrollments] =
    useState<Enrollment[]>([]);

  const [students, setStudents] =
    useState<Student[]>([]);

  const [assessmentRows, setAssessmentRows] =
    useState<AssessmentRecord[]>([]);

  const [attendanceRows, setAttendanceRows] =
    useState<AttendanceRow[]>([]);

  const [timetableRows, setTimetableRows] =
    useState<TimetableEntry[]>([]);

  const [staffId, setStaffId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<TeachingDocument[]>([]);
  const [documentType, setDocumentType] = useState<DocumentType>('unit_specification');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentNotes, setDocumentNotes] = useState('');
  const [documentYearId, setDocumentYearId] = useState('');
  const [documentSemesterId, setDocumentSemesterId] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentMessage, setDocumentMessage] = useState('');
  const [documentError, setDocumentError] = useState('');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const {
        data: userProfile,
        error: profileError,
      } = await supabase
        .from('users')
        .select(
          'id, full_name, email, role, school_id'
        )
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile) {
        if (mounted) {
          setError(
            profileError?.message ??
              'Unable to load your teacher profile.'
          );
          setLoading(false);
        }

        return;
      }

      /*
       * --------------------------------------------------
       * ROLE PROTECTION
       * --------------------------------------------------
       */

      if (userProfile.role !== 'teacher') {
        if (userProfile.role === 'admin') {
          router.replace('/');
        } else if (
          userProfile.role === 'Student'
        ) {
          router.replace('/student');
        } else {
          await supabase.auth.signOut();
          router.replace('/login');
        }

        return;
      }

      /*
       * --------------------------------------------------
       * TEACHER ASSIGNMENTS + ACADEMIC CONTEXT
       * --------------------------------------------------
       */

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('teacher_assignments')
        .select('id, class_id, subject_id, term_id, academic_year_id, programme_ids, forms')
        .eq('teacher_id', user.id);

      if (assignmentError) {
        if (mounted) { setError(assignmentError.message); setLoading(false); }
        return;
      }

      const assignmentRows = (assignmentData ?? []) as Assignment[];

      const { data: yearsData, error: yearsError } = await supabase
        .from('academic_years')
        .select('id, name, is_current')
        .eq('school_id', userProfile.school_id)
        .order('start_date', { ascending: false });

      if (yearsError) {
        if (mounted) { setError(yearsError.message); setLoading(false); }
        return;
      }

      const yearRows = (yearsData ?? []) as AcademicYear[];
      const currentYear = yearRows.find((year) => year.is_current) ?? yearRows[0] ?? null;
      const activeAssignments = currentYear
        ? assignmentRows.filter((row) => !row.academic_year_id || row.academic_year_id === currentYear.id)
        : assignmentRows;

      const subjectIds = [...new Set(activeAssignments.map((row) => row.subject_id).filter(Boolean))];
      const { data: subjectsData, error: subjectsError } = subjectIds.length
        ? await supabase.from('subjects').select('id, name, code').in('id', subjectIds).order('name')
        : { data: [], error: null };

      if (subjectsError) {
        if (mounted) { setError(subjectsError.message); setLoading(false); }
        return;
      }
      const subjectRows = (subjectsData ?? []) as Subject[];

      const { data: allClassesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, level, programme_id')
        .eq('school_id', userProfile.school_id)
        .order('name');

      if (classesError) {
        if (mounted) { setError(classesError.message); setLoading(false); }
        return;
      }

      const allClasses = (allClassesData ?? []) as ClassItem[];
      const legacyClassIds = new Set(activeAssignments.map((row) => row.class_id).filter(Boolean) as string[]);
      const classRows = allClasses.filter((classItem) =>
        legacyClassIds.has(classItem.id) || activeAssignments.some((assignment) => {
          const programmes = assignment.programme_ids ?? [];
          const forms = assignment.forms ?? [];
          return !!classItem.programme_id && programmes.includes(classItem.programme_id) &&
            (!!classItem.level && forms.some((form) => form.trim().toLowerCase() === classItem.level?.trim().toLowerCase()));
        })
      );
      const classIds = classRows.map((row) => row.id);

      const { data: termsData, error: termsError } = currentYear
        ? await supabase.from('terms').select('id, name, academic_year_id, is_current').eq('academic_year_id', currentYear.id).order('start_date')
        : { data: [], error: null };
      if (termsError) {
        if (mounted) { setError(termsError.message); setLoading(false); }
        return;
      }
      const semesterRows = (termsData ?? []) as Semester[];
      const currentTerm = semesterRows.find((term) => term.is_current) ?? semesterRows[0] ?? null;

      let timetableDataRows: TimetableEntry[] = [];
      if (activeAssignments.length) {
        const { data: timetableData, error: timetableError } = await supabase
          .from('timetable')
          .select('id, teacher_assignment_id, academic_year_id, day_of_week, start_time, end_time, status, notes')
          .eq('school_id', userProfile.school_id)
          .in('teacher_assignment_id', activeAssignments.map((row) => row.id))
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true });
        if (timetableError) {
          if (mounted) { setError(timetableError.message); setLoading(false); }
          return;
        }
        timetableDataRows = (timetableData ?? []) as TimetableEntry[];
      }

      let enrollmentRows: Enrollment[] = [];
      if (classIds.length && currentYear?.id) {
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('student_id, class_id, academic_year_id, programme_id, status')
          .in('class_id', classIds)
          .eq('academic_year_id', currentYear.id);
        if (enrollmentError) {
          if (mounted) { setError(enrollmentError.message); setLoading(false); }
          return;
        }
        enrollmentRows = ((enrollmentData ?? []) as Enrollment[]).filter((row) => !row.status || row.status.toLowerCase() === 'active');
      }

      const studentIds = [...new Set(enrollmentRows.map((row) => row.student_id))];

      // Link the authenticated teacher to the existing staff record by school + email.
      const { data: staffMatch } = await supabase
        .from('staff')
        .select('id')
        .eq('school_id', userProfile.school_id)
        .ilike('email', userProfile.email)
        .eq('staff_category', 'teaching')
        .maybeSingle();

      let teacherDocuments: TeachingDocument[] = [];
      if (staffMatch?.id) {
        const { data: documentData } = await supabase
          .from('staff_teaching_documents')
          .select('id, staff_id, document_type, academic_year_id, semester_id, title, file_name, file_path, file_type, file_size, uploaded_at, notes')
          .eq('school_id', userProfile.school_id)
          .eq('staff_id', staffMatch.id)
          .order('uploaded_at', { ascending: false });
        teacherDocuments = (documentData ?? []) as TeachingDocument[];
      }

      /*
       * --------------------------------------------------
       * STUDENTS
       * --------------------------------------------------
       */

      let studentRows: Student[] = [];

      if (studentIds.length) {
        const {
          data: studentData,
          error: studentError,
        } = await supabase
          .from('students')
          .select(
            'id, full_name, admission_number, gender'
          )
          .in('id', studentIds)
          .eq(
            'school_id',
            userProfile.school_id
          )
          .order('full_name');

        if (studentError) {
          if (mounted) {
            setError(studentError.message);
            setLoading(false);
          }

          return;
        }

        studentRows =
          (studentData ?? []) as Student[];
      }

      // Render the teacher workspace as soon as its essential data is ready.
      // Assessment and attendance histories can be very large, so they load
      // below without holding the entire dashboard behind a loading screen.
      if (!mounted) return;

      setProfile(userProfile as Profile);
      setAssignments(assignmentRows);
      setClasses(classRows);
      setSubjects(subjectRows);
      setSemesters(semesterRows);
      setAcademicYears(yearRows);
      setEnrollments(enrollmentRows);
      setStudents(studentRows);
      setTimetableRows(timetableDataRows);
      setStaffId(staffMatch?.id ?? null);
      setDocuments(teacherDocuments);
      setDocumentYearId(currentYear?.id ?? '');
      setDocumentSemesterId(currentTerm?.id ?? '');
      setLoading(false);

      /*
       * --------------------------------------------------
       * ASSESSMENT ANALYTICS
       * --------------------------------------------------
       */

      const teacherSubjectNames =
        subjectRows.map(
          (subject) => subject.name
        );

      const [assessmentRows, attendance] = await Promise.all([
        fetchPagedAssessments({
            studentIds:
              studentRows.map(
                (student) => student.id
              ),
            schoolId:
              userProfile.school_id,
            term:
              currentTerm?.name ?? null,
            subjects:
              teacherSubjectNames,
          }).catch(() => [] as AssessmentRecord[]),
        fetchPagedAttendance(
          studentRows.map(
            (student) => student.id
          )
        ).catch(() => [] as AttendanceRow[]),
      ]);

      if (!mounted) return;
      setAssessmentRows(assessmentRows);
      setAttendanceRows(attendance);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function uploadTeachingDocument(event: React.FormEvent) {
    event.preventDefault();
    setDocumentError('');
    setDocumentMessage('');

    if (!profile || !staffId) {
      setDocumentError('Your teacher account is not linked to a teaching staff record. Ask the administrator to make sure your Staff email matches your login email.');
      return;
    }
    if (!documentFile) { setDocumentError('Choose a document to upload.'); return; }
    if (!documentYearId) { setDocumentError('Select an academic year.'); return; }
    if (!documentSemesterId) { setDocumentError('Select a semester.'); return; }
    if (documentFile.size > 10 * 1024 * 1024) { setDocumentError('The selected file is larger than 10 MB.'); return; }

    if (documentType === 'unit_specification' && documents.some((doc) =>
      doc.document_type === 'unit_specification' && doc.academic_year_id === documentYearId && doc.semester_id === documentSemesterId
    )) {
      setDocumentError('A Unit Specification Breakdown already exists for this semester.');
      return;
    }

    setUploadingDocument(true);
    const safeName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${profile.school_id}/${staffId}/${Date.now()}-${safeName}`;
    const { error: storageError } = await supabase.storage.from('staff-documents').upload(path, documentFile, { cacheControl: '3600', upsert: false });
    if (storageError) { setDocumentError(storageError.message); setUploadingDocument(false); return; }

    const { data, error: recordError } = await supabase.from('staff_teaching_documents').insert({
      staff_id: staffId, school_id: profile.school_id, document_type: documentType, academic_year_id: documentYearId,
      semester_id: documentSemesterId, title: documentTitle.trim() || DOCUMENT_LABELS[documentType], file_name: documentFile.name,
      file_path: path, file_type: documentFile.type || null, file_size: documentFile.size, uploaded_by: profile.id, notes: documentNotes.trim() || null,
    }).select('id, staff_id, document_type, academic_year_id, semester_id, title, file_name, file_path, file_type, file_size, uploaded_at, notes').single();

    if (recordError) {
      await supabase.storage.from('staff-documents').remove([path]);
      setDocumentError(recordError.message);
    } else {
      setDocuments((current) => [data as TeachingDocument, ...current]);
      setDocumentTitle(''); setDocumentNotes(''); setDocumentFile(null);
      const input = document.getElementById('teacher-document-file') as HTMLInputElement | null; if (input) input.value = '';
      setDocumentMessage('Document uploaded successfully. The administration can now see this submission.');
    }
    setUploadingDocument(false);
  }

  async function openTeachingDocument(item: TeachingDocument) {
    setDocumentError('');
    const { data, error: signedError } = await supabase.storage.from('staff-documents').createSignedUrl(item.file_path, 600);
    if (signedError || !data?.signedUrl) { setDocumentError(signedError?.message || 'The document could not be opened.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  /*
   * --------------------------------------------------
   * CURRENT SEMESTER
   * --------------------------------------------------
   */

  const currentSemester =
    useMemo(() => {
      return (
        semesters.find(
          (semester) =>
            semester.is_current
        ) ??
        semesters.find(
          (semester) =>
            semester.name ===
            'Semester 1'
        ) ??
        semesters[0] ??
        null
      );
    }, [semesters]);

  /*
   * --------------------------------------------------
   * CURRENT ACADEMIC YEAR
   * --------------------------------------------------
   */

  const currentAcademicYear =
    useMemo(() => {
      return (
        academicYears.find(
          (year) => year.is_current
        ) ??
        academicYears[0] ??
        null
      );
    }, [academicYears]);

  /*
   * --------------------------------------------------
   * MY SCHEDULE
   * --------------------------------------------------
   */

  const scheduleRows =
    useMemo(() => {
      if (!currentAcademicYear?.id) {
        return timetableRows;
      }

      return timetableRows.filter(
        (row) =>
          row.academic_year_id ===
          currentAcademicYear.id
      );
    }, [
      timetableRows,
      currentAcademicYear,
    ]);

  const todayNumber =
    new Date().getDay();

  const todaySchedule =
    useMemo(() => {
      if (
        todayNumber < 1 ||
        todayNumber > 5
      ) {
        return [];
      }

      return scheduleRows
        .filter(
          (row) =>
            row.day_of_week ===
            todayNumber
        )
        .sort(
          (a, b) =>
            timeToMinutes(
              a.start_time
            ) -
            timeToMinutes(
              b.start_time
            )
        );
    }, [
      scheduleRows,
      todayNumber,
    ]);

  const nextClass =
    useMemo(() => {
      const now = new Date();

      const nowMinutes =
        now.getHours() * 60 +
        now.getMinutes();

      const upcomingToday =
        todaySchedule.filter(
          (row) =>
            row.status !== 'cancelled' &&
            timeToMinutes(
              row.start_time
            ) >= nowMinutes
        );

      if (upcomingToday.length) {
        return upcomingToday[0];
      }

      const futureDays =
        scheduleRows
          .filter(
            (row) =>
              row.status !==
                'cancelled' &&
              row.day_of_week >
                todayNumber
          )
          .sort((a, b) => {
            if (
              a.day_of_week !==
              b.day_of_week
            ) {
              return (
                a.day_of_week -
                b.day_of_week
              );
            }

            return (
              timeToMinutes(
                a.start_time
              ) -
              timeToMinutes(
                b.start_time
              )
            );
          });

      return futureDays[0] ?? null;
    }, [
      todaySchedule,
      scheduleRows,
      todayNumber,
    ]);

  const getScheduleDetails = (
    timetable: TimetableEntry
  ) => {
    const assignment =
      assignments.find(
        (item) =>
          item.id ===
          timetable.teacher_assignment_id
      );

    const classItem =
      classes.find(
        (item) =>
          item.id ===
          assignment?.class_id
      );

    const subject =
      subjects.find(
        (item) =>
          item.id ===
          assignment?.subject_id
      );

    const semester =
      semesters.find(
        (item) =>
          item.id ===
          assignment?.term_id
      );

    return {
      assignment,
      classItem,
      subject,
      semester,
    };
  };

  /*
   * --------------------------------------------------
   * CLASS SUMMARIES
   * --------------------------------------------------
   */

  const classSummaries =
    useMemo(() => {
      return classes.map(
        (classItem) => ({
          ...classItem,

          students:
            new Set(
              enrollments
                .filter(
                  (enrollment) =>
                    enrollment.class_id ===
                    classItem.id
                )
                .map(
                  (enrollment) =>
                    enrollment.student_id
                )
            ).size,

          subjects:
            new Set(
              assignments
                .filter(
                  (assignment) =>
                    assignment.class_id ===
                    classItem.id
                )
                .map(
                  (assignment) =>
                    assignment.subject_id
                )
            ).size,
        })
      );
    }, [
      classes,
      enrollments,
      assignments,
    ]);

  /*
   * --------------------------------------------------
   * GENDER ANALYTICS
   * --------------------------------------------------
   */

  const gender =
    useMemo(() => {
      let male = 0;
      let female = 0;
      let other = 0;

      students.forEach(
        (student) => {
          const value =
            (
              student.gender ?? ''
            )
              .trim()
              .toLowerCase();

          if (
            value === 'male' ||
            value === 'm'
          ) {
            male += 1;
          } else if (
            value === 'female' ||
            value === 'f'
          ) {
            female += 1;
          } else {
            other += 1;
          }
        }
      );

      return {
        male,
        female,
        other,
        total: students.length,
      };
    }, [students]);

  /*
   * --------------------------------------------------
   * ASSESSMENT ANALYTICS
   * --------------------------------------------------
   */

  const analytics =
    useMemo(() => {
      const valid =
        assessmentRows.filter(
          (record) =>
            record.max_score > 0
        );

      const normalized =
        valid.map((record) =>
          percentage(
            Number(record.score),
            Number(record.max_score)
          )
        );

      const average =
        normalized.length
          ? normalized.reduce(
              (total, value) =>
                total + value,
              0
            ) / normalized.length
          : 0;

      const highest =
        normalized.length
          ? Math.max(...normalized)
          : 0;

      const lowest =
        normalized.length
          ? Math.min(...normalized)
          : 0;

      const passed =
        normalized.filter(
          (value) => value >= 50
        ).length;

      const submitted =
        assessmentRows.length;

      const expectedAssignments = assignments.filter(
        (assignment) =>
          !currentAcademicYear ||
          !assignment.academic_year_id ||
          assignment.academic_year_id === currentAcademicYear.id
      );

      const expectedPerType = expectedAssignments.reduce(
        (total, assignment) => {
          const matchingClassIds = assignment.class_id
            ? [assignment.class_id]
            : classes
                .filter((classItem) =>
                  !!classItem.programme_id &&
                  (assignment.programme_ids ?? []).includes(classItem.programme_id) &&
                  !!classItem.level &&
                  (assignment.forms ?? []).some(
                    (form) => form.trim().toLowerCase() === classItem.level?.trim().toLowerCase()
                  )
                )
                .map((classItem) => classItem.id);

          return total + new Set(
            enrollments
              .filter((enrollment) => matchingClassIds.includes(enrollment.class_id))
              .map((enrollment) => enrollment.student_id)
          ).size;
        },
        0
      );

      const expected =
        expectedPerType *
        ASSESSMENT_TYPES.length;

      const notSubmitted =
        Math.max(
          0,
          expected - submitted
        );

      const completion =
        expected > 0
          ? (submitted / expected) *
            100
          : 0;

      const byType =
        ASSESSMENT_TYPES.map(
          (type) => {
            const rows =
              assessmentRows.filter(
                (record) =>
                  record.assessment_type ===
                  type.name
              );

            const values =
              rows
                .filter(
                  (record) =>
                    record.max_score > 0
                )
                .map((record) =>
                  percentage(
                    Number(
                      record.score
                    ),
                    Number(
                      record.max_score
                    )
                  )
                );

            const average =
              values.length
                ? values.reduce(
                    (total, value) =>
                      total + value,
                    0
                  ) / values.length
                : 0;

            return {
              ...type,
              submitted:
                rows.length,
              expected:
                expectedPerType,
              avg: average,
            };
          }
        );

      return {
        average,
        highest,
        lowest,

        passRate:
          valid.length
            ? (passed / valid.length) *
              100
            : 0,

        submitted,
        notSubmitted,
        expected,
        completion,
        byType,
      };
    }, [
      assessmentRows,
      assignments,
      enrollments,
      currentSemester,
      currentAcademicYear,
      classes,
    ]);

  /*
   * --------------------------------------------------
   * ATTENDANCE ANALYTICS
   * --------------------------------------------------
   */

  const attendance =
    useMemo(() => {
      const present =
        attendanceRows.filter(
          (row) =>
            [
              'present',
              'late',
            ].includes(
              row.status.toLowerCase()
            )
        ).length;

      const absent =
        attendanceRows.filter(
          (row) =>
            row.status.toLowerCase() ===
            'absent'
        ).length;

      const late =
        attendanceRows.filter(
          (row) =>
            row.status.toLowerCase() ===
            'late'
        ).length;

      const excused =
        attendanceRows.filter(
          (row) =>
            row.status.toLowerCase() ===
            'excused'
        ).length;

      const percentage =
        attendanceRows.length
          ? (present /
              attendanceRows.length) *
            100
          : 0;

      return {
        present,
        absent,
        late,
        excused,
        percentage,
      };
    }, [attendanceRows]);

  /*
   * --------------------------------------------------
   * STUDENTS NEEDING ATTENTION
   * --------------------------------------------------
   */

  const attention =
    useMemo(() => {
      const items: {
        student: Student;
        kind: string;
        detail: string;
        severity:
          | 'high'
          | 'medium';
      }[] = [];

      students.forEach(
        (student) => {
          const records =
            assessmentRows.filter(
              (record) =>
                record.student_id ===
                student.id
            );

          const hasLowScore =
            records.some(
              (record) =>
                percentage(
                  Number(record.score),
                  Number(
                    record.max_score
                  )
                ) < 40
            );

          const hasMissing =
            analytics.expected >
              0 &&
            records.length === 0;

          if (hasMissing) {
            items.push({
              student,
              kind:
                'Missing assessment',
              detail:
                'No submitted assessment yet',
              severity: 'high',
            });
          } else if (
            hasLowScore
          ) {
            items.push({
              student,
              kind:
                'Low performance',
              detail:
                'At least one score below 40%',
              severity: 'high',
            });
          }
        }
      );

      const attendanceMap =
        new Map<
          string,
          {
            total: number;
            attended: number;
          }
        >();

      attendanceRows.forEach(
        (row) => {
          const current =
            attendanceMap.get(
              row.student_id
            ) ?? {
              total: 0,
              attended: 0,
            };

          current.total += 1;

          if (
            [
              'present',
              'late',
            ].includes(
              row.status.toLowerCase()
            )
          ) {
            current.attended += 1;
          }

          attendanceMap.set(
            row.student_id,
            current
          );
        }
      );

      students.forEach(
        (student) => {
          const record =
            attendanceMap.get(
              student.id
            );

          if (
            record &&
            record.total >= 3 &&
            record.attended /
              record.total <
              0.75 &&
            !items.some(
              (item) =>
                item.student.id ===
                student.id
            )
          ) {
            items.push({
              student,
              kind:
                'Low attendance',
              detail: `${Math.round(
                (record.attended /
                  record.total) *
                  100
              )}% attendance`,
              severity: 'medium',
            });
          }
        }
      );

      return items.slice(0, 8);
    }, [
      students,
      assessmentRows,
      attendanceRows,
      analytics.expected,
    ]);

  /*
   * --------------------------------------------------
   * MAIN KPI METRICS
   * --------------------------------------------------
   */

  const metrics: Metric[] = [
    {
      label: 'Total Students',
      value: students.length,
      icon:
        'fa-solid fa-user-graduate',
      detail:
        'Across assigned classes',
    },
    {
      label: 'Male Students',
      value: gender.male,
      icon:
        'fa-solid fa-person',
      detail: `${
        gender.total
          ? Math.round(
              (gender.male /
                gender.total) *
                100
            )
          : 0
      }% of students`,
    },
    {
      label: 'Female Students',
      value: gender.female,
      icon:
        'fa-solid fa-person-dress',
      detail: `${
        gender.total
          ? Math.round(
              (gender.female /
                gender.total) *
                100
            )
          : 0
      }% of students`,
    },
    {
      label: 'Assigned Classes',
      value: classes.length,
      icon:
        'fa-solid fa-school',
      detail: `${assignments.length} teaching assignments`,
    },
  ];

  /*
   * --------------------------------------------------
   * LOADING
   * --------------------------------------------------
   */

  if (loading) {
    return (
      <>
        <style jsx global>{`
          .bti-skel {
            animation: btiPulse 1.4s
              ease-in-out infinite;
          }

          @keyframes btiPulse {
            50% {
              opacity: 0.45;
            }
          }
        `}</style>

        <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-5">
            <div className="bti-skel h-56 rounded-[2rem] bg-slate-200" />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="bti-skel h-32 rounded-3xl bg-slate-200"
                  />
                )
              )}
            </div>

            <div className="bti-skel h-96 rounded-[2rem] bg-slate-200" />
          </div>
        </div>
      </>
    );
  }

  /*
   * --------------------------------------------------
   * ERROR
   * --------------------------------------------------
   */

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-200 bg-white p-8 shadow-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <i className="fa-solid fa-triangle-exclamation" />
          </div>

          <h1 className="mt-5 text-2xl font-black text-slate-900">
            Teacher dashboard could not load
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
          >
            <i className="fa-solid fa-rotate-right mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const donutTotal =
    gender.male +
    gender.female +
    gender.other;

  const maleAngle = donutTotal
    ? (gender.male / donutTotal) *
      360
    : 0;

  const femaleAngle = donutTotal
    ? (gender.female / donutTotal) *
      360
    : 0;

  return (
    <>
      <style jsx global>{`
        @keyframes btiFadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes btiGrow {
          from {
            width: 0;
          }
        }

        @keyframes btiFloat {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-5px);
          }
        }

        .bti-card-in {
          animation: btiFadeUp
            0.55s ease-out both;
        }

        .bti-grow {
          animation: btiGrow
            1s ease-out both;
        }

        .bti-float {
          animation: btiFloat
            3.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .bti-card-in,
          .bti-grow,
          .bti-float {
            animation: none;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* HERO */}

          <section className="bti-card-in relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-7 text-white shadow-2xl sm:px-8 sm:py-8">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[.04]" />

            <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-white/[.035]" />

            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-bold text-slate-200 ring-1 ring-white/10">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                    <i className="fa-solid fa-chart-pie text-[10px]" />
                  </span>
                  Teacher Analytics Workspace
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-black text-slate-900 shadow-xl sm:flex">
                    {initials(
                      profile?.full_name ??
                        'Teacher'
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-400">
                      {todayLabel()}
                    </p>

                    <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
                      Welcome,{' '}
                      {profile?.full_name ??
                        'Teacher'}
                    </h1>
                  </div>
                </div>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  A live view of your students,
                  assessment activity, academic
                  performance and teaching workload.
                </p>
              </div>

              <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/10 backdrop-blur-md lg:min-w-[270px]">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">
                  Academic Context
                </p>

                <p className="mt-1 text-lg font-black">
                  {currentAcademicYear?.name ??
                    'Academic year'}
                </p>

                <p className="text-sm text-slate-300">
                  {currentSemester?.name ??
                    'Current semester'}
                </p>

                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Analytics live
                </div>
              </div>
            </div>
          </section>

          <StaffPerformanceStars mode="teacher" />

          {/* KPI CARDS */}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(
              (metric, index) => (
                <AnimatedMetric
                  key={metric.label}
                  metric={metric}
                  delay={index * 80}
                />
              )
            )}
          </section>

          {/* MY SCHEDULE */}

          <section className="bti-card-in relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-slate-100/80" />

            <div className="relative">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-slate-500">
                    <i className="fa-solid fa-calendar-days" />
                    Teacher Schedule
                  </div>

                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                    My Schedule
                  </h2>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Your teaching timetable is now
                    available directly from your
                    dashboard.
                  </p>
                </div>

                <Link
                  href="/my-schedule"
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  <i className="fa-solid fa-calendar-week" />
                  View Full Schedule
                  <i className="fa-solid fa-arrow-right transition group-hover:translate-x-1" />
                </Link>
              </div>

              {scheduleRows.length === 0 ? (
                <div className="mt-7 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                    <i className="fa-solid fa-calendar-xmark text-xl" />
                  </div>

                  <h3 className="mt-4 text-sm font-black text-slate-800">
                    No timetable entries yet
                  </h3>

                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">
                    Once your timetable is assigned,
                    your teaching schedule will appear
                    here automatically.
                  </p>
                </div>
              ) : (
                <>
                  {/* NEXT CLASS */}

                  <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-xl">
                      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/[.05]" />

                      <div className="relative">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
                            Next Class
                          </p>

                          <span className="bti-float flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                            <i className="fa-solid fa-forward" />
                          </span>
                        </div>

                        {nextClass ? (
                          (() => {
                            const details =
                              getScheduleDetails(
                                nextClass
                              );

                            return (
                              <>
                                <p className="mt-5 text-2xl font-black">
                                  {details.subject
                                    ?.name ??
                                    'Scheduled Lesson'}
                                </p>

                                <p className="mt-1 text-sm font-semibold text-slate-300">
                                  {details.classItem
                                    ?.name ??
                                    'Assigned class'}
                                </p>

                                <div className="mt-5 flex flex-wrap gap-2">
                                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">
                                    <i className="fa-solid fa-clock mr-1.5 text-slate-400" />
                                    {formatTime(
                                      nextClass.start_time
                                    )}{' '}
                                    –{' '}
                                    {formatTime(
                                      nextClass.end_time
                                    )}
                                  </span>

                                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">
                                    <i className="fa-solid fa-calendar-day mr-1.5 text-slate-400" />
                                    {DAY_NAMES[
                                      nextClass
                                        .day_of_week
                                    ] ??
                                      'Scheduled'}
                                  </span>
                                </div>
                              </>
                            );
                          })()
                        ) : (
                          <div className="mt-6">
                            <p className="text-lg font-black">
                              No upcoming class
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Your schedule is clear for
                              the remaining timetable.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* TODAY */}

                    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
                            Today
                          </p>

                          <h3 className="mt-1 text-lg font-black text-slate-900">
                            {todayNumber >= 1 &&
                            todayNumber <= 5
                              ? DAY_NAMES[
                                  todayNumber
                                ]
                              : 'Weekend'}
                          </h3>
                        </div>

                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                          <i className="fa-solid fa-clock" />
                        </span>
                      </div>

                      {todaySchedule.length ===
                      0 ? (
                        <div className="mt-5 rounded-2xl bg-white px-4 py-5 text-center">
                          <i className="fa-solid fa-mug-hot text-slate-300" />

                          <p className="mt-2 text-xs font-black text-slate-600">
                            No classes scheduled today
                          </p>
                        </div>
                      ) : (
                        <div className="mt-5 space-y-2">
                          {todaySchedule
                            .slice(0, 4)
                            .map(
                              (entry) => {
                                const details =
                                  getScheduleDetails(
                                    entry
                                  );

                                const cancelled =
                                  entry.status ===
                                  'cancelled';

                                return (
                                  <div
                                    key={
                                      entry.id
                                    }
                                    className={`group flex items-center gap-3 rounded-2xl border p-3 transition ${
                                      cancelled
                                        ? 'border-red-100 bg-red-50/60'
                                        : 'border-white bg-white hover:-translate-y-0.5 hover:shadow-md'
                                    }`}
                                  >
                                    <div
                                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                        cancelled
                                          ? 'bg-red-100 text-red-600'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      <i
                                        className={
                                          cancelled
                                            ? 'fa-solid fa-ban'
                                            : 'fa-solid fa-book-open'
                                        }
                                      />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <p
                                        className={`truncate text-xs font-black ${
                                          cancelled
                                            ? 'text-red-700 line-through'
                                            : 'text-slate-800'
                                        }`}
                                      >
                                        {details
                                          .subject
                                          ?.name ??
                                          'Lesson'}
                                      </p>

                                      <p className="mt-0.5 truncate text-[10px] text-slate-400">
                                        {details
                                          .classItem
                                          ?.name ??
                                          'Class'}{' '}
                                        ·{' '}
                                        {formatTime(
                                          entry.start_time
                                        )}
                                      </p>
                                    </div>

                                    {cancelled ? (
                                      <span className="rounded-full bg-red-100 px-2 py-1 text-[8px] font-black uppercase text-red-600">
                                        Cancelled
                                      </span>
                                    ) : (
                                      <i className="fa-solid fa-chevron-right text-[9px] text-slate-300 transition group-hover:translate-x-0.5" />
                                    )}
                                  </div>
                                );
                              }
                            )}

                          {todaySchedule.length >
                            4 && (
                            <Link
                              href="/my-schedule"
                              className="block pt-2 text-center text-[10px] font-black text-slate-500"
                            >
                              +{' '}
                              {todaySchedule.length -
                                4}{' '}
                              more classes
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WEEKLY PREVIEW */}

                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
                        Weekly Preview
                      </p>

                      <span className="text-[10px] font-bold text-slate-400">
                        Monday – Friday
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-5">
                      {[1, 2, 3, 4, 5].map(
                        (day) => {
                          const dayEntries =
                            scheduleRows
                              .filter(
                                (entry) =>
                                  entry.day_of_week ===
                                  day
                              )
                              .sort(
                                (a, b) =>
                                  timeToMinutes(
                                    a.start_time
                                  ) -
                                  timeToMinutes(
                                    b.start_time
                                  )
                              );

                          const isToday =
                            day ===
                            todayNumber;

                          return (
                            <div
                              key={day}
                              className={`rounded-2xl border p-3 transition ${
                                isToday
                                  ? 'border-slate-900 bg-slate-950 text-white shadow-lg'
                                  : 'border-slate-100 bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <p
                                  className={`text-[10px] font-black uppercase tracking-wider ${
                                    isToday
                                      ? 'text-white'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {DAY_NAMES[day]}
                                </p>

                                {isToday && (
                                  <span className="rounded-full bg-white/10 px-2 py-1 text-[8px] font-black uppercase text-white">
                                    Today
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 space-y-2">
                                {dayEntries.length ===
                                0 ? (
                                  <p
                                    className={`py-4 text-center text-[9px] font-bold ${
                                      isToday
                                        ? 'text-slate-500'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    No classes
                                  </p>
                                ) : (
                                  dayEntries
                                    .slice(0, 3)
                                    .map(
                                      (
                                        entry
                                      ) => {
                                        const details =
                                          getScheduleDetails(
                                            entry
                                          );

                                        const cancelled =
                                          entry.status ===
                                          'cancelled';

                                        return (
                                          <div
                                            key={
                                              entry.id
                                            }
                                            className={`rounded-xl p-2.5 ${
                                              isToday
                                                ? 'bg-white/10'
                                                : 'bg-white'
                                            }`}
                                          >
                                            <p
                                              className={`truncate text-[9px] font-black ${
                                                cancelled
                                                  ? 'line-through text-red-400'
                                                  : isToday
                                                  ? 'text-white'
                                                  : 'text-slate-700'
                                              }`}
                                            >
                                              {details
                                                .subject
                                                ?.name ??
                                                'Lesson'}
                                            </p>

                                            <p
                                              className={`mt-1 text-[8px] font-semibold ${
                                                isToday
                                                  ? 'text-slate-400'
                                                  : 'text-slate-400'
                                              }`}
                                            >
                                              {formatTime(
                                                entry.start_time
                                              )}{' '}
                                              ·{' '}
                                              {details
                                                .classItem
                                                ?.name ??
                                                'Class'}
                                            </p>
                                          </div>
                                        );
                                      }
                                    )
                                )}

                                {dayEntries.length >
                                  3 && (
                                  <p
                                    className={`text-center text-[8px] font-black ${
                                      isToday
                                        ? 'text-slate-400'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    +
                                    {dayEntries.length -
                                      3}{' '}
                                    more
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* GENDER + ASSESSMENT PARTICIPATION */}

          <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">

            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Student Composition
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Gender Distribution
                  </h2>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-500">
                  {gender.total} students
                </span>
              </div>

              <div className="mt-7 flex flex-col items-center gap-7 sm:flex-row sm:justify-center">
                <div
                  className="relative h-48 w-48 shrink-0 rounded-full p-1 shadow-inner"
                  style={{
                    background: `conic-gradient(#0f172a 0deg ${maleAngle}deg,#94a3b8 ${maleAngle}deg ${
                      maleAngle + femaleAngle
                    }deg,#e2e8f0 ${
                      maleAngle + femaleAngle
                    }deg 360deg)`,
                  }}
                >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white shadow-inner">
                    <div className="text-center">
                      <p className="text-3xl font-black text-slate-950">
                        {gender.total}
                      </p>

                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Students
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-xs space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-600">
                        Male
                      </span>

                      <b>{gender.male}</b>
                    </div>

                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className="bti-grow h-2 rounded-full bg-slate-900"
                        style={{
                          width: `${
                            gender.total
                              ? (gender.male /
                                  gender.total) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-600">
                        Female
                      </span>

                      <b>{gender.female}</b>
                    </div>

                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className="bti-grow h-2 rounded-full bg-slate-400"
                        style={{
                          width: `${
                            gender.total
                              ? (gender.female /
                                  gender.total) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {gender.other > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-600">
                        Other / Unspecified
                      </span>

                      <b>{gender.other}</b>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Assessment Participation
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Submission Coverage
                  </h2>
                </div>

                <i className="fa-solid fa-clipboard-check rounded-2xl bg-slate-100 p-3 text-slate-700" />
              </div>

              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-4xl font-black text-slate-950">
                    {Math.round(
                      analytics.completion
                    )}
                    %
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Overall assessment completion
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-black text-emerald-600">
                    {analytics.submitted}{' '}
                    submitted
                  </p>

                  <p className="text-sm font-black text-slate-400">
                    {analytics.notSubmitted}{' '}
                    not submitted
                  </p>
                </div>
              </div>

              <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="bti-grow h-full rounded-full bg-gradient-to-r from-slate-950 to-slate-500"
                  style={{
                    width: `${Math.min(
                      100,
                      analytics.completion
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
                <i className="fa-solid fa-circle-info mr-2 text-slate-400" />

                A blank assessment has{' '}
                <b>no database row</b>, while a
                recorded score of <b>0</b> is
                treated as submitted. This keeps
                academic participation separate
                from performance.
              </div>
            </div>
          </section>

          {/* PERFORMANCE + ATTENDANCE */}

          <section className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Academic Performance
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Performance Snapshot
                  </h2>
                </div>

                <Link
                  href="/results"
                  className="rounded-xl bg-slate-950 px-3 py-2 text-[10px] font-black text-white"
                >
                  View Results
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">
                    Average
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {analytics.average.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">
                    Highest
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {analytics.highest.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">
                    Lowest
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {analytics.lowest.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">
                    Pass Rate
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {analytics.passRate.toFixed(
                      1
                    )}
                    %
                  </p>
                </div>
              </div>

              <div className="mt-7 space-y-4">
                {analytics.byType.map(
                  (item) => (
                    <div key={item.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="font-bold text-slate-700">
                          {item.name}
                        </span>

                        <span className="font-black text-slate-500">
                          {item.submitted}{' '}
                          submitted ·{' '}
                          {item.avg.toFixed(0)}
                          % avg
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="bti-grow h-full rounded-full bg-slate-900"
                          style={{
                            width: `${Math.min(
                              100,
                              item.avg
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                  Attendance Health
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Attendance Overview
                </h2>
              </div>

              <div className="mt-6 flex items-center gap-5">
                <div
                  className="relative h-32 w-32 shrink-0 rounded-full"
                  style={{
                    background: `conic-gradient(#0f172a 0deg ${
                      attendance.percentage *
                      3.6
                    }deg,#e2e8f0 ${
                      attendance.percentage *
                      3.6
                    }deg 360deg)`,
                  }}
                >
                  <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white">
                    <div className="text-center">
                      <p className="text-2xl font-black">
                        {Math.round(
                          attendance.percentage
                        )}
                        %
                      </p>

                      <p className="text-[9px] font-black uppercase text-slate-400">
                        Attended
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p>
                    <b className="text-slate-900">
                      {attendance.present}
                    </b>{' '}
                    attended
                  </p>

                  <p>
                    <b className="text-amber-600">
                      {attendance.late}
                    </b>{' '}
                    late
                  </p>

                  <p>
                    <b className="text-red-600">
                      {attendance.absent}
                    </b>{' '}
                    absent
                  </p>

                  <p>
                    <b className="text-blue-600">
                      {attendance.excused}
                    </b>{' '}
                    excused
                  </p>
                </div>
              </div>

              <Link
                href="/attendance-reports"
                className="mt-6 inline-flex items-center gap-2 text-xs font-black text-slate-700"
              >
                Open attendance reports
                <i className="fa-solid fa-arrow-right" />
              </Link>
            </div>
          </section>

          {/* ASSESSMENT TYPE ACTIVITY */}

          <section className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                  Teaching Intelligence
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Assessment Activity by Type
                </h2>
              </div>

              <p className="text-xs font-semibold text-slate-400">
                Submitted scores across your current
                teaching scope
              </p>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {analytics.byType.map(
                (item) => (
                  <div
                    key={item.name}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black text-slate-700">
                        {item.name}
                      </span>

                      <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-500">
                        /{item.max}
                      </span>
                    </div>

                    <p className="mt-4 text-2xl font-black text-slate-950">
                      {item.submitted}
                    </p>

                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      submitted
                    </p>

                    <div className="mt-3 h-1.5 rounded-full bg-white">
                      <div
                        className="bti-grow h-1.5 rounded-full bg-slate-900"
                        style={{
                          width: `${
                            item.expected
                              ? Math.min(
                                  100,
                                  (item.submitted /
                                    item.expected) *
                                    100
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          {/* ATTENTION + CLASSES */}

          <section className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Student Support
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Students Needing Attention
                  </h2>
                </div>

                <span className="rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-black text-red-600">
                  {attention.length} flagged
                </span>
              </div>

              {attention.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <i className="fa-solid fa-circle-check text-xl" />
                  </div>

                  <p className="mt-4 text-sm font-black text-slate-800">
                    No immediate concerns
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Your current analytics show no
                    flagged students.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {attention.map(
                    (item) => (
                      <div
                        key={`${item.student.id}-${item.kind}`}
                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
                          {initials(
                            item.student.full_name
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-slate-800">
                            {item.student.full_name}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {item.detail}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2 py-1 text-[9px] font-black ${
                            item.severity ===
                            'high'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {item.kind}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="bti-card-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Teaching Overview
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    My Classes
                  </h2>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-500">
                  {classes.length} classes
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {classSummaries.length ===
                0 ? (
                  <p className="py-10 text-center text-sm font-bold text-slate-400">
                    No classes assigned.
                  </p>
                ) : (
                  classSummaries
                    .slice(0, 6)
                    .map((classItem) => (
                      <div
                        key={classItem.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3.5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                            <i className="fa-solid fa-school" />
                          </div>

                          <div>
                            <p className="text-sm font-black text-slate-800">
                              {classItem.name}
                            </p>

                            <p className="text-[10px] text-slate-400">
                              {classItem.level ??
                                'Assigned class'}{' '}
                              ·{' '}
                              {classItem.students}{' '}
                              students
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-black text-slate-600">
                          {classItem.subjects}{' '}
                          subjects
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </section>

          {/* TEACHING DOCUMENTS */}
          <section className="bti-card-in overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-6 sm:px-7">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Professional Records</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">My Teaching Documents</h2>
                  <p className="mt-1 text-xs text-slate-500">Upload your USB, LSP and POWD directly from your teacher portal.</p>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">{documents.length} documents</span>
              </div>
            </div>
            <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[1fr_1.15fr]">
              <form onSubmit={uploadTeachingDocument} className="rounded-3xl bg-slate-50 p-5">
                <div className="grid gap-4">
                  <label className="text-xs font-black text-slate-700">Document Type
                    <select value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none">
                      <option value="unit_specification">USB — Unit Specification Breakdown</option>
                      <option value="learning_session_plan">LSP — Learning Session Plan</option>
                      <option value="particulars_of_work_done">POWD — Particulars of Work Done</option>
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-black text-slate-700">Academic Year
                      <select value={documentYearId} onChange={(e) => setDocumentYearId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none">
                        <option value="">Select year</option>{academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-black text-slate-700">Semester
                      <select value={documentSemesterId} onChange={(e) => setDocumentSemesterId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none">
                        <option value="">Select semester</option>{semesters.filter((sem) => !documentYearId || sem.academic_year_id === documentYearId).map((sem) => <option key={sem.id} value={sem.id}>{sem.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <input value={documentTitle} onChange={(e) => setDocumentTitle(e.target.value)} placeholder="Optional document title" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none" />
                  <textarea value={documentNotes} onChange={(e) => setDocumentNotes(e.target.value)} placeholder="Optional notes" rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none" />
                  <input id="teacher-document-file" type="file" onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)} className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs" />
                  {!staffId && <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700"><i className="fa-solid fa-triangle-exclamation mr-2" />Your login email must match your Teaching Staff email before uploads can be accepted.</p>}
                  {documentError && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{documentError}</p>}
                  {documentMessage && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{documentMessage}</p>}
                  <button disabled={uploadingDocument || !staffId} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <i className={`mr-2 ${uploadingDocument ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-cloud-arrow-up'}`} />{uploadingDocument ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
              </form>
              <div>
                <div className="grid gap-3 sm:grid-cols-3">{(['unit_specification','learning_session_plan','particulars_of_work_done'] as DocumentType[]).map((type) => <div key={type} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><i className={`${DOCUMENT_ICONS[type]} text-slate-500`} /><p className="mt-3 text-2xl font-black text-slate-900">{documents.filter((doc) => doc.document_type === type).length}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wide text-slate-400">{type === 'unit_specification' ? 'USB' : type === 'learning_session_plan' ? 'LSP' : 'POWD'}</p></div>)}</div>
                <div className="mt-4 space-y-2">{documents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400"><i className="fa-solid fa-folder-open mb-3 block text-2xl" />No teaching documents uploaded yet.</div> : documents.slice(0, 8).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><i className={DOCUMENT_ICONS[item.document_type]} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-slate-800">{item.title}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{item.file_name}</p></div><button type="button" onClick={() => openTeachingDocument(item)} className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-200"><i className="fa-solid fa-arrow-up-right-from-square mr-1" />Open</button></div>)}</div>
              </div>
            </div>
          </section>

          {/* QUICK ACTIONS */}

          <section className="bti-card-in">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                  Teaching Tools
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Quick Actions
                </h2>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {quickActions.map(
                (action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        <i
                          className={
                            action.icon
                          }
                        />
                      </span>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase text-slate-500">
                        {action.badge}
                      </span>
                    </div>

                    <h3 className="mt-5 font-black text-slate-900">
                      {action.title}
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {action.description}
                    </p>

                    <div className="mt-4 text-xs font-black text-slate-700">
                      Open Tool
                      <i className="fa-solid fa-arrow-right ml-1 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                )
              )}
            </div>
          </section>

          {/* ASSIGNMENTS */}

          <section className="bti-card-in overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-6 sm:px-7">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                    Teaching Load
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    My Assignments
                  </h2>
                </div>

                <span className="w-fit rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
                  {assignments.length}{' '}
                  assignments
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-4">
                      Department / Form
                    </th>

                    <th className="px-6 py-4">
                      Subject
                    </th>

                    <th className="px-6 py-4">
                      Forms
                    </th>

                    <th className="px-6 py-4">
                      Academic Year
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {assignments.map(
                    (assignment) => {
                      const classItem =
                        classes.find(
                          (item) =>
                            item.id ===
                            assignment.class_id
                        );

                      const subject =
                        subjects.find(
                          (item) =>
                            item.id ===
                            assignment.subject_id
                        );

                      const year = academicYears.find((item) => item.id === assignment.academic_year_id);
                      const departmentCount = assignment.programme_ids?.length ?? 0;

                      return (
                        <tr
                          key={assignment.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-6 py-4 font-black text-slate-800">
                            {classItem?.name ?? (departmentCount ? `${departmentCount} department${departmentCount === 1 ? '' : 's'}` : '—')}
                          </td>

                          <td className="px-6 py-4 font-bold text-slate-700">
                            {subject?.name ??
                              '—'}
                          </td>

                          <td className="px-6 py-4 text-slate-600">
                            {assignment.forms?.join(', ') || '—'}
                          </td>

                          <td className="px-6 py-4 text-slate-600">
                            {year?.name ??
                              '—'}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* FOOTER */}

          <footer className="border-t border-slate-200 pt-5 pb-4 text-center text-[11px] text-slate-400 sm:flex sm:justify-between">
            <span>
              <i className="fa-solid fa-shield-halved mr-1.5" />
              BIRITECH SMS Teacher Workspace
            </span>

            <span>
              <i className="fa-solid fa-graduation-cap mr-1.5" />
              Biriwa Technical Institute
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}

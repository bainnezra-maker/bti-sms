'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Status = 'present' | 'absent' | 'excused' | 'late';

type AcademicYear = { id: string; name: string; is_current: boolean };
type Programme = { id: string; name: string; code: string | null };
type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
  academic_year_id: string | null;
};
type Assignment = {
  id: string;
  academic_year_id: string | null;
  subject_id: string | null;
  programme_ids: string[] | null;
  forms: string[] | null;
};
type Subject = {
  id: string;
  name: string;
  code: string | null;
};
type StudentRow = {
  id: string;
  full_name: string;
  admission_number: string;
  classId: string;
  className: string;
  form: string | null;
  programmeId: string | null;
  programmeName: string | null;
};
type UserProfile = {
  id: string;
  full_name?: string | null;
  school_id: string;
  role: string;
  is_active: boolean | null;
};

const STATUS_OPTIONS: Status[] = ['present', 'absent', 'excused', 'late'];

function todayString() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function label(status: Status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function icon(status: Status) {
  if (status === 'present') return 'fa-solid fa-circle-check';
  if (status === 'absent') return 'fa-solid fa-circle-xmark';
  if (status === 'late') return 'fa-solid fa-clock';
  return 'fa-solid fa-shield-heart';
}

function activeStyle(status: Status) {
  if (status === 'present') return 'border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/20';
  if (status === 'absent') return 'border-red-600 bg-red-600 text-white shadow-red-600/20';
  if (status === 'late') return 'border-amber-500 bg-amber-500 text-white shadow-amber-500/20';
  return 'border-violet-600 bg-violet-600 text-white shadow-violet-600/20';
}

export default function AttendancePage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedForm, setSelectedForm] = useState('all');
  const [selectedProgramme, setSelectedProgramme] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [search, setSearch] = useState('');

  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info');

  useEffect(() => {
    async function loadSetup() {
      try {
        setLoading(true);
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) throw new Error('You are not logged in.');

        const { data: p, error: pError } = await supabase
          .from('users')
          .select('id, full_name, school_id, role, is_active')
          .eq('id', user.id)
          .single();

        if (pError || !p?.school_id || p.is_active === false) {
          throw new Error(pError?.message || 'Could not load your active school account.');
        }

        let typed = p as UserProfile;
        if (typed.role === 'owner') {
          const { data: delegatedTeacher, error: delegatedError } = await supabase
            .from('users')
            .select('id, full_name, school_id, role, is_active')
            .eq('school_id', typed.school_id)
            .eq('role', 'teacher')
            .eq('full_name', typed.full_name)
            .eq('is_active', true)
            .maybeSingle();
          if (delegatedError || !delegatedTeacher) throw new Error('Your Owner account could not find the linked Ezra teacher profile.');
          typed = delegatedTeacher as UserProfile;
        }
        if (typed.role !== 'teacher') throw new Error('This attendance page is for teachers.');
        setProfile(typed);

        const [yearsResult, programmesResult, subjectsResult, assignmentsResult] = await Promise.all([
          supabase
            .from('academic_years')
            .select('id, name, is_current')
            .eq('school_id', typed.school_id)
            .order('name', { ascending: false }),
          supabase
            .from('programmes')
            .select('id, name, code')
            .eq('school_id', typed.school_id)
            .order('name'),
          supabase
            .from('subjects')
            .select('id, name, code')
            .eq('school_id', typed.school_id)
            .order('name'),
          supabase
            .from('teacher_assignments')
            .select('id, academic_year_id, subject_id, programme_ids, forms')
            .eq('teacher_id', typed.id),
        ]);

        if (yearsResult.error) throw yearsResult.error;
        if (programmesResult.error) throw programmesResult.error;
        if (subjectsResult.error) throw subjectsResult.error;
        if (assignmentsResult.error) throw assignmentsResult.error;

        const years = (yearsResult.data ?? []) as AcademicYear[];
        const allProgrammes = (programmesResult.data ?? []) as Programme[];
        const allSubjects = (subjectsResult.data ?? []) as Subject[];
        const teacherAssignments = (assignmentsResult.data ?? []) as Assignment[];

        setAcademicYears(years);
        setProgrammes(allProgrammes);
        setSubjects(allSubjects);
        setAssignments(teacherAssignments);

        const assignmentYearIds = new Set(
          teacherAssignments.map(a => a.academic_year_id).filter(Boolean)
        );
        const preferred =
          years.find(y => y.is_current && assignmentYearIds.has(y.id)) ??
          years.find(y => assignmentYearIds.has(y.id)) ??
          years.find(y => y.is_current) ??
          years[0];

        if (preferred) setSelectedYear(preferred.id);
      } catch (err: any) {
        setMessageType('error');
        setMessage(err?.message || 'Unable to prepare attendance.');
      } finally {
        setLoading(false);
      }
    }
    loadSetup();
  }, []);

  const yearAssignments = useMemo(
    () => assignments.filter(a => a.academic_year_id === selectedYear),
    [assignments, selectedYear]
  );

  const assignedSubjects = useMemo(() => {
    const ids = Array.from(new Set(yearAssignments.map(a => a.subject_id).filter(Boolean))) as string[];
    return subjects.filter(s => ids.includes(s.id));
  }, [yearAssignments, subjects]);

  useEffect(() => {
    if (!selectedYear) return;
    if (!assignedSubjects.some(s => s.id === selectedSubject)) {
      setSelectedSubject(assignedSubjects[0]?.id ?? '');
    }
  }, [selectedYear, assignedSubjects, selectedSubject]);

  const subjectAssignments = useMemo(
    () => yearAssignments.filter(a => a.subject_id === selectedSubject),
    [yearAssignments, selectedSubject]
  );

  const assignedForms = useMemo(
    () => Array.from(new Set(subjectAssignments.flatMap(a => a.forms ?? []))).sort(),
    [subjectAssignments]
  );

  const assignedProgrammeIds = useMemo(
    () => Array.from(new Set(subjectAssignments.flatMap(a => a.programme_ids ?? []))),
    [subjectAssignments]
  );

  const assignedProgrammes = useMemo(
    () => programmes.filter(p => assignedProgrammeIds.includes(p.id)),
    [programmes, assignedProgrammeIds]
  );

  useEffect(() => {
    async function loadClasses() {
      if (!profile || !selectedYear || !assignedProgrammeIds.length || !assignedForms.length) {
        setClasses([]);
        return;
      }

      const { data, error } = await supabase
        .from('classes')
        .select('id, name, level, programme_id, academic_year_id')
        .eq('school_id', profile.school_id)
        .eq('academic_year_id', selectedYear)
        .in('programme_id', assignedProgrammeIds)
        .in('level', assignedForms)
        .order('name');

      if (error) {
        setMessageType('error');
        setMessage(`Could not load assigned classes: ${error.message}`);
        setClasses([]);
        return;
      }

      const authorized = ((data ?? []) as ClassItem[]).filter(c =>
        subjectAssignments.some(a =>
          (a.programme_ids ?? []).includes(c.programme_id ?? '') &&
          (a.forms ?? []).includes(c.level ?? '')
        )
      );
      setClasses(authorized);
    }
    loadClasses();
  }, [profile, selectedYear, selectedSubject, assignedProgrammeIds.join('|'), assignedForms.join('|')]);

  const visibleClasses = useMemo(() => {
    return classes.filter(c => {
      if (selectedForm !== 'all' && c.level !== selectedForm) return false;
      if (selectedProgramme !== 'all' && c.programme_id !== selectedProgramme) return false;
      if (selectedClass !== 'all' && c.name !== selectedClass) return false;
      return true;
    });
  }, [classes, selectedForm, selectedProgramme, selectedClass]);

  const classOptions = useMemo(
    () => Array.from(new Set(
      classes
        .filter(c => selectedForm === 'all' || c.level === selectedForm)
        .filter(c => selectedProgramme === 'all' || c.programme_id === selectedProgramme)
        .map(c => c.name)
    )).sort(),
    [classes, selectedForm, selectedProgramme]
  );

  useEffect(() => {
    async function loadStudents() {
      if (!profile || !selectedYear || visibleClasses.length === 0) {
        setStudents([]);
        setMarks({});
        return;
      }

      setLoadingStudents(true);
      setMessage('');

      const classIds = visibleClasses.map(c => c.id);
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('student_id, class_id')
        .in('class_id', classIds)
        .eq('academic_year_id', selectedYear)
        .eq('status', 'active');

      if (enrollmentError) {
        setMessageType('error');
        setMessage(`Could not load enrollment: ${enrollmentError.message}`);
        setStudents([]);
        setLoadingStudents(false);
        return;
      }

      const enrollmentRows = enrollmentData ?? [];
      const studentIds = Array.from(new Set(enrollmentRows.map(e => e.student_id)));

      if (!studentIds.length) {
        setStudents([]);
        setMarks({});
        setLoadingStudents(false);
        return;
      }

      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, full_name, admission_number')
        .eq('school_id', profile.school_id)
        .eq('status', 'active')
        .in('id', studentIds)
        .order('full_name');

      if (studentError) {
        setMessageType('error');
        setMessage(`Could not load students: ${studentError.message}`);
        setStudents([]);
        setLoadingStudents(false);
        return;
      }

      const classMap = new Map(classes.map(c => [c.id, c]));
      const programmeMap = new Map(programmes.map(p => [p.id, p]));
      const enrollmentByStudent = new Map(enrollmentRows.map(e => [e.student_id, e.class_id]));

      const rows: StudentRow[] = (studentData ?? []).map(s => {
        const classId = enrollmentByStudent.get(s.id) ?? '';
        const cls = classMap.get(classId);
        const prog = cls?.programme_id ? programmeMap.get(cls.programme_id) : null;
        return {
          id: s.id,
          full_name: s.full_name,
          admission_number: s.admission_number,
          classId,
          className: cls?.name ?? '—',
          form: cls?.level ?? null,
          programmeId: cls?.programme_id ?? null,
          programmeName: prog?.name ?? null,
        };
      });

      setStudents(rows);
      setMarks(Object.fromEntries(rows.map(s => [s.id, 'present' as Status])));
      setLoadingStudents(false);
    }
    loadStudents();
  }, [profile, selectedYear, visibleClasses.map(c => c.id).join('|')]);

  useEffect(() => {
    async function loadExistingAttendance() {
      if (!selectedDate || !students.length) return;
      setLoadingAttendance(true);

      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status')
        .in('student_id', students.map(s => s.id))
        .eq('date', selectedDate)
        .eq('subject_id', selectedSubject);

      if (error) {
        setMessageType('error');
        setMessage(`Could not load attendance: ${error.message}`);
        setLoadingAttendance(false);
        return;
      }

      const next: Record<string, Status> = Object.fromEntries(
        students.map(s => [s.id, 'present' as Status])
      );
      (data ?? []).forEach((r: any) => {
        if (STATUS_OPTIONS.includes(r.status as Status)) next[r.student_id] = r.status as Status;
      });
      setMarks(next);
      setLoadingAttendance(false);
    }
    loadExistingAttendance();
  }, [selectedDate, selectedSubject, students.map(s => s.id).join('|')]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      s.full_name.toLowerCase().includes(q) ||
      s.admission_number.toLowerCase().includes(q) ||
      (s.programmeName ?? '').toLowerCase().includes(q) ||
      (s.form ?? '').toLowerCase().includes(q) ||
      s.className.toLowerCase().includes(q)
    );
  }, [students, search]);

  const counts = useMemo(() => {
    const result = { total: students.length, present: 0, absent: 0, excused: 0, late: 0 };
    students.forEach(s => {
      const status = marks[s.id];
      if (status) result[status]++;
    });
    return result;
  }, [students, marks]);

  const percentage = counts.total
    ? ((counts.present + counts.late) / counts.total) * 100
    : 0;

  function setMark(id: string, status: Status) {
    setMarks(previous => ({ ...previous, [id]: status }));
  }

  function markAll(status: Status) {
    setMarks(previous => {
      const next = { ...previous };
      filteredStudents.forEach(student => { next[student.id] = status; });
      return next;
    });
  }

  async function saveAttendance() {
    if (!profile || !selectedSubject || !students.length || !selectedDate) {
      setMessageType('error');
      setMessage('Select an assigned subject and a group with students before submitting attendance.');
      return;
    }

    setSaving(true);
    setMessage('');

    const rows = students.map(student => ({
      student_id: student.id,
      school_id: profile.school_id,
      class_id: student.classId,
      date: selectedDate,
      subject_id: selectedSubject,
      status: marks[student.id] ?? 'present',
      recorded_by: profile.id,
      submitted_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'student_id,date,subject_id' });

    if (error) {
      setMessageType('error');
      setMessage(`Could not submit attendance: ${error.message}`);
    } else {
      setMessageType('success');
      setMessage(
        `Attendance submitted for ${students.length} students — ${counts.present} present, ${counts.absent} absent, ${counts.late} late and ${counts.excused} excused.`
      );
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-12 text-center shadow-sm">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-blue-600" />
          <p className="mt-4 font-bold text-slate-800">Loading Teacher Attendance...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @keyframes btiAttendanceFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .bti-attendance-fade { animation: btiAttendanceFadeUp .45s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .bti-attendance-fade { animation: none; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <section className="bti-attendance-fade overflow-hidden rounded-[30px] bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-6 text-white shadow-xl sm:p-8">
            <div className="flex items-center justify-between gap-5">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
                  <i className="fa-solid fa-calendar-check" /> Teacher Attendance Workspace
                </span>
                <h1 className="mt-5 text-3xl font-black sm:text-4xl">Take Attendance</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100 sm:text-base">
                  Select your assigned form, department and class, then mark each student in real time.
                </p>
                {profile?.full_name && <p className="mt-4 font-bold">Welcome, {profile.full_name}</p>}
              </div>
              <div className="hidden h-24 w-24 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-4xl sm:flex">
                <i className="fa-solid fa-clipboard-user" />
              </div>
            </div>
          </section>

          <section className="bti-attendance-fade rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="font-black text-slate-900">Attendance Register</h2>
              <p className="mt-1 text-xs text-slate-500">
                “All” combines students across the areas assigned to you.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <Filter label="Academic Year">
                <select value={selectedYear} onChange={e => {
                  setSelectedYear(e.target.value);
                  setSelectedForm('all'); setSelectedProgramme('all'); setSelectedClass('all');
                }} className="bti-select">
                  {academicYears.length === 0 && <option value="">No assigned academic year</option>}
                  {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' — Current' : ''}</option>)}
                </select>
              </Filter>

              <Filter label="Subject">
                <select value={selectedSubject} onChange={e => {
                  setSelectedSubject(e.target.value);
                  setSelectedForm('all'); setSelectedProgramme('all'); setSelectedClass('all');
                }} className="bti-select" disabled={!selectedYear || assignedSubjects.length === 0}>
                  <option value="">Select Subject</option>
                  {assignedSubjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                </select>
              </Filter>

              <Filter label="Form">
                <select value={selectedForm} onChange={e => {
                  setSelectedForm(e.target.value); setSelectedProgramme('all'); setSelectedClass('all');
                }} className="bti-select">
                  <option value="all">All Assigned Forms</option>
                  {assignedForms.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Filter>

              <Filter label="Department / Programme">
                <select value={selectedProgramme} onChange={e => {
                  setSelectedProgramme(e.target.value); setSelectedClass('all');
                }} className="bti-select">
                  <option value="all">All Departments</option>
                  {assignedProgrammes.map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
                </select>
              </Filter>

              <Filter label="Class">
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="bti-select">
                  <option value="all">All Classes</option>
                  {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Filter>

              <Filter label="Attendance Date">
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bti-select" />
              </Filter>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-cyan-700">
                {subjects.find(s => s.id === selectedSubject)?.name || 'No Subject Selected'}
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{selectedForm === 'all' ? 'All Assigned Forms' : selectedForm}</span>
              <span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-700">
                {selectedProgramme === 'all' ? 'All Departments' : assignedProgrammes.find(p => p.id === selectedProgramme)?.name}
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{selectedClass === 'all' ? 'All Classes' : selectedClass}</span>
            </div>
          </section>

          {message && (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              messageType === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
              messageType === 'error' ? 'border-red-200 bg-red-50 text-red-800' :
              'border-blue-200 bg-blue-50 text-blue-800'
            }`}>
              <i className={`mr-2 ${messageType === 'success' ? 'fa-solid fa-circle-check' : messageType === 'error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-info'}`} />
              {message}
            </div>
          )}

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ['Total', counts.total, 'fa-solid fa-users', 'bg-slate-50 text-slate-700'],
              ['Present', counts.present, 'fa-solid fa-circle-check', 'bg-emerald-50 text-emerald-700'],
              ['Absent', counts.absent, 'fa-solid fa-circle-xmark', 'bg-red-50 text-red-700'],
              ['Excused', counts.excused, 'fa-solid fa-shield-heart', 'bg-violet-50 text-violet-700'],
              ['Late', counts.late, 'fa-solid fa-clock', 'bg-amber-50 text-amber-700'],
              ['Attendance', `${percentage.toFixed(1)}%`, 'fa-solid fa-chart-line', 'bg-blue-50 text-blue-700'],
            ].map(([name, value, cardIcon, style]) => (
              <div key={String(name)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${style}`}><i className={String(cardIcon)} /></div>
                <p className="mt-3 text-xs font-bold text-slate-500">{name}</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-black text-slate-900">Student Attendance List</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedDate} • {students.length} student{students.length === 1 ? '' : 's'} in the selected group
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Quick status="present" onClick={() => markAll('present')} />
                  <Quick status="absent" onClick={() => markAll('absent')} />
                  <Quick status="excused" onClick={() => markAll('excused')} />
                  <Quick status="late" onClick={() => markAll('late')} />
                </div>
              </div>

              <div className="relative mt-5">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, admission number, form, department or class..."
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
              </div>
            </div>

            {(loadingStudents || loadingAttendance) && (
              <div className="p-12 text-center text-blue-600">
                <i className="fa-solid fa-spinner fa-spin text-2xl" />
                <p className="mt-3 text-sm font-bold text-slate-700">Loading attendance register...</p>
              </div>
            )}

            {!loadingStudents && !loadingAttendance && filteredStudents.length === 0 && (
              <div className="p-12 text-center">
                <i className="fa-solid fa-users-slash text-3xl text-slate-300" />
                <p className="mt-4 font-bold text-slate-700">No students found for this selection.</p>
                <p className="mt-1 text-sm text-slate-500">Choose another assigned form, department or class.</p>
              </div>
            )}

            {!loadingStudents && !loadingAttendance && filteredStudents.length > 0 && (
              <div className="divide-y divide-slate-100">
                {filteredStudents.map((student, index) => (
                  <div key={student.id} className="p-4 transition hover:bg-slate-50 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600">{index + 1}</div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">{student.full_name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {student.admission_number} • {student.form ?? '—'} • {student.programmeName ?? '—'} • Class {student.className}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {STATUS_OPTIONS.map(status => {
                          const active = marks[student.id] === status;
                          return (
                            <button key={status} type="button" onClick={() => setMark(student.id, status)}
                              className={`inline-flex min-w-[104px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black transition ${
                                active ? `${activeStyle(status)} shadow-md` : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:bg-slate-50'
                              }`}>
                              <i className={icon(status)} /> {label(status)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {students.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="text-xs font-semibold text-slate-600">
                  <strong>{counts.present}</strong> Present • <strong>{counts.absent}</strong> Absent • <strong>{counts.excused}</strong> Excused • <strong>{counts.late}</strong> Late
                </div>
                <button type="button" onClick={saveAttendance} disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60">
                  <i className={saving ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-paper-plane'} />
                  {saving ? 'Submitting Attendance...' : 'Submit Attendance'}
                </button>
              </div>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <Link href="/teacher/classes" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">
              <i className="fa-solid fa-arrow-left mr-2" />My Classes
            </Link>
            <Link href="/attendance-reports" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">
              <i className="fa-solid fa-chart-column mr-2" />Attendance Reports
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bti-select {
          width: 100%;
          border-radius: .75rem;
          border: 1px solid rgb(226 232 240);
          background: rgb(248 250 252);
          padding: .75rem 1rem;
          font-size: .875rem;
          font-weight: 600;
          color: rgb(51 65 85);
          outline: none;
        }
        .bti-select:focus {
          border-color: rgb(59 130 246);
          background: white;
          box-shadow: 0 0 0 4px rgb(219 234 254);
        }
      `}</style>

      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" />
    </>
  );
}

function Filter({ label: title, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">{title}</label>
      {children}
    </div>
  );
}

function Quick({ status, onClick }: { status: Status; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50">
      <i className={icon(status)} /> {label(status)} All
    </button>
  );
}

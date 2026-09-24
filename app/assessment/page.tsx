'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

type AcademicYear = { id: string; name: string };
type Term = { id: string; name: string; academic_year_id: string };
type Programme = { id: string; name: string; code: string | null };
type Subject = { id: string; name: string; code: string | null };
type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
  academic_year_id: string | null;
};
type Assignment = {
  id: string;
  academic_year_id: string;
  subject_id: string;
  programme_ids: string[] | null;
  forms: string[] | null;
};
type Student = { id: string; full_name: string; admission_number: string };
type AssessmentRecord = {
  id: string;
  student_id: string;
  score: number;
  max_score: number;
  assessment_type: string;
  subject_id: string | null;
  academic_year_id: string | null;
  term_id: string | null;
  term: string | null;
  class_id: string | null;
};

const supabase = createClient();

const SEMESTER_NAMES = ['Semester 1', 'Semester 2'];

const CA_TYPES = [
  { value: 'Exercise 1', label: 'Exercise 1', max: 10 },
  { value: 'Exercise 2', label: 'Exercise 2', max: 10 },
  { value: 'Exercise 3', label: 'Exercise 3', max: 10 },
  { value: 'Exercise 4', label: 'Exercise 4', max: 10 },
  { value: 'Class Test 1', label: 'Class Test 1', max: 20 },
  { value: 'Class Test 2', label: 'Class Test 2', max: 20 },
  { value: 'Class Test 3', label: 'Class Test 3', max: 20 },
];

const EXAM_TYPE = { value: 'Examination', label: 'Examination', max: 100 };
const ALL_TYPES = [...CA_TYPES, EXAM_TYPE];

function normalForm(level: string | null) {
  if (!level) return '';
  const v = level.trim().toLowerCase();
  if (v === '1' || v === 'form1' || v.includes('form 1')) return 'Form 1';
  if (v === '2' || v === 'form2' || v.includes('form 2')) return 'Form 2';
  if (v === '3' || v === 'form3' || v.includes('form 3')) return 'Form 3';
  return level;
}

function percentage(score: number, max: number) {
  return max > 0 ? (score / max) * 100 : 0;
}
function grade(p: number) {
  if (p >= 80) return 'A';
  if (p >= 70) return 'B';
  if (p >= 60) return 'C';
  if (p >= 50) return 'D';
  if (p >= 40) return 'E';
  return 'F';
}

export default function AssessmentPage() {
  const [schoolId, setSchoolId] = useState('');
  const [teacherId, setTeacherId] = useState('');

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [existing, setExisting] = useState<AssessmentRecord[]>([]);

  const [yearId, setYearId] = useState('');
  const [semester, setSemester] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [form, setForm] = useState('');
  const [programmeId, setProgrammeId] = useState('');
  const [classId, setClassId] = useState('');
  const [assessmentType, setAssessmentType] = useState('');
  const [scores, setScores] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function setup() {
      setLoading(true);
      setError('');

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setError('You are not logged in.');
        setLoading(false);
        return;
      }

      const { data: signedInProfile, error: profileError } = await supabase
        .from('users')
        .select('id, full_name, school_id, role, is_active')
        .eq('id', auth.user.id)
        .single();

      if (profileError || !signedInProfile) {
        setError(profileError?.message || 'Teacher profile could not be loaded.');
        setLoading(false);
        return;
      }

      let profile = signedInProfile;
      if (signedInProfile.role === 'owner') {
        const { data: delegatedTeacher, error: delegatedError } = await supabase
          .from('users')
          .select('id, full_name, school_id, role, is_active')
          .eq('school_id', signedInProfile.school_id)
          .eq('role', 'teacher')
          .eq('full_name', signedInProfile.full_name)
          .eq('is_active', true)
          .maybeSingle();
        if (delegatedError || !delegatedTeacher) {
          setError('Your Owner account could not find the linked Ezra teacher profile.');
          setLoading(false);
          return;
        }
        profile = delegatedTeacher;
      }

      if (profile.role !== 'teacher') {
        setError('This assessment page is for teachers.');
        setLoading(false);
        return;
      }

      setSchoolId(profile.school_id);
      setTeacherId(profile.id);

      const [yearRes, termRes, programmeRes, subjectRes, classRes, assignmentRes] =
        await Promise.all([
          supabase.from('academic_years').select('id,name').eq('school_id', profile.school_id).order('start_date', { ascending: false }),
          supabase.from('terms').select('id,name,academic_year_id').in('name', SEMESTER_NAMES).order('start_date'),
          supabase.from('programmes').select('id,name,code').eq('school_id', profile.school_id).order('name'),
          supabase.from('subjects').select('id,name,code').eq('school_id', profile.school_id).order('name'),
          supabase.from('classes').select('id,name,level,programme_id,academic_year_id').eq('school_id', profile.school_id).order('name'),
          supabase.from('teacher_assignments')
            .select('id,academic_year_id,subject_id,programme_ids,forms')
            .eq('teacher_id', profile.id)
            .eq('school_id', profile.school_id),
        ]);

      const firstError =
        yearRes.error || termRes.error || programmeRes.error ||
        subjectRes.error || classRes.error || assignmentRes.error;

      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const a = (assignmentRes.data || []) as Assignment[];
      const assignedYearIds = new Set(a.map(x => x.academic_year_id));
      const assignedSubjectIds = new Set(a.map(x => x.subject_id));
      const assignedProgrammeIds = new Set(a.flatMap(x => x.programme_ids || []));

      setAssignments(a);
      setYears((yearRes.data || []).filter(y => assignedYearIds.has(y.id)));
      setTerms((termRes.data || []) as Term[]);
      setSubjects((subjectRes.data || []).filter(s => assignedSubjectIds.has(s.id)));
      setProgrammes((programmeRes.data || []).filter(p => assignedProgrammeIds.has(p.id)));
      setClasses((classRes.data || []) as ClassItem[]);

      const firstAssignedYear = (yearRes.data || []).find(y => assignedYearIds.has(y.id));
      if (firstAssignedYear) setYearId(firstAssignedYear.id);

      setLoading(false);
    }

    setup();
  }, []);

  const yearAssignments = useMemo(
    () => assignments.filter(a => a.academic_year_id === yearId),
    [assignments, yearId]
  );

  const availableSubjects = useMemo(() => {
    const ids = new Set(yearAssignments.map(a => a.subject_id));
    return subjects.filter(s => ids.has(s.id));
  }, [subjects, yearAssignments]);

  useEffect(() => {
    if (subjectId && !availableSubjects.some(s => s.id === subjectId)) setSubjectId('');
    if (!subjectId && availableSubjects.length === 1) setSubjectId(availableSubjects[0].id);
  }, [availableSubjects, subjectId]);

  const subjectAssignments = useMemo(
    () => yearAssignments.filter(a => a.subject_id === subjectId),
    [yearAssignments, subjectId]
  );

  const availableForms = useMemo(() => {
    const order = ['Form 1', 'Form 2', 'Form 3'];
    const set = new Set(subjectAssignments.flatMap(a => a.forms || []));
    return Array.from(set).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [subjectAssignments]);

  useEffect(() => {
    if (form && !availableForms.includes(form)) setForm('');
    if (!form && availableForms.length === 1) setForm(availableForms[0]);
  }, [availableForms, form]);

  const formAssignments = useMemo(
    () => subjectAssignments.filter(a => !form || (a.forms || []).includes(form)),
    [subjectAssignments, form]
  );

  const availableProgrammes = useMemo(() => {
    const ids = new Set(formAssignments.flatMap(a => a.programme_ids || []));
    return programmes.filter(p => ids.has(p.id));
  }, [programmes, formAssignments]);

  useEffect(() => {
    if (programmeId && !availableProgrammes.some(p => p.id === programmeId)) setProgrammeId('');
  }, [availableProgrammes, programmeId]);

  const availableClasses = useMemo(() => {
    if (!yearId || !subjectId || !form || !programmeId) return [];
    return classes.filter(c =>
      c.academic_year_id === yearId &&
      c.programme_id === programmeId &&
      normalForm(c.level) === form &&
      subjectAssignments.some(a =>
        (a.forms || []).includes(form) &&
        (a.programme_ids || []).includes(programmeId)
      )
    );
  }, [classes, yearId, subjectId, form, programmeId, subjectAssignments]);

  useEffect(() => {
    if (classId && !availableClasses.some(c => c.id === classId)) setClassId('');
    if (!classId && availableClasses.length === 1) setClassId(availableClasses[0].id);
  }, [availableClasses, classId]);

  const semesterTerms = useMemo(
    () => terms.filter(t => t.academic_year_id === yearId),
    [terms, yearId]
  );

  const selectedTermId =
    semesterTerms.find(t => t.name === semester)?.id || null;

  useEffect(() => {
    async function loadStudents() {
      setStudents([]);
      setScores({});
      setExisting([]);
      if (!schoolId || !yearId || !classId) return;

      setLoadingStudents(true);
      const { data: enrollments, error: eError } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('academic_year_id', yearId)
        .eq('class_id', classId)
        .eq('status', 'active');

      if (eError) {
        setError(eError.message);
        setLoadingStudents(false);
        return;
      }

      const ids = (enrollments || []).map(e => e.student_id);
      if (!ids.length) {
        setLoadingStudents(false);
        return;
      }

      const { data, error: sError } = await supabase
        .from('students')
        .select('id,full_name,admission_number')
        .eq('school_id', schoolId)
        .in('id', ids)
        .order('full_name');

      if (sError) setError(sError.message);
      else setStudents((data || []) as Student[]);
      setLoadingStudents(false);
    }

    loadStudents();
  }, [schoolId, yearId, classId]);

  useEffect(() => {
    async function loadExisting() {
      setExisting([]);
      setScores({});
      if (!schoolId || !yearId || !subjectId || !semester || !assessmentType || !students.length) return;

      let query = supabase
        .from('assessments')
        .select('id,student_id,score,max_score,assessment_type,subject_id,academic_year_id,term_id,term,class_id')
        .eq('school_id', schoolId)
        .eq('academic_year_id', yearId)
        .eq('subject_id', subjectId)
        .eq('assessment_type', assessmentType)
        .eq('term', semester)
        .in('student_id', students.map(s => s.id));

      const { data, error: aError } = await query;
      if (aError) {
        setError(aError.message);
        return;
      }

      const records = (data || []) as AssessmentRecord[];
      setExisting(records);
      const map: Record<string, string> = {};
      records.forEach(r => { map[r.student_id] = String(r.score); });
      setScores(map);
    }

    loadExisting();
  }, [schoolId, yearId, subjectId, semester, assessmentType, students]);

  const currentType = ALL_TYPES.find(t => t.value === assessmentType) || null;
  const maxScore = currentType?.max || 0;

  function changeScore(studentId: string, value: string) {
    if (value === '') {
      setScores(prev => ({ ...prev, [studentId]: '' }));
      return;
    }
    const n = Number(value);
    if (Number.isNaN(n)) return;
    setScores(prev => ({
      ...prev,
      [studentId]: String(Math.max(0, Math.min(maxScore, n))),
    }));
  }

  async function saveScores() {
    setError('');
    setMessage('');

    if (!schoolId || !teacherId || !yearId || !semester || !subjectId || !form ||
        !programmeId || !classId || !assessmentType || !currentType) {
      setError('Please complete all assessment setup dropdowns.');
      return;
    }

    const entered = students.filter(s => scores[s.id] !== undefined && scores[s.id] !== '');
    if (!entered.length) {
      setError('Enter at least one student score before saving.');
      return;
    }

    setSaving(true);

    try {
      const subjectName = subjects.find(s => s.id === subjectId)?.name || '';
      const now = new Date().toISOString();

      const rows = entered.map(student => ({
        school_id: schoolId,
        student_id: student.id,
        academic_year_id: yearId,
        term_id: selectedTermId,
        term: semester,
        subject_id: subjectId,
        subject: subjectName,
        class_id: classId,
        assessment_type: assessmentType,
        score: Number(scores[student.id]),
        max_score: currentType.max,
        recorded_by: teacherId,
        submitted_at: now,
        updated_at: now,
      }));

      const { error: saveError } = await supabase
        .from('assessments')
        .upsert(rows, {
          onConflict: 'student_id,academic_year_id,term_id,subject_id,assessment_type',
        });

      if (saveError) throw saveError;

      setMessage(`${rows.length} score${rows.length === 1 ? '' : 's'} saved successfully.`);

      const { data } = await supabase
        .from('assessments')
        .select('id,student_id,score,max_score,assessment_type,subject_id,academic_year_id,term_id,term,class_id')
        .eq('school_id', schoolId)
        .eq('academic_year_id', yearId)
        .eq('subject_id', subjectId)
        .eq('assessment_type', assessmentType)
        .eq('term', semester)
        .in('student_id', students.map(s => s.id));

      setExisting((data || []) as AssessmentRecord[]);
    } catch (e: any) {
      setError(e?.message || 'Scores could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      s.full_name.toLowerCase().includes(q) ||
      s.admission_number.toLowerCase().includes(q)
    );
  }, [students, search]);

  const stats = useMemo(() => {
    const values = students
      .map(s => scores[s.id])
      .filter(v => v !== undefined && v !== '')
      .map(Number);
    const ps = values.map(v => percentage(v, maxScore));
    return {
      entered: values.length,
      average: ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0,
      highest: ps.length ? Math.max(...ps) : 0,
      lowest: ps.length ? Math.min(...ps) : 0,
      pass: ps.filter(p => p >= 50).length,
    };
  }, [students, scores, maxScore]);

  function quickFill(value: number) {
    if (!maxScore) return;
    const map: Record<string, string> = {};
    students.forEach(s => { map[s.id] = String(Math.min(value, maxScore)); });
    setScores(map);
  }

  function exportExcel() {
    if (!students.length || !currentType) return;
    const year = years.find(y => y.id === yearId)?.name || '';
    const subject = subjects.find(s => s.id === subjectId)?.name || '';
    const programme = programmes.find(p => p.id === programmeId)?.name || '';
    const className = classes.find(c => c.id === classId)?.name || '';

    const rows = students.map((s, i) => {
      const raw = scores[s.id] ?? '';
      const p = raw === '' ? '' : percentage(Number(raw), maxScore);
      return {
        No: i + 1,
        Student: s.full_name,
        'Admission No.': s.admission_number,
        'Academic Year': year,
        Semester: semester,
        Subject: subject,
        Programme: programme,
        Form: form,
        Class: className,
        Assessment: assessmentType,
        Score: raw,
        'Max Score': maxScore,
        Percentage: p === '' ? '' : Number(p.toFixed(1)),
        Grade: p === '' ? '' : grade(Number(p)),
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Assessment');
    XLSX.writeFile(wb, `BTI-Assessment-${subject || 'Subject'}-${assessmentType || 'Scores'}.xlsx`);
  }

  const selectedSubjectName = subjects.find(s => s.id === subjectId)?.name || '';
  const selectedProgrammeName = programmes.find(p => p.id === programmeId)?.name || '';
  const selectedClassName = classes.find(c => c.id === classId)?.name || '';

  const SelectBox = ({
    label, icon, value, onChange, disabled, children,
  }: {
    label: string; icon: string; value: string;
    onChange: (v: string) => void; disabled?: boolean; children: React.ReactNode;
  }) => (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
      <div className="relative">
        <i className={`${icon} pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-600`} />
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {children}
        </select>
        <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-xl sm:p-7">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-400/20 blur-2xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                  <i className="fa-solid fa-chart-line mr-2 animate-pulse" />BIRITECH SMS
                </span>
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                  <i className="fa-solid fa-circle-check mr-2" />Teacher Assessment
                </span>
              </div>
              <h1 className="text-2xl font-black sm:text-3xl">Assessment Management</h1>
              <p className="mt-2 text-sm text-blue-100">
                Enter and manage scores only for your assigned subjects, forms and departments.
              </p>
            </div>
            <button onClick={exportExcel} disabled={!students.length}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-900 shadow transition hover:-translate-y-0.5 disabled:opacity-50">
              <i className="fa-solid fa-file-excel mr-2 text-emerald-600" />Export Excel
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['fa-pen-to-square', 'Exercises', '4 × 10 = 40'],
            ['fa-file-pen', 'Class Tests', '3 × 20 = 60'],
            ['fa-percent', 'Continuous Assessment', '100 → 30%'],
            ['fa-graduation-cap', 'Examination', '100 → 70%'],
          ].map(([icon, title, value]) => (
            <div key={title} className="rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5">
              <i className={`fa-solid ${icon} mb-2 text-blue-600`} />
              <p className="text-xs font-medium text-slate-500">{title}</p>
              <p className="mt-1 font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <i className="fa-solid fa-circle-exclamation mr-2" />{error}
        </div>}
        {message && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <i className="fa-solid fa-circle-check mr-2" />{message}
        </div>}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b p-4 sm:px-6">
            <h2 className="font-bold text-slate-900"><i className="fa-solid fa-sliders mr-2 text-blue-600" />Assessment Setup</h2>
            <p className="mt-1 text-xs text-slate-500">The options below come from your Teacher Assignment.</p>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            <SelectBox label="Academic Year" icon="fa-solid fa-calendar-days" value={yearId}
              onChange={v => { setYearId(v); setSemester(''); setSubjectId(''); setForm(''); setProgrammeId(''); setClassId(''); }}>
              <option value="">Select Academic Year</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </SelectBox>

            <SelectBox label="Semester" icon="fa-solid fa-calendar-week" value={semester}
              disabled={!yearId} onChange={v => setSemester(v)}>
              <option value="">Select Semester</option>
              {SEMESTER_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
            </SelectBox>

            <SelectBox label="Subject" icon="fa-solid fa-book" value={subjectId}
              disabled={!yearId} onChange={v => { setSubjectId(v); setForm(''); setProgrammeId(''); setClassId(''); }}>
              <option value="">Select Subject</option>
              {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
            </SelectBox>

            <SelectBox label="Form" icon="fa-solid fa-layer-group" value={form}
              disabled={!subjectId} onChange={v => { setForm(v); setProgrammeId(''); setClassId(''); }}>
              <option value="">Select Form</option>
              {availableForms.map(f => <option key={f} value={f}>{f}</option>)}
            </SelectBox>

            <SelectBox label="Department / Programme" icon="fa-solid fa-building-columns" value={programmeId}
              disabled={!form} onChange={v => { setProgrammeId(v); setClassId(''); }}>
              <option value="">Select Department</option>
              {availableProgrammes.map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
            </SelectBox>

            <SelectBox label="Class" icon="fa-solid fa-users" value={classId}
              disabled={!programmeId} onChange={setClassId}>
              <option value="">Select Class</option>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectBox>

            <div className="sm:col-span-2">
              <SelectBox label="Assessment Type" icon="fa-solid fa-file-signature" value={assessmentType}
                disabled={!classId} onChange={setAssessmentType}>
                <option value="">Select Assessment</option>
                <optgroup label="Continuous Assessment">
                  {CA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label} — /{t.max}</option>)}
                </optgroup>
                <optgroup label="Examination">
                  <option value={EXAM_TYPE.value}>Examination — /100</option>
                </optgroup>
              </SelectBox>
            </div>
          </div>
        </div>

        {classId && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
            <i className="fa-solid fa-location-dot mr-2 text-blue-600" />
            {years.find(y => y.id === yearId)?.name} → {semester || 'Semester'} → {selectedSubjectName} → {form} → {selectedProgrammeName} → <b>{selectedClassName}</b>
          </div>
        )}

        {loading && <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
          <i className="fa-solid fa-spinner fa-spin mr-2 text-blue-600" />Loading your assignments...
        </div>}

        {!loading && assessmentType && students.length > 0 && (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ['Students', students.length, 'fa-users'],
                ['Entered', stats.entered, 'fa-check-double'],
                ['Average', `${stats.average.toFixed(1)}%`, 'fa-chart-line'],
                ['Highest', `${stats.highest.toFixed(1)}%`, 'fa-arrow-trend-up'],
                ['Passed', stats.pass, 'fa-circle-check'],
              ].map(([label, value, icon]) => (
                <div key={String(label)} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <i className={`fa-solid ${icon} text-blue-600`} />
                  <p className="mt-3 text-xs font-semibold uppercase text-slate-400">{label}</p>
                  <p className="text-2xl font-black text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold text-slate-900">Enter Scores — {assessmentType} / {maxScore}</h2>
                  <p className="text-xs text-slate-500">{existing.length ? `${existing.length} existing score(s) loaded.` : 'No previous scores for this assessment.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => quickFill(maxScore)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Fill Max</button>
                  <button onClick={() => quickFill(0)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">Fill 0</button>
                  <button onClick={() => setScores({})} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Clear</button>
                </div>
              </div>

              <div className="p-4">
                <div className="relative mb-4">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search student or admission number..."
                    className="w-full rounded-xl border py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr><th className="p-3">#</th><th className="p-3">Student</th><th className="p-3">Admission No.</th><th className="p-3">Score / {maxScore}</th><th className="p-3">%</th><th className="p-3">Grade</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {visibleStudents.map((s, i) => {
                        const raw = scores[s.id] ?? '';
                        const p = raw === '' ? null : percentage(Number(raw), maxScore);
                        return (
                          <tr key={s.id} className="hover:bg-blue-50/40">
                            <td className="p-3 text-slate-400">{i + 1}</td>
                            <td className="p-3 font-semibold text-slate-900">{s.full_name}</td>
                            <td className="p-3 text-slate-600">{s.admission_number}</td>
                            <td className="p-3">
                              <input type="number" min="0" max={maxScore} step="0.1" value={raw}
                                onChange={e => changeScore(s.id, e.target.value)}
                                className="w-28 rounded-lg border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                            </td>
                            <td className="p-3 font-semibold">{p === null ? '—' : `${p.toFixed(1)}%`}</td>
                            <td className="p-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold">{p === null ? '—' : grade(p)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 flex justify-end">
                  <button onClick={saveScores} disabled={saving || !stats.entered}
                    className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Saving...</> : <><i className="fa-solid fa-floppy-disk mr-2" />Save Assessment</>}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {!loading && classId && loadingStudents && (
          <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
            <i className="fa-solid fa-spinner fa-spin mr-2 text-blue-600" />Loading students...
          </div>
        )}

        {!loading && classId && !loadingStudents && students.length === 0 && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
            <i className="fa-solid fa-user-slash mr-2" />No active students were found in this class for the selected academic year.
          </div>
        )}
      </div>
    </div>
  );
}

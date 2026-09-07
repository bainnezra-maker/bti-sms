'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../lib/supabase';

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
  created_at: string;
};

export default function AssessmentPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [studentId, setStudentId] = useState('');
  const [subject, setSubject] = useState('');
  const [assessmentType, setAssessmentType] = useState('CA1');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [term, setTerm] = useState('');

  const router = useRouter();
  const supabase = createClient();

  async function loadRecords(school_id: string) {
    const { data } = await supabase
      .from('assessments')
      .select('id, student_id, subject, assessment_type, score, max_score, term, created_at')
      .eq('school_id', school_id)
      .order('created_at', { ascending: false })
      .limit(20);
    setRecords(data ?? []);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        setLoading(false);
        return;
      }
      setSchoolId(profile.school_id);

      const { data: studentRows } = await supabase
        .from('students')
        .select('id, full_name, admission_number')
        .eq('school_id', profile.school_id)
        .eq('status', 'active')
        .order('full_name');

      setStudents(studentRows ?? []);
      if (studentRows && studentRows.length > 0) setStudentId(studentRows[0].id);

      await loadRecords(profile.school_id);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');

    if (!studentId || !subject || !score) {
      setMessage('Student, subject, and score are required.');
      return;
    }
    if (!schoolId || !userId) return;

    setSaving(true);

    const { error } = await supabase.from('assessments').insert({
      school_id: schoolId,
      student_id: studentId,
      subject,
      assessment_type: assessmentType,
      score: Number(score),
      max_score: Number(maxScore) || 100,
      term: term || null,
      recorded_by: userId,
    });

    setSaving(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setSubject('');
    setScore('');
    setMessage('Score saved.');
    await loadRecords(schoolId);
  }

  function studentName(id: string) {
    return students.find((s) => s.id === id)?.full_name ?? 'Unknown';
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 60 }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Assessment</h2>
        <Link href="/students">
          <button type="button">Student records</button>
        </Link>
      </div>

      {students.length === 0 ? (
        <p style={{ color: '#666' }}>No active students yet — add some on the Student records page first.</p>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          <label style={{ fontSize: 13, color: '#666' }}>Student</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.admission_number})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Subject (e.g. Integrated Science)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <label style={{ fontSize: 13, color: '#666' }}>Assessment type</label>
          <select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)}>
            <option value="CA1">CA1</option>
            <option value="CA2">CA2</option>
            <option value="CA3">CA3</option>
            <option value="Exam">Exam</option>
          </select>

          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="number"
              placeholder="Score"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              placeholder="Max score"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>

          <input
            type="text"
            placeholder="Term (e.g. Term 1, optional)"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />

          {message && <p style={{ fontSize: 13, color: message.startsWith('Error') ? '#c0392b' : '#1a1a1a' }}>{message}</p>}

          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save score'}
          </button>
        </form>
      )}

      <h3 style={{ fontSize: 16, marginBottom: 8 }}>Recent scores</h3>
      {records.length === 0 ? (
        <p style={{ color: '#666' }}>No scores recorded yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {records.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: 12,
                background: 'white',
                borderRadius: 8,
                border: '1px solid #e0e0d8',
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 500 }}>{studentName(r.student_id)}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#666' }}>
                  {r.subject} · {r.assessment_type}{r.term ? ` · ${r.term}` : ''}
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {r.score}/{r.max_score}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
      }

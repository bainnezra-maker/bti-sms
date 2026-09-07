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

type Status = 'present' | 'absent' | 'late' | 'excused';

const STATUS_OPTIONS: Status[] = ['present', 'absent', 'late', 'excused'];

function todayString() {
  return new Date().toISOString().split('T')[0];
}

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [date, setDate] = useState(todayString());
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const supabase = createClient();

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

      const initialMarks: Record<string, Status> = {};
      (studentRows ?? []).forEach((s) => {
        initialMarks[s.id] = 'present';
      });
      setMarks(initialMarks);
      setLoading(false);
    }
    load();
  }, []);

  function setMark(studentId: string, status: Status) {
    setMarks((prev) => ({ ...prev, [studentId]: status }));
  }

  async function handleSave() {
    if (!schoolId || !userId) return;
    setSaving(true);
    setMessage('');

    const rows = students.map((s) => ({
      student_id: s.id,
      school_id: schoolId,
      date,
      status: marks[s.id] ?? 'present',
      recorded_by: userId,
    }));

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'student_id,date' });

    setSaving(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }
    setMessage('Attendance saved.');
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 60 }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2>Attendance</h2>
        <Link href="/students">
          <button type="button">Student records</button>
        </Link>
      </div>

      <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>Date</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      {students.length === 0 ? (
        <p style={{ color: '#666' }}>No active students yet — add some on the Student records page first.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {students.map((s) => (
            <div
              key={s.id}
              style={{
                padding: 12,
                background: 'white',
                borderRadius: 8,
                border: '1px solid #e0e0d8',
              }}
            >
              <p style={{ margin: '0 0 8px', fontWeight: 500 }}>{s.full_name}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setMark(s.id, status)}
                    style={{
                      background: marks[s.id] === status ? '#1a1a1a' : '#f0f0ec',
                      color: marks[s.id] === status ? 'white' : '#1a1a1a',
                      fontSize: 12,
                      padding: '6px 10px',
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {message && <p style={{ fontSize: 13, marginTop: 12 }}>{message}</p>}

      {students.length > 0 && (
        <button type="button" onClick={handleSave} disabled={saving} style={{ width: '100%', marginTop: 16 }}>
          {saving ? 'Saving…' : 'Save attendance'}
        </button>
      )}
    </div>
  );
      }

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../lib/supabase';

type Student = {
  id: string;
  admission_number: string;
  full_name: string;
  status: string;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
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
        .select('id, admission_number, full_name, status')
        .eq('school_id', profile.school_id)
        .order('full_name');

      setStudents(studentRows ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p style={{ textAlign: 'center', marginTop: 60 }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Student records</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/attendance">
            <button type="button">Attendance</button>
          </Link>
          <Link href="/assessment">
            <button type="button">Assessment</button>
          </Link>
          <Link href="/students/add">
            <button type="button">+ Add student</button>
          </Link>
        </div>
      </div>
      <input
        type="text"
        placeholder="Search by name or admission no."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 16 }}
      />
      {filtered.length === 0 ? (
        <p style={{ color: '#666' }}>No students found yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((s) => (
            <div
              key={s.id}
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
                <p style={{ margin: 0, fontWeight: 500 }}>{s.full_name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#666' }}>{s.admission_number}</p>
              </div>
              <span style={{ fontSize: 12, color: '#666' }}>{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

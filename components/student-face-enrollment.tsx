'use client';

import { useEffect, useRef, useState } from 'react';

type Student = { id: string; full_name: string; admission_number: string };

export default function StudentFaceEnrollment({ student }: { student: Student }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState('loading');
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const res = await fetch(`/api/facial-attendance/enrollment?studentId=${encodeURIComponent(student.id)}`);
    const data = await res.json();
    if (res.ok) {
      setStatus(data.enrollment?.enrollment_status ?? 'not_enrolled');
      setCount(data.enrollment?.reference_photo_count ?? 0);
    } else setMessage(data.error || 'Could not load face enrollment.');
  }
  useEffect(() => { refresh(); }, [student.id]);

  async function enroll() {
    if (files.length < 2 || files.length > 3) return setMessage('Select 2 or 3 clear photos.');
    setBusy(true); setMessage('');
    try {
      const form = new FormData();
      form.append('studentId', student.id);
      files.forEach(f => form.append('photos', f));
      const res = await fetch('/api/facial-attendance/enrollment', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrollment failed.');
      setFiles([]); setMessage(data.message); await refresh();
    } catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm(`Remove facial enrollment for ${student.full_name}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/facial-attendance/enrollment?studentId=${encodeURIComponent(student.id)}`, { method: 'DELETE' });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMessage(data.error || 'Could not remove enrollment.');
    setFiles([]); setMessage('Facial enrollment removed.'); await refresh();
  }

  return (
    <section className="bti-attendance-fade rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
            <i className="fa-solid fa-face-viewfinder fa-beat-fade" /> Face Enrollment
          </div>
          <h3 className="mt-3 font-black text-slate-900">{student.full_name}</h3>
          <p className="text-xs text-slate-500">{student.admission_number}</p>
        </div>
        <div className={`rounded-2xl px-4 py-2 text-xs font-black ${status === 'enrolled' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          <i className={`mr-2 fa-solid ${status === 'enrolled' ? 'fa-circle-check' : 'fa-circle-exclamation'}`} />
          {status === 'loading' ? 'Checking…' : status === 'enrolled' ? `Enrolled • ${count} photos` : 'Not Enrolled'}
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
        Use 2–3 clear photos of the same student: front-facing, slight left, and slight right. Avoid group photographs.
      </div>

      <input ref={inputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple
        onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 3))} />

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => inputRef.current?.click()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700">
          <i className="fa-solid fa-images mr-2" />Choose 2–3 Photos
        </button>
        <button type="button" disabled={busy || files.length < 2}
          onClick={enroll} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">
          <i className={busy ? 'fa-solid fa-spinner fa-spin mr-2' : 'fa-solid fa-shield-halved mr-2'} />
          {status === 'enrolled' ? 'Replace Enrollment' : 'Enroll Face'}
        </button>
        {status === 'enrolled' && (
          <button type="button" disabled={busy} onClick={remove}
            className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 disabled:opacity-40">
            <i className="fa-solid fa-trash mr-2" />Remove
          </button>
        )}
      </div>

      {files.length > 0 && <p className="mt-3 text-xs font-bold text-slate-600">{files.length} photo{files.length === 1 ? '' : 's'} selected</p>}
      {message && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">{message}</p>}
    </section>
  );
}

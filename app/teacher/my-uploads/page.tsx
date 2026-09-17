'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Profile = { id: string; full_name: string; email: string; role: string; school_id: string };
type AcademicYear = { id: string; name: string; is_current?: boolean };
type Semester = { id: string; name: string; academic_year_id: string; is_current?: boolean };
type DocumentType = 'unit_specification' | 'learning_session_plan' | 'particulars_of_work_done';
type TeachingDocument = {
  id: string; staff_id: string; document_type: DocumentType; academic_year_id: string | null;
  semester_id: string | null; title: string; file_name: string; file_path: string;
  file_type: string | null; file_size: number | null; uploaded_at: string | null; notes: string | null;
};

const supabase = createClient();
const LABELS: Record<DocumentType, string> = {
  unit_specification: 'Unit Specification Breakdown',
  learning_session_plan: 'Learning Session Plan',
  particulars_of_work_done: 'Particulars of Work Done',
};
const SHORT: Record<DocumentType, string> = {
  unit_specification: 'USB', learning_session_plan: 'LSP', particulars_of_work_done: 'POWD',
};
const ICONS: Record<DocumentType, string> = {
  unit_specification: 'fa-solid fa-list-check',
  learning_session_plan: 'fa-solid fa-chalkboard-user',
  particulars_of_work_done: 'fa-solid fa-file-circle-check',
};

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export default function MyUploadsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [documents, setDocuments] = useState<TeachingDocument[]>([]);
  const [documentType, setDocumentType] = useState<DocumentType>('unit_specification');
  const [yearId, setYearId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setError('');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: userProfile, error: profileError } = await supabase.from('users')
        .select('id, full_name, email, role, school_id').eq('id', user.id).single();
      if (profileError || !userProfile) { if (mounted) { setError(profileError?.message || 'Unable to load your teacher profile.'); setLoading(false); } return; }
      if (userProfile.role !== 'teacher') { router.replace(userProfile.role === 'admin' ? '/' : userProfile.role === 'Student' ? '/student' : '/login'); return; }

      const [{ data: yearData, error: yearError }, { data: staffMatch, error: staffError }] = await Promise.all([
        supabase.from('academic_years').select('id, name, is_current').eq('school_id', userProfile.school_id).order('start_date', { ascending: false }),
        supabase.from('staff').select('id').eq('school_id', userProfile.school_id).ilike('email', userProfile.email).eq('staff_category', 'teaching').maybeSingle(),
      ]);
      if (yearError) { if (mounted) { setError(yearError.message); setLoading(false); } return; }
      if (staffError) { if (mounted) { setError(staffError.message); setLoading(false); } return; }
      const yearRows = (yearData ?? []) as AcademicYear[];
      const currentYear = yearRows.find(y => y.is_current) ?? yearRows[0] ?? null;

      let termRows: Semester[] = [];
      if (currentYear) {
        const { data: termData, error: termError } = await supabase.from('terms')
          .select('id, name, academic_year_id, is_current').eq('academic_year_id', currentYear.id).order('start_date');
        if (termError) { if (mounted) { setError(termError.message); setLoading(false); } return; }
        termRows = (termData ?? []) as Semester[];
      }

      let docRows: TeachingDocument[] = [];
      if (staffMatch?.id) {
        const { data: docData, error: docError } = await supabase.from('staff_teaching_documents')
          .select('id, staff_id, document_type, academic_year_id, semester_id, title, file_name, file_path, file_type, file_size, uploaded_at, notes')
          .eq('school_id', userProfile.school_id).eq('staff_id', staffMatch.id).order('uploaded_at', { ascending: false });
        if (docError) { if (mounted) { setError(docError.message); setLoading(false); } return; }
        docRows = (docData ?? []) as TeachingDocument[];
      }
      if (!mounted) return;
      setProfile(userProfile as Profile); setStaffId(staffMatch?.id ?? null); setYears(yearRows); setSemesters(termRows); setDocuments(docRows);
      setYearId(currentYear?.id ?? '');
      setSemesterId(termRows.find(t => t.is_current)?.id ?? termRows[0]?.id ?? '');
      setLoading(false);
    }
    load(); return () => { mounted = false; };
  }, [router]);

  useEffect(() => {
    async function changeYear() {
      if (!yearId) { setSemesters([]); setSemesterId(''); return; }
      const { data, error: termError } = await supabase.from('terms').select('id, name, academic_year_id, is_current').eq('academic_year_id', yearId).order('start_date');
      if (termError) { setError(termError.message); return; }
      const rows = (data ?? []) as Semester[]; setSemesters(rows); setSemesterId(rows.find(t => t.is_current)?.id ?? rows[0]?.id ?? '');
    }
    if (!loading) changeYear();
  }, [yearId, loading]);

  const counts = useMemo(() => ({
    unit_specification: documents.filter(d => d.document_type === 'unit_specification').length,
    learning_session_plan: documents.filter(d => d.document_type === 'learning_session_plan').length,
    particulars_of_work_done: documents.filter(d => d.document_type === 'particulars_of_work_done').length,
  }), [documents]);

  async function uploadDocument(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (!profile || !staffId) { setError('Your teacher login is not linked to a Teaching Staff record. Ask the administrator to make sure the email in Staff Management matches your teacher login email.'); return; }
    if (!file) { setError('Choose a document to upload.'); return; }
    if (!yearId) { setError('Select an academic year.'); return; }
    if (!semesterId) { setError('Select a semester.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('The selected file is larger than 10 MB.'); return; }
    if (documentType === 'unit_specification' && documents.some(d => d.document_type === documentType && d.academic_year_id === yearId && d.semester_id === semesterId)) {
      setError('A Unit Specification Breakdown already exists for this semester.'); return;
    }
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${profile.school_id}/${staffId}/${Date.now()}-${safeName}`;
    const { error: storageError } = await supabase.storage.from('staff-documents').upload(path, file, { cacheControl: '3600', upsert: false });
    if (storageError) { setError(storageError.message); setUploading(false); return; }
    const { data, error: recordError } = await supabase.from('staff_teaching_documents').insert({
      staff_id: staffId, school_id: profile.school_id, document_type: documentType, academic_year_id: yearId, semester_id: semesterId,
      title: title.trim() || `${LABELS[documentType]} (${SHORT[documentType]})`, file_name: file.name, file_path: path,
      file_type: file.type || null, file_size: file.size, uploaded_by: profile.id, notes: notes.trim() || null,
    }).select('id, staff_id, document_type, academic_year_id, semester_id, title, file_name, file_path, file_type, file_size, uploaded_at, notes').single();
    if (recordError) { await supabase.storage.from('staff-documents').remove([path]); setError(recordError.message); setUploading(false); return; }
    setDocuments(current => [data as TeachingDocument, ...current]); setTitle(''); setNotes(''); setFile(null);
    const input = document.getElementById('teacher-upload-file') as HTMLInputElement | null; if (input) input.value = '';
    setMessage('Document uploaded successfully.'); setUploading(false);
  }

  async function openDocument(item: TeachingDocument) {
    setError('');
    const { data, error: signedError } = await supabase.storage.from('staff-documents').createSignedUrl(item.file_path, 600);
    if (signedError || !data?.signedUrl) { setError(signedError?.message || 'The document could not be opened.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  if (loading) return <div className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-7xl animate-pulse space-y-5"><div className="h-44 rounded-[2rem] bg-slate-200"/><div className="h-96 rounded-[2rem] bg-slate-200"/></div></div>;

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" />
      <style jsx global>{`@keyframes uploadFade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} .upload-in{animation:uploadFade .45s ease-out both}@media(prefers-reduced-motion:reduce){.upload-in{animation:none}}`}</style>
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="upload-in relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-7 text-white shadow-2xl sm:p-8">
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[.05]"/>
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black"><i className="fa-solid fa-cloud-arrow-up"/> Teacher Workspace</div>
                <h1 className="mt-4 text-3xl font-black sm:text-4xl">My Uploads</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Upload and keep track of your USB, LSP and POWD teaching documents.</p></div>
              <div className="rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/10"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Teacher</p><p className="mt-1 font-black">{profile?.full_name ?? 'Teacher'}</p></div>
            </div>
          </section>

          {!staffId && <div className="upload-in rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800"><i className="fa-solid fa-triangle-exclamation mr-2"/>Your login is not yet linked to a Teaching Staff record. The email in Staff Management must match your teacher login email.</div>}
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><i className="fa-solid fa-circle-exclamation mr-2"/>{error}</div>}
          {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"><i className="fa-solid fa-circle-check mr-2"/>{message}</div>}

          <section className="grid gap-4 sm:grid-cols-3">
            {(['unit_specification','learning_session_plan','particulars_of_work_done'] as DocumentType[]).map((type, index) => <div key={type} className="upload-in rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm" style={{animationDelay:`${index*70}ms`}}><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><i className={ICONS[type]}/></span><p className="mt-4 text-3xl font-black text-slate-950">{counts[type]}</p><p className="text-xs font-black text-slate-500">{SHORT[type]} uploads</p><p className="mt-1 text-[11px] text-slate-400">{LABELS[type]}</p></div>)}
          </section>

          <section className="grid gap-6 xl:grid-cols-[.9fr_1.35fr]">
            <form onSubmit={uploadDocument} className="upload-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white"><i className="fa-solid fa-file-arrow-up"/></span><div><h2 className="text-xl font-black text-slate-950">Upload document</h2><p className="text-xs text-slate-500">Maximum file size: 10 MB</p></div></div>
              <div className="mt-6 space-y-4">
                <label className="block"><span className="text-xs font-black text-slate-600">Document type</span><select value={documentType} onChange={e=>setDocumentType(e.target.value as DocumentType)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none">{(Object.keys(LABELS) as DocumentType[]).map(type=><option key={type} value={type}>{SHORT[type]} — {LABELS[type]}</option>)}</select></label>
                <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-xs font-black text-slate-600">Academic year</span><select value={yearId} onChange={e=>setYearId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none"><option value="">Select year</option>{years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select></label><label className="block"><span className="text-xs font-black text-slate-600">Semester</span><select value={semesterId} onChange={e=>setSemesterId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none"><option value="">Select semester</option>{semesters.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
                <label className="block"><span className="text-xs font-black text-slate-600">Title <span className="font-medium text-slate-400">(optional)</span></span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder={`${SHORT[documentType]} title`} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none"/></label>
                <label className="block"><span className="text-xs font-black text-slate-600">Notes <span className="font-medium text-slate-400">(optional)</span></span><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Add a short note" className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none"/></label>
                <label className="block rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center transition hover:border-slate-400"><i className="fa-solid fa-cloud-arrow-up text-2xl text-slate-400"/><p className="mt-2 text-xs font-black text-slate-700">{file?.name ?? 'Choose document'}</p><input id="teacher-upload-file" type="file" onChange={e=>setFile(e.target.files?.[0] ?? null)} className="mt-3 block w-full text-xs text-slate-500"/></label>
                <button disabled={uploading || !staffId} type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"><i className={uploading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-upload'}/>{uploading ? 'Uploading...' : `Upload ${SHORT[documentType]}`}</button>
              </div>
            </form>

            <section className="upload-in rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">Upload history</h2><p className="mt-1 text-xs text-slate-500">Your submitted teaching documents</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{documents.length} total</span></div>
              {documents.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center"><i className="fa-regular fa-folder-open text-3xl text-slate-300"/><p className="mt-3 text-sm font-black text-slate-700">No uploads yet</p><p className="mt-1 text-xs text-slate-400">Your USB, LSP and POWD submissions will appear here.</p></div> : <div className="mt-6 space-y-3">{documents.map(doc => { const year=years.find(y=>y.id===doc.academic_year_id); const sem=semesters.find(s=>s.id===doc.semester_id); return <div key={doc.id} className="group rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm"><i className={ICONS[doc.document_type]}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-950 px-2.5 py-1 text-[9px] font-black text-white">{SHORT[doc.document_type]}</span><span className="text-[10px] font-bold text-slate-400">{formatDate(doc.uploaded_at)}</span></div><p className="mt-2 truncate text-sm font-black text-slate-800">{doc.title || LABELS[doc.document_type]}</p><p className="mt-1 truncate text-[11px] text-slate-400">{doc.file_name} · {formatBytes(doc.file_size)}{year ? ` · ${year.name}` : ''}{sem ? ` · ${sem.name}` : ''}</p>{doc.notes && <p className="mt-2 text-xs leading-5 text-slate-500">{doc.notes}</p>}</div><button type="button" onClick={()=>openDocument(doc)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm transition hover:bg-slate-950 hover:text-white" title="Open document"><i className="fa-solid fa-arrow-up-right-from-square text-xs"/></button></div></div>})}</div>}
            </section>
          </section>
        </div>
      </main>
    </>
  );
}

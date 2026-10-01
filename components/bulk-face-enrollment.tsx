'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
  status: string | null;
};

type UploadAuthorization = {
  path: string;
  token: string;
};

type ApiResponse = {
  error?: string;
  message?: string;
  uploads?: UploadAuthorization[];
};

type MatchedGroup = {
  student: Student;
  files: File[];
};

type ResultStatus = 'waiting' | 'uploading' | 'success' | 'failed';

type EnrollmentResult = {
  studentId: string;
  name: string;
  admissionNumber: string;
  photoCount: number;
  status: ResultStatus;
  message: string;
};

const BUCKET = 'student-face-enrollment';
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024;

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function fileStem(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '');
}

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const raw = await response.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {
      error:
        raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ||
        `The server returned HTTP ${response.status}.`,
    };
  }
}

export default function BulkFaceEnrollment() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<EnrollmentResult[]>([]);

  useEffect(() => {
    let active = true;

    async function loadStudents() {
      setLoading(true);
      setError('');

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = '/login';
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('school_id, role, is_active')
          .eq('id', user.id)
          .maybeSingle();

        if (
          profileError ||
          !profile ||
          profile.is_active === false ||
          !['admin', 'owner'].includes(profile.role)
        ) {
          throw new Error(
            'Only an active administrator or owner can bulk-enroll faces.'
          );
        }

        const allStudents: Student[] = [];
        const pageSize = 1000;

        for (let from = 0; ; from += pageSize) {
          const { data, error: studentsError } = await supabase
            .from('students')
            .select('id, full_name, admission_number, status')
            .eq('school_id', profile.school_id)
            .order('admission_number')
            .range(from, from + pageSize - 1);

          if (studentsError) throw studentsError;

          const page = (data || []) as Student[];
          allStudents.push(...page);
          if (page.length < pageSize) break;
        }

        if (active) setStudents(allStudents);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load students.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStudents();
    return () => {
      active = false;
    };
  }, []);

  const analysis = useMemo(() => {
    const admissionIndex = students
      .map((student) => ({
        student,
        key: normalize(student.admission_number),
      }))
      .filter((item) => item.key)
      .sort((a, b) => b.key.length - a.key.length);

    const duplicateKeys = new Set<string>();
    const seenKeys = new Set<string>();

    for (const item of admissionIndex) {
      if (seenKeys.has(item.key)) duplicateKeys.add(item.key);
      seenKeys.add(item.key);
    }

    const grouped = new Map<string, MatchedGroup>();
    const unmatched: File[] = [];
    const invalid: Array<{ file: File; reason: string }> = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        invalid.push({ file, reason: 'Unsupported file type' });
        continue;
      }

      if (file.size <= 0 || file.size > MAX_BYTES) {
        invalid.push({ file, reason: 'Photo must be 8 MB or smaller' });
        continue;
      }

      const normalizedName = normalize(fileStem(file.name));
      const match = admissionIndex.find(
        (item) =>
          !duplicateKeys.has(item.key) && normalizedName.startsWith(item.key)
      );

      if (!match) {
        unmatched.push(file);
        continue;
      }

      const current = grouped.get(match.student.id) || {
        student: match.student,
        files: [],
      };
      current.files.push(file);
      grouped.set(match.student.id, current);
    }

    const ready: MatchedGroup[] = [];
    const incomplete: MatchedGroup[] = [];
    const excess: MatchedGroup[] = [];

    for (const group of grouped.values()) {
      if (group.files.length < 2) incomplete.push(group);
      else if (group.files.length > 3) excess.push(group);
      else ready.push(group);
    }

    ready.sort((a, b) =>
      a.student.admission_number.localeCompare(b.student.admission_number)
    );

    return {
      ready,
      incomplete,
      excess,
      unmatched,
      invalid,
      duplicateAdmissionNumbers: Array.from(duplicateKeys),
    };
  }, [files, students]);

  function chooseFiles(selected: FileList | null) {
    setFiles(Array.from(selected || []));
    setResults([]);
    setError('');
    setProgress('');
  }

  function updateResult(studentId: string, patch: Partial<EnrollmentResult>) {
    setResults((current) =>
      current.map((item) =>
        item.studentId === studentId ? { ...item, ...patch } : item
      )
    );
  }

  async function enrollGroup(group: MatchedGroup) {
    updateResult(group.student.id, {
      status: 'uploading',
      message: 'Preparing secure upload…',
    });

    const prepareRes = await fetch('/api/facial-attendance/enrollment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'prepare',
        studentId: group.student.id,
        files: group.files.map((file) => ({
          type: file.type,
          size: file.size,
          name: file.name,
        })),
      }),
    });

    const prepareData = await readApiResponse(prepareRes);
    if (!prepareRes.ok) {
      throw new Error(prepareData.error || 'Could not prepare upload.');
    }

    const uploads = prepareData.uploads || [];
    if (uploads.length !== group.files.length) {
      throw new Error('The server did not authorize every photo.');
    }

    const supabase = createClient();
    const uploadedPaths: string[] = [];

    for (let index = 0; index < group.files.length; index++) {
      updateResult(group.student.id, {
        message: `Uploading photo ${index + 1} of ${group.files.length}…`,
      });

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(
          uploads[index].path,
          uploads[index].token,
          group.files[index],
          { contentType: group.files[index].type }
        );

      if (uploadError) throw new Error(uploadError.message);
      uploadedPaths.push(uploads[index].path);
    }

    updateResult(group.student.id, { message: 'Verifying enrollment…' });

    const finalizeRes = await fetch('/api/facial-attendance/enrollment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'finalize',
        studentId: group.student.id,
        paths: uploadedPaths,
      }),
    });

    const finalizeData = await readApiResponse(finalizeRes);
    if (!finalizeRes.ok) {
      throw new Error(finalizeData.error || 'Could not finalize enrollment.');
    }
  }

  async function startEnrollment() {
    if (!analysis.ready.length || busy) return;

    const initialResults: EnrollmentResult[] = analysis.ready.map((group) => ({
      studentId: group.student.id,
      name: group.student.full_name,
      admissionNumber: group.student.admission_number,
      photoCount: group.files.length,
      status: 'waiting',
      message: 'Waiting',
    }));

    setResults(initialResults);
    setBusy(true);
    setError('');

    let succeeded = 0;

    for (let index = 0; index < analysis.ready.length; index++) {
      const group = analysis.ready[index];
      setProgress(
        `Enrolling ${index + 1} of ${analysis.ready.length}: ${group.student.full_name}`
      );

      try {
        await enrollGroup(group);
        succeeded += 1;
        updateResult(group.student.id, {
          status: 'success',
          message: 'Enrolled successfully',
        });
      } catch (enrollmentError) {
        updateResult(group.student.id, {
          status: 'failed',
          message:
            enrollmentError instanceof Error
              ? enrollmentError.message
              : 'Enrollment failed',
        });
      }
    }

    setProgress(
      `Completed: ${succeeded} enrolled, ${analysis.ready.length - succeeded} failed.`
    );
    setBusy(false);
  }

  const successCount = results.filter((item) => item.status === 'success').length;
  const failedCount = results.filter((item) => item.status === 'failed').length;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-blue-100">
              <i className="fa-solid fa-users-viewfinder" />
              Administrator Tool
            </div>
            <h1 className="text-2xl font-black sm:text-3xl">Bulk Face Enrollment</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Match 2–3 clear photos to each student using the admission number in each filename.
            </p>
          </div>
          <Link
            href="/students"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black hover:bg-white/20"
          >
            <i className="fa-solid fa-arrow-left" />
            Students
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-black text-slate-900">1. Name the photos</h2>
          <p className="mt-2 text-sm text-slate-600">
            Replace slashes in the admission number with hyphens, then add the photo angle.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {['BTI-2026-0960-front.jpg', 'BTI-2026-0960-left.jpg', 'BTI-2026-0960-right.jpg'].map(
              (name) => (
                <code key={name} className="rounded-xl bg-slate-100 p-3 text-xs font-bold text-slate-700">
                  {name}
                </code>
              )
            )}
          </div>
          <p className="mt-3 text-xs font-semibold text-amber-700">
            Use individual photographs containing only that student. Group/classroom photos are not suitable for enrollment.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">2. Select all photos</h2>
              <p className="mt-1 text-sm text-slate-500">
                JPEG, PNG or WebP; maximum 8 MB per photo.
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => chooseFiles(event.target.files)}
            />
            <button
              type="button"
              disabled={loading || busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="fa-solid fa-images mr-2" />
              Choose Bulk Photos
            </button>
          </div>

          {loading && <p className="mt-5 text-sm font-bold text-slate-500">Loading student admission numbers…</p>}
          {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

          {files.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryCard label="Photos selected" value={files.length} tone="blue" />
              <SummaryCard label="Ready students" value={analysis.ready.length} tone="green" />
              <SummaryCard label="Need 2–3 photos" value={analysis.incomplete.length + analysis.excess.length} tone="amber" />
              <SummaryCard label="Unmatched" value={analysis.unmatched.length} tone="red" />
              <SummaryCard label="Invalid files" value={analysis.invalid.length} tone="slate" />
            </div>
          )}

          {(analysis.incomplete.length > 0 || analysis.excess.length > 0 || analysis.unmatched.length > 0 || analysis.invalid.length > 0) && (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {(analysis.incomplete.length > 0 || analysis.excess.length > 0) && (
                <IssueBox
                  title="Photo-count problems"
                  items={[
                    ...analysis.incomplete.map((group) => `${group.student.admission_number} — only ${group.files.length} photo`),
                    ...analysis.excess.map((group) => `${group.student.admission_number} — ${group.files.length} photos (maximum 3)`),
                  ]}
                />
              )}
              {(analysis.unmatched.length > 0 || analysis.invalid.length > 0) && (
                <IssueBox
                  title="Files that will not be enrolled"
                  items={[
                    ...analysis.unmatched.map((file) => `${file.name} — admission number not matched`),
                    ...analysis.invalid.map((item) => `${item.file.name} — ${item.reason}`),
                  ]}
                />
              )}
            </div>
          )}

          {analysis.duplicateAdmissionNumbers.length > 0 && (
            <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
              Duplicate admission numbers exist in the student records. Correct them before bulk enrollment.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-600">
              Only the {analysis.ready.length} ready student{analysis.ready.length === 1 ? '' : 's'} will be processed.
            </p>
            <button
              type="button"
              disabled={busy || analysis.ready.length === 0}
              onClick={startEnrollment}
              className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className={busy ? 'fa-solid fa-spinner fa-spin mr-2' : 'fa-solid fa-shield-halved mr-2'} />
              {busy ? 'Enrolling Students…' : `Enroll ${analysis.ready.length} Students`}
            </button>
          </div>
        </section>

        {(progress || results.length > 0) && (
          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5 sm:p-6">
              <h2 className="text-lg font-black text-slate-900">3. Enrollment results</h2>
              {progress && <p className="mt-2 text-sm font-semibold text-blue-700">{progress}</p>}
              {results.length > 0 && (
                <div className="mt-3 flex gap-3 text-xs font-black">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{successCount} successful</span>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">{failedCount} failed</span>
                </div>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {results.map((result) => (
                <div key={result.studentId} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-6">
                  <div>
                    <p className="font-black text-slate-900">{result.name}</p>
                    <p className="text-xs text-slate-500">{result.admissionNumber} • {result.photoCount} photos</p>
                  </div>
                  <StatusBadge status={result.status} />
                  <p className="text-xs font-semibold text-slate-600 sm:max-w-xs sm:text-right">{result.message}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'green' | 'amber' | 'red' | 'slate' }) {
  const classes = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className={`rounded-2xl p-4 ${classes[tone]}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-black">{label}</p>
    </div>
  );
}

function IssueBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-black text-amber-900">{title}</p>
      <div className="mt-2 max-h-40 space-y-1 overflow-auto text-xs font-semibold text-amber-800">
        {items.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ResultStatus }) {
  const config = {
    waiting: ['Waiting', 'bg-slate-100 text-slate-600'],
    uploading: ['Uploading', 'bg-blue-50 text-blue-700'],
    success: ['Successful', 'bg-emerald-50 text-emerald-700'],
    failed: ['Failed', 'bg-red-50 text-red-700'],
  } as const;

  return <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${config[status][1]}`}>{config[status][0]}</span>;
}

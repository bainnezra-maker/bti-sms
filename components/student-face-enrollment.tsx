'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
};

type ApiResponse = {
  error?: string;
  message?: string;
  batchId?: string;
  uploads?: Array<{
    path: string;
    token: string;
  }>;
  enrollment?: {
    enrollment_status?: string;
    reference_photo_count?: number;
  };
};

const BUCKET = 'student-face-enrollment';

export default function StudentFaceEnrollment({
  student,
}: {
  student: Student;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState('loading');
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState('');

  async function readApiResponse(
    response: Response
  ): Promise<ApiResponse> {
    const raw = await response.text();

    if (!raw) return {};

    try {
      return JSON.parse(raw);
    } catch {
      const cleaned = raw
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        error:
          cleaned ||
          `The server returned HTTP ${response.status} ${response.statusText}.`,
      };
    }
  }

  async function refresh() {
    try {
      const res = await fetch(
        `/api/facial-attendance/enrollment?studentId=${encodeURIComponent(
          student.id
        )}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      const data = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(
          data.error ||
            `Could not load face enrollment. HTTP ${res.status}.`
        );
      }

      setStatus(
        data.enrollment?.enrollment_status ?? 'not_enrolled'
      );

      setCount(
        data.enrollment?.reference_photo_count ?? 0
      );
    } catch (error: any) {
      console.error('Face enrollment refresh error:', error);
      setStatus('not_enrolled');
      setMessage(
        error?.message || 'Could not load face enrollment.'
      );
    }
  }

  useEffect(() => {
    refresh();
  }, [student.id]);

  async function enroll() {
    if (files.length < 2 || files.length > 3) {
      setMessage('Select 2 or 3 clear photos.');
      return;
    }

    setBusy(true);
    setMessage('');
    setProgress('Preparing secure upload…');

    try {
      /*
       * Step 1:
       * Send ONLY small metadata to Vercel.
       * No image bytes pass through the Vercel function.
       */
      const prepareRes = await fetch(
        '/api/facial-attendance/enrollment',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'prepare',
            studentId: student.id,
            files: files.map((file) => ({
              type: file.type,
              size: file.size,
              name: file.name,
            })),
          }),
        }
      );

      const prepareData = await readApiResponse(prepareRes);

      if (!prepareRes.ok) {
        throw new Error(
          prepareData.error ||
            `Could not prepare upload. HTTP ${prepareRes.status}.`
        );
      }

      const uploads = prepareData.uploads || [];

      if (uploads.length !== files.length) {
        throw new Error(
          'The server did not authorize all selected photos.'
        );
      }

      /*
       * Step 2:
       * Upload image bytes DIRECTLY from the browser to the private
       * Supabase Storage bucket using the short-lived signed tokens.
       */
      const supabase = createClient();
      const uploadedPaths: string[] = [];

      for (let i = 0; i < files.length; i++) {
        setProgress(
          `Uploading photo ${i + 1} of ${files.length} securely…`
        );

        const authorization = uploads[i];

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(
            authorization.path,
            authorization.token,
            files[i],
            {
              contentType: files[i].type,
            }
          );

        if (uploadError) {
          throw new Error(
            `Photo ${i + 1} upload failed: ${uploadError.message}`
          );
        }

        uploadedPaths.push(authorization.path);
      }

      /*
       * Step 3:
       * Send ONLY the small private storage path list back to Vercel.
       * Server verifies that the objects really exist before enrollment.
       */
      setProgress('Verifying enrollment…');

      const finalizeRes = await fetch(
        '/api/facial-attendance/enrollment',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'finalize',
            studentId: student.id,
            paths: uploadedPaths,
          }),
        }
      );

      const finalizeData = await readApiResponse(finalizeRes);

      if (!finalizeRes.ok) {
        throw new Error(
          finalizeData.error ||
            `Could not finalize enrollment. HTTP ${finalizeRes.status}.`
        );
      }

      setFiles([]);

      if (inputRef.current) {
        inputRef.current.value = '';
      }

      setMessage(
        finalizeData.message ||
          'Face enrollment completed successfully.'
      );

      await refresh();
    } catch (error: any) {
      console.error('Face enrollment error:', error);

      setMessage(
        error?.message ||
          'Face enrollment failed. Please try again.'
      );
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  async function remove() {
    if (
      !confirm(
        `Remove facial enrollment for ${student.full_name}?`
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('');
    setProgress('Removing enrollment…');

    try {
      const res = await fetch(
        `/api/facial-attendance/enrollment?studentId=${encodeURIComponent(
          student.id
        )}`,
        {
          method: 'DELETE',
        }
      );

      const data = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(
          data.error ||
            `Could not remove enrollment. HTTP ${res.status}.`
        );
      }

      setFiles([]);

      if (inputRef.current) {
        inputRef.current.value = '';
      }

      setMessage('Facial enrollment removed.');

      await refresh();
    } catch (error: any) {
      console.error('Face enrollment removal error:', error);

      setMessage(
        error?.message || 'Could not remove enrollment.'
      );
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  return (
    <section className="bti-attendance-fade rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
            <i className="fa-solid fa-face-viewfinder fa-beat-fade" />
            Face Enrollment
          </div>

          <h3 className="mt-3 font-black text-slate-900">
            {student.full_name}
          </h3>

          <p className="text-xs text-slate-500">
            {student.admission_number}
          </p>
        </div>

        <div
          className={`rounded-2xl px-4 py-2 text-xs font-black ${
            status === 'enrolled'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}
        >
          <i
            className={`mr-2 fa-solid ${
              status === 'enrolled'
                ? 'fa-circle-check'
                : 'fa-circle-exclamation'
            }`}
          />

          {status === 'loading'
            ? 'Checking…'
            : status === 'enrolled'
            ? `Enrolled • ${count} photos`
            : 'Not Enrolled'}
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
        Use 2–3 clear photos of the same student:
        front-facing, slight left, and slight right.
        Avoid group photographs.
      </div>

      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => {
          const selected = Array.from(
            e.target.files || []
          ).slice(0, 3);

          setFiles(selected);
          setMessage('');
          setProgress('');
        }}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <i className="fa-solid fa-images mr-2" />
          Choose 2–3 Photos
        </button>

        <button
          type="button"
          disabled={busy || files.length < 2}
          onClick={enroll}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <i
            className={
              busy
                ? 'fa-solid fa-spinner fa-spin mr-2'
                : 'fa-solid fa-shield-halved mr-2'
            }
          />

          {busy
            ? 'Processing...'
            : status === 'enrolled'
            ? 'Replace Enrollment'
            : 'Enroll Face'}
        </button>

        {status === 'enrolled' && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className="fa-solid fa-trash mr-2" />
            Remove
          </button>
        )}
      </div>

      {files.length > 0 && (
        <p className="mt-3 text-xs font-bold text-slate-600">
          <i className="fa-solid fa-circle-check mr-2 text-blue-600" />
          {files.length} photo
          {files.length === 1 ? '' : 's'} selected
        </p>
      )}

      {progress && (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700">
          <i className="fa-solid fa-cloud-arrow-up fa-bounce mr-2 text-blue-600" />
          {progress}
        </p>
      )}

      {message && (
        <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">
          <i className="fa-solid fa-circle-info mr-2" />
          {message}
        </p>
      )}
    </section>
  );
}

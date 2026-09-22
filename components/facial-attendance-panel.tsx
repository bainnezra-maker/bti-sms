'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type FacialStudent = {
  id: string;
  full_name: string;
  admission_number: string;
};

type MatchResult = {
  faceId: string;
  studentId: string | null;
  studentName: string | null;
  confidence: number | null;
  status: 'strong' | 'review' | 'unknown';
};

type Props = {
  className: string;
  classId: string;
  students: FacialStudent[];
  onApplyPresent: (studentIds: string[]) => void;
};

type ApiData = {
  error?: string;
  message?: string;
  jobId?: string;
  uploads?: Array<{ path: string; token: string }>;
  matches?: MatchResult[];
};

const BUCKET = 'facial-attendance-classroom';

export default function FacialAttendancePanel({
  className,
  classId,
  students,
  onApplyPresent,
}: Props) {
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const uploadInput = useRef<HTMLInputElement | null>(null);

  const [photos, setPhotos] = useState<File[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState('');

  const previews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos]
  );

  useEffect(
    () => () => previews.forEach((x) => URL.revokeObjectURL(x.url)),
    [previews]
  );

  async function readApi(response: Response): Promise<ApiData> {
    const raw = await response.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {
        error:
          raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ||
          `HTTP ${response.status} ${response.statusText}`,
      };
    }
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;

    const incoming = Array.from(files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );

    setPhotos((previous) => [...previous, ...incoming].slice(0, 10));
    setResults([]);
    setMessage('');
    setProgress('');
  }

  async function processPhotos() {
    if (!classId) {
      setMessage('Select one specific class before using facial attendance.');
      return;
    }

    if (!photos.length) {
      setMessage('Take or upload at least one classroom photo.');
      return;
    }

    setProcessing(true);
    setMessage('');
    setProgress('Preparing secure classroom-photo upload…');

    try {
      // STEP 1 — request short-lived signed upload authorization.
      const prepareResponse = await fetch(
        '/api/facial-attendance/classroom-upload',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'prepare',
            classId,
            files: photos.map((photo) => ({
              name: photo.name,
              type: photo.type,
              size: photo.size,
            })),
          }),
        }
      );

      const prepare = await readApi(prepareResponse);

      if (!prepareResponse.ok) {
        throw new Error(
          prepare.error ||
            `Could not prepare classroom upload. HTTP ${prepareResponse.status}.`
        );
      }

      if (!prepare.jobId || !prepare.uploads) {
        throw new Error('The server did not create the facial-attendance job.');
      }

      if (prepare.uploads.length !== photos.length) {
        throw new Error('The server did not authorize all classroom photos.');
      }

      // STEP 2 — image bytes go directly to private Supabase Storage.
      const supabase = createClient();

      for (let i = 0; i < photos.length; i++) {
        setProgress(
          `Uploading classroom photo ${i + 1} of ${photos.length} securely…`
        );

        const authorization = prepare.uploads[i];

        const { error } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(
            authorization.path,
            authorization.token,
            photos[i],
            { contentType: photos[i].type }
          );

        if (error) {
          throw new Error(
            `Classroom photo ${i + 1} upload failed: ${error.message}`
          );
        }
      }

      // STEP 3 — server verifies that every private object exists.
      setProgress('Verifying classroom photos…');

      const finalizeResponse = await fetch(
        '/api/facial-attendance/classroom-upload',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'finalize',
            classId,
            jobId: prepare.jobId,
          }),
        }
      );

      const finalized = await readApi(finalizeResponse);

      if (!finalizeResponse.ok) {
        throw new Error(
          finalized.error ||
            `Could not verify classroom photos. HTTP ${finalizeResponse.status}.`
        );
      }

      /*
       * STEP 4 — recognition endpoint receives only the small job ID.
       * No classroom image bytes pass through Vercel.
       *
       * The existing process route is still a recognition placeholder until
       * the dedicated Phase 2B inference worker is connected.
       */
      setProgress('Sending photos for facial recognition…');

      const recognitionResponse = await fetch(
        '/api/facial-attendance/process',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId,
            jobId: prepare.jobId,
          }),
        }
      );

      const recognition = await readApi(recognitionResponse);

      if (!recognitionResponse.ok) {
        throw new Error(
          recognition.error ||
            `Facial recognition could not start. HTTP ${recognitionResponse.status}.`
        );
      }

      const matches = recognition.matches || [];
      setResults(matches);

      // Preserve existing attendance behavior:
      // only strong matches are proposed as Present.
      const strongIds = [
        ...new Set(
          matches
            .filter((match) => match.status === 'strong' && match.studentId)
            .map((match) => match.studentId as string)
        ),
      ];

      if (strongIds.length) {
        onApplyPresent(strongIds);
      }

      setMessage(
        recognition.message ||
          finalized.message ||
          `${photos.length} classroom photo${
            photos.length === 1 ? '' : 's'
          } uploaded securely.`
      );
    } catch (error: any) {
      console.error('Facial attendance error:', error);
      setMessage(error?.message || 'Facial attendance processing failed.');
    } finally {
      setProcessing(false);
      setProgress('');
    }
  }

  function confirm(faceId: string, studentId: string) {
    setResults((previous) =>
      previous.map((result) =>
        result.faceId === faceId
          ? { ...result, status: 'strong' as const }
          : result
      )
    );

    onApplyPresent([studentId]);
  }

  function reject(faceId: string) {
    setResults((previous) =>
      previous.map((result) =>
        result.faceId === faceId
          ? {
              ...result,
              studentId: null,
              studentName: null,
              status: 'unknown' as const,
            }
          : result
      )
    );
  }

  return (
    <section className="rounded-3xl border border-blue-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
            <i className="fa-solid fa-camera fa-beat-fade" />
            Facial Attendance
          </div>

          <h2 className="mt-3 text-xl font-black text-slate-900">
            {className || 'Select a Class'}
          </h2>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Take photos now or upload classroom photos taken earlier when
            there was no internet.
          </p>
        </div>

        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          Not detected does not automatically mean absent.
        </div>
      </div>

      {!classId && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Choose one specific class. Facial attendance is disabled for All
          Classes.
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={!classId || processing}
          onClick={() => cameraInput.current?.click()}
          className="rounded-2xl bg-blue-600 px-5 py-4 font-black text-white disabled:opacity-40"
        >
          <i className="fa-solid fa-camera mr-2" />
          Take Photos Now
        </button>

        <button
          type="button"
          disabled={!classId || processing}
          onClick={() => uploadInput.current?.click()}
          className="rounded-2xl border border-slate-300 bg-white px-5 py-4 font-black text-slate-700 disabled:opacity-40"
        >
          <i className="fa-solid fa-cloud-arrow-up mr-2" />
          Upload Photos
        </button>

        <input
          ref={cameraInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => addPhotos(e.target.files)}
        />

        <input
          ref={uploadInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => addPhotos(e.target.files)}
        />
      </div>

      {!!photos.length && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="font-black">
              Classroom Photos ({photos.length})
            </h3>

            <button
              type="button"
              disabled={processing}
              onClick={() => {
                setPhotos([]);
                setResults([]);
                setMessage('');
                setProgress('');
              }}
              className="text-xs font-black text-red-600 disabled:opacity-40"
            >
              Clear All
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {previews.map((x, i) => (
              <div
                key={`${x.file.name}-${i}`}
                className="overflow-hidden rounded-2xl border"
              >
                <img
                  src={x.url}
                  alt={`Classroom photo ${i + 1}`}
                  className="h-28 w-full object-cover"
                />

                <div className="flex justify-between p-2 text-xs font-bold">
                  Photo {i + 1}

                  <button
                    type="button"
                    disabled={processing}
                    onClick={() =>
                      setPhotos((previous) =>
                        previous.filter((_, j) => j !== i)
                      )
                    }
                    className="text-red-600 disabled:opacity-40"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={processPhotos}
            disabled={processing}
            className="mt-5 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white disabled:opacity-60"
          >
            <i
              className={
                processing
                  ? 'fa-solid fa-spinner fa-spin mr-2'
                  : 'fa-solid fa-face-viewfinder mr-2'
              }
            />
            {processing ? 'Processing Faces...' : 'Process Attendance'}
          </button>
        </div>
      )}

      {progress && (
        <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          <i className="fa-solid fa-cloud-arrow-up fa-bounce mr-2 text-blue-600" />
          {progress}
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          <i className="fa-solid fa-circle-info mr-2" />
          {message}
        </div>
      )}

      {!!results.length && (
        <div className="mt-6 space-y-3">
          {results.map((result) => (
            <div key={result.faceId} className="rounded-2xl border p-4">
              <p className="font-black">
                {result.studentName || 'Unknown Face'}
              </p>

              {result.confidence !== null && (
                <p className="mt-1 text-xs font-bold text-slate-600">
                  Match confidence: {Math.round(result.confidence * 100)}%
                </p>
              )}

              <p className="mt-1 text-xs text-slate-500">
                {result.status === 'strong'
                  ? 'Strong match — proposed Present'
                  : result.status === 'review'
                  ? 'Low-confidence match — confirm below'
                  : 'No reliable student match'}
              </p>

              {result.status === 'review' && result.studentId && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      confirm(result.faceId, result.studentId!)
                    }
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white"
                  >
                    <i className="fa-solid fa-user-check mr-2" />
                    Same Person
                  </button>

                  <button
                    type="button"
                    onClick={() => reject(result.faceId)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white"
                  >
                    <i className="fa-solid fa-user-xmark mr-2" />
                    Different Person
                  </button>

                  <button
                    type="button"
                    className="rounded-xl border px-4 py-2 text-xs font-black"
                  >
                    <i className="fa-solid fa-circle-question mr-2" />
                    Not Sure
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

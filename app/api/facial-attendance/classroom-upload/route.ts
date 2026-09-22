import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const BUCKET = 'facial-attendance-classroom';
const MAX_PHOTOS = 10;
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function authorize() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }) };

  const { data: profile } = await userClient
    .from('users')
    .select('school_id, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    return { error: NextResponse.json({ error: 'Your account is not active.' }, { status: 403 }) };
  }

  const allowed = ['teacher', 'admin', 'owner', 'principal'];
  if (!allowed.includes(String(profile.role || '').toLowerCase())) {
    return { error: NextResponse.json({ error: 'You are not allowed to use facial attendance.' }, { status: 403 }) };
  }

  return { user, profile };
}

function ext(type:string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: 'Server Supabase credentials are not configured.' }, { status: 500 });

  let body:any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const action = String(body?.action || '');
  const classId = String(body?.classId || '');

  if (!classId) return NextResponse.json({ error: 'Select one specific class.' }, { status: 400 });

  // Ensure the selected class belongs to the signed-in user's school.
  const { data: classRow } = await admin
    .from('classes')
    .select('id, school_id')
    .eq('id', classId)
    .eq('school_id', auth.profile.school_id)
    .maybeSingle();

  if (!classRow) return NextResponse.json({ error: 'Class not found in your school.' }, { status: 404 });

  if (action === 'prepare') {
    const files = Array.isArray(body?.files) ? body.files : [];
    if (!files.length || files.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `Choose between 1 and ${MAX_PHOTOS} classroom photos.` }, { status: 400 });
    }

    for (const file of files) {
      const type = String(file?.type || '');
      const size = Number(file?.size || 0);
      if (!ALLOWED_TYPES.has(type)) return NextResponse.json({ error: 'Classroom photos must be JPEG, PNG or WebP.' }, { status: 400 });
      if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
        return NextResponse.json({ error: 'Each classroom photo must be 12 MB or smaller.' }, { status: 400 });
      }
    }

    const jobId = crypto.randomUUID();
    const folder = `${auth.profile.school_id}/${classId}/${jobId}`;
    const uploads:any[] = [];

    for (let i=0;i<files.length;i++) {
      const path = `${folder}/classroom-${i+1}.${ext(String(files[i].type))}`;
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data?.token) {
        return NextResponse.json({ error: error?.message || 'Could not authorize classroom-photo upload.' }, { status: 500 });
      }
      uploads.push({ path, token: data.token });
    }

    const { error: jobError } = await admin.from('face_recognition_jobs').insert({
      id: jobId,
      school_id: auth.profile.school_id,
      class_id: classId,
      created_by: auth.user.id,
      photo_paths: uploads.map(x => x.path),
      status: 'uploaded',
    });

    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });

    return NextResponse.json({ ok: true, jobId, uploads });
  }

  if (action === 'finalize') {
    const jobId = String(body?.jobId || '');
    if (!jobId) return NextResponse.json({ error: 'jobId is required.' }, { status: 400 });

    const { data: job } = await admin.from('face_recognition_jobs')
      .select('id, school_id, class_id, created_by, photo_paths, status')
      .eq('id', jobId)
      .eq('school_id', auth.profile.school_id)
      .eq('class_id', classId)
      .maybeSingle();

    if (!job || job.created_by !== auth.user.id) {
      return NextResponse.json({ error: 'Recognition job not found.' }, { status: 404 });
    }

    const prefix = `${auth.profile.school_id}/${classId}/${jobId}`;
    const { data: objects, error: listError } = await admin.storage.from(BUCKET).list(prefix, { limit: MAX_PHOTOS + 2 });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

    const existing = new Set((objects || []).map((o:any) => `${prefix}/${o.name}`));
    const missing = (job.photo_paths || []).filter((p:string) => !existing.has(p));
    if (missing.length) return NextResponse.json({ error: 'One or more classroom photos did not finish uploading.' }, { status: 400 });

    await admin.from('face_attendance_audit').insert({
      school_id: auth.profile.school_id,
      actor_user_id: auth.user.id,
      class_id: classId,
      event_type: 'classroom_photos_uploaded',
      result: 'ready_for_recognition',
      metadata: { job_id: jobId, photo_count: job.photo_paths.length },
    });

    return NextResponse.json({
      ok: true,
      jobId,
      photoCount: job.photo_paths.length,
      message: `${job.photo_paths.length} classroom photo${job.photo_paths.length === 1 ? '' : 's'} uploaded securely and ready for recognition.`,
    });
  }

  return NextResponse.json({ error: 'Unknown upload action.' }, { status: 400 });
}

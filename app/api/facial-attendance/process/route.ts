import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function POST(request: Request) {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const { data: profile } = await userClient
    .from('users')
    .select('school_id, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    return NextResponse.json({ error: 'Your account is not active.' }, { status: 403 });
  }

  const allowed = ['teacher', 'admin', 'owner', 'principal'];
  if (!allowed.includes(String(profile.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'You are not allowed to use facial attendance.' }, { status: 403 });
  }

  let body:any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid recognition request.' }, { status: 400 }); }

  const classId = String(body?.classId || '');
  const jobId = String(body?.jobId || '');
  if (!classId || !jobId) {
    return NextResponse.json({ error: 'classId and jobId are required.' }, { status: 400 });
  }

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: 'Server Supabase credentials are not configured.' }, { status: 500 });

  const { data: classRow } = await admin.from('classes')
    .select('id,school_id')
    .eq('id', classId)
    .eq('school_id', profile.school_id)
    .maybeSingle();

  if (!classRow) return NextResponse.json({ error: 'Class not found in your school.' }, { status: 404 });

  const { data: job } = await admin.from('face_recognition_jobs')
    .select('id,school_id,class_id,created_by,status')
    .eq('id', jobId)
    .eq('school_id', profile.school_id)
    .eq('class_id', classId)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: 'Recognition job not found.' }, { status: 404 });

  const workerUrl = process.env.RECOGNITION_WORKER_URL;
  const workerSecret = process.env.RECOGNITION_WORKER_SECRET;
  if (!workerUrl || !workerSecret) {
    return NextResponse.json({
      error: 'Recognition worker is not configured. Add RECOGNITION_WORKER_URL and RECOGNITION_WORKER_SECRET to Vercel.'
    }, { status: 503 });
  }

  await admin.from('face_recognition_jobs').update({ status: 'processing' }).eq('id', jobId);

  try {
    const response = await fetch(`${workerUrl.replace(/\/$/, '')}/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': workerSecret,
      },
      body: JSON.stringify({
        school_id: profile.school_id,
        class_id: classId,
        job_id: jobId,
      }),
      cache: 'no-store',
    });

    const raw = await response.text();
    let data:any;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { data = { error: raw || 'Recognition worker returned an invalid response.' }; }

    if (!response.ok) {
      await admin.from('face_recognition_jobs')
        .update({ status: 'failed', error_message: data?.detail || data?.error || `Worker HTTP ${response.status}` })
        .eq('id', jobId);
      return NextResponse.json({ error: data?.detail || data?.error || 'Recognition worker failed.' }, { status: 502 });
    }

    await admin.from('face_attendance_audit').insert({
      school_id: profile.school_id,
      actor_user_id: user.id,
      class_id: classId,
      event_type: 'face_recognition_completed',
      result: 'completed',
      metadata: { job_id: jobId, match_count: Array.isArray(data.matches) ? data.matches.length : 0 },
    });

    return NextResponse.json(data);
  } catch (error:any) {
    await admin.from('face_recognition_jobs')
      .update({ status: 'failed', error_message: error?.message || 'Worker connection failed.' })
      .eq('id', jobId);

    return NextResponse.json({
      error: error?.message || 'Could not connect to recognition worker.'
    }, { status: 502 });
  }
}

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const ALLOWED_ROLES = ['admin', 'owner'];
const MAX_FILES = 3;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function serverAdmin() {
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

  if (!profile || profile.is_active === false || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Only an active administrator or owner can manage face enrollment.' }, { status: 403 }) };
  }
  return { user, profile };
}

export async function GET(request: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;

  const studentId = new URL(request.url).searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'studentId is required.' }, { status: 400 });

  const admin = serverAdmin();
  if (!admin) return NextResponse.json({ error: 'Server Supabase credentials are not configured.' }, { status: 500 });

  const { data: student } = await admin.from('students')
    .select('id, full_name, admission_number, school_id')
    .eq('id', studentId).eq('school_id', auth.profile.school_id).maybeSingle();

  if (!student) return NextResponse.json({ error: 'Student not found in your school.' }, { status: 404 });

  const { data: enrollment } = await admin.from('student_face_enrollments')
    .select('student_id, enrollment_status, reference_photo_paths, template_version, enrolled_at, updated_at')
    .eq('school_id', auth.profile.school_id).eq('student_id', studentId).maybeSingle();

  return NextResponse.json({
    student,
    enrollment: enrollment ? {
      ...enrollment,
      reference_photo_count: enrollment.reference_photo_paths?.length ?? 0,
      reference_photo_paths: undefined,
    } : { student_id: studentId, enrollment_status: 'not_enrolled', reference_photo_count: 0 },
  });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;

  const admin = serverAdmin();
  if (!admin) return NextResponse.json({ error: 'Server Supabase credentials are not configured.' }, { status: 500 });

  const form = await request.formData();
  const studentId = String(form.get('studentId') || '');
  const photos = form.getAll('photos').filter((x): x is File => x instanceof File);

  if (!studentId) return NextResponse.json({ error: 'studentId is required.' }, { status: 400 });
  if (photos.length < 2 || photos.length > MAX_FILES) {
    return NextResponse.json({ error: 'Upload 2 or 3 clear reference photos.' }, { status: 400 });
  }
  for (const photo of photos) {
    if (!ALLOWED_TYPES.has(photo.type) || photo.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Each photo must be JPEG, PNG or WebP and no larger than 8 MB.' }, { status: 400 });
    }
  }

  const { data: student } = await admin.from('students')
    .select('id, full_name, admission_number, school_id')
    .eq('id', studentId).eq('school_id', auth.profile.school_id).maybeSingle();
  if (!student) return NextResponse.json({ error: 'Student not found in your school.' }, { status: 404 });

  const { data: old } = await admin.from('student_face_enrollments')
    .select('reference_photo_paths')
    .eq('school_id', auth.profile.school_id).eq('student_id', studentId).maybeSingle();

  const paths: string[] = [];
  try {
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${auth.profile.school_id}/${studentId}/${crypto.randomUUID()}-${i + 1}.${ext}`;
      const bytes = new Uint8Array(await photo.arrayBuffer());
      const { error } = await admin.storage.from('student-face-enrollment')
        .upload(path, bytes, { contentType: photo.type, upsert: false });
      if (error) throw error;
      paths.push(path);
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await admin.from('student_face_enrollments').upsert({
      school_id: auth.profile.school_id,
      student_id: studentId,
      reference_photo_paths: paths,
      enrollment_status: 'enrolled',
      template_version: null,
      template_ciphertext: null,
      enrolled_by: auth.user.id,
      enrolled_at: now,
      updated_at: now,
    }, { onConflict: 'school_id,student_id' });
    if (upsertError) throw upsertError;

    await admin.from('face_attendance_audit').insert({
      school_id: auth.profile.school_id,
      actor_user_id: auth.user.id,
      student_id: studentId,
      event_type: old ? 'face_reenrolled' : 'face_enrolled',
      result: 'reference_photos_saved',
      metadata: { photo_count: paths.length },
    });

    if (old?.reference_photo_paths?.length) {
      await admin.storage.from('student-face-enrollment').remove(old.reference_photo_paths);
    }

    return NextResponse.json({
      ok: true,
      student: { id: student.id, full_name: student.full_name, admission_number: student.admission_number },
      enrollment_status: 'enrolled',
      reference_photo_count: paths.length,
      message: 'Reference photos saved securely. Face-template generation will be connected in Phase 2B.',
    });
  } catch (error: any) {
    if (paths.length) await admin.storage.from('student-face-enrollment').remove(paths);
    console.error('Face enrollment error:', error);
    return NextResponse.json({ error: error?.message || 'Face enrollment failed.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;
  const admin = serverAdmin();
  if (!admin) return NextResponse.json({ error: 'Server Supabase credentials are not configured.' }, { status: 500 });

  const studentId = new URL(request.url).searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'studentId is required.' }, { status: 400 });

  const { data: student } = await admin.from('students').select('id')
    .eq('id', studentId).eq('school_id', auth.profile.school_id).maybeSingle();
  if (!student) return NextResponse.json({ error: 'Student not found in your school.' }, { status: 404 });

  const { data: enrollment } = await admin.from('student_face_enrollments')
    .select('reference_photo_paths').eq('school_id', auth.profile.school_id)
    .eq('student_id', studentId).maybeSingle();

  if (enrollment?.reference_photo_paths?.length) {
    await admin.storage.from('student-face-enrollment').remove(enrollment.reference_photo_paths);
  }
  await admin.from('student_face_enrollments').delete()
    .eq('school_id', auth.profile.school_id).eq('student_id', studentId);

  await admin.from('face_attendance_audit').insert({
    school_id: auth.profile.school_id, actor_user_id: auth.user.id,
    student_id: studentId, event_type: 'face_enrollment_removed', result: 'removed',
  });

  return NextResponse.json({ ok: true });
}

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const ALLOWED_ROLES = ['admin', 'owner'];
const BUCKET = 'student-face-enrollment';
const MAX_FILES = 3;
const MIN_FILES = 2;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function serverAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function authorize() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    };
  }

  const { data: profile } = await userClient
    .from('users')
    .select('school_id, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.is_active === false ||
    !ALLOWED_ROLES.includes(profile.role)
  ) {
    return {
      error: NextResponse.json(
        {
          error:
            'Only an active administrator or owner can manage face enrollment.',
        },
        { status: 403 }
      ),
    };
  }

  return { user, profile };
}

function extensionFor(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

async function getStudent(admin: any, schoolId: string, studentId: string) {
  const { data } = await admin
    .from('students')
    .select('id, full_name, admission_number, school_id')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();

  return data;
}

export async function GET(request: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;

  const studentId = new URL(request.url).searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json(
      { error: 'studentId is required.' },
      { status: 400 }
    );
  }

  const admin = serverAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: 'Server Supabase credentials are not configured.' },
      { status: 500 }
    );
  }

  const student = await getStudent(
    admin,
    auth.profile.school_id,
    studentId
  );

  if (!student) {
    return NextResponse.json(
      { error: 'Student not found in your school.' },
      { status: 404 }
    );
  }

  const { data: enrollment } = await admin
    .from('student_face_enrollments')
    .select(
      'student_id, enrollment_status, reference_photo_paths, template_version, enrolled_at, updated_at'
    )
    .eq('school_id', auth.profile.school_id)
    .eq('student_id', studentId)
    .maybeSingle();

  return NextResponse.json({
    student,
    enrollment: enrollment
      ? {
          student_id: enrollment.student_id,
          enrollment_status: enrollment.enrollment_status,
          template_version: enrollment.template_version,
          enrolled_at: enrollment.enrolled_at,
          updated_at: enrollment.updated_at,
          reference_photo_count:
            enrollment.reference_photo_paths?.length ?? 0,
        }
      : {
          student_id: studentId,
          enrollment_status: 'not_enrolled',
          reference_photo_count: 0,
        },
  });
}

/*
  POST now accepts SMALL JSON only.

  action: "prepare"
    - validates file metadata
    - returns short-lived signed upload URLs
    - browser uploads image bytes directly to private Supabase Storage

  action: "finalize"
    - verifies every expected object exists
    - records only the verified private storage paths in the enrollment table
*/
export async function POST(request: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;

  const admin = serverAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: 'Server Supabase credentials are not configured.' },
      { status: 500 }
    );
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid enrollment request.' },
      { status: 400 }
    );
  }

  const action = String(body?.action || '');
  const studentId = String(body?.studentId || '');

  if (!studentId) {
    return NextResponse.json(
      { error: 'studentId is required.' },
      { status: 400 }
    );
  }

  const student = await getStudent(
    admin,
    auth.profile.school_id,
    studentId
  );

  if (!student) {
    return NextResponse.json(
      { error: 'Student not found in your school.' },
      { status: 404 }
    );
  }

  if (action === 'prepare') {
    const files = Array.isArray(body?.files) ? body.files : [];

    if (files.length < MIN_FILES || files.length > MAX_FILES) {
      return NextResponse.json(
        { error: 'Select 2 or 3 clear reference photos.' },
        { status: 400 }
      );
    }

    for (const file of files) {
      const type = String(file?.type || '');
      const size = Number(file?.size || 0);

      if (!ALLOWED_TYPES.has(type)) {
        return NextResponse.json(
          { error: 'Photos must be JPEG, PNG or WebP.' },
          { status: 400 }
        );
      }

      if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
        return NextResponse.json(
          { error: 'Each photo must be no larger than 8 MB.' },
          { status: 400 }
        );
      }
    }

    const batchId = crypto.randomUUID();
    const folder = `${auth.profile.school_id}/${studentId}/${batchId}`;
    const uploads = [];

    for (let i = 0; i < files.length; i++) {
      const type = String(files[i].type);
      const ext = extensionFor(type);
      const path = `${folder}/reference-${i + 1}.${ext}`;

      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);

      if (error || !data?.token) {
        console.error('Signed upload URL error:', error);
        return NextResponse.json(
          { error: error?.message || 'Could not authorize photo upload.' },
          { status: 500 }
        );
      }

      uploads.push({
        path,
        token: data.token,
      });
    }

    return NextResponse.json({
      ok: true,
      batchId,
      uploads,
    });
  }

  if (action === 'finalize') {
    const paths = Array.isArray(body?.paths)
      ? body.paths.map((value: unknown) => String(value))
      : [];

    if (paths.length < MIN_FILES || paths.length > MAX_FILES) {
      return NextResponse.json(
        { error: 'Exactly 2 or 3 uploaded photo paths are required.' },
        { status: 400 }
      );
    }

    const prefix = `${auth.profile.school_id}/${studentId}/`;

    if (
      new Set(paths).size !== paths.length ||
      paths.some((path: string) => !path.startsWith(prefix))
    ) {
      return NextResponse.json(
        { error: 'Invalid enrollment photo paths.' },
        { status: 400 }
      );
    }

    // All files in one request must belong to the same server-created batch.
    const relative = paths[0].slice(prefix.length);
    const batchId = relative.split('/')[0];

    if (
      !batchId ||
      paths.some(
        (path: string) => !path.startsWith(`${prefix}${batchId}/`)
      )
    ) {
      return NextResponse.json(
        { error: 'Enrollment photos must belong to one upload batch.' },
        { status: 400 }
      );
    }

    const folder = `${prefix}${batchId}`;

    const { data: objects, error: listError } = await admin.storage
      .from(BUCKET)
      .list(folder, { limit: 10 });

    if (listError) {
      console.error('Enrollment verification error:', listError);
      return NextResponse.json(
        { error: listError.message || 'Could not verify uploaded photos.' },
        { status: 500 }
      );
    }

    const existingPaths = new Set(
      (objects || []).map((obj: any) => `${folder}/${obj.name}`)
    );

    const missing = paths.filter(
      (path: string) => !existingPaths.has(path)
    );

    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'One or more reference photos did not finish uploading.' },
        { status: 400 }
      );
    }

    const { data: old } = await admin
      .from('student_face_enrollments')
      .select('reference_photo_paths')
      .eq('school_id', auth.profile.school_id)
      .eq('student_id', studentId)
      .maybeSingle();

    const now = new Date().toISOString();

    const { error: upsertError } = await admin
      .from('student_face_enrollments')
      .upsert(
        {
          school_id: auth.profile.school_id,
          student_id: studentId,
          reference_photo_paths: paths,
          enrollment_status: 'enrolled',
          template_version: null,
          template_ciphertext: null,
          enrolled_by: auth.user.id,
          enrolled_at: now,
          updated_at: now,
        },
        { onConflict: 'school_id,student_id' }
      );

    if (upsertError) {
      console.error('Enrollment save error:', upsertError);
      return NextResponse.json(
        { error: upsertError.message || 'Could not save face enrollment.' },
        { status: 500 }
      );
    }

    await admin.from('face_attendance_audit').insert({
      school_id: auth.profile.school_id,
      actor_user_id: auth.user.id,
      student_id: studentId,
      event_type: old ? 'face_reenrolled' : 'face_enrolled',
      result: 'reference_photos_saved',
      metadata: {
        photo_count: paths.length,
        upload_mode: 'signed_direct_storage',
      },
    });

    // Delete the old reference photos only AFTER the new enrollment is saved.
    const oldPaths = Array.isArray(old?.reference_photo_paths)
      ? old.reference_photo_paths.filter(
          (path: string) => !paths.includes(path)
        )
      : [];

    if (oldPaths.length > 0) {
      const { error: removeError } = await admin.storage
        .from(BUCKET)
        .remove(oldPaths);

      if (removeError) {
        console.error(
          'Old face enrollment cleanup warning:',
          removeError
        );
      }
    }

    return NextResponse.json({
      ok: true,
      student: {
        id: student.id,
        full_name: student.full_name,
        admission_number: student.admission_number,
      },
      enrollment_status: 'enrolled',
      reference_photo_count: paths.length,
      message: `Face enrollment saved successfully with ${paths.length} reference photos.`,
    });
  }

  return NextResponse.json(
    { error: 'Unknown enrollment action.' },
    { status: 400 }
  );
}

export async function DELETE(request: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;

  const admin = serverAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: 'Server Supabase credentials are not configured.' },
      { status: 500 }
    );
  }

  const studentId = new URL(request.url).searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json(
      { error: 'studentId is required.' },
      { status: 400 }
    );
  }

  const student = await getStudent(
    admin,
    auth.profile.school_id,
    studentId
  );

  if (!student) {
    return NextResponse.json(
      { error: 'Student not found in your school.' },
      { status: 404 }
    );
  }

  const { data: enrollment } = await admin
    .from('student_face_enrollments')
    .select('reference_photo_paths')
    .eq('school_id', auth.profile.school_id)
    .eq('student_id', studentId)
    .maybeSingle();

  if (enrollment?.reference_photo_paths?.length) {
    const { error: removeError } = await admin.storage
      .from(BUCKET)
      .remove(enrollment.reference_photo_paths);

    if (removeError) {
      console.error('Face photo removal warning:', removeError);
    }
  }

  const { error: deleteError } = await admin
    .from('student_face_enrollments')
    .delete()
    .eq('school_id', auth.profile.school_id)
    .eq('student_id', studentId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || 'Could not remove enrollment.' },
      { status: 500 }
    );
  }

  await admin.from('face_attendance_audit').insert({
    school_id: auth.profile.school_id,
    actor_user_id: auth.user.id,
    student_id: studentId,
    event_type: 'face_enrollment_removed',
    result: 'removed',
  });

  return NextResponse.json({ ok: true });
}

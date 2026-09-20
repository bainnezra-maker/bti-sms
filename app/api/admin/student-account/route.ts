import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function normalizeAdmissionNumber(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const admissionNumber = normalizeAdmissionNumber(
      body?.admissionNumber
    );

    const password = String(body?.password ?? '');

    if (!admissionNumber || !password) {
      return NextResponse.json(
        {
          error: 'Admission number and password are required.',
        },
        {
          status: 400,
        }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error: 'Student password must be at least 8 characters.',
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Verify that the person creating the account
     * is an active BTI administrator.
     */
    const userClient = await createClient();

    const {
      data: { user: currentUser },
    } = await userClient.auth.getUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          error: 'You must be signed in as an administrator.',
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: adminProfile,
      error: adminProfileError,
    } = await userClient
      .from('users')
      .select('school_id, role, is_active')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (
      adminProfileError ||
      !adminProfile ||
      !['admin','owner'].includes(adminProfile.role) ||
      adminProfile.is_active === false
    ) {
      return NextResponse.json(
        {
          error:
            'Only an active administrator can create student accounts.',
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Server-only Supabase credentials.
     */
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const secretKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !secretKey) {
      console.error(
        'Server-only Supabase credentials are not configured.'
      );

      return NextResponse.json(
        {
          error:
            'Student account creation is not configured yet.',
        },
        {
          status: 500,
        }
      );
    }

    const adminClient = createSupabaseClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    /*
     * Find the student inside the administrator's school.
     */
    const {
      data: student,
      error: studentError,
    } = await adminClient
      .from('students')
      .select(
        'id, admission_number, full_name, school_id, status'
      )
      .eq('school_id', adminProfile.school_id)
      .eq('admission_number', admissionNumber)
      .maybeSingle();

    if (studentError) {
      console.error(
        'Student lookup error:',
        studentError
      );

      return NextResponse.json(
        {
          error:
            'Unable to find the student record.',
        },
        {
          status: 500,
        }
      );
    }

    if (!student) {
      return NextResponse.json(
        {
          error:
            'No student with that admission number was found.',
        },
        {
          status: 404,
        }
      );
    }

    if (student.status !== 'active') {
      return NextResponse.json(
        {
          error:
            'Only an active student can receive a student login account.',
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Prevent duplicate student accounts.
     */
    const {
      data: existingProfile,
      error: existingProfileError,
    } = await adminClient
      .from('users')
      .select(
        'id, email, is_active, student_id'
      )
      .eq('student_id', student.id)
      .maybeSingle();

    if (existingProfileError) {
      console.error(
        'Existing student account lookup error:',
        existingProfileError
      );

      return NextResponse.json(
        {
          error:
            'Unable to check the existing student account.',
        },
        {
          status: 500
        }
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        {
          error:
            'This student already has a BIRITECH SMS account. Use the password reset process instead of creating another account.',
        },
        {
          status: 409
        }
      );
    }

    /*
     * Supabase Auth needs an email identity.
     *
     * The student NEVER uses this email to log in.
     * Their visible login identifier remains their
     * admission number.
     */
    const internalEmail =
      `student.${student.id}@bti-sms.local`;

    /*
     * Create the Auth user securely on the server.
     */
    const {
      data: authData,
      error: authError,
    } =
      await adminClient.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: student.full_name,
          role: 'Student',
          student_id: student.id,
          school_id: student.school_id,
        },
      });

    if (authError || !authData.user) {
      console.error(
        'Student Auth account creation error:',
        authError
      );

      return NextResponse.json(
        {
          error:
            authError?.message ||
            'Unable to create the student login account.',
        },
        {
          status: 500
        }
      );
    }

    /*
     * Create the matching application profile.
     */
    const {
      error: profileInsertError,
    } = await adminClient
      .from('users')
      .insert({
        id: authData.user.id,
        school_id: student.school_id,
        full_name: student.full_name,
        email: internalEmail,
        role: 'Student',
        is_active: true,
        student_id: student.id,
      });

    if (profileInsertError) {
      /*
       * Roll back the Auth account if the public.users
       * record cannot be created.
       */
      await adminClient.auth.admin.deleteUser(
        authData.user.id
      );

      console.error(
        'Student profile creation error:',
        profileInsertError
      );

      return NextResponse.json(
        {
          error:
            'The student login account could not be completed.',
        },
        {
          status: 500
        }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        'Student login account created successfully.',
      student: {
        id: student.id,
        admission_number:
          student.admission_number,
        full_name: student.full_name,
      },
    });
  } catch (error) {
    console.error(
      'Student account creation error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Unable to create the student login account right now.',
      },
      {
        status: 500
      }
    );
  }
}

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
          error: 'Invalid admission number or password.',
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ============================================================
     * SERVER-ONLY CREDENTIALS
     * ============================================================
     *
     * SUPABASE_SECRET_KEY must NEVER be exposed to the browser.
     *
     * SUPABASE_SERVICE_ROLE_KEY is retained as a fallback in case
     * the project still uses the older Supabase key format.
     */
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const secretKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !secretKey || !publishableKey) {
      console.error(
        'Student login server credentials are not configured.'
      );

      return NextResponse.json(
        {
          error:
            'Student login is not configured yet. Please contact the administrator.',
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ============================================================
     * ADMIN SERVER CLIENT
     * ============================================================
     *
     * This client uses the Supabase Secret Key.
     *
     * It is SERVER ONLY.
     */
    const adminClient = createClient(
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
     * ============================================================
     * FIND STUDENT
     * ============================================================
     */
    const { data: student, error: studentError } =
      await adminClient
        .from('students')
        .select(
          'id, admission_number, status'
        )
        .eq('admission_number', admissionNumber)
        .maybeSingle();

    if (
      studentError ||
      !student ||
      student.status !== 'active'
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid admission number or password.',
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ============================================================
     * FIND LINKED STUDENT USER ACCOUNT
     * ============================================================
     */
    const { data: profile, error: profileError } =
      await adminClient
        .from('users')
        .select(
          'id, email, role, is_active, student_id'
        )
        .eq('student_id', student.id)
        .eq('role', 'Student')
        .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.is_active === false ||
      profile.student_id !== student.id
    ) {
      return NextResponse.json(
        {
          error:
            'This student account is not active. Please contact the administrator.',
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ============================================================
     * AUTHENTICATE PASSWORD
     * ============================================================
     *
     * Supabase Auth still uses the linked email internally.
     *
     * The student never needs to know or enter that email.
     */
    const authClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    const {
      data: authData,
      error: authError,
    } =
      await authClient.auth.signInWithPassword({
        email: profile.email,
        password,
      });

    if (
      authError ||
      !authData.session ||
      !authData.user ||
      authData.user.id !== profile.id
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid admission number or password.',
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ============================================================
     * RETURN SESSION TO THE LOGIN PAGE
     * ============================================================
     *
     * The browser will use these tokens with
     * supabase.auth.setSession().
     */
    return NextResponse.json({
      access_token:
        authData.session.access_token,

      refresh_token:
        authData.session.refresh_token,

      expires_in:
        authData.session.expires_in,

      expires_at:
        authData.session.expires_at,

      user_id:
        authData.user.id,
    });
  } catch (error) {
    console.error(
      'Student login error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Unable to sign in right now. Please try again.',
      },
      {
        status: 500,
      }
    );
  }
}

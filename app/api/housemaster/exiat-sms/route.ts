import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ExeatRow = {
  id: string;
  school_id: string;
  student_id: string;
  reason: string;
  destination: string | null;
  departure_at: string;
  expected_return_at: string;
  guardian_contact: string | null;
  guardian_message: string | null;
  sms_attempt_count: number | null;
  sms_last_attempt_at: string | null;
};

function normalizeGhanaPhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) digits = `233${digits.slice(1)}`;
  if (digits.length === 9) digits = `233${digits}`;
  return /^233\d{9}$/.test(digits) ? digits : null;
}

function formatGhanaDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

function clipMessage(value: string, maximum = 420) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= maximum ? clean : `${clean.slice(0, maximum - 1).trim()}…`;
}

function providerReference(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const value =
    record.messageId ||
    record.message_id ||
    record.id ||
    (record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>).messageId ||
        (record.data as Record<string, unknown>).id
      : null);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('id,school_id,role,is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.is_active === false ||
    !['housemaster', 'admin'].includes(profile.role)
  ) {
    return NextResponse.json({ error: 'You are not authorized to send guardian SMS messages.' }, { status: 403 });
  }

  let body: { exiatId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (!body.exiatId) {
    return NextResponse.json({ error: 'An exeat record is required.' }, { status: 400 });
  }

  const { data: exiatData, error: exiatError } = await supabase
    .from('student_exiats')
    .select(
      'id,school_id,student_id,reason,destination,departure_at,expected_return_at,guardian_contact,guardian_message,sms_attempt_count,sms_last_attempt_at',
    )
    .eq('id', body.exiatId)
    .eq('school_id', profile.school_id)
    .maybeSingle();

  if (exiatError || !exiatData) {
    return NextResponse.json({ error: exiatError?.message || 'Exeat record not found.' }, { status: 404 });
  }

  const exiat = exiatData as ExeatRow;
  if (exiat.sms_last_attempt_at) {
    const elapsed = Date.now() - new Date(exiat.sms_last_attempt_at).getTime();
    if (elapsed < 30_000) {
      return NextResponse.json(
        { error: 'Please wait 30 seconds before retrying this SMS.' },
        { status: 429 },
      );
    }
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('full_name,guardian_phone')
    .eq('id', exiat.student_id)
    .eq('school_id', profile.school_id)
    .maybeSingle();

  if (studentError || !student) {
    return NextResponse.json({ error: studentError?.message || 'Student record not found.' }, { status: 404 });
  }

  const recipient = normalizeGhanaPhone(exiat.guardian_contact || student.guardian_phone || '');
  const message = clipMessage(
    `BTI NOTICE: Exeat issued to ${student.full_name}. Reason: ${exiat.reason}. Left: ${formatGhanaDate(
      exiat.departure_at,
    )}. Expected return: ${formatGhanaDate(exiat.expected_return_at)}.${
      exiat.destination ? ` Destination: ${exiat.destination}.` : ''
    }${exiat.guardian_message ? ` ${exiat.guardian_message}` : ''}`,
  );
  const attemptedAt = new Date().toISOString();
  const attemptCount = (exiat.sms_attempt_count || 0) + 1;

  if (!recipient) {
    const errorText = 'The guardian phone number is missing or invalid.';
    await supabase
      .from('student_exiats')
      .update({
        sms_status: 'Failed',
        sms_message: message,
        sms_recipient: exiat.guardian_contact || student.guardian_phone || null,
        sms_attempt_count: attemptCount,
        sms_last_attempt_at: attemptedAt,
        sms_error: errorText,
        updated_at: attemptedAt,
      })
      .eq('id', exiat.id)
      .eq('school_id', profile.school_id);
    return NextResponse.json({ error: errorText, saved: true }, { status: 422 });
  }

  await supabase
    .from('student_exiats')
    .update({
      sms_status: 'Pending',
      sms_message: message,
      sms_recipient: recipient,
      sms_attempt_count: attemptCount,
      sms_last_attempt_at: attemptedAt,
      sms_error: null,
      updated_at: attemptedAt,
    })
    .eq('id', exiat.id)
    .eq('school_id', profile.school_id);

  const clientId = process.env.HUBTEL_SMS_CLIENT_ID;
  const clientSecret = process.env.HUBTEL_SMS_CLIENT_SECRET;
  const senderId = process.env.HUBTEL_SMS_SENDER_ID || 'BTI';
  const endpoint = process.env.HUBTEL_SMS_API_URL || 'https://smsc.hubtel.com/v1/messages/send';

  if (!clientId || !clientSecret) {
    const errorText = 'Hubtel SMS is not configured yet. Add the Hubtel credentials in Vercel.';
    await supabase
      .from('student_exiats')
      .update({ sms_status: 'Failed', sms_error: errorText, updated_at: attemptedAt })
      .eq('id', exiat.id)
      .eq('school_id', profile.school_id);
    return NextResponse.json({ error: errorText, saved: true }, { status: 503 });
  }

  try {
    const url = new URL(endpoint);
    url.searchParams.set('clientid', clientId);
    url.searchParams.set('clientsecret', clientSecret);
    url.searchParams.set('from', senderId);
    url.searchParams.set('to', recipient);
    url.searchParams.set('content', message);

    const response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const responseText = await response.text();
    let payload: unknown = responseText;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      // Keep the provider response as text for the error message below.
    }

    if (!response.ok) {
      throw new Error(
        typeof payload === 'string'
          ? payload || `Hubtel returned ${response.status}.`
          : `Hubtel returned ${response.status}.`,
      );
    }

    const sentAt = new Date().toISOString();
    const reference = providerReference(payload);
    const { error: updateError } = await supabase
      .from('student_exiats')
      .update({
        sms_status: 'Sent',
        sms_provider_message_id: reference,
        sms_sent_at: sentAt,
        sms_error: null,
        updated_at: sentAt,
      })
      .eq('id', exiat.id)
      .eq('school_id', profile.school_id);

    if (updateError) throw updateError;
    return NextResponse.json({ ok: true, status: 'Sent', sentAt, reference });
  } catch (error) {
    const errorText = error instanceof Error ? error.message.slice(0, 500) : 'SMS sending failed.';
    await supabase
      .from('student_exiats')
      .update({ sms_status: 'Failed', sms_error: errorText, updated_at: new Date().toISOString() })
      .eq('id', exiat.id)
      .eq('school_id', profile.school_id);
    return NextResponse.json({ error: errorText, saved: true }, { status: 502 });
  }
}

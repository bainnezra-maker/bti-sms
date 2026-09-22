import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const form = await request.formData();
  const classId = String(form.get('classId') || '');
  const photos = form.getAll('photos');
  if (!classId) return NextResponse.json({ error: 'A specific class is required.' }, { status: 400 });
  if (!photos.length) return NextResponse.json({ error: 'At least one classroom photo is required.' }, { status: 400 });
  // Phase 2: authenticate teacher; load enrolled class students + approved server-side face templates;
  // detect/encode faces; compare only within this class; merge duplicates; return strong/review/unknown.
  // Never automatically mark an undetected student absent and never expose biometric templates to the browser.
  return NextResponse.json({ matches: [], message: `Received ${photos.length} classroom photo${photos.length === 1 ? '' : 's'}. Camera/upload workflow is working. Facial recognition is the next phase.` });
}

export type TeachingDocumentKind =
  | 'unit_specification'
  | 'learning_session_plan'
  | 'particulars_of_work_done';

export type TeachingDocumentContext = {
  kind: TeachingDocumentKind;
  teacherName: string;
  subjectName: string;
  subjectCode?: string | null;
  academicYear: string;
  semester: string;
  forms: string[];
  programmeCount: number;
};

export type GeneratedTeachingDocument = {
  title: string;
  fileName: string;
  mimeType: string;
  content: string;
};

const TITLES: Record<TeachingDocumentKind, string> = {
  unit_specification: 'Unit Specification Breakdown',
  learning_session_plan: 'Learning Session Plan',
  particulars_of_work_done: 'Particulars of Work Done',
};

const SHORT: Record<TeachingDocumentKind, string> = {
  unit_specification: 'USB',
  learning_session_plan: 'LSP',
  particulars_of_work_done: 'POWD',
};

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeFilePart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'subject';
}

function blankLines(count: number) {
  return Array.from({ length: count }, () => '<div class="write-line">&nbsp;</div>').join('');
}

function weeklyRows(columns: number, weeks = 16) {
  return Array.from({ length: weeks }, (_, index) => {
    const cells = Array.from(
      { length: columns - 1 },
      () => '<td class="write-cell">&nbsp;</td>'
    ).join('');
    return `<tr><td class="week">Week ${index + 1}</td>${cells}</tr>`;
  }).join('');
}

function metadata(context: TeachingDocumentContext) {
  const forms = context.forms.length ? context.forms.join(', ') : 'Assigned forms';
  const code = context.subjectCode?.trim() || '—';
  const programmes = context.programmeCount
    ? `${context.programmeCount} assigned programme${context.programmeCount === 1 ? '' : 's'}`
    : 'Assigned programme(s)';

  return `
    <table class="meta">
      <tr><th>Facilitator</th><td>${escapeHtml(context.teacherName)}</td><th>Academic Year</th><td>${escapeHtml(context.academicYear)}</td></tr>
      <tr><th>Subject</th><td>${escapeHtml(context.subjectName)}</td><th>Semester</th><td>${escapeHtml(context.semester)}</td></tr>
      <tr><th>Subject Code</th><td>${escapeHtml(code)}</td><th>Form(s)</th><td>${escapeHtml(forms)}</td></tr>
      <tr><th>Programme Coverage</th><td colspan="3">${escapeHtml(programmes)}</td></tr>
    </table>`;
}

function usbBody(context: TeachingDocumentContext) {
  return `
    ${metadata(context)}
    <div class="notice"><strong>Editable curriculum working document:</strong> complete the official unit titles, learning outcomes and performance criteria from the approved NCI/NCII curriculum.</div>
    <table class="grid usb">
      <thead><tr><th>Week</th><th>Unit / Topic</th><th>Learning Outcome(s)</th><th>Performance Criteria</th><th>Facilitator & Learner Activities</th><th>Resources</th><th>Assessment</th></tr></thead>
      <tbody>${weeklyRows(7)}</tbody>
    </table>
    <table class="signatures"><tr><th>Prepared by</th><th>Checked by</th><th>Approved by</th></tr><tr><td>Name/Signature/Date</td><td>Name/Signature/Date</td><td>Name/Signature/Date</td></tr></table>`;
}

function lspBody(context: TeachingDocumentContext) {
  return `
    <h2>Pre-Session Preparation</h2>
    ${metadata(context)}
    <table class="meta">
      <tr><th>Session / Week</th><td>&nbsp;</td><th>Date</th><td>&nbsp;</td></tr>
      <tr><th>Number of Learners</th><td>&nbsp;</td><th>Duration</th><td>&nbsp;</td></tr>
      <tr><th>Learning Area</th><td colspan="3">Facilitation Room ☐ &nbsp; Workshop ☐ &nbsp; Laboratory ☐ &nbsp; Library ☐ &nbsp; Other ☐</td></tr>
      <tr><th>Unit Title</th><td colspan="3">&nbsp;</td></tr>
      <tr><th>Reference No.</th><td>&nbsp;</td><th>Number of Credits</th><td>&nbsp;</td></tr>
    </table>
    <section><h3>Learning Outcome(s) for this Learning Session</h3>${blankLines(2)}</section>
    <section><h3>Performance Criteria for this Learning Session</h3>${blankLines(3)}</section>
    <section><h3>Range Statement</h3>${blankLines(2)}</section>
    <table class="grid detail">
      <tr><th>Key Skills Integrated</th><td>&nbsp;</td></tr>
      <tr><th>Learners' Existing Knowledge</th><td>&nbsp;</td></tr>
      <tr><th>Learners' Existing Skills</th><td>&nbsp;</td></tr>
      <tr><th>Special Needs Requirements</th><td>&nbsp;</td></tr>
      <tr><th>Safety Procedures</th><td>&nbsp;</td></tr>
      <tr><th>Trade Equipment / Tools / Materials</th><td>&nbsp;</td></tr>
      <tr><th>AVA / Written / Assessment Materials</th><td>&nbsp;</td></tr>
      <tr><th>Reference Materials</th><td>&nbsp;</td></tr>
    </table>
    <h2>Learning Session Delivery</h2>
    <table class="grid delivery">
      <thead><tr><th>Stage</th><th>Time</th><th>Resources</th><th>Facilitator Activity</th><th>Learner Activity (including grouping)</th></tr></thead>
      <tbody>
        <tr><td>Introduction</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        <tr><td>Development 1</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        <tr><td>Development 2</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        <tr><td>Practice / Assessment</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        <tr><td>Conclusion</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
      </tbody>
    </table>
    <h2>Post-Session Reflection and Evaluation</h2>
    <table class="grid detail">
      <tr><th>Main Strength</th><td>&nbsp;</td></tr>
      <tr><th>Main Weakness</th><td>&nbsp;</td></tr>
      <tr><th>Improvement for Subsequent Session</th><td>&nbsp;</td></tr>
      <tr><th>Other Reflective Comments</th><td>&nbsp;</td></tr>
    </table>`;
}

function powdBody(context: TeachingDocumentContext) {
  return `
    ${metadata(context)}
    <table class="grid powd">
      <thead><tr><th>Week / Date</th><th>Duration</th><th>Work Done</th><th>Assessment / Test / Homework</th><th>Remarks</th></tr></thead>
      <tbody>${weeklyRows(5)}</tbody>
    </table>
    <table class="signatures"><tr><th>Facilitator</th><th>Head of Department</th><th>Academic Coordinator</th></tr><tr><td>Signature/Date</td><td>Signature/Date</td><td>Signature/Date</td></tr></table>`;
}

function documentShell(title: string, body: string) {
  return `<!doctype html>
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
  <head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #111827; font-size: 10pt; line-height: 1.35; }
    h1 { text-align: center; font-size: 18pt; margin: 0 0 4px; letter-spacing: .4px; }
    .subtitle { text-align: center; font-size: 9pt; margin-bottom: 14px; color: #475569; }
    h2 { text-align: center; font-size: 13pt; margin: 16px 0 8px; }
    h3 { font-size: 10pt; margin: 10px 0 4px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
    th, td { border: 1px solid #334155; padding: 6px; vertical-align: top; }
    th { background: #e2e8f0; font-weight: 700; }
    .meta th { width: 14%; text-align: left; }
    .meta td { width: 36%; }
    .grid thead th { background: #0f172a; color: white; text-align: center; }
    .week { width: 8%; font-weight: 700; white-space: nowrap; }
    .write-cell { height: 34px; }
    .delivery td { height: 48px; }
    .detail th { width: 28%; text-align: left; }
    .detail td { height: 28px; }
    .notice { border: 1px solid #f59e0b; background: #fffbeb; padding: 8px 10px; margin: 10px 0; font-size: 8.5pt; }
    .write-line { border-bottom: 1px solid #94a3b8; height: 18px; }
    .signatures td { height: 44px; text-align: center; color: #64748b; }
    .signatures th { text-align: center; }
    .footer { margin-top: 12px; text-align: center; color: #64748b; font-size: 8pt; }
  </style></head>
  <body><h1>${escapeHtml(title).toUpperCase()}</h1><div class="subtitle">Generated by BIRITECH SMS · Editable Microsoft Word document</div>${body}<div class="footer">Generated ${escapeHtml(new Intl.DateTimeFormat('en-GH', { dateStyle: 'long' }).format(new Date()))}</div></body></html>`;
}

export function generateTeachingDocument(
  context: TeachingDocumentContext
): GeneratedTeachingDocument {
  const title = `${TITLES[context.kind]} — ${context.subjectName}`;
  const body = context.kind === 'unit_specification'
    ? usbBody(context)
    : context.kind === 'learning_session_plan'
      ? lspBody(context)
      : powdBody(context);

  const fileName = [
    SHORT[context.kind],
    safeFilePart(context.subjectCode || context.subjectName),
    safeFilePart(context.academicYear),
    safeFilePart(context.semester),
  ].join('_') + '.doc';

  return {
    title,
    fileName,
    mimeType: 'application/msword',
    content: documentShell(title, body),
  };
}

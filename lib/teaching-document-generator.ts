import curriculumSeed from '@/lib/curriculum-data.json';

export type TeachingDocumentKind = 'unit_specification' | 'learning_session_plan' | 'particulars_of_work_done';
export type CurriculumLevel = 'NCI' | 'NCII';
export type CalendarEntry = { title: string; activityDate: string; endDate?: string | null; targetForm?: string | null };
type CurriculumOutcome = { number: number; title: string; performanceCriteria: string[]; rangeStatement: string; evidenceRequirements: string };
type CurriculumUnit = { level: CurriculumLevel; subjectKey: string; unitNumber: number; unitTitle: string; levelLabel: string; creditValue: string | null; notionalHours: number | null; introduction: string; contentContext: string; assessmentGuidance: string; learningOutcomes: CurriculumOutcome[]; sourceFile: string };
export type TeachingDocumentContext = {
  kind: TeachingDocumentKind; teacherName: string; subjectName: string; subjectCode?: string | null;
  academicYear: string; semester: string; form: string; programmeCount: number;
  department?: string | null; numberOfLearners?: number | null; sessionDurationMinutes?: number;
  semesterStartDate?: string | null; semesterEndDate?: string | null;
  selectedWeekDate?: string | null; calendarEntries: CalendarEntry[]; powdConfirmed?: boolean;
};
export type GeneratedTeachingDocument = { title: string; fileName: string; mimeType: string; content: string };
type PlannedWeek = { week: number; startDate: string; endDate: string; activity: string; curriculum?: { items: { unit: CurriculumUnit; outcome: CurriculumOutcome }[] } };

const TITLES: Record<TeachingDocumentKind, string> = { unit_specification: 'Unit Specification Breakdown', learning_session_plan: 'Learning Session Plan', particulars_of_work_done: 'Particulars of Work Done' };
const SHORT: Record<TeachingDocumentKind, string> = { unit_specification: 'USB', learning_session_plan: 'LSP', particulars_of_work_done: 'POWD' };
const units = curriculumSeed.units as CurriculumUnit[];

function escapeHtml(value: string | number | null | undefined) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;') }
function safeFilePart(value: string) { return value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'subject' }
function subjectKey(name: string) { const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (normalized.includes('integrated science') || normalized === 'science') return 'integrated-science'; if (normalized.includes('social studies')) return 'social-studies'; return normalized.replaceAll(' ', '-') }
function levelForForm(form: string): CurriculumLevel {
  const formNumber = Number(form.match(/\d+/)?.[0] ?? 1);
  return formNumber <= 2 ? 'NCI' : 'NCII';
}
function formTarget(form: string) { return `form_${form.match(/\d+/)?.[0] ?? '1'}` }
function formatDate(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) }
function mondayEnd(startDate: string) { const date = new Date(`${startDate}T00:00:00`); date.setDate(date.getDate() + 4); return date.toISOString().slice(0, 10) }
function isLessonPlan(title: string) { return /lesson\s*plan/i.test(title) }
function curriculumFor(context: TeachingDocumentContext) { const level = levelForForm(context.form); const key = subjectKey(context.subjectName); return units.filter(unit => unit.level === level && unit.subjectKey === key).sort((a, b) => a.unitNumber - b.unitNumber) }

function buildPlan(context: TeachingDocumentContext): PlannedWeek[] {
  const target = formTarget(context.form);
  const entries = context.calendarEntries.filter(entry => !entry.targetForm || entry.targetForm === 'all' || entry.targetForm === target).sort((a, b) => a.activityDate.localeCompare(b.activityDate));
  const teachingEntries = entries.filter(entry => isLessonPlan(entry.title));
  const outcomes = curriculumFor(context).flatMap(unit => unit.learningOutcomes.map(outcome => ({ unit, outcome })));
  const perWeek = Math.max(1, Math.ceil(outcomes.length / Math.max(1, teachingEntries.length)));
  let cursor = 0;
  return entries.map((entry, index) => {
    const planned: PlannedWeek = { week: index + 1, startDate: entry.activityDate, endDate: entry.endDate || mondayEnd(entry.activityDate), activity: entry.title };
    if (!isLessonPlan(entry.title) || cursor >= outcomes.length) return planned;
    const items = outcomes.slice(cursor, cursor + perWeek);
    cursor += items.length; planned.curriculum = { items }; return planned;
  });
}

function list(items: string[]) { return items.length ? `<ol>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>` : '—' }
function metadata(context: TeachingDocumentContext) { return `<table class="meta"><tr><th>Facilitator</th><td>${escapeHtml(context.teacherName)}</td><th>Academic Year</th><td>${escapeHtml(context.academicYear)}</td></tr><tr><th>Subject</th><td>${escapeHtml(context.subjectName)}</td><th>Semester</th><td>${escapeHtml(context.semester)}</td></tr><tr><th>Subject Code</th><td>${escapeHtml(context.subjectCode || '—')}</td><th>Form / Level</th><td>${escapeHtml(context.form)} / ${levelForForm(context.form)}</td></tr><tr><th>Department</th><td>${escapeHtml(context.department || '—')}</td><th>Programme Coverage</th><td>${context.programmeCount || '—'}</td></tr></table>` }

function usbBody(context: TeachingDocumentContext) {
  const rows = buildPlan(context).map(row => { const items = row.curriculum?.items ?? []; const criteria = items.flatMap(item => item.outcome.performanceCriteria); const unitLabels = Array.from(new Set(items.map(item => `Unit ${item.unit.unitNumber}: ${item.unit.unitTitle}`))); return `<tr><td class="center">${row.week}</td><td>${escapeHtml(formatDate(row.startDate))}<br>to ${escapeHtml(formatDate(row.endDate))}</td><td>${escapeHtml(row.activity)}</td><td>${items.length ? list(unitLabels) : '—'}</td><td>${items.length ? list(items.map(item => `Unit ${item.unit.unitNumber}, LO ${item.outcome.number}: ${item.outcome.title}`)) : '—'}</td><td>${items.length ? list(criteria) : '—'}</td><td>${items.length ? escapeHtml(items.map(item => item.outcome.evidenceRequirements).filter(Boolean).join(' ') || items[0].unit.assessmentGuidance || 'Assessment aligned to the performance criteria.') : '—'}</td></tr>` }).join('');
  return `${metadata(context)}<table class="grid usb"><thead><tr><th>Week</th><th>Date / Period</th><th>School Activity</th><th>Unit / Topic</th><th>Learning Outcome(s)</th><th>Performance Criteria</th><th>Assessment / Evidence</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function selectedWeek(context: TeachingDocumentContext) { const plan = buildPlan(context).filter(row => row.curriculum); return plan.find(row => row.startDate === context.selectedWeekDate) ?? plan[0] }

function lspBody(context: TeachingDocumentContext) {
  const week = selectedWeek(context); if (!week?.curriculum) return '<p>No lesson-plan week or curriculum content is available for this selection.</p>';
  const items = week.curriculum.items; const unit = items[0].unit; const outcomes = items.map(item => item.outcome); const unitTitles = Array.from(new Set(items.map(item => `Unit ${item.unit.unitNumber}: ${item.unit.unitTitle}`))); const criteria = outcomes.flatMap(outcome => outcome.performanceCriteria); const duration = context.sessionDurationMinutes || 120; const intro = Math.max(10, Math.round(duration * .12)); const conclusion = Math.max(10, Math.round(duration * .12)); const development = Math.max(20, duration - intro - conclusion);
  return `<h2>PRE-SESSION PREPARATION</h2>${metadata(context)}<table class="meta"><tr><th>Session / Week</th><td>Week ${week.week}</td><th>Date</th><td>${escapeHtml(formatDate(week.startDate))}</td></tr><tr><th>Number of Learners</th><td>${escapeHtml(context.numberOfLearners || '—')}</td><th>Duration</th><td>${duration} minutes</td></tr><tr><th>Learning Area</th><td colspan="3">Facilitation Room ☒ &nbsp; Workshop ☐ &nbsp; Laboratory ☐ &nbsp; Library ☐ &nbsp; Other ☐</td></tr><tr><th>Unit Title</th><td colspan="3">${escapeHtml(unitTitles.join('; '))}</td></tr><tr><th>Reference No.</th><td>${escapeHtml(context.subjectCode || unit.sourceFile)}</td><th>Number of Credits</th><td>${escapeHtml(unit.creditValue || '—')}</td></tr></table>
  <section><h3>Learning Outcome(s) for this Learning Session</h3>${list(outcomes.map(outcome => `LO ${outcome.number}: ${outcome.title}`))}</section><section><h3>Performance Criteria for this Learning Session</h3>${list(criteria)}</section><section><h3>Range Statement</h3><p>${escapeHtml(outcomes.map(outcome => outcome.rangeStatement).filter(Boolean).join(' ')) || 'The range is fully expressed in the performance criteria.'}</p></section>
  <table class="grid detail"><tr><th>Key Skills Integrated</th><td>Communication, teamwork, problem solving, observation and safe working practices.</td></tr><tr><th>Learners' Existing Knowledge / Skills</th><td>Facilitator checks prior knowledge connected to ${escapeHtml(unit.unitTitle)} through questions and a short introductory task.</td></tr><tr><th>Special Needs / Safety Requirements</th><td>Use inclusive grouping, accessible materials and the relevant classroom or laboratory safety procedures.</td></tr><tr><th>Equipment / Tools / Materials / PPE</th><td>Approved curriculum learning materials, board, markers, learner notes and subject-appropriate equipment or PPE.</td></tr><tr><th>AVA / Written / Assessment Materials</th><td>Charts or slides, worksheets, short-answer questions and practical observation checklist where applicable.</td></tr><tr><th>Reference Materials</th><td>${escapeHtml(unit.sourceFile)}; approved CTVET ${levelForForm(context.form)} learning material.</td></tr></table>
  <h2>LEARNING SESSION DELIVERY</h2><table class="grid delivery"><thead><tr><th>Stage</th><th>Time</th><th>Resources</th><th>Facilitator Activity</th><th>Learner Activity (including grouping)</th></tr></thead><tbody><tr><td>Introduction</td><td>${intro} min</td><td>Board / AVA</td><td>Introduce the session, connect prior learning and communicate the expected outcomes.</td><td>Respond to diagnostic questions, share prior experience and identify the session goal.</td></tr><tr><td>Development</td><td>${development} min</td><td>CTVET learning material and subject resources</td><td>Explain, demonstrate and facilitate guided practice for: ${escapeHtml(criteria.join('; '))}</td><td>Observe, discuss in groups, practise the required tasks and record findings.</td></tr><tr><td>Conclusion / Assessment</td><td>${conclusion} min</td><td>Questions / checklist</td><td>Review the outcomes and assess performance against the stated criteria.</td><td>Present responses, complete the assessment task and identify areas for improvement.</td></tr></tbody></table>
  <h2>POST-SESSION REFLECTION AND EVALUATION</h2><table class="grid detail"><tr><th>Main Strength</th><td>&nbsp;</td></tr><tr><th>Main Weakness</th><td>&nbsp;</td></tr><tr><th>Improvement for Subsequent Session</th><td>&nbsp;</td></tr><tr><th>Other Reflective Comments</th><td>&nbsp;</td></tr></table>`;
}

function powdBody(context: TeachingDocumentContext) {
  const week = selectedWeek(context); if (!week?.curriculum) return '<p>No completed lesson-plan week is available for this selection.</p>';
  const items = week.curriculum.items; const duration = context.sessionDurationMinutes || 120; const unitTitles = Array.from(new Set(items.map(item => `Unit ${item.unit.unitNumber}: ${item.unit.unitTitle}`)));
  return `<table class="powd-head"><tr><th>Department</th><td>${escapeHtml(context.department || '—')}</td><th>Semester</th><td>${escapeHtml(context.semester)}</td></tr><tr><th>Year</th><td>${escapeHtml(context.academicYear)}</td><th>Group</th><td>${escapeHtml(context.form)}</td></tr></table><table class="grid powd"><thead><tr><th>Date</th><th>Duration</th><th>Work Done</th><th>Assessment / Test / Homework</th></tr></thead><tbody><tr><td>${escapeHtml(formatDate(week.startDate))}</td><td>${duration} minutes</td><td><strong>${escapeHtml(unitTitles.join('; '))}</strong><br>${escapeHtml(items.map(item => `LO ${item.outcome.number}: ${item.outcome.title}`).join('; '))}</td><td>${escapeHtml(items.map(item => item.outcome.evidenceRequirements).filter(Boolean).join(' ') || 'Assessment completed against the selected performance criteria.')}</td></tr></tbody></table><p class="confirmation"><strong>Teacher confirmation:</strong> ${context.powdConfirmed ? 'Confirmed as work completed.' : 'DRAFT — confirm the work was completed before filing.'}</p>`;
}

function documentShell(title: string, body: string, portrait = false) {
  const subtitle = title.includes('Particulars') ? 'Official teacher work record' : 'Generated from the approved CTVET curriculum and school activity calendar';
  return `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 ${portrait ? 'portrait' : 'landscape'};margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:9.5pt;line-height:1.3}h1{text-align:center;font-family:"Times New Roman",serif;font-size:17pt;margin:0 0 4px}h2{text-align:center;font-size:12pt;margin:14px 0 7px}h3{font-size:10pt;margin:9px 0 3px}table{width:100%;border-collapse:collapse;margin:7px 0 11px}th,td{border:1px solid #111;padding:5px;vertical-align:top}th{font-weight:700}.meta th,.powd-head th{width:15%;text-align:left;background:#eee}.meta td{width:35%}.grid thead th{text-align:center;background:#eee}.center{text-align:center}ol{margin:0;padding-left:17px}li{margin-bottom:2px}.delivery td{height:48px}.detail th{width:27%;text-align:left;background:#eee}.detail td{min-height:28px}.powd td{height:92px}.confirmation{margin-top:12px}.subtitle{text-align:center;margin-bottom:10px}</style></head><body><h1>BIRIWA TECHNICAL INSTITUTE</h1><h1>${escapeHtml(title).toUpperCase()}</h1><div class="subtitle">${escapeHtml(subtitle)}</div>${body}</body></html>`;
}

export function getTeachingWeeks(context: Omit<TeachingDocumentContext, 'kind'>) { return buildPlan({ ...context, kind: 'learning_session_plan' }).filter(row => row.curriculum) }
export function hasCurriculum(subjectName: string, form: string) { const key = subjectKey(subjectName); const level = levelForForm(form); return units.some(unit => unit.subjectKey === key && unit.level === level) }
export function generateTeachingDocument(context: TeachingDocumentContext): GeneratedTeachingDocument { const title = `${TITLES[context.kind]} — ${context.subjectName} — ${context.form}`; const body = context.kind === 'unit_specification' ? usbBody(context) : context.kind === 'learning_session_plan' ? lspBody(context) : powdBody(context); const fileName = [SHORT[context.kind], safeFilePart(context.subjectCode || context.subjectName), safeFilePart(context.form), safeFilePart(context.academicYear), safeFilePart(context.semester)].join('_') + '.doc'; return { title, fileName, mimeType: 'application/msword', content: documentShell(title, body, context.kind === 'particulars_of_work_done') } }

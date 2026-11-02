import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
} from 'docx';

import curriculumSeed from '@/lib/curriculum-data.json';
import type { CalendarEntry, CurriculumLevel, TeachingDocumentContext } from '@/lib/teaching-document-generator';

type CurriculumOutcome = {
  number: number;
  title: string;
  performanceCriteria: string[];
};

type CurriculumUnit = {
  level: CurriculumLevel;
  subjectKey: string;
  unitNumber: number;
  unitTitle: string;
  learningOutcomes: CurriculumOutcome[];
};

type LessonChunk = {
  unit: CurriculumUnit;
  outcome: CurriculumOutcome;
  criteria: string[];
  criteriaStart: number;
  finalChunk: boolean;
};

type ScheduledRow =
  | { kind: 'activity'; week: string; activity: string }
  | { kind: 'lesson'; week: string; lesson: number; chunk: LessonChunk };

const units = curriculumSeed.units as CurriculumUnit[];
const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const LEFT_MARGIN = 640;
const RIGHT_MARGIN = 1100;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
const MAIN_WIDTHS = [700, 700, 2400, 3300, 1600, 1800];
const META_WIDTHS = [2600, 7900];
const FONT = 'Calibri';
const FONT_SIZE = 20;
const HEADER_FILL = 'A9BCE0';
const ASSESSMENT_BLUE = '4472C4';
const MATERIAL_GREEN = '548235';

const borders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
};

function safeFilePart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'subject';
}

function subjectKey(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (normalized.includes('integrated science') || normalized === 'science') return 'integrated-science';
  if (normalized.includes('social studies')) return 'social-studies';
  return normalized.replaceAll(' ', '-');
}

function levelForForm(form: string): CurriculumLevel {
  return Number(form.match(/\d+/)?.[0] ?? 1) <= 2 ? 'NCI' : 'NCII';
}

function formTarget(form: string) {
  return `form_${form.match(/\d+/)?.[0] ?? '1'}`;
}

function isLessonPlan(title: string) {
  return /lesson\s*plan/i.test(title);
}

function curriculumFor(context: TeachingDocumentContext) {
  const key = subjectKey(context.subjectName);
  const level = levelForForm(context.form);
  return units
    .filter(unit => unit.level === level && unit.subjectKey === key)
    .sort((a, b) => a.unitNumber - b.unitNumber);
}

function text(value: string, options: { bold?: boolean; color?: string; break?: number } = {}) {
  return new TextRun({
    text: value,
    bold: options.bold,
    color: options.color,
    break: options.break,
    font: FONT,
    size: FONT_SIZE,
  });
}

function paragraph(
  children: TextRun[],
  options: { alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; keepNext?: boolean } = {},
) {
  return new Paragraph({
    children,
    alignment: options.alignment,
    spacing: { before: options.before ?? 0, after: options.after ?? 0, line: 240 },
    keepNext: options.keepNext,
  });
}

function cell(children: Paragraph[], width: number, options: {
  shading?: string;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType];
  columnSpan?: number;
} = {}) {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: options.shading ? { fill: options.shading, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    verticalMerge: options.verticalMerge,
    columnSpan: options.columnSpan,
    margins: { top: 70, bottom: 70, left: 70, right: 70 },
  });
}

function simpleCell(value: string, width: number, options: {
  bold?: boolean;
  shading?: string;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType];
  columnSpan?: number;
} = {}) {
  return cell([paragraph([text(value, { bold: options.bold })], { alignment: options.alignment })], width, options);
}

function metadataTable(context: TeachingDocumentContext) {
  const rows = [
    ['Department:', (context.department || 'Generics').toUpperCase()],
    ['Level on NTVETQF:', levelForForm(context.form) === 'NCI' ? 'NATIONAL CERTIFICATE I' : 'NATIONAL CERTIFICATE II'],
    ['Group:', context.form.toUpperCase()],
    ['Subject:', context.subjectName.toUpperCase()],
  ];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: META_WIDTHS,
    layout: TableLayoutType.FIXED,
    borders,
    rows: rows.map(([label, value]) => new TableRow({
      height: { value: 416, rule: HeightRule.ATLEAST },
      children: [simpleCell(label, META_WIDTHS[0], { bold: true }), simpleCell(value, META_WIDTHS[1])],
    })),
  });
}

function semesterLine(context: TeachingDocumentContext) {
  const range = context.semesterStartDate && context.semesterEndDate
    ? ` (${new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${context.semesterStartDate}T00:00:00Z`))} to ${new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${context.semesterEndDate}T00:00:00Z`))})`
    : '';
  const semesterLabel = context.semester.replace(/^semester\s*/i, '') || context.semester;
  return paragraph([text('Semester:', { bold: true }), text(` ${semesterLabel}${range}`)], { after: 80, keepNext: true });
}

function makeChunks(curriculum: CurriculumUnit[]) {
  const chunks: LessonChunk[] = [];
  for (const unit of curriculum) {
    for (const outcome of unit.learningOutcomes) {
      const criteria = outcome.performanceCriteria.length ? outcome.performanceCriteria : ['Performance assessed against the approved curriculum criteria.'];
      for (let index = 0; index < criteria.length; index += 3) {
        chunks.push({
          unit,
          outcome,
          criteria: criteria.slice(index, index + 3),
          criteriaStart: index,
          finalChunk: index + 3 >= criteria.length,
        });
      }
    }
  }
  return chunks;
}

function filteredCalendar(context: TeachingDocumentContext) {
  const target = formTarget(context.form);
  return context.calendarEntries
    .filter(entry => !entry.targetForm || entry.targetForm === 'all' || entry.targetForm === target)
    .sort((a, b) => a.activityDate.localeCompare(b.activityDate));
}

function scheduleRows(context: TeachingDocumentContext, chunks: LessonChunk[]) {
  const entries = filteredCalendar(context);
  const lessonEntryCount = entries.filter(entry => isLessonPlan(entry.title)).length;
  const rows: ScheduledRow[] = [];
  let chunkIndex = 0;
  let lessonNumber = 1;
  let lessonWeekIndex = 0;

  entries.forEach((entry, index) => {
    const week = String(index + 1);
    if (!isLessonPlan(entry.title)) {
      rows.push({ kind: 'activity', week, activity: entry.title.toUpperCase() });
      return;
    }
    const remainingWeeks = Math.max(1, lessonEntryCount - lessonWeekIndex);
    const remainingChunks = chunks.length - chunkIndex;
    const take = Math.max(1, Math.ceil(remainingChunks / remainingWeeks));
    chunks.slice(chunkIndex, chunkIndex + take).forEach(chunk => {
      rows.push({ kind: 'lesson', week, lesson: lessonNumber, chunk });
      lessonNumber += 1;
    });
    chunkIndex += take;
    lessonWeekIndex += 1;
  });

  while (chunkIndex < chunks.length) {
    rows.push({ kind: 'lesson', week: String(Math.max(1, entries.length)), lesson: lessonNumber, chunk: chunks[chunkIndex] });
    chunkIndex += 1;
    lessonNumber += 1;
  }
  return rows;
}

function headerRow() {
  const labels = ['WEEK', 'LESSON NO.', 'LEARNING OUTCOME', 'PERFORMANCE CRITERIA', 'RESOURCES', 'REFERENCES'];
  return new TableRow({
    tableHeader: true,
    height: { value: 680, rule: HeightRule.ATLEAST },
    children: labels.map((label, index) => simpleCell(label, MAIN_WIDTHS[index], {
      bold: true,
      shading: HEADER_FILL,
      alignment: AlignmentType.CENTER,
    })),
  });
}

function outcomeParagraph(chunk: LessonChunk) {
  const children: TextRun[] = [text(`LO ${chunk.outcome.number}: ${chunk.outcome.title}`, { bold: true })];
  if (chunk.finalChunk) children.push(text('FORMATIVE ASSESSMENT', { bold: true, color: ASSESSMENT_BLUE, break: 2 }));
  return paragraph(children);
}

function criteriaParagraph(chunk: LessonChunk) {
  const children: TextRun[] = [text('PC:', { bold: true })];
  chunk.criteria.forEach((criterion, index) => {
    children.push(text(`${String.fromCharCode(97 + chunk.criteriaStart + index)}) ${criterion}`, { break: 1 }));
  });
  if (chunk.finalChunk) {
    const lastLetter = String.fromCharCode(65 + chunk.criteriaStart + chunk.criteria.length - 1);
    children.push(text(`PC A-${lastLetter}`, { bold: true, break: 2 }));
  }
  return paragraph(children);
}

function referenceParagraph(assessment: boolean) {
  const children = [text('CBT Learning Material')];
  if (assessment) children.push(text('Exercise Books & Writing Materials', { color: MATERIAL_GREEN, break: 1 }));
  return paragraph(children);
}

function tableForRows(rows: ScheduledRow[]) {
  const tableRows: TableRow[] = [headerRow()];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.kind === 'activity') {
      tableRows.push(new TableRow({
        children: [
          simpleCell(row.activity === 'VACATION' ? '' : row.week, MAIN_WIDTHS[0], { alignment: AlignmentType.CENTER }),
          simpleCell(row.activity, MAIN_WIDTHS.slice(1).reduce((total, width) => total + width, 0), { bold: true, alignment: AlignmentType.CENTER, columnSpan: 5 }),
        ],
      }));
      continue;
    }

    const previous = rows[index - 1];
    const next = rows[index + 1];
    const startsWeek = previous?.kind !== 'lesson' || previous.week !== row.week;
    const continuesWeek = next?.kind === 'lesson' && next.week === row.week;
    const weekMerge = startsWeek && continuesWeek ? VerticalMergeType.RESTART : !startsWeek ? VerticalMergeType.CONTINUE : undefined;
    tableRows.push(new TableRow({
      cantSplit: true,
      children: [
        simpleCell(startsWeek ? row.week : '', MAIN_WIDTHS[0], { alignment: AlignmentType.CENTER, verticalMerge: weekMerge }),
        simpleCell(String(row.lesson), MAIN_WIDTHS[1], { alignment: AlignmentType.CENTER }),
        cell([outcomeParagraph(row.chunk)], MAIN_WIDTHS[2]),
        cell([criteriaParagraph(row.chunk)], MAIN_WIDTHS[3]),
        cell([paragraph([text('Whiteboard, Marker, Laptop, Projector, videos and pictures.')])], MAIN_WIDTHS[4]),
        cell([referenceParagraph(row.chunk.finalChunk)], MAIN_WIDTHS[5]),
      ],
    }));
  }

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: MAIN_WIDTHS,
    layout: TableLayoutType.FIXED,
    borders,
    rows: tableRows,
  });
}

function unitSections(context: TeachingDocumentContext) {
  const curriculum = curriculumFor(context);
  const scheduled = scheduleRows(context, makeChunks(curriculum));
  const groups: { unit: CurriculumUnit; rows: ScheduledRow[] }[] = [];
  let currentUnit = curriculum[0];

  for (const row of scheduled) {
    if (row.kind === 'lesson') currentUnit = row.chunk.unit;
    if (!currentUnit) continue;
    const last = groups[groups.length - 1];
    if (!last || last.unit.unitNumber !== currentUnit.unitNumber) groups.push({ unit: currentUnit, rows: [] });
    groups[groups.length - 1].rows.push(row);
  }

  return groups.flatMap((group, index) => [
    paragraph([text('Unit Title:', { bold: true }), text(` ${group.unit.unitTitle}`)], { before: index === 0 ? 120 : 160, after: 0, keepNext: true }),
    semesterLine(context),
    tableForRows(group.rows),
  ]);
}

export async function generateUsbDocument(context: TeachingDocumentContext) {
  const title = `Unit Specification Breakdown — ${context.subjectName} — ${context.form}`;
  const fileName = ['USB', safeFilePart(context.subjectCode || context.subjectName), safeFilePart(context.form), safeFilePart(context.academicYear), safeFilePart(context.semester)].join('_') + '.docx';
  const document = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: FONT_SIZE, color: '000000' }, paragraph: { spacing: { after: 0, line: 240 } } },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: { top: 640, right: RIGHT_MARGIN, bottom: 640, left: LEFT_MARGIN, header: 0, footer: 0, gutter: 0 },
        },
      },
      children: [metadataTable(context), ...unitSections(context)],
    }],
  });
  return {
    title,
    fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    blob: await Packer.toBlob(document),
  };
}


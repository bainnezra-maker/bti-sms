import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  type TableVerticalAlign,
  VerticalAlignTable,
  VerticalMergeType,
  WidthType,
} from 'docx';

import {
  getTeachingWeeks,
  type TeachingDocumentContext,
} from '@/lib/teaching-document-generator';

const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const MARGIN_TOP = 540;
const MARGIN_BOTTOM = 500;
const MARGIN_LEFT = 760;
const MARGIN_RIGHT = 760;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FONT = 'Times New Roman';
const BODY_SIZE = 21;
const SMALL_SIZE = 19;
const DELIVERY_WIDTHS = [650, 760, 1320, 2750, 4906];

const border = { style: BorderStyle.SINGLE, size: 8, color: '000000' };
const borders = {
  top: border,
  bottom: border,
  left: border,
  right: border,
  insideHorizontal: border,
  insideVertical: border,
};

function safeFilePart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'subject';
}

function run(value: string, options: { bold?: boolean; italics?: boolean; size?: number; break?: number } = {}) {
  return new TextRun({
    text: value,
    bold: options.bold,
    italics: options.italics,
    size: options.size ?? BODY_SIZE,
    break: options.break,
    font: FONT,
    color: '000000',
  });
}

function para(
  children: TextRun[],
  options: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
    line?: number;
    keepNext?: boolean;
  } = {},
) {
  return new Paragraph({
    children,
    alignment: options.alignment,
    spacing: {
      before: options.before ?? 0,
      after: options.after ?? 0,
      line: options.line ?? 240,
    },
    keepNext: options.keepNext,
  });
}

function line(label: string, value: string, options: { before?: number; after?: number } = {}) {
  return para([run(label), run(value)], options);
}

function cell(
  children: Array<Paragraph | Table>,
  width: number,
  options: {
    columnSpan?: number;
    verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType];
    verticalAlign?: TableVerticalAlign;
    margins?: { top: number; bottom: number; left: number; right: number };
  } = {},
) {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    borders,
    columnSpan: options.columnSpan,
    verticalMerge: options.verticalMerge,
    verticalAlign: options.verticalAlign ?? VerticalAlignTable.TOP,
    margins: options.margins ?? { top: 75, bottom: 65, left: 90, right: 90 },
  });
}

function textCell(
  value: string,
  width: number,
  options: {
    bold?: boolean;
    italics?: boolean;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    columnSpan?: number;
    verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType];
    verticalAlign?: TableVerticalAlign;
    size?: number;
  } = {},
) {
  return cell([
    para([run(value, { bold: options.bold, italics: options.italics, size: options.size })], {
      alignment: options.alignment,
    }),
  ], width, options);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}hrs ${minutes}min`;
  if (hours) return `${hours}hrs`;
  return `${minutes}min`;
}

function letteredCriteria(criteria: string[]) {
  return criteria.map((criterion, index) => `(${String.fromCharCode(97 + index)})  ${criterion}`);
}

function cleanCriterion(value: string) {
  return value.replace(/\s*Range Statement.*$/i, '').replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '');
}

function groupActivities(items: string[], maximumGroups: number) {
  if (items.length <= maximumGroups) return items;
  const groups: string[] = [];
  for (let index = 0; index < maximumGroups; index += 1) {
    const start = Math.floor((index * items.length) / maximumGroups);
    const end = Math.floor(((index + 1) * items.length) / maximumGroups);
    groups.push(items.slice(start, end).join('; '));
  }
  return groups;
}

function learningAreaLine(subjectName: string, department?: string | null) {
  const source = `${subjectName} ${department ?? ''}`.toLowerCase();
  const laboratory = /science|computer|ict|information technology|laboratory/.test(source);
  const workshop = /construction|electrical|fashion|leather|motor|refrigeration|welding|wood|catering/.test(source);
  const selected = laboratory ? 'laboratory' : workshop ? 'workshop' : 'facilitation';
  const box = (name: string) => selected === name ? '☒' : '☐';
  return `Learning Area: Facilitation Room ${box('facilitation')}      Workshop ${box('workshop')}      Laboratory ${box('laboratory')}      Library ☐      Other ☐`;
}

function topDetails(context: TeachingDocumentContext, week: ReturnType<typeof getTeachingWeeks>[number]) {
  const duration = context.sessionDurationMinutes || 120;
  const widths = [3400, 3500, 3486];
  const details = new Table({
    width: { size: CONTENT_WIDTH - 180, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        height: { value: 380, rule: HeightRule.ATLEAST },
        children: [
          textCell(`Department:  ${context.department || 'Generics'}`, widths[0]),
          textCell(`Number of learners: ${context.numberOfLearners || ''}`, widths[1]),
          textCell(`Session: Week ${week.week}`, widths[2]),
        ],
      }),
      new TableRow({
        height: { value: 380, rule: HeightRule.ATLEAST },
        children: [
          textCell(`Group: ${context.form}`, widths[0]),
          textCell('', widths[1]),
          textCell(`Date: ${formatDate(week.startDate)}`, widths[2]),
        ],
      }),
      new TableRow({
        height: { value: 380, rule: HeightRule.ATLEAST },
        children: [
          textCell(`Facilitator: ${context.teacherName}`, widths[0]),
          textCell('I.V: ____________________', widths[1]),
          textCell(`Duration: ${formatDuration(duration)}`, widths[2]),
        ],
      }),
    ],
  });

  return [
    details,
    para([run(learningAreaLine(context.subjectName, context.department), { size: SMALL_SIZE })], { before: 70 }),
  ];
}

function preSessionPage(context: TeachingDocumentContext, week: ReturnType<typeof getTeachingWeeks>[number]) {
  if (!week.curriculum) throw new Error('No curriculum content is available for the selected lesson-plan week.');
  const items = week.curriculum.items;
  const firstUnit = items[0].unit;
  const outcomes = items.map(item => item.outcome);
  const criteria = outcomes.flatMap(outcome => outcome.performanceCriteria).map(cleanCriterion).filter(Boolean);
  const unitTitles = Array.from(new Set(items.map(item => item.unit.unitTitle))).join(', ');
  const outcomeText = outcomes.map(outcome => outcome.title).join('; ');
  const range = Array.from(new Set(outcomes.map(outcome => outcome.rangeStatement).filter(Boolean))).join(' ')
    || 'The range is fully expressed in the performance criteria.';
  const criteriaRuns: TextRun[] = [run('PC:'), ...letteredCriteria(criteria).map(value => run(value, { break: 1 }))];

  const outer = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    borders,
    rows: [
      new TableRow({
        height: { value: 270, rule: HeightRule.ATLEAST },
        children: [textCell('Pre-Session Preparation', CONTENT_WIDTH, { bold: true, alignment: AlignmentType.CENTER, size: 22 })],
      }),
      new TableRow({
        height: { value: 1750, rule: HeightRule.ATLEAST },
        children: [cell(topDetails(context, week), CONTENT_WIDTH)],
      }),
      new TableRow({
        height: { value: 4700, rule: HeightRule.ATLEAST },
        children: [cell([
          line('Unit Title: ', unitTitles, { after: 210 }),
          para([
            run(`Ref. No: ${context.subjectCode || ''}`),
            run(`                                  Number of Credit: ${firstUnit.creditValue || ''}`),
          ], { after: 210 }),
          line('Learning Outcome (s) for this Learning Session:  ', outcomeText, { after: 210 }),
          para([run('Performance Criteria for this Learning Session:')], { after: 140 }),
          para(criteriaRuns, { after: 220 }),
          para([run('Range Statement:')], { after: 100 }),
          para([run(range)], { after: 240 }),
          line('Key Skills integrated within this Learning Session: ', 'Communication, teamwork, problem solving, observation and safe working practices.'),
        ], CONTENT_WIDTH)],
      }),
      new TableRow({
        height: { value: 5350, rule: HeightRule.ATLEAST },
        children: [cell([
          line("Learners' Existing Knowledge: ", `Learners have prior knowledge related to ${firstUnit.unitTitle}.`, { after: 210 }),
          line("Learners' Existing Skills: ", 'Learners can communicate ideas, follow instructions and work with others.', { after: 210 }),
          line('Special Needs requirements: ', 'NIL', { after: 210 }),
          line('Safety procedures: ', 'Learners should follow all classroom, laboratory or workshop safety instructions.', { after: 210 }),
          line('Trade equipment: ', 'Personal Computer, Projector, White Board and subject-appropriate equipment.', { after: 210 }),
          line('Trade tools: ', 'Subject-appropriate tools and learning aids.', { after: 210 }),
          line('Trade materials: ', 'Approved curriculum learning materials.', { after: 210 }),
          line('Health & Safety equipment required, PPE such: ', 'Protective clothing and equipment where applicable.', { after: 210 }),
          line("AVA's required: ", 'Projector, charts, videos or pictures where applicable.', { after: 210 }),
          line('Written/Graphical materials required: ', 'CBT Learning Material.', { after: 210 }),
          line('Assessment materials required: ', 'Self-Assessment in Learning Materials.'),
        ], CONTENT_WIDTH)],
      }),
    ],
  });

  return [
    para([run('CTVET', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, after: 220 }),
    para([run('Learning Session Plan', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, after: 250 }),
    outer,
  ];
}

function activityText(criterion: string, index: number) {
  const trimmed = criterion.replace(/[.;]+$/, '');
  const facilitator = index === 0 ? trimmed : trimmed;
  const learnerVerb = /^explain\b/i.test(trimmed) ? trimmed.replace(/^explain\b/i, 'explain')
    : /^outline\b/i.test(trimmed) ? trimmed.replace(/^outline\b/i, 'outline')
      : /^describe\b/i.test(trimmed) ? trimmed.replace(/^describe\b/i, 'describe')
        : /^demonstrate\b/i.test(trimmed) ? trimmed.replace(/^demonstrate\b/i, 'demonstrate')
          : `participate in the activity on ${trimmed.toLowerCase()}`;
  return {
    facilitator: trimmed,
    learner: `Learners ${learnerVerb.charAt(0).toLowerCase()}${learnerVerb.slice(1)} based on the facilitator's guidance.`,
  };
}

function deliveryPage(context: TeachingDocumentContext, week: ReturnType<typeof getTeachingWeeks>[number]) {
  if (!week.curriculum) throw new Error('No curriculum content is available for the selected lesson-plan week.');
  const items = week.curriculum.items;
  const criteria = items.flatMap(item => item.outcome.performanceCriteria).map(cleanCriterion).filter(Boolean);
  const activities = criteria.length ? criteria : items.map(item => item.outcome.title);
  const duration = context.sessionDurationMinutes || 120;
  const introductionMinutes = Math.max(20, Math.round(duration * 0.2));
  const assessmentMinutes = Math.max(20, Math.round(duration * 0.2));
  const developmentTotal = Math.max(30, duration - introductionMinutes - assessmentMinutes);
  const developmentCount = Math.max(1, activities.length - 1);
  const developmentMinutes = Math.max(10, Math.round(developmentTotal / developmentCount));
  const widths = DELIVERY_WIDTHS;
  const first = activityText(activities[0], 0);
  const remaining = groupActivities(activities.slice(1), 4);
  const rows: TableRow[] = [
    new TableRow({
      height: { value: 820, rule: HeightRule.ATLEAST },
      children: [cell([line('Reference materials: ', 'CBT Learning Material')], CONTENT_WIDTH, { columnSpan: 5 })],
    }),
    new TableRow({
      height: { value: 260, rule: HeightRule.ATLEAST },
      children: [textCell('Learning Session Delivery', CONTENT_WIDTH, { bold: true, alignment: AlignmentType.CENTER, columnSpan: 5, size: 22 })],
    }),
    new TableRow({
      height: { value: 250, rule: HeightRule.ATLEAST },
      children: [textCell('Introduction', CONTENT_WIDTH, { bold: true, alignment: AlignmentType.CENTER, columnSpan: 5, size: 21 })],
    }),
    new TableRow({
      height: { value: 350, rule: HeightRule.ATLEAST },
      children: [
        textCell('Stage', widths[0], { bold: true, italics: true, alignment: AlignmentType.CENTER, size: SMALL_SIZE }),
        textCell('Time', widths[1], { bold: true, italics: true, alignment: AlignmentType.CENTER, size: SMALL_SIZE }),
        textCell('Resources', widths[2], { bold: true, italics: true, alignment: AlignmentType.CENTER, size: SMALL_SIZE }),
        textCell('Facilitator Activity', widths[3], { bold: true, italics: true, alignment: AlignmentType.CENTER, size: SMALL_SIZE }),
        textCell('Learner Activity (incl. grouping arrangements)', widths[4], { bold: true, italics: true, alignment: AlignmentType.CENTER, size: SMALL_SIZE }),
      ],
    }),
    new TableRow({
      cantSplit: true,
      height: { value: 2500, rule: HeightRule.ATLEAST },
      children: [
        textCell('1', widths[0], { alignment: AlignmentType.CENTER }),
        textCell(`${introductionMinutes}\nmin.`, widths[1], { alignment: AlignmentType.CENTER }),
        textCell('Board / AVA', widths[2]),
        textCell(first.facilitator, widths[3]),
        textCell(first.learner, widths[4]),
      ],
    }),
    new TableRow({
      height: { value: 300, rule: HeightRule.ATLEAST },
      children: [textCell('Development', CONTENT_WIDTH, { bold: true, alignment: AlignmentType.CENTER, columnSpan: 5, size: 21 })],
    }),
  ];

  const developmentRows = remaining.length ? remaining : activities;
  developmentRows.forEach((criterion, index) => {
    const activity = activityText(criterion, index + 1);
    const isFirst = index === 0;
    const merge = isFirst ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE;
    rows.push(new TableRow({
      cantSplit: true,
      height: { value: 1700, rule: HeightRule.ATLEAST },
      children: [
        textCell(isFirst ? '2' : '', widths[0], { alignment: AlignmentType.CENTER, verticalMerge: merge }),
        textCell(`${developmentMinutes}\nmin`, widths[1], { alignment: AlignmentType.CENTER }),
        textCell(isFirst ? 'CTVET Learning Material and subject resources' : '', widths[2]),
        textCell(activity.facilitator, widths[3]),
        textCell(activity.learner, widths[4]),
      ],
    }));
  });

  rows.push(new TableRow({
    cantSplit: true,
    height: { value: 1400, rule: HeightRule.ATLEAST },
    children: [
      textCell('', widths[0], { alignment: AlignmentType.CENTER, verticalMerge: VerticalMergeType.CONTINUE }),
      textCell(`${assessmentMinutes}\nmin`, widths[1], { alignment: AlignmentType.CENTER }),
      textCell('', widths[2]),
      textCell('Give learners self-assessment questions.', widths[3]),
      textCell('Learners complete self-assessment questions.', widths[4]),
    ],
  }));

  const delivery = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
    rows,
  });

  return [
    para([new PageBreak()]),
    delivery,
  ];
}

function reflectionPage(context: TeachingDocumentContext, week: ReturnType<typeof getTeachingWeeks>[number]) {
  if (!week.curriculum) throw new Error('No curriculum content is available for the selected lesson-plan week.');
  const outcome = week.curriculum.items[0].outcome.title.toLowerCase();
  const box = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    borders,
    rows: [
      new TableRow({
        height: { value: 280, rule: HeightRule.ATLEAST },
        children: [textCell('Post-session Reflection and Evaluation', CONTENT_WIDTH, { bold: true, alignment: AlignmentType.CENTER, size: 22 })],
      }),
      new TableRow({
        height: { value: 2600, rule: HeightRule.ATLEAST },
        children: [cell([
          line('Main Strength of this Learning Session: ', `Learners were able to ${outcome}.`, { after: 260 }),
          line('Main Weakness of this Learning Session: ', 'NIL', { after: 260 }),
          line('How I intend to improve a subsequent Learning Session: ', 'More engagement with learners.', { after: 260 }),
          line('Other reflective comments: ', 'NIL'),
        ], CONTENT_WIDTH)],
      }),
    ],
  });
  return [para([new PageBreak()]), box];
}

export async function generateLspDocument(context: TeachingDocumentContext) {
  const weeks = getTeachingWeeks(context);
  const week = weeks.find(item => item.startDate === context.selectedWeekDate) ?? weeks[0];
  if (!week?.curriculum) throw new Error('No lesson-plan week or curriculum content is available for this selection.');

  const title = `Learning Session Plan — ${context.subjectName} — ${context.form}`;
  const fileName = [
    'LSP',
    safeFilePart(context.subjectCode || context.subjectName),
    safeFilePart(context.form),
    safeFilePart(context.academicYear),
    safeFilePart(context.semester),
    `Week-${week.week}`,
  ].join('_') + '.docx';

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE, color: '000000' },
          paragraph: { spacing: { after: 0, line: 240 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: {
            top: MARGIN_TOP,
            right: MARGIN_RIGHT,
            bottom: MARGIN_BOTTOM,
            left: MARGIN_LEFT,
            header: 0,
            footer: 180,
            gutter: 0,
          },
        },
      },
      footers: {
        default: new Footer({
          children: [para([new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SMALL_SIZE })], { alignment: AlignmentType.CENTER })],
        }),
      },
      children: [
        ...preSessionPage(context, week),
        ...deliveryPage(context, week),
        ...reflectionPage(context, week),
      ],
    }],
  });

  return {
    title,
    fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    blob: await Packer.toBlob(document),
  };
}

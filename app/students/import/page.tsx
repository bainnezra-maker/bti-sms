'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

type Programme = {
  id: string;
  name: string;
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
};

type SchoolClass = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
  academic_year_id: string | null;
};

type ImportRow = {
  full_name: string;
  form: string;
  programme: string;
  class_name: string;
  gender: string;
  resident: string;
  date_of_birth: string;
  guardian_name: string;
  guardian_phone: string;
  address: string;
  admission_date: string;
  jhs_aggregate: string;
};

type ResultMessage = {
  row: number;
  message: string;
  type?: 'error' | 'warning' | 'success';
};

type BulkResult = {
  row: number;
  status: 'success' | 'partial' | 'skipped' | 'failed';
  message?: string;
  student_created?: boolean;
  student_existing?: boolean;
  enrollment_created?: boolean;
  enrollment_updated?: boolean;
  class_created?: boolean;
  assigned?: boolean;
  student_id?: string;
  class_id?: string;
  enrollment_id?: string;
};

const BATCH_SIZE = 50;

const headers = [
  'FULL NAME',
  'FORM',
  'PROGRAMME',
  'CLASS',
  'GENDER',
  'RESIDENCE',
  'DATE OF BIRTH',
  'GUARDIAN NAME',
  'GUARDIAN PHONE',
  'ADDRESS',
  'ADMISSION DATE',
  'JHS AGGREGATE',
];

function clean(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeResidence(value: string): string {
  const v = normalize(value);

  if (v === 'day' || v === 'day student' || v === 'day students') {
    return 'Day';
  }

  if (
    v === 'boarding' ||
    v === 'boarder' ||
    v === 'boarders' ||
    v === 'boarding student' ||
    v === 'boarding students'
  ) {
    return 'Boarding';
  }

  return clean(value);
}

function excelDateToString(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      const year = parsed.y;
      const month = String(parsed.m).padStart(2, '0');
      const day = String(parsed.d).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }
  }

  const raw = clean(value);

  if (!raw) return '';

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
    const [year, month, day] = raw.split('-');

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const slashMatch = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);

  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = slashMatch[3];

    /*
     * Prefer DD/MM/YYYY when the first value is > 12.
     * Otherwise use DD/MM/YYYY as the normal school-data convention.
     */
    const day = first;
    const month = second;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
        2,
        '0'
      )}`;
    }
  }

  const parsedDate = new Date(raw);

  if (!Number.isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  return '';
}

function mapRow(row: Record<string, unknown>): ImportRow {
  const get = (name: string) => {
    const direct = row[name];

    if (direct !== undefined) return direct;

    const normalizedKey = normalize(name);

    const foundKey = Object.keys(row).find(
      (key) => normalize(key) === normalizedKey
    );

    return foundKey ? row[foundKey] : '';
  };

  return {
    full_name: clean(get('FULL NAME')),
    form: clean(get('FORM')),
    programme: clean(get('PROGRAMME')),
    class_name: clean(get('CLASS')),
    gender: clean(get('GENDER')),
    resident: normalizeResidence(clean(get('RESIDENCE'))),
    date_of_birth: excelDateToString(get('DATE OF BIRTH')),
    guardian_name: clean(get('GUARDIAN NAME')),
    guardian_phone: clean(get('GUARDIAN PHONE')),
    address: clean(get('ADDRESS')),
    admission_date: excelDateToString(get('ADMISSION DATE')),
    jhs_aggregate: clean(get('JHS AGGREGATE')),
  };
}

function downloadWorkbook(
  rows: ImportRow[] = [
    {
      full_name: 'John Mensah',
      form: 'Form 1',
      programme: 'Electrical Engineering',
      class_name: 'A Class',
      gender: 'Male',
      resident: 'Boarding',
      date_of_birth: '2010-05-12',
      guardian_name: 'Kwame Mensah',
      guardian_phone: '0240000000',
      address: 'Accra',
      admission_date: '2026-09-01',
      jhs_aggregate: '18',
    },
  ]
) {
  const worksheetRows = rows.map((row) => ({
    'FULL NAME': row.full_name,
    FORM: row.form,
    PROGRAMME: row.programme,
    CLASS: row.class_name,
    GENDER: row.gender,
    RESIDENCE: row.resident,
    'DATE OF BIRTH': row.date_of_birth,
    'GUARDIAN NAME': row.guardian_name,
    'GUARDIAN PHONE': row.guardian_phone,
    ADDRESS: row.address,
    'ADMISSION DATE': row.admission_date,
    'JHS AGGREGATE': row.jhs_aggregate,
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetRows, {
    header: headers,
  });

  worksheet['!cols'] = [
    { wch: 28 },
    { wch: 12 },
    { wch: 28 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 24 },
    { wch: 20 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

  XLSX.writeFile(
    workbook,
    'BTI-SMS-Student-Import-Template.xlsx'
  );
}

export default function StudentImportPage() {
  const supabase = createClient();

  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [schoolId, setSchoolId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');

  const [loading, setLoading] = useState(true);
  const [readingFile, setReadingFile] = useState(false);
  const [importing, setImporting] = useState(false);

  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);

  const [message, setMessage] = useState('');

  const [resultMessages, setResultMessages] = useState<ResultMessage[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);

  const [error, setError] = useState('');

  const [importStarted, setImportStarted] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

async function importStudents() {
  if (importing) return;

  setErrors([]);
  setMessage('');
  setImportProgress('');
  setProgressPercent(0);

  // ---------------------------------------------------------
  // BASIC CHECKS
  // ---------------------------------------------------------

  if (!rows.length) {
    setMessage(
      'Please select an Excel file containing student records.'
    );
    return;
  }

  if (!academicYearId) {
    setMessage(
      'Please select the academic year for this import.'
    );
    return;
  }

  if (!schoolId) {
    setMessage(
      'Your school could not be determined. Please refresh the page and try again.'
    );
    return;
  }

  setImporting(true);

  try {
    // -------------------------------------------------------
    // STEP 1 — LOCAL VALIDATION
    // -------------------------------------------------------

    setImportProgress(
      `Validating ${rows.length} student record(s)...`
    );
    setProgressPercent(5);

    const validationResults: ResultMessage[] = [];

    const validRows: Array<
      ImportRow & {
        row_number: number;
      }
    > = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;

      const fullName = clean(row.full_name);

      const residence = normalizeResidence(
        row.resident
      );

      if (!fullName) {
        validationResults.push({
          row: rowNumber,
          type: 'error',
          message: 'FULL NAME is required.',
        });

        return;
      }

      if (row.resident && !residence) {
        validationResults.push({
          row: rowNumber,
          type: 'error',
          message:
            'RESIDENCE must be Day or Boarding.',
        });

        return;
      }

      if (row.jhs_aggregate) {
        const aggregate = Number(
          String(row.jhs_aggregate)
            .replace(/,/g, '')
            .trim()
        );

        if (!Number.isFinite(aggregate)) {
          validationResults.push({
            row: rowNumber,
            type: 'error',
            message:
              'JHS AGGREGATE must be a valid number.',
          });

          return;
        }
      }

      validRows.push({
        ...row,
        full_name: fullName,
        resident: residence,
        row_number: rowNumber,
      });
    });

    // -------------------------------------------------------
    // STEP 2 — DUPLICATE NAMES INSIDE THIS EXCEL
    // -------------------------------------------------------

    setImportProgress(
      `Checking ${validRows.length} valid record(s) for duplicate names...`
    );
    setProgressPercent(10);

    const nameOccurrences = new Map<
      string,
      number[]
    >();

    validRows.forEach((row) => {
      const key = normalize(row.full_name);

      if (!nameOccurrences.has(key)) {
        nameOccurrences.set(key, []);
      }

      nameOccurrences
        .get(key)!
        .push(row.row_number);
    });

    const duplicateRows = new Set<number>();

    nameOccurrences.forEach(
      (rowNumbers, key) => {
        if (rowNumbers.length > 1) {
          rowNumbers.forEach((number) =>
            duplicateRows.add(number)
          );

          const duplicateName =
            validRows.find(
              (row) =>
                normalize(row.full_name) === key
            )?.full_name || 'Unknown student';

          validationResults.push({
            row: rowNumbers[0],
            type: 'warning',
            message:
              `Duplicate student name detected: "${duplicateName}". Excel rows ${rowNumbers.join(
                ', '
              )} contain the same name. These rows were not imported automatically because the system cannot safely determine whether they represent one student or different students.`,
          });
        }
      }
    );

    const rowsToImport = validRows.filter(
      (row) =>
        !duplicateRows.has(row.row_number)
    );

    setErrors(validationResults);

    if (!rowsToImport.length) {
      setProgressPercent(100);
      setImportProgress('');

      setMessage(
        'Import stopped. No unambiguous student records were available for import.'
      );

      return;
    }

    // -------------------------------------------------------
    // STEP 3 — PREPARE PAYLOAD
    // -------------------------------------------------------

    setImportProgress(
      `Preparing ${rowsToImport.length} student record(s) for secure bulk processing...`
    );
    setProgressPercent(15);

    const payload = rowsToImport.map(
      (row) => ({
        row_number: row.row_number,
        full_name: clean(row.full_name),
        form: clean(row.form),
        programme: clean(row.programme),
        class_name: clean(row.class_name),
        gender: clean(row.gender),
        resident: normalizeResidence(
          row.resident
        ),
        date_of_birth: clean(
          row.date_of_birth
        ),
        guardian_name: clean(
          row.guardian_name
        ),
        guardian_phone: clean(
          row.guardian_phone
        ),
        address: clean(row.address),
        admission_date: clean(
          row.admission_date
        ),
        jhs_aggregate: clean(
          row.jhs_aggregate
        ),
      })
    );

    // -------------------------------------------------------
    // STEP 4 — BATCHED BULK SUPABASE IMPORT
    // -------------------------------------------------------

    const BATCH_SIZE = 50;

    const totalRecords = payload.length;

    const totalBatches = Math.ceil(
      totalRecords / BATCH_SIZE
    );

    const allDatabaseResults: BulkResult[] = [];

    let processedRecords = 0;

    for (
      let batchIndex = 0;
      batchIndex < totalBatches;
      batchIndex++
    ) {
      const start =
        batchIndex * BATCH_SIZE;

      const end = Math.min(
        start + BATCH_SIZE,
        totalRecords
      );

      const batch = payload.slice(
        start,
        end
      );

      const batchNumber = batchIndex + 1;

      setImportProgress(
        `Importing batch ${batchNumber} of ${totalBatches} (${start + 1}-${end} of ${totalRecords})...`
      );

      const batchStartPercent = 20;

      const batchEndPercent = 85;

      const currentPercent =
        batchStartPercent +
        Math.round(
          (processedRecords /
            totalRecords) *
            (batchEndPercent -
              batchStartPercent)
        );

      setProgressPercent(
        Math.max(
          20,
          Math.min(85, currentPercent)
        )
      );

      const {
        data,
        error,
      } = await supabase.rpc(
        'bulk_import_students',
        {
          p_school_id: schoolId,
          p_academic_year_id:
            academicYearId,
          p_rows: batch,
        }
      );

      if (error) {
        console.error(
          `Bulk student import error in batch ${batchNumber}:`,
          error
        );

        // Keep results from batches that
        // already completed.
        setErrors([
          ...validationResults,
          ...allDatabaseResults.map(
            (result) => ({
              row: Number(
                result.row || 0
              ),
              message:
                result.message ||
                'Import processing completed.',
              type:
                result.status ===
                'success'
                  ? 'success'
                  : result.status ===
                      'failed'
                    ? 'error'
                    : 'warning',
            })
          ),
          {
            row: 0,
            type: 'error',
            message:
              `Batch ${batchNumber} of ${totalBatches} could not be completed: ${
                error.message ||
                'Unknown Supabase error.'
              }`,
          },
        ]);

        setProgressPercent(0);
        setImportProgress('');

        setMessage(
          `Import stopped at batch ${batchNumber} of ${totalBatches}. The completed batches were saved safely. You can upload the same file again to process the remaining records.`
        );

        return;
      }

      const batchResults: BulkResult[] =
        Array.isArray(data)
          ? data
          : [];

      allDatabaseResults.push(
        ...batchResults
      );

      processedRecords = end;

      const actualProgress =
        20 +
        Math.round(
          (processedRecords /
            totalRecords) *
            65
        );

      setProgressPercent(
        Math.min(85, actualProgress)
      );
    }

    // -------------------------------------------------------
    // STEP 5 — PROCESS DATABASE RESULTS
    // -------------------------------------------------------

    setImportProgress(
      'Processing import and assignment results...'
    );

    setProgressPercent(90);

    const databaseResults =
      allDatabaseResults;

    const resultMessages: ResultMessage[] =
      [...validationResults];

    databaseResults.forEach(
      (result) => {
        let resultType:
          | 'success'
          | 'warning'
          | 'error';

        if (
          result.status ===
          'success'
        ) {
          resultType = 'success';
        } else if (
          result.status ===
            'partial' ||
          result.status ===
            'skipped'
        ) {
          resultType = 'warning';
        } else {
          resultType = 'error';
        }

        let resultMessage =
          result.message ||
          'Import processing completed.';

        if (
          result.status ===
            'success' &&
          result.assigned
        ) {
          resultMessage +=
            ' Student assigned successfully.';
        }

        resultMessages.push({
          row: Number(
            result.row || 0
          ),
          message: resultMessage,
          type: resultType,
        });
      }
    );

    setErrors(resultMessages);

    // -------------------------------------------------------
    // STEP 6 — ACCURATE COUNTS
    // -------------------------------------------------------

    const successful =
      databaseResults.filter(
        (item) =>
          item.status ===
          'success'
      );

    const partial =
      databaseResults.filter(
        (item) =>
          item.status ===
          'partial'
      );

    const skipped =
      databaseResults.filter(
        (item) =>
          item.status ===
            'skipped' ||
          item.status ===
            'failed'
      );

    const newStudents =
      successful.filter(
        (item) =>
          item.student_created ===
          true
      ).length;

    const existingStudents =
      successful.filter(
        (item) =>
          item.student_existing ===
          true
      ).length;

    const assignedStudents =
      successful.filter(
        (item) =>
          item.assigned ===
          true
      ).length;

    const newClasses =
      successful.filter(
        (item) =>
          item.class_created ===
          true
      ).length;

    const enrollmentsCreated =
      successful.filter(
        (item) =>
          item.enrollment_created ===
          true
      ).length;

    const enrollmentsUpdated =
      successful.filter(
        (item) =>
          item.enrollment_updated ===
          true
      ).length;

    // -------------------------------------------------------
    // STEP 7 — REFRESH
    // -------------------------------------------------------

    setImportProgress(
      'Refreshing BTI-SMS student and class data...'
    );

    setProgressPercent(95);

    await loadData();

    // -------------------------------------------------------
    // STEP 8 — COMPLETE
    // -------------------------------------------------------

    setProgressPercent(100);

    setMessage(
      `Import complete: ${newStudents} new student(s), ${existingStudents} existing student(s) updated, ${assignedStudents} student(s) assigned, ${enrollmentsCreated} enrollment(s) created, ${enrollmentsUpdated} enrollment(s) processed, ${newClasses} class(es) created, ${partial.length} partial record(s), and ${skipped.length} skipped/failed row(s).`
    );

    setImportProgress('');
  } catch (error: any) {
    console.error(
      'Unexpected bulk import error:',
      error
    );

    setProgressPercent(0);
    setImportProgress('');

    setMessage(
      `Import failed unexpectedly: ${
        error?.message ||
        'Please try again.'
      }`
    );

    setErrors(
      (previous) => [
        ...previous,
        {
          row: 0,
          type: 'error',
          message:
            error?.message ||
            'An unexpected error occurred during the import.',
        },
      ]
    );
  } finally {
    setImporting(false);
  }
}

  function validateRows(inputRows: ImportRow[]) {
    const messages: ResultMessage[] = [];
    const seenNames = new Map<string, number[]>();

    inputRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = normalize(row.full_name);

      if (name) {
        const existing = seenNames.get(name) || [];
        existing.push(rowNumber);
        seenNames.set(name, existing);
      }
    });

    inputRows.forEach((row, index) => {
      const rowNumber = index + 2;

      if (!row.full_name) {
        messages.push({
          row: rowNumber,
          message: 'FULL NAME is required.',
          type: 'error',
        });
      }

      if (
        row.resident &&
        row.resident !== 'Day' &&
        row.resident !== 'Boarding'
      ) {
        messages.push({
          row: rowNumber,
          message: 'RESIDENCE must be Day or Boarding.',
          type: 'error',
        });
      }

      if (row.jhs_aggregate) {
        const aggregate = Number(row.jhs_aggregate);

        if (
          Number.isNaN(aggregate) ||
          aggregate < 1 ||
          aggregate > 99
        ) {
          messages.push({
            row: rowNumber,
            message: 'JHS AGGREGATE must be a valid number.',
            type: 'error',
          });
        }
      }

      const duplicateRows = seenNames.get(
        normalize(row.full_name)
      );

      if (
        duplicateRows &&
        duplicateRows.length > 1
      ) {
        messages.push({
          row: rowNumber,
          message: `Duplicate student name in this Excel file. The name appears on rows ${duplicateRows.join(
            ', '
          )}.`,
          type: 'warning',
        });
      }
    });

    return messages;
  }

  async function handleFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setReadingFile(true);
    setError('');
    setMessage('');
    setResultMessages([]);
    setBulkResults([]);
    setImportStarted(false);
    setProgress(0);
    setProcessed(0);
    setCurrentBatch(0);
    setTotalBatches(0);

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
      });

      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error(
          'The workbook does not contain a worksheet.'
        );
      }

      const worksheet = workbook.Sheets[firstSheetName];

      const rawRows = XLSX.utils.sheet_to_json<
        Record<string, unknown>
      >(worksheet, {
        defval: '',
        raw: true,
      });

      if (!rawRows.length) {
        throw new Error(
          'The selected Excel file does not contain any student records.'
        );
      }

      const mappedRows = rawRows.map(mapRow);

      const validationMessages = validateRows(mappedRows);

      setRows(mappedRows);
      setFileName(file.name);
      setResultMessages(validationMessages);

      setMessage(
        `${mappedRows.length.toLocaleString()} student records loaded and ready for import.`
      );
    } catch (err) {
      console.error(err);

      setRows([]);
      setFileName('');

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to read the Excel file.'
      );
    } finally {
      setReadingFile(false);

      event.target.value = '';
    }
  }

  const duplicateRows = useMemo(() => {
    const map = new Map<string, number[]>();

    rows.forEach((row, index) => {
      const name = normalize(row.full_name);

      if (!name) return;

      const existing = map.get(name) || [];
      existing.push(index);

      map.set(name, existing);
    });

    return new Set(
      Array.from(map.values())
        .filter((indexes) => indexes.length > 1)
        .flat()
    );
  }, [rows]);

  const importableRows = useMemo(() => {
    return rows.filter(
      (_, index) => !duplicateRows.has(index)
    );
  }, [rows, duplicateRows]);

  const summary = useMemo(() => {
    return {
      newStudents: bulkResults.filter(
        (item) => item.student_created
      ).length,

      existingStudents: bulkResults.filter(
        (item) => item.student_existing
      ).length,

      assigned: bulkResults.filter(
        (item) => item.assigned
      ).length,

      classesCreated: bulkResults.filter(
        (item) => item.class_created
      ).length,

      enrollmentsCreated: bulkResults.filter(
        (item) => item.enrollment_created
      ).length,

      enrollmentsUpdated: bulkResults.filter(
        (item) => item.enrollment_updated
      ).length,

      partial: bulkResults.filter(
        (item) => item.status === 'partial'
      ).length,

      skipped: bulkResults.filter(
        (item) => item.status === 'skipped'
      ).length,

      failed: bulkResults.filter(
        (item) => item.status === 'failed'
      ).length,

      success: bulkResults.filter(
        (item) => item.status === 'success'
      ).length,
    };
  }, [bulkResults]);

  async function importStudents() {
    if (!schoolId) {
      setError('School information is not available.');
      return;
    }

    if (!academicYearId) {
      setError('Please select an academic year.');
      return;
    }

    if (!rows.length) {
      setError('Please select an Excel file first.');
      return;
    }

    if (!importableRows.length) {
      setError(
        'There are no importable rows. Please remove duplicate names from the Excel file.'
      );
      return;
    }

    const validationErrors = resultMessages.filter(
      (item) => item.type === 'error'
    );

    if (validationErrors.length) {
      setError(
        `Please correct ${validationErrors.length} validation issue${
          validationErrors.length === 1 ? '' : 's'
        } before importing.`
      );
      return;
    }

    setImporting(true);
    setImportStarted(true);
    setError('');
    setMessage('');
    setBulkResults([]);
    setProgress(0);
    setProcessed(0);
    setCurrentBatch(0);

    const total = importableRows.length;
    const batches = Math.ceil(total / BATCH_SIZE);

    setTotalBatches(batches);

    const allResults: BulkResult[] = [];

    try {
      for (
        let batchIndex = 0;
        batchIndex < batches;
        batchIndex++
      ) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(
          start + BATCH_SIZE,
          total
        );

        const batch = importableRows.slice(start, end);

        setCurrentBatch(batchIndex + 1);

        setMessage(
          `Processing batch ${batchIndex + 1} of ${batches} — students ${start + 1}–${end}...`
        );

        const payload = batch.map((row, index) => ({
          full_name: row.full_name,
          form: row.form,
          programme: row.programme,
          class_name: row.class_name,
          gender: row.gender,
          resident: row.resident,
          date_of_birth: row.date_of_birth,
          guardian_name: row.guardian_name,
          guardian_phone: row.guardian_phone,
          address: row.address,
          admission_date: row.admission_date,
          jhs_aggregate: row.jhs_aggregate,
          row_number: start + index + 2,
        }));

        const { data, error: rpcError } =
          await supabase.rpc(
            'bulk_import_students',
            {
              p_school_id: schoolId,
              p_academic_year_id: academicYearId,
              p_rows: payload,
            }
          );

        if (rpcError) {
          throw rpcError;
        }

        const batchResults = Array.isArray(data)
          ? (data as BulkResult[])
          : [];

        allResults.push(...batchResults);

        const completed = end;

        setProcessed(completed);

        setProgress(
          Math.round((completed / total) * 100)
        );

        setBulkResults([...allResults]);

        /*
         * Give React a moment to paint the updated progress
         * before the next batch begins.
         */
        await new Promise((resolve) =>
          setTimeout(resolve, 120)
        );
      }

      setProgress(100);
      setProcessed(total);
      setCurrentBatch(batches);

      const successful = allResults.filter(
        (item) => item.status === 'success'
      ).length;

      const partial = allResults.filter(
        (item) => item.status === 'partial'
      ).length;

      const failed = allResults.filter(
        (item) => item.status === 'failed'
      ).length;

      setMessage(
        `Import completed. ${successful.toLocaleString()} processed successfully${
          partial
            ? `, ${partial.toLocaleString()} partially completed`
            : ''
        }${
          failed
            ? `, and ${failed.toLocaleString()} failed`
            : ''
        }.`
      );

      /*
       * Refresh reference data so classes created by the RPC
       * are immediately reflected if the user imports again.
       */
      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'The student import could not be completed.'
      );

      setMessage(
        `Import stopped after ${processed.toLocaleString()} of ${total.toLocaleString()} students.`
      );
    } finally {
      setImporting(false);
    }
  }

  function clearImport() {
    if (importing) return;

    setRows([]);
    setFileName('');
    setBulkResults([]);
    setResultMessages([]);
    setError('');
    setMessage('');
    setProgress(0);
    setProcessed(0);
    setCurrentBatch(0);
    setTotalBatches(0);
    setImportStarted(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-blue-100">
                <i className="fa-solid fa-spinner animate-spin text-blue-600" />
              </div>

              <div>
                <div className="h-5 w-56 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulseSoft {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.65;
          }
        }

        @keyframes progressGlow {
          0% {
            opacity: 0.75;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.75;
          }
        }

        .bti-fade-up {
          animation: fadeUp 0.45s ease-out both;
        }

        .bti-delay-1 {
          animation-delay: 0.08s;
        }

        .bti-delay-2 {
          animation-delay: 0.16s;
        }

        .bti-delay-3 {
          animation-delay: 0.24s;
        }

        .bti-pulse-soft {
          animation: pulseSoft 1.8s ease-in-out infinite;
        }

        .bti-progress-glow {
          animation: progressGlow 1.5s ease-in-out infinite;
        }
      `}</style>

      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
          {/* Header */}
          <section className="bti-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                  <i className="fa-solid fa-file-import" />
                  STUDENT DATA MANAGEMENT
                </div>

                <h1 className="text-2xl font-black tracking-tight md:text-4xl">
                  Import Students
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 md:text-base">
                  Upload your Excel student register and
                  securely import students, programmes, classes
                  and academic-year enrollments into BTI-SMS.
                </p>
              </div>

              <button
                type="button"
                onClick={() => downloadWorkbook()}
                disabled={importing}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <i className="fa-solid fa-download" />
                Download Template
              </button>
            </div>
          </section>

          {/* Information cards */}
          <section className="grid gap-4 md:grid-cols-3">
            <div className="bti-fade-up bti-delay-1 rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <i className="fa-solid fa-bolt" />
                </div>

                <div>
                  <h3 className="font-bold text-slate-900">
                    Batch Processing
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Large registers are processed in small
                    batches for better reliability.
                  </p>
                </div>
              </div>
            </div>

            <div className="bti-fade-up bti-delay-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <i className="fa-solid fa-shield-halved" />
                </div>

                <div>
                  <h3 className="font-bold text-slate-900">
                    Duplicate Safe
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Re-uploading the same register will not
                    create duplicate student records.
                  </p>
                </div>
              </div>
            </div>

            <div className="bti-fade-up bti-delay-3 rounded-2xl border border-violet-100 bg-violet-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                  <i className="fa-solid fa-house-user" />
                </div>

                <div>
                  <h3 className="font-bold text-slate-900">
                    Residence Included
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    RESIDENCE is imported as either Day or
                    Boarding and appears with the student data.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Academic year */}
          <section className="bti-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <i className="fa-solid fa-calendar-days" />
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">
                  Academic Year
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Select the academic year for these student
                  enrollments.
                </p>

                <select
                  value={academicYearId}
                  onChange={(event) =>
                    setAcademicYearId(event.target.value)
                  }
                  disabled={importing}
                  className="mt-4 min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 md:max-w-xl"
                >
                  <option value="">
                    Select academic year
                  </option>

                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Template columns */}
          <section className="bti-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <i className="fa-solid fa-table-columns" />
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">
                  Excel Format
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your workbook should use these columns. The
                  template already contains them in the correct
                  order.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {headers.map((header) => (
                    <span
                      key={header}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      {header}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Upload */}
          <section className="bti-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
                  <i className="fa-solid fa-cloud-arrow-up text-lg" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Upload Student Register
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Accepted formats: Excel (.xlsx, .xls) or
                    CSV.
                  </p>
                </div>
              </div>

              <label
                className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-md transition ${
                  readingFile || importing
                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                    : 'bg-slate-900 text-white hover:-translate-y-0.5 hover:bg-slate-800'
                }`}
              >
                <i
                  className={`fa-solid ${
                    readingFile
                      ? 'fa-spinner animate-spin'
                      : 'fa-folder-open'
                  }`}
                />

                {readingFile
                  ? 'Reading file...'
                  : 'Choose Excel File'}

                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFile}
                  disabled={readingFile || importing}
                  className="hidden"
                />
              </label>
            </div>

            {fileName && (
              <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                    <i className="fa-solid fa-file-excel" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {fileName}
                    </p>

                    <p className="text-xs text-slate-500">
                      {rows.length.toLocaleString()} rows loaded
                    </p>
                  </div>
                </div>

                {!importing && (
                  <button
                    type="button"
                    onClick={clearImport}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"
                  >
                    <i className="fa-solid fa-trash-can" />
                    Clear
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Validation notices */}
          {duplicateRows.size > 0 && (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                  <i className="fa-solid fa-triangle-exclamation" />
                </div>

                <div>
                  <h3 className="font-bold text-amber-900">
                    Duplicate names detected in Excel
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    {duplicateRows.size.toLocaleString()} row
                    {duplicateRows.size === 1 ? '' : 's'} will
                    not be sent to the database because the same
                    student name appears more than once in this
                    workbook.
                  </p>
                </div>
              </div>
            </section>
          )}

          {resultMessages.filter(
            (item) => item.type === 'error'
          ).length > 0 && (
            <section className="rounded-3xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                  <i className="fa-solid fa-circle-xmark" />
                </div>

                <div>
                  <h3 className="font-bold text-red-900">
                    Validation issues found
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-red-800">
                    Correct the highlighted issues before
                    starting the import.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Import progress */}
          {importStarted && (
            <section className="bti-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {importing && (
                        <i className="fa-solid fa-spinner animate-spin text-blue-600" />
                      )}

                      {!importing && progress === 100 && (
                        <i className="fa-solid fa-circle-check text-emerald-600" />
                      )}

                      <h2 className="text-lg font-bold text-slate-900">
                        {importing
                          ? 'Importing students'
                          : 'Import complete'}
                      </h2>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {processed.toLocaleString()} of{' '}
                      {importableRows.length.toLocaleString()}{' '}
                      students processed
                    </p>
                  </div>

                  <div className="text-3xl font-black text-blue-600">
                    {progress}%
                  </div>
                </div>

                <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`bti-progress-glow h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 ${
                      progress > 0 ? '' : 'w-0'
                    }`}
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>

                <div className="flex flex-col gap-2 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Batch {currentBatch || 0} of{' '}
                    {totalBatches || 0}
                  </span>

                  <span>
                    {BATCH_SIZE} students per batch
                  </span>
                </div>

                {message && (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-700">
                    <i className="fa-solid fa-circle-info mr-2 text-blue-600" />
                    {message}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Preview */}
          {rows.length > 0 && !importStarted && (
            <section className="bti-fade-up overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5 md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Import Preview
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Showing the first{' '}
                      {Math.min(50, rows.length)} of{' '}
                      {rows.length.toLocaleString()} records.
                    </p>
                  </div>

                  <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                    <i className="fa-solid fa-users mr-2" />
                    {importableRows.length.toLocaleString()} importable
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">
                        #
                      </th>
                      <th className="px-4 py-3">
                        Full Name
                      </th>
                      <th className="px-4 py-3">
                        Form
                      </th>
                      <th className="px-4 py-3">
                        Programme
                      </th>
                      <th className="px-4 py-3">
                        Class
                      </th>
                      <th className="px-4 py-3">
                        Gender
                      </th>
                      <th className="px-4 py-3">
                        Residence
                      </th>
                      <th className="px-4 py-3">
                        DOB
                      </th>
                      <th className="px-4 py-3">
                        Admission
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 50).map((row, index) => {
                      const isDuplicate =
                        duplicateRows.has(index);

                      return (
                        <tr
                          key={`${row.full_name}-${index}`}
                          className={
                            isDuplicate
                              ? 'bg-amber-50'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="px-4 py-3 font-semibold text-slate-400">
                            {index + 2}
                          </td>

                          <td className="px-4 py-3 font-bold text-slate-800">
                            {row.full_name || '—'}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {row.form || '—'}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {row.programme || '—'}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {row.class_name || '—'}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {row.gender || '—'}
                          </td>

                          <td className="px-4 py-3">
                            {row.resident ? (
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                  row.resident ===
                                  'Boarding'
                                    ? 'bg-violet-100 text-violet-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {row.resident}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {row.date_of_birth || '—'}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {row.admission_date || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Start import */}
          {rows.length > 0 && !importStarted && (
            <section className="bti-fade-up rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-600" />

                    <h2 className="text-lg font-bold text-slate-900">
                      Ready to import
                    </h2>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {importableRows.length.toLocaleString()}{' '}
                    students will be processed in batches of{' '}
                    {BATCH_SIZE}. Existing students will be
                    updated instead of duplicated.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={importStudents}
                  disabled={
                    importing ||
                    !academicYearId ||
                    !importableRows.length ||
                    resultMessages.some(
                      (item) => item.type === 'error'
                    )
                  }
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-4 text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <i className="fa-solid fa-cloud-arrow-up" />
                  Import{' '}
                  {importableRows.length.toLocaleString()}{' '}
                  Students
                </button>
              </div>
            </section>
          )}

          {/* Final summary */}
          {bulkResults.length > 0 && (
            <section className="bti-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <i className="fa-solid fa-chart-pie" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Import Results
                  </h2>

                  <p className="text-sm text-slate-500">
                    Summary of the complete import operation.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                <ResultCard
                  icon="fa-user-plus"
                  label="New Students"
                  value={summary.newStudents}
                  tone="blue"
                />

                <ResultCard
                  icon="fa-user-check"
                  label="Existing Students"
                  value={summary.existingStudents}
                  tone="emerald"
                />

                <ResultCard
                  icon="fa-link"
                  label="Assigned"
                  value={summary.assigned}
                  tone="indigo"
                />

                <ResultCard
                  icon="fa-school"
                  label="Classes Created"
                  value={summary.classesCreated}
                  tone="violet"
                />

                <ResultCard
                  icon="fa-file-circle-plus"
                  label="New Enrollments"
                  value={summary.enrollmentsCreated}
                  tone="cyan"
                />

                <ResultCard
                  icon="fa-rotate"
                  label="Updated Enrollments"
                  value={summary.enrollmentsUpdated}
                  tone="amber"
                />

                <ResultCard
                  icon="fa-triangle-exclamation"
                  label="Partial"
                  value={summary.partial}
                  tone="orange"
                />

                <ResultCard
                  icon="fa-forward"
                  label="Skipped"
                  value={summary.skipped}
                  tone="slate"
                />

                <ResultCard
                  icon="fa-circle-xmark"
                  label="Failed"
                  value={summary.failed}
                  tone="red"
                />

                <ResultCard
                  icon="fa-circle-check"
                  label="Successful Rows"
                  value={summary.success}
                  tone="green"
                />
              </div>
            </section>
          )}

          {/* Result details */}
          {bulkResults.length > 0 && (
            <section className="bti-fade-up overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5 md:p-6">
                <h2 className="text-lg font-bold text-slate-900">
                  Detailed Results
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Review rows that were partially completed or
                  failed.
                </p>
              </div>

              <div className="max-h-[520px] overflow-auto">
                <div className="divide-y divide-slate-100">
                  {bulkResults
                    .filter(
                      (item) =>
                        item.status !== 'success'
                    )
                    .map((item, index) => (
                      <div
                        key={`${item.row}-${index}`}
                        className="flex gap-3 p-4"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            item.status === 'partial'
                              ? 'bg-amber-100 text-amber-700'
                              : item.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <i
                            className={`fa-solid ${
                              item.status === 'partial'
                                ? 'fa-triangle-exclamation'
                                : item.status === 'failed'
                                ? 'fa-circle-xmark'
                                : 'fa-forward'
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black uppercase text-slate-400">
                              Excel row {item.row}
                            </span>

                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                                item.status ===
                                'partial'
                                  ? 'bg-amber-100 text-amber-700'
                                  : item.status ===
                                    'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>

                          <p className="mt-1 text-sm leading-6 text-slate-700">
                            {item.message ||
                              'No additional information was returned.'}
                          </p>
                        </div>
                      </div>
                    ))}

                  {bulkResults.every(
                    (item) =>
                      item.status === 'success'
                  ) && (
                    <div className="p-8 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                        <i className="fa-solid fa-check-double text-xl" />
                      </div>

                      <h3 className="mt-4 font-bold text-slate-900">
                        All processed rows completed successfully
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        No partial or failed records were returned.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Messages */}
          {error && (
            <section className="bti-fade-up rounded-3xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                  <i className="fa-solid fa-circle-exclamation" />
                </div>

                <div>
                  <h3 className="font-bold text-red-900">
                    Import Error
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-red-800">
                    {error}
                  </p>
                </div>
              </div>
            </section>
          )}

          {message && !importStarted && (
            <section className="bti-fade-up rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <i className="fa-solid fa-circle-check" />
                </div>

                <p className="text-sm font-semibold text-emerald-800">
                  {message}
                </p>
              </div>
            </section>
          )}

          {/* Quick guide */}
          <section className="bti-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                <i className="fa-solid fa-circle-question" />
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">
                  Quick Guide
                </h2>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <GuideItem
                    number="01"
                    text="Download the BTI-SMS Excel template."
                  />

                  <GuideItem
                    number="02"
                    text="Enter student information using the supplied column headings."
                  />

                  <GuideItem
                    number="03"
                    text="Use Day or Boarding in the RESIDENCE column."
                  />

                  <GuideItem
                    number="04"
                    text="Select the correct academic year before importing."
                  />

                  <GuideItem
                    number="05"
                    text="Review the preview and correct validation errors."
                  />

                  <GuideItem
                    number="06"
                    text="Start the import and monitor the live batch progress."
                  />
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

function ResultCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  tone:
    | 'blue'
    | 'emerald'
    | 'indigo'
    | 'violet'
    | 'cyan'
    | 'amber'
    | 'orange'
    | 'slate'
    | 'red'
    | 'green';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald:
      'bg-emerald-50 text-emerald-700 border-emerald-100',
    indigo:
      'bg-indigo-50 text-indigo-700 border-indigo-100',
    violet:
      'bg-violet-50 text-violet-700 border-violet-100',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    amber:
      'bg-amber-50 text-amber-700 border-amber-100',
    orange:
      'bg-orange-50 text-orange-700 border-orange-100',
    slate:
      'bg-slate-50 text-slate-700 border-slate-200',
    red: 'bg-red-50 text-red-700 border-red-100',
    green:
      'bg-green-50 text-green-700 border-green-100',
  };

  return (
    <div
      className={`rounded-2xl border p-4 ${tones[tone]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <i className={`fa-solid ${icon}`} />

        <span className="text-2xl font-black">
          {value.toLocaleString()}
        </span>
      </div>

      <p className="mt-2 text-xs font-bold opacity-80">
        {label}
      </p>
    </div>
  );
}

function GuideItem({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-black text-blue-600 shadow-sm">
        {number}
      </div>

      <p className="text-sm font-medium leading-5 text-slate-600">
        {text}
      </p>
    </div>
  );
}

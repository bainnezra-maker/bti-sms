'use client';

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
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

type ImportStatus =
  | 'success'
  | 'partial'
  | 'skipped'
  | 'failed';

type ResultMessage = {
  row: number;
  status: ImportStatus;
  message: string;
  type: 'error' | 'warning' | 'success';
  student_saved?: boolean;
  assigned?: boolean;
};

type BulkResult = {
  row?: number;
  row_number?: number;
  status?: ImportStatus;
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

type PreparedRow = ImportRow & {
  row_number: number;
};

type ImportCounts = Record<ImportStatus, number> & {
  studentSaved: number;
  assigned: number;
  enrollmentCreated: number;
  enrollmentUpdated: number;
  classCreated: number;
};

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

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function normalize(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeResidence(value: unknown) {
  const normalized = clean(value).toLowerCase();

  if (normalized === 'day') {
    return 'Day';
  }

  if (normalized === 'boarding') {
    return 'Boarding';
  }

  return '';
}

function excelDateToString(value: unknown): string {
  if (!value) return '';

  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);

    if (date) {
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');

      return `${date.y}-${month}-${day}`;
    }
  }

  const text = clean(value);

  if (!text) return '';

  const slashMatch = text.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
  );

  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];

    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return text;
}

function mapRow(
  row: Record<string, unknown>
): ImportRow {
  const get = (name: string) => {
    const key = Object.keys(row).find(
      (item) =>
        normalize(item) === normalize(name)
    );

    return key ? row[key] : '';
  };

  return {
    full_name: clean(get('FULL NAME')),
    form: clean(get('FORM')),
    programme: clean(get('PROGRAMME')),
    class_name: clean(get('CLASS')),
    gender: clean(get('GENDER')),
    resident: clean(get('RESIDENCE')),
    date_of_birth: excelDateToString(
      get('DATE OF BIRTH')
    ),
    guardian_name: clean(
      get('GUARDIAN NAME')
    ),
    guardian_phone: clean(
      get('GUARDIAN PHONE')
    ),
    address: clean(get('ADDRESS')),
    admission_date: excelDateToString(
      get('ADMISSION DATE')
    ),
    jhs_aggregate: clean(
      get('JHS AGGREGATE')
    ),
  };
}

export default function StudentImportPage() {
  const supabase = createClient();

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [programmes, setProgrammes] =
    useState<Programme[]>([]);
  const [academicYears, setAcademicYears] =
    useState<AcademicYear[]>([]);
  const [classes, setClasses] =
    useState<SchoolClass[]>([]);

  const [academicYearId, setAcademicYearId] =
    useState('');
  const [schoolId, setSchoolId] =
    useState('');

  const [loadingData, setLoadingData] =
    useState(true);
  const [importing, setImporting] =
    useState(false);

  const [message, setMessage] =
    useState('');
  const [errors, setErrors] =
    useState<ResultMessage[]>([]);
  const [fileName, setFileName] =
    useState('');

  const [importProgress, setImportProgress] =
    useState('');
  const [progressPercent, setProgressPercent] =
    useState(0);

  const selectedAcademicYear =
    useMemo(
      () =>
        academicYears.find(
          (year) =>
            year.id === academicYearId
        ),
      [
        academicYears,
        academicYearId,
      ]
    );

  const importCounts = useMemo<ImportCounts>(
    () =>
      errors.reduce<ImportCounts>(
        (counts, result) => {
          counts[result.status] += 1;

          if (result.student_saved) {
            counts.studentSaved += 1;
          }

          if (result.assigned) {
            counts.assigned += 1;
          }

          return counts;
        },
        {
          success: 0,
          partial: 0,
          skipped: 0,
          failed: 0,
          studentSaved: 0,
          assigned: 0,
          enrollmentCreated: 0,
          enrollmentUpdated: 0,
          classCreated: 0,
        }
      ),
    [errors]
  );


  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoadingData(true);
    setMessage('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage(
        'You must be logged in to use the student importer.'
      );
      setLoadingData(false);
      return;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      setMessage(
        `Unable to determine your school: ${profileError.message}`
      );
      setLoadingData(false);
      return;
    }

    if (!profile?.school_id) {
      setMessage(
        'Your BTI-SMS account is not linked to a school.'
      );
      setLoadingData(false);
      return;
    }

    const currentSchoolId =
      profile.school_id;

    setSchoolId(currentSchoolId);

    const [
      {
        data: programmeData,
        error: programmeError,
      },
      {
        data: yearData,
        error: yearError,
      },
      {
        data: classData,
        error: classError,
      },
    ] = await Promise.all([
      supabase
        .from('programmes')
        .select('id, name')
        .eq(
          'school_id',
          currentSchoolId
        )
        .order('name'),

      supabase
        .from('academic_years')
        .select(
          'id, name, start_date'
        )
        .eq(
          'school_id',
          currentSchoolId
        )
        .order('start_date', {
          ascending: false,
        }),

      supabase
        .from('classes')
        .select(
          'id, name, level, programme_id, academic_year_id'
        )
        .eq(
          'school_id',
          currentSchoolId
        )
        .order('name'),
    ]);

    if (
      programmeError ||
      yearError ||
      classError
    ) {
      setMessage(
        programmeError?.message ||
          yearError?.message ||
          classError?.message ||
          'Unable to load school data.'
      );

      setLoadingData(false);
      return;
    }

    const loadedProgrammes =
      programmeData || [];
    const loadedYears =
      yearData || [];
    const loadedClasses =
      classData || [];

    setProgrammes(
      loadedProgrammes
    );
    setAcademicYears(
      loadedYears
    );
    setClasses(
      loadedClasses
    );

    const currentYear =
      loadedYears.find(
        (year) =>
          normalize(
            year.name
          ).includes('current')
      );

    if (currentYear) {
      setAcademicYearId(
        currentYear.id
      );
    } else if (
      loadedYears[0]
    ) {
      setAcademicYearId(
        loadedYears[0].id
      );
    }

    setLoadingData(false);
  }

  function downloadTemplate() {
    const sample = [
      {
        'FULL NAME':
          'John Mensah',
        FORM: 'Form 1',
        PROGRAMME:
          'Electrical Engineering',
        CLASS: 'A Class',
        GENDER: 'Male',
        RESIDENCE:
          'Boarding',
        'DATE OF BIRTH':
          '2010-05-12',
        'GUARDIAN NAME':
          'Kwame Mensah',
        'GUARDIAN PHONE':
          '0240000000',
        ADDRESS: 'Accra',
        'ADMISSION DATE':
          '2026-09-01',
        'JHS AGGREGATE':
          '18',
      },
    ];

    const worksheet =
      XLSX.utils.json_to_sheet(
        sample,
        {
          header: headers,
        }
      );

    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 14 },
      { wch: 30 },
      { wch: 28 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 25 },
      { wch: 20 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Students'
    );

    XLSX.writeFile(
      workbook,
      'BTI-SMS-Student-Import-Template.xlsx'
    );
  }

  async function handleFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setMessage('');
    setErrors([]);
    setRows([]);
    setImportProgress('');
    setProgressPercent(0);

    try {
      const buffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(buffer, {
          type: 'array',
          cellDates: true,
        });

      if (
        !workbook.SheetNames.length
      ) {
        setMessage(
          'The selected Excel file does not contain a worksheet.'
        );
        return;
      }

      const firstSheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      const json =
        XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(firstSheet, {
          defval: '',
        });

      const mappedRows =
        json.map(mapRow);

      setRows(mappedRows);

      if (!mappedRows.length) {
        setMessage(
          'The selected Excel file contains no student records.'
        );
      } else {
        setMessage(
          `${mappedRows.length} student record(s) loaded and ready for import.`
        );
      }
    } catch {
      setMessage(
        'Unable to read this file. Please use an Excel (.xlsx/.xls) or CSV file.'
      );
    }

    event.target.value = '';
  }

  async function importStudents() {
    if (importing) return;

    setErrors([]);
    setMessage('');
    setImportProgress('');
    setProgressPercent(0);

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

    const results: ResultMessage[] = [];
    const counts: ImportCounts = {
      success: 0,
      partial: 0,
      skipped: 0,
      failed: 0,
      studentSaved: 0,
      assigned: 0,
      enrollmentCreated: 0,
      enrollmentUpdated: 0,
      classCreated: 0,
    };

    const addResult = (
      result: ResultMessage,
      details?: BulkResult
    ) => {
      results.push(result);
      counts[result.status] += 1;

      if (result.student_saved) {
        counts.studentSaved += 1;
      }

      if (result.assigned) {
        counts.assigned += 1;
      }

      if (details?.enrollment_created) {
        counts.enrollmentCreated += 1;
      }

      if (details?.enrollment_updated) {
        counts.enrollmentUpdated += 1;
      }

      if (details?.class_created) {
        counts.classCreated += 1;
      }
    };

    const addBatchFailure = (
      batch: PreparedRow[],
      batchNumber: number,
      reason: string
    ) => {
      batch.forEach((row) =>
        addResult({
          row: row.row_number,
          status: 'failed',
          type: 'error',
          message: `Batch ${batchNumber} could not be processed: ${reason}`,
        })
      );
    };

    try {
      setImportProgress(
        `Validating ${rows.length} student record(s)...`
      );
      setProgressPercent(10);

      const validRows: PreparedRow[] = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const fullName = clean(row.full_name);
        const residence = normalizeResidence(row.resident);

        if (!fullName) {
          addResult({
            row: rowNumber,
            status: 'skipped',
            type: 'warning',
            message: 'Skipped before import: FULL NAME is required.',
          });
          return;
        }

        if (row.resident && !residence) {
          addResult({
            row: rowNumber,
            status: 'skipped',
            type: 'warning',
            message:
              'Skipped before import: RESIDENCE must be Day or Boarding.',
          });
          return;
        }

        if (row.jhs_aggregate) {
          const aggregate = Number(
            String(row.jhs_aggregate).replace(/,/g, '').trim()
          );

          if (!Number.isFinite(aggregate)) {
            addResult({
              row: rowNumber,
              status: 'skipped',
              type: 'warning',
              message:
                'Skipped before import: JHS AGGREGATE must be a valid number.',
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

      setImportProgress(
        `Checking ${validRows.length} valid record(s) for duplicate names...`
      );
      setProgressPercent(20);

      const rowsByFingerprint = new Map<
        string,
        PreparedRow[]
      >();

      validRows.forEach((row) => {
        const fingerprint = [
          row.full_name,
          row.form,
          row.programme,
          row.class_name,
          row.gender,
          row.resident,
          row.date_of_birth,
          row.guardian_name,
          row.guardian_phone,
          row.address,
          row.admission_date,
          row.jhs_aggregate,
        ]
          .map(normalize)
          .join('|');

        rowsByFingerprint.set(fingerprint, [
          ...(rowsByFingerprint.get(fingerprint) || []),
          row,
        ]);
      });

      const rowsToImport: PreparedRow[] = [];

      rowsByFingerprint.forEach((identicalRows) => {
        const firstRow = identicalRows[0];
        rowsToImport.push(firstRow);

        identicalRows.slice(1).forEach((row) =>
          addResult({
            row: row.row_number,
            status: 'skipped',
            type: 'warning',
            message:
              `Skipped before import: this row is identical to Excel row ${firstRow.row_number}.`,
          })
        );
      });

      if (!rowsToImport.length) {
        setErrors([...results]);
        setProgressPercent(100);
        setImportProgress('');
        setMessage(
          `Import complete: 0 successful, 0 partial, ${counts.skipped} skipped, and 0 failed. No rows were sent to the database.`
        );
        return;
      }

      const payload = rowsToImport.map((row) => ({
        row_number: row.row_number,
        full_name: clean(row.full_name),
        form: clean(row.form),
        programme: clean(row.programme),
        class_name: clean(row.class_name),
        gender: clean(row.gender),
        resident: normalizeResidence(row.resident),
        date_of_birth: clean(row.date_of_birth),
        guardian_name: clean(row.guardian_name),
        guardian_phone: clean(row.guardian_phone),
        address: clean(row.address),
        admission_date: clean(row.admission_date),
        jhs_aggregate: clean(row.jhs_aggregate),
      }));

      const batchSize = 50;
      const totalBatches = Math.ceil(payload.length / batchSize);

      for (
        let batchIndex = 0;
        batchIndex < totalBatches;
        batchIndex += 1
      ) {
        const start = batchIndex * batchSize;
        const batch = payload.slice(start, start + batchSize);
        const batchRows = rowsToImport.slice(
          start,
          start + batchSize
        );
        const batchNumber = batchIndex + 1;
        const completedBeforeBatch = start;
        const progress = 30 +
          Math.round(
            (completedBeforeBatch / payload.length) * 55
          );

        setImportProgress(
          `Importing batch ${batchNumber} of ${totalBatches} (${batch.length} record(s))...`
        );
        setProgressPercent(progress);

        const { data, error } = await supabase.rpc(
          'bulk_import_students',
          {
            p_school_id: schoolId,
            p_academic_year_id: academicYearId,
            p_rows: batch,
          }
        );

        if (error) {
          addBatchFailure(
            batchRows,
            batchNumber,
            error.message || 'Unknown database error.'
          );
          setErrors([...results]);
          continue;
        }

        if (!Array.isArray(data)) {
          addBatchFailure(
            batchRows,
            batchNumber,
            'The database returned no row-level results.'
          );
          setErrors([...results]);
          continue;
        }

        const returnedRows = new Set<number>();

        (data as BulkResult[]).forEach((databaseResult) => {
          const rowNumber = Number(
            databaseResult.row ?? databaseResult.row_number ?? 0
          );
          const status = databaseResult.status || 'failed';

          if (!rowNumber) {
            return;
          }

          returnedRows.add(rowNumber);

          const studentSaved =
            databaseResult.student_created === true ||
            databaseResult.student_existing === true ||
            Boolean(databaseResult.student_id);
          const assigned =
            databaseResult.assigned === true ||
            databaseResult.enrollment_created === true ||
            databaseResult.enrollment_updated === true ||
            Boolean(databaseResult.enrollment_id);

          const type =
            status === 'success'
              ? 'success'
              : status === 'partial' || status === 'skipped'
              ? 'warning'
              : 'error';

          let message =
            databaseResult.message ||
            'The database did not provide a reason for this row.';

          const outcomes: string[] = [];

          if (studentSaved) {
            outcomes.push(
              databaseResult.student_created
                ? 'Student record saved.'
                : 'Student record already existed.'
            );
          }

          if (assigned) {
            outcomes.push('Enrollment assigned successfully.');
          } else if (studentSaved && status !== 'success') {
            outcomes.push('No enrollment was assigned.');
          }

          if (databaseResult.class_created) {
            outcomes.push('A new class was created.');
          }

          if (outcomes.length) {
            message = `${message} ${outcomes.join(' ')}`;
          }

          addResult(
            {
              row: rowNumber,
              status,
              type,
              message,
              student_saved: studentSaved,
              assigned,
            },
            databaseResult
          );
        });

        batchRows
          .filter((row) => !returnedRows.has(row.row_number))
          .forEach((row) =>
            addResult({
              row: row.row_number,
              status: 'failed',
              type: 'error',
              message:
                `Batch ${batchNumber} completed without a result for this row.`,
            })
          );

        setErrors([...results]);
      }

      setImportProgress(
        'Refreshing BTI-SMS student and class data...'
      );
      setProgressPercent(92);

      await loadData();

      setErrors([...results]);
      setProgressPercent(100);
      setImportProgress('');
      setMessage(
        `Import complete: ${counts.success} successful, ${counts.partial} partial, ${counts.skipped} skipped, and ${counts.failed} failed. ${counts.studentSaved} student record(s) saved or matched; ${counts.assigned} enrollment(s) assigned; ${counts.enrollmentCreated} enrollment(s) created; ${counts.enrollmentUpdated} enrollment(s) updated; ${counts.classCreated} class(es) created.`
      );
    } catch (error: unknown) {
      const reason =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred during the import.';

      setImportProgress('');
      setProgressPercent(0);

      const unreportedRows = rows
        .map((_, index) => index + 2)
        .filter(
          (rowNumber) =>
            !results.some((result) => result.row === rowNumber)
        );

      unreportedRows.forEach((rowNumber) =>
        addResult({
          row: rowNumber,
          status: 'failed',
          type: 'error',
          message: `Import stopped unexpectedly: ${reason}`,
        })
      );

      setErrors([...results]);
      setMessage(`Import failed unexpectedly: ${reason}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">

        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="mb-8">

          <a
            href="/students"
            className="group inline-flex items-center gap-2 text-sm font-bold text-blue-600 transition-all duration-200 hover:-translate-x-1 hover:text-blue-700"
          >
            <i className="fa-solid fa-arrow-left transition-transform duration-200 group-hover:-translate-x-1" />
            Back to Students
          </a>

          <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

            <div>

              <div className="mb-3 inline-flex animate-pulse items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-blue-700">
                <i className="fa-solid fa-bolt" />
                Fast Bulk Processing
              </div>

              <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Bulk Student Import
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                Import, register and assign large
                numbers of students into BTI-SMS
                through one fast, secure bulk process.
              </p>

            </div>

            <div className="rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200 transition duration-300 hover:-translate-y-1 hover:shadow-lg">

              <div className="flex items-center gap-3">

                <div className="flex h-12 w-12 animate-[pulse_2s_ease-in-out_infinite] items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <i className="fa-solid fa-users-rectangle text-lg" />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Import fields
                  </p>

                  <p className="text-xl font-black text-slate-900">
                    {headers.length}
                  </p>
                </div>

              </div>

            </div>

          </div>

        </div>

        {/* =====================================================
            MAIN GRID
        ====================================================== */}

        <div className="grid gap-6 lg:grid-cols-3">

          {/* ===================================================
              TEMPLATE CARD
          ==================================================== */}

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition duration-300 hover:shadow-xl lg:col-span-1">

            <div className="bg-gradient-to-r from-slate-950 to-slate-800 p-5 text-white">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                  <i className="fa-solid fa-file-excel text-lg" />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-300">
                    Step 1
                  </p>

                  <h2 className="text-lg font-black">
                    Download Template
                  </h2>
                </div>

              </div>

            </div>

            <div className="p-5">

              <p className="text-sm leading-6 text-slate-600">
                Use the official BTI-SMS template
                so that your Excel columns match the
                importer correctly.
              </p>

              <button
                type="button"
                onClick={
                  downloadTemplate
                }
                disabled={
                  importing
                }
                className="group mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-black text-white shadow-sm transition duration-300 hover:-translate-y-1 hover:bg-slate-800 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="fa-solid fa-download transition-transform duration-300 group-hover:translate-y-0.5" />
                Download Excel Template
              </button>

              {/* FIELD LIST */}

              <div className="mt-7">

                <div className="flex items-center justify-between">

                  <h3 className="font-black text-slate-900">
                    Excel fields
                  </h3>

                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">
                    {headers.length} columns
                  </span>

                </div>

                <div className="mt-3 space-y-1.5">

                  {headers.map(
                    (
                      header,
                      index
                    ) => (
                      <div
                        key={
                          header
                        }
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-200 hover:translate-x-1 ${
                          header ===
                          'RESIDENCE'
                            ? 'bg-blue-50 font-bold text-blue-800 ring-1 ring-blue-200'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >

                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-500">
                          {index +
                            1}
                        </span>

                        <span className="flex-1">
                          {header}
                        </span>

                        {header ===
                          'RESIDENCE' && (
                          <i className="fa-solid fa-circle-check text-blue-600" />
                        )}

                      </div>
                    )
                  )}

                </div>

              </div>

              {/* RESIDENCE */}

              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 transition duration-300 hover:-translate-y-1 hover:shadow-md">

                <div className="flex items-start gap-3">

                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <i className="fa-solid fa-house-user" />
                  </div>

                  <div>

                    <p className="font-black text-blue-900">
                      Residence is included
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-800">
                      Enter either{' '}
                      <strong>
                        Day
                      </strong>{' '}
                      or{' '}
                      <strong>
                        Boarding
                      </strong>
                      .
                    </p>

                  </div>

                </div>

              </div>

              {/* SPEED NOTICE */}

              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

                <div className="flex gap-3">

                  <i className="fa-solid fa-gauge-high mt-0.5 text-emerald-600" />

                  <div>

                    <p className="font-black text-emerald-900">
                      Faster bulk processing
                    </p>

                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                      BTI-SMS processes the import as
                      a bulk operation instead of making
                      separate database requests for
                      every student.
                    </p>

                  </div>

                </div>

              </div>

              {/* ASSIGNMENT NOTICE */}

              <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-4">

                <div className="flex gap-3">

                  <i className="fa-solid fa-user-check mt-0.5 text-purple-600" />

                  <div>

                    <p className="font-black text-purple-900">
                      Automatic class assignment
                    </p>

                    <p className="mt-1 text-xs leading-5 text-purple-800">
                      FORM + PROGRAMME + CLASS are
                      used to place the student into the
                      correct class and create/update the
                      enrollment automatically.
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </section>

          {/* ===================================================
              UPLOAD CARD
          ==================================================== */}

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition duration-300 hover:shadow-xl lg:col-span-2">

            <div className="border-b border-slate-200 bg-white p-5">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <i className="fa-solid fa-cloud-arrow-up text-lg" />
                </div>

                <div>

                  <p className="text-xs font-black uppercase tracking-wider text-blue-600">
                    Step 2
                  </p>

                  <h2 className="text-lg font-black text-slate-900">
                    Select Academic Year
                  </h2>

                </div>

              </div>

            </div>

            <div className="p-5">

              {/* ACADEMIC YEAR */}

              <select
                value={
                  academicYearId
                }
                onChange={(
                  event
                ) =>
                  setAcademicYearId(
                    event.target
                      .value
                  )
                }
                disabled={
                  loadingData ||
                  importing
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-bold text-slate-800 outline-none transition duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              >

                <option value="">
                  {loadingData
                    ? 'Loading academic years...'
                    : 'Select academic year'}
                </option>

                {academicYears.map(
                  (
                    year
                  ) => (
                    <option
                      key={
                        year.id
                      }
                      value={
                        year.id
                      }
                    >
                      {
                        year.name
                      }
                    </option>
                  )
                )}

              </select>

              {selectedAcademicYear && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">

                  <i className="fa-solid fa-calendar-check text-blue-600" />

                  Students will be enrolled against{' '}

                  <strong className="text-slate-900">
                    {
                      selectedAcademicYear.name
                    }
                  </strong>

                </div>
              )}

              {/* UPLOAD */}

              <div className="mt-8">

                <div className="mb-3 flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <i className="fa-solid fa-file-arrow-up" />
                  </div>

                  <div>

                    <p className="text-xs font-black uppercase tracking-wider text-blue-600">
                      Step 3
                    </p>

                    <h2 className="text-lg font-black text-slate-900">
                      Upload Excel File
                    </h2>

                  </div>

                </div>

                <label className="group relative flex min-h-[210px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50/40 p-8 text-center transition duration-300 hover:-translate-y-1 hover:border-blue-400 hover:bg-blue-50 hover:shadow-xl">

                  <div className="absolute inset-0 bg-blue-400/5 opacity-0 transition duration-500 group-hover:opacity-100" />

                  <div className="relative flex h-16 w-16 animate-[bounce_3s_ease-in-out_infinite] items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-blue-100 transition duration-300 group-hover:scale-110 group-hover:shadow-xl">

                    <i className="fa-solid fa-file-excel text-2xl" />

                  </div>

                  <span className="relative mt-5 text-base font-black text-slate-800">
                    Choose Excel or CSV file
                  </span>

                  <span className="relative mt-1 text-xs text-slate-500">
                    .xlsx, .xls or .csv
                  </span>

                  <span className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-blue-700 shadow-sm ring-1 ring-slate-200 transition duration-300 group-hover:scale-105">
                    <i className="fa-solid fa-arrow-up-from-bracket" />
                    Select file
                  </span>

                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={
                      handleFile
                    }
                    disabled={
                      importing
                    }
                    className="hidden"
                  />

                </label>

              </div>

              {/* FILE SELECTED */}

              {fileName && (
                <div className="mt-4 flex animate-[fadeIn_0.4s_ease-out] items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

                  <div className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <i className="fa-solid fa-file-circle-check" />
                  </div>

                  <div className="min-w-0">

                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      File selected
                    </p>

                    <p className="truncate text-sm font-black text-emerald-900">
                      {fileName}
                    </p>

                  </div>

                </div>
              )}

              {/* =================================================
                  LIVE PROGRESS
              ================================================== */}

              {importing && (
                <div className="mt-5 animate-[fadeIn_0.4s_ease-out] rounded-3xl border border-blue-200 bg-blue-50 p-5">

                  <div className="flex items-start gap-4">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">

                      <i className="fa-solid fa-spinner fa-spin text-lg" />

                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">

                        <div>

                          <p className="font-black text-blue-950">
                            Import in progress
                          </p>

                          <p className="mt-1 text-xs text-blue-700">
                            {
                              importProgress
                            }
                          </p>

                        </div>

                        <span className="font-black text-blue-700">
                          {
                            progressPercent
                          }%
                        </span>

                      </div>

                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-blue-100">

                        <div
                          className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
                          style={{
                            width: `${progressPercent}%`,
                          }}
                        />

                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-blue-700">

                        <i className="fa-solid fa-shield-halved" />

                        Students, classes and
                        enrollments are being processed
                        together.

                      </div>

                    </div>

                  </div>

                </div>
              )}

              {/* MESSAGE */}

              {message && !importing && (
                <div className="mt-4 flex animate-[fadeIn_0.4s_ease-out] items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">

                  <i className="fa-solid fa-circle-info mt-0.5 shrink-0 text-blue-600" />

                  <span>
                    {message}
                  </span>

                </div>
              )}

              {/* =================================================
                  PREVIEW
              ================================================== */}

              {rows.length > 0 && (
                <div className="mt-8">

                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                    <div>

                      <div className="flex items-center gap-2">

                        <h2 className="text-xl font-black text-slate-900">
                          Preview
                        </h2>

                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">
                          {
                            rows.length
                          }
                        </span>

                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        Review the student records before
                        starting the bulk operation.
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={
                        importStudents
                      }
                      disabled={
                        importing ||
                        !academicYearId ||
                        !schoolId
                      }
                      className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-sm transition duration-300 hover:-translate-y-1 hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                    >

                      <i
                        className={
                          importing
                            ? 'fa-solid fa-spinner fa-spin'
                            : 'fa-solid fa-cloud-arrow-up'
                        }
                      />

                      {importing
                        ? 'Processing...'
                        : 'Import & Assign Students'}

                    </button>

                  </div>

                  {/* TABLE */}

                  <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">

                    <table className="min-w-[1250px] text-left text-xs">

                      <thead className="bg-slate-100">

                        <tr>

                          {headers.map(
                            (
                              header
                            ) => (
                              <th
                                key={
                                  header
                                }
                                className={`whitespace-nowrap px-3 py-3.5 font-black ${
                                  header ===
                                  'RESIDENCE'
                                    ? 'bg-blue-50 text-blue-800'
                                    : 'text-slate-700'
                                }`}
                              >

                                <div className="flex items-center gap-2">

                                  {
                                    header
                                  }

                                  {header ===
                                    'RESIDENCE' && (
                                    <i className="fa-solid fa-house-user text-blue-600" />
                                  )}

                                </div>

                              </th>
                            )
                          )}

                        </tr>

                      </thead>

                      <tbody>

                        {rows
                          .slice(
                            0,
                            50
                          )
                          .map(
                            (
                              row,
                              index
                            ) => (
                              <tr
                                key={
                                  index
                                }
                                className="border-t border-slate-200 transition duration-200 hover:bg-blue-50/40"
                              >

                                <td className="px-3 py-3 font-bold text-slate-800">
                                  {
                                    row.full_name
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    row.form
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    row.programme
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    row.class_name
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    row.gender
                                  }
                                </td>

                                <td className="bg-blue-50/40 px-3 py-3">

                                  {row.resident ? (
                                    <span
                                      className={
                                        normalizeResidence(
                                          row.resident
                                        ) ===
                                        'Boarding'
                                          ? 'inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 font-black text-purple-700'
                                          : 'inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 font-black text-blue-700'
                                      }
                                    >

                                      <i
                                        className={
                                          normalizeResidence(
                                            row.resident
                                          ) ===
                                          'Boarding'
                                            ? 'fa-solid fa-building'
                                            : 'fa-solid fa-house'
                                        }
                                      />

                                      {
                                        normalizeResidence(
                                          row.resident
                                        )
                                      }

                                    </span>
                                  ) : (
                                    <span className="text-slate-400">
                                      —
                                    </span>
                                  )}

                                </td>

                                <td className="px-3 py-3">
                                  {
                                    row.date_of_birth
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    row.guardian_name
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    row.guardian_phone
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    row.address
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    row.admission_date
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    row.jhs_aggregate
                                  }
                                </td>

                              </tr>
                            )
                          )}

                      </tbody>

                    </table>

                  </div>

                  {rows.length >
                    50 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">

                      <i className="fa-solid fa-eye" />

                      Showing the first 50 rows
                      in the preview. All{' '}
                      {
                        rows.length
                      } rows will be processed.

                    </div>
                  )}

                </div>
              )}

              {/* =================================================
                  RESULTS SUMMARY
              ================================================== */}

              {errors.length >
                0 && (
                <div className="mt-8 animate-[fadeIn_0.5s_ease-out]">

                  <div className="mb-4">

                    <h2 className="text-xl font-black text-slate-900">
                      Import Results
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Review exactly what happened to
                      each Excel row.
                    </p>

                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        label: 'Successful',
                        count: importCounts.success,
                        icon: 'fa-solid fa-circle-check',
                        card: 'border-emerald-200 bg-emerald-50',
                        iconBox: 'bg-emerald-600',
                        text: 'text-emerald-900',
                        labelText: 'text-emerald-700',
                      },
                      {
                        label: 'Partial',
                        count: importCounts.partial,
                        icon: 'fa-solid fa-circle-exclamation',
                        card: 'border-amber-200 bg-amber-50',
                        iconBox: 'bg-amber-500',
                        text: 'text-amber-900',
                        labelText: 'text-amber-700',
                      },
                      {
                        label: 'Skipped',
                        count: importCounts.skipped,
                        icon: 'fa-solid fa-forward',
                        card: 'border-slate-200 bg-slate-50',
                        iconBox: 'bg-slate-600',
                        text: 'text-slate-900',
                        labelText: 'text-slate-700',
                      },
                      {
                        label: 'Failed',
                        count: importCounts.failed,
                        icon: 'fa-solid fa-circle-xmark',
                        card: 'border-red-200 bg-red-50',
                        iconBox: 'bg-red-600',
                        text: 'text-red-900',
                        labelText: 'text-red-700',
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className={`group rounded-2xl border p-4 transition duration-300 hover:-translate-y-1 hover:shadow-lg ${card.card}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white transition duration-300 group-hover:scale-110 ${card.iconBox}`}>
                            <i className={card.icon} />
                          </div>

                          <div>
                            <p className={`text-xs font-black uppercase tracking-wide ${card.labelText}`}>
                              {card.label}
                            </p>

                            <p className={`text-2xl font-black ${card.text}`}>
                              {card.count}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Student records saved or matched: {importCounts.studentSaved}. Enrollments assigned: {importCounts.assigned}.
                  </p>

                  {/* DETAILED RESULTS */}

                  <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">

                          <i className="fa-solid fa-list-check" />

                        </div>

                        <div>

                          <h3 className="font-black text-slate-900">
                            Detailed row results
                          </h3>

                          <p className="text-xs text-slate-500">
                            Student assignment and
                            import status by Excel row.
                          </p>

                        </div>

                      </div>

                    </div>

                    <div className="max-h-[500px] overflow-y-auto">

                      {errors.map(
                        (
                          result,
                          index
                        ) => {

                          const isSuccess =
                            result.status ===
                            'success';

                          const isError =
                            result.status ===
                            'failed';

                          return (
                            <div
                              key={`${result.row}-${index}`}
                              className={`flex gap-3 border-b px-5 py-3 transition duration-200 last:border-b-0 hover:bg-slate-50 ${
                                isSuccess
                                  ? 'border-emerald-100'
                                  : isError
                                  ? 'border-red-100'
                                  : 'border-amber-100'
                              }`}
                            >

                              <div
                                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                  isSuccess
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : isError
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >

                                <i
                                  className={
                                    isSuccess
                                      ? 'fa-solid fa-check'
                                      : isError
                                      ? 'fa-solid fa-xmark'
                                      : 'fa-solid fa-exclamation'
                                  }
                                />

                              </div>

                              <div className="min-w-0 flex-1">

                                <div className="flex flex-wrap items-center gap-2">

                                  <span className="text-xs font-black uppercase tracking-wide text-slate-400">
                                    {result.row >
                                    0
                                      ? `Excel Row ${result.row}`
                                      : 'Import System'}
                                  </span>

                                  <span
                                    className={
                                      result.status === 'success'
                                        ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700'
                                        : result.status === 'partial'
                                        ? 'rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700'
                                        : result.status === 'skipped'
                                        ? 'rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700'
                                        : 'rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-700'
                                    }
                                  >
                                    {result.status}
                                  </span>

                                  {result.student_saved && (
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">
                                      Student saved
                                    </span>
                                  )}

                                  {result.assigned && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                                      Enrolled
                                    </span>
                                  )}

                                </div>

                                <p
                                  className={`mt-1 text-sm leading-6 ${
                                    isSuccess
                                      ? 'text-emerald-800'
                                      : isError
                                      ? 'text-red-800'
                                      : 'text-amber-800'
                                  }`}
                                >
                                  {
                                    result.message
                                  }
                                </p>

                              </div>

                            </div>
                          );
                        }
                      )}

                    </div>

                  </div>

                </div>
              )}

            </div>

          </section>

        </div>

        {/* =====================================================
            QUICK GUIDE
        ====================================================== */}

        <section className="mt-6 overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-sm transition duration-300 hover:shadow-xl md:p-6">

          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

            <div className="flex items-start gap-4">

              <div className="flex h-12 w-12 shrink-0 animate-pulse items-center justify-center rounded-2xl bg-blue-600">

                <i className="fa-solid fa-house-user text-lg" />

              </div>

              <div>

                <h2 className="font-black">
                  Residence & assignment guide
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
                  Enter Day or Boarding under
                  RESIDENCE. FORM, PROGRAMME and CLASS
                  are then used to automatically place the
                  student in the correct academic class.
                </p>

              </div>

            </div>

            <div className="flex flex-wrap gap-2">

              <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-4 py-2 text-xs font-black text-blue-200 ring-1 ring-blue-400/30">
                <i className="fa-solid fa-house" />
                Day
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 px-4 py-2 text-xs font-black text-purple-200 ring-1 ring-purple-400/30">
                <i className="fa-solid fa-building" />
                Boarding
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-xs font-black text-emerald-200 ring-1 ring-emerald-400/30">
                <i className="fa-solid fa-user-check" />
                Auto Assign
              </span>

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}

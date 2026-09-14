'use client';

import { useEffect, useMemo, useState } from 'react';
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
};

const emptyRow: ImportRow = {
full_name: '',
form: '',
programme: '',
class_name: '',
gender: '',
date_of_birth: '',
guardian_name: '',
guardian_phone: '',
address: '',
admission_date: '',
jhs_aggregate: '',
};

const headers = [
'FULL NAME',
'FORM',
'PROGRAMME',
'CLASS',
'GENDER',
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
return clean(value).toLowerCase().replace(/\s+/g, ' ');
}

function excelDateToString(value: unknown): string {
if (!value) return '';

if (value instanceof Date && !Number.isNaN(value.getTime())) {
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

const parsed = new Date(text);

if (!Number.isNaN(parsed.getTime())) {
return parsed.toISOString().slice(0, 10);
}

return text;
}

function mapRow(row: Record<string, unknown>): ImportRow {
const get = (name: string) => {
const key = Object.keys(row).find(
(item) => normalize(item) === normalize(name)
);

return key ? row[key] : '';

};

return {
full_name: clean(get('FULL NAME')),
form: clean(get('FORM')),
programme: clean(get('PROGRAMME')),
class_name: clean(get('CLASS')),
gender: clean(get('GENDER')),
date_of_birth: excelDateToString(get('DATE OF BIRTH')),
guardian_name: clean(get('GUARDIAN NAME')),
guardian_phone: clean(get('GUARDIAN PHONE')),
address: clean(get('ADDRESS')),
admission_date: excelDateToString(get('ADMISSION DATE')),
jhs_aggregate: clean(get('JHS AGGREGATE')),
};
}

export default function StudentImportPage() {
const supabase = createClient();

const [rows, setRows] = useState<ImportRow[]>([]);
const [programmes, setProgrammes] = useState<Programme[]>([]);
const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
const [classes, setClasses] = useState<SchoolClass[]>([]);

const [academicYearId, setAcademicYearId] = useState('');
const [loadingData, setLoadingData] = useState(true);
const [importing, setImporting] = useState(false);
const [message, setMessage] = useState('');
const [errors, setErrors] = useState<ResultMessage[]>([]);
const [fileName, setFileName] = useState('');

const selectedAcademicYear = useMemo(
() => academicYears.find((year) => year.id === academicYearId),
[academicYears, academicYearId]
);

useEffect(() => {
loadData();
}, []);

async function loadData() {
setLoadingData(true);
setMessage('');

const [
  { data: programmeData, error: programmeError },
  { data: yearData, error: yearError },
  { data: classData, error: classError },
] = await Promise.all([
  supabase
    .from('programmes')
    .select('id, name')
    .order('name'),

  supabase
    .from('academic_years')
    .select('id, name, start_date')
    .order('start_date', { ascending: false }),

  supabase
    .from('classes')
    .select('id, name, level, programme_id, academic_year_id')
    .order('name'),
]);

if (programmeError || yearError || classError) {
  setMessage(
    programmeError?.message ||
      yearError?.message ||
      classError?.message ||
      'Unable to load school data.'
  );
} else {
  setProgrammes(programmeData || []);
  setAcademicYears(yearData || []);
  setClasses(classData || []);

  const currentYear = (yearData || []).find(
    (year) =>
      year.name.toLowerCase().includes('current') ||
      year.start_date === new Date().getFullYear().toString()
  );

  if (currentYear) {
    setAcademicYearId(currentYear.id);
  } else if (yearData?.[0]) {
    setAcademicYearId(yearData[0].id);
  }
}

setLoadingData(false);

}

function downloadTemplate() {
const sample = [
{
'FULL NAME': 'John Mensah',
FORM: 'Form 1',
PROGRAMME: 'Electrical',
CLASS: 'Form 1 Electrical A',
GENDER: 'Male',
'DATE OF BIRTH': '2010-05-12',
'GUARDIAN NAME': 'Kwame Mensah',
'GUARDIAN PHONE': '0240000000',
ADDRESS: 'Accra',
'ADMISSION DATE': '2026-09-01',
'JHS AGGREGATE': '18',
},
];

const worksheet = XLSX.utils.json_to_sheet(sample, {
  header: headers,
});

worksheet['!cols'] = [
  { wch: 25 },
  { wch: 14 },
  { wch: 20 },
  { wch: 28 },
  { wch: 12 },
  { wch: 16 },
  { wch: 25 },
  { wch: 20 },
  { wch: 30 },
  { wch: 18 },
  { wch: 18 },
];

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

XLSX.writeFile(workbook, 'BTI-SMS-Student-Import-Template.xlsx');

}

async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
const file = event.target.files?.[0];

if (!file) return;

setFileName(file.name);
setMessage('');
setErrors([]);
setRows([]);

try {
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
  });

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    firstSheet,
    {
      defval: '',
    }
  );

  const mappedRows = json.map(mapRow);

  setRows(mappedRows);

  if (!mappedRows.length) {
    setMessage('The selected Excel file contains no student records.');
  }
} catch {
  setMessage(
    'Unable to read this file. Please use an Excel (.xlsx/.xls) or CSV file.'
  );
}

event.target.value = '';

}

function findProgramme(name: string) {
if (!name) return null;

return (
  programmes.find((programme) => normalize(programme.name) === normalize(name)) ||
  null
);

}

function findClass(row: ImportRow) {
const programme = findProgramme(row.programme);

let matches = classes.filter(
  (schoolClass) =>
    schoolClass.academic_year_id === academicYearId
);

if (row.class_name) {
  matches = matches.filter(
    (schoolClass) =>
      normalize(schoolClass.name) === normalize(row.class_name)
  );
}

if (row.form) {
  matches = matches.filter(
    (schoolClass) =>
      normalize(schoolClass.level) === normalize(row.form)
  );
}

if (programme) {
  matches = matches.filter(
    (schoolClass) => schoolClass.programme_id === programme.id
  );
}

return matches[0] || null;

}

async function importStudents() {
if (!rows.length) {
setMessage('Please select an Excel file first.');
return;
}

if (!academicYearId) {
  setMessage('Please select the academic year for this import.');
  return;
}

setImporting(true);
setMessage('');
setErrors([]);

let imported = 0;
let skipped = 0;
const resultErrors: ResultMessage[] = [];

const { data: userData, error: userError } =
  await supabase.auth.getUser();

if (userError || !userData.user) {
  setMessage('You must be logged in to import students.');
  setImporting(false);
  return;
}

const schoolId = userData.user.user_metadata?.school_id;

if (!schoolId) {
  setMessage('Your account is not linked to a school.');
  setImporting(false);
  return;
}

for (let index = 0; index < rows.length; index++) {
  const row = rows[index];
  const excelRowNumber = index + 2;

  if (!row.full_name) {
    skipped++;

    resultErrors.push({
      row: excelRowNumber,
      message: 'FULL NAME is required.',
    });

    continue;
  }

  const { data: duplicate, error: duplicateError } = await supabase
    .from('students')
    .select('id')
    .eq('school_id', schoolId)
    .ilike('full_name', row.full_name)
    .limit(1)
    .maybeSingle();

  if (duplicateError) {
    skipped++;

    resultErrors.push({
      row: excelRowNumber,
      message: `Could not check duplicate student: ${duplicateError.message}`,
    });

    continue;
  }

  if (duplicate) {
    skipped++;

    resultErrors.push({
      row: excelRowNumber,
      message: `${row.full_name} already exists in BTI-SMS.`,
    });

    continue;
  }

  const admissionDate =
    row.admission_date || new Date().toISOString().slice(0, 10);

  const studentPayload = {
    school_id: schoolId,
    full_name: row.full_name,
    date_of_birth: row.date_of_birth || null,
    gender: row.gender || null,
    guardian_name: row.guardian_name || null,
    guardian_phone: row.guardian_phone || null,
    address: row.address || null,
    admission_date: admissionDate,
    jhs_aggregate: row.jhs_aggregate
      ? Number(row.jhs_aggregate)
      : null,
  };

  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert(studentPayload)
    .select('id')
    .single();

  if (studentError || !student) {
    skipped++;

    resultErrors.push({
      row: excelRowNumber,
      message:
        studentError?.message || 'Student could not be created.',
    });

    continue;
  }

  imported++;

  const schoolClass = findClass(row);

  if (schoolClass) {
    const programme = findProgramme(row.programme);

    const { error: enrollmentError } = await supabase
      .from('enrollments')
      .insert({
        student_id: student.id,
        class_id: schoolClass.id,
        academic_year_id: academicYearId,
        programme_id: programme?.id || schoolClass.programme_id || null,
        enrollment_date: admissionDate,
        status: 'active',
      });

    if (enrollmentError) {
      resultErrors.push({
        row: excelRowNumber,
        message: `Student imported, but enrollment was not created: ${enrollmentError.message}`,
      });
    }
  } else if (row.form || row.class_name || row.programme) {
    resultErrors.push({
      row: excelRowNumber,
      message:
        'Student imported, but no matching class/enrollment was found for the supplied FORM, PROGRAMME and CLASS.',
    });
  }
}

setErrors(resultErrors);
setMessage(
  `Import complete: ${imported} student(s) imported, ${skipped} row(s) skipped.`
);

setImporting(false);

}

return (
<main className="min-h-screen bg-slate-50 p-4 md:p-8">
<div className="mx-auto max-w-7xl">
<div className="mb-6">
<a
href="/students"
className="text-sm font-medium text-blue-600 hover:underline"
>
← Back to Students
</a>

      <h1 className="mt-3 text-2xl font-bold text-slate-900">
        Bulk Student Import
      </h1>

      <p className="mt-1 text-sm text-slate-600">
        Upload many students from Excel or CSV instead of entering them
        one by one.
      </p>
    </div>

    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-1">
        <h2 className="text-lg font-semibold text-slate-900">
          1. Download Template
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Use the official BTI-SMS template so your columns match the
          importer.
        </p>

        <button
          type="button"
          onClick={downloadTemplate}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Download Excel Template
        </button>

        <div className="mt-6">
          <h3 className="font-semibold text-slate-900">
            Excel fields
          </h3>

          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {headers.map((header) => (
              <li key={header}>• {header}</li>
            ))}
          </ul>
        </div>

        <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
          Blank optional fields are accepted. FULL NAME is required
          because every student record needs a name.
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
        <h2 className="text-lg font-semibold text-slate-900">
          2. Select Academic Year
        </h2>

        <select
          value={academicYearId}
          onChange={(event) => setAcademicYearId(event.target.value)}
          disabled={loadingData}
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
        >
          <option value="">
            {loadingData
              ? 'Loading academic years...'
              : 'Select academic year'}
          </option>

          {academicYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </select>

        {selectedAcademicYear && (
          <p className="mt-2 text-xs text-slate-500">
            Students will be enrolled against{' '}
            <strong>{selectedAcademicYear.name}</strong> when a matching
            class is found.
          </p>
        )}

        <h2 className="mt-8 text-lg font-semibold text-slate-900">
          3. Upload Excel File
        </h2>

        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-blue-400 hover:bg-blue-50">
          <span className="text-4xl">📊</span>

          <span className="mt-3 font-semibold text-slate-800">
            Choose Excel or CSV file
          </span>

          <span className="mt-1 text-xs text-slate-500">
            .xlsx, .xls or .csv
          </span>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="hidden"
          />
        </label>

        {fileName && (
          <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
            Selected file: <strong>{fileName}</strong>
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            {message}
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Preview
                </h2>

                <p className="text-sm text-slate-500">
                  {rows.length} student row(s) found.
                </p>
              </div>

              <button
                type="button"
                onClick={importStudents}
                disabled={importing || !academicYearId}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import Students'}
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[1100px] text-left text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    {headers.map((header) => (
                      <th
                        key={header}
                        className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.slice(0, 50).map((row, index) => (
                    <tr
                      key={index}
                      className="border-t border-slate-200"
                    >
                      <td className="px-3 py-3">{row.full_name}</td>
                      <td className="px-3 py-3">{row.form}</td>
                      <td className="px-3 py-3">{row.programme}</td>
                      <td className="px-3 py-3">{row.class_name}</td>
                      <td className="px-3 py-3">{row.gender}</td>
                      <td className="px-3 py-3">{row.date_of_birth}</td>
                      <td className="px-3 py-3">{row.guardian_name}</td>
                      <td className="px-3 py-3">{row.guardian_phone}</td>
                      <td className="px-3 py-3">{row.address}</td>
                      <td className="px-3 py-3">{row.admission_date}</td>
                      <td className="px-3 py-3">{row.jhs_aggregate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > 50 && (
              <p className="mt-2 text-xs text-slate-500">
                Showing the first 50 rows in the preview. All {rows.length}{' '}
                rows will be imported.
              </p>
            )}
          </div>
        )}

        {errors.length > 0 && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-semibold text-amber-900">
              Import Notes
            </h2>

            <div className="mt-3 max-h-72 overflow-y-auto space-y-2 text-sm text-amber-800">
              {errors.map((error, index) => (
                <div key={index}>
                  <strong>Excel row {error.row}:</strong>{' '}
                  {error.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  </div>
</main>

);
}

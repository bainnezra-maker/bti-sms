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
    resident: clean(get('RESIDENCE')),
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
  const [schoolId, setSchoolId] = useState('');

  const [loadingData, setLoadingData] = useState(true);
  const [importing, setImporting] = useState(false);

  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<ResultMessage[]>([]);
  const [fileName, setFileName] = useState('');

  const selectedAcademicYear = useMemo(
    () =>
      academicYears.find(
        (year) => year.id === academicYearId
      ),
    [academicYears, academicYearId]
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

    const currentSchoolId = profile.school_id;

    setSchoolId(currentSchoolId);

    const [
      { data: programmeData, error: programmeError },
      { data: yearData, error: yearError },
      { data: classData, error: classError },
    ] = await Promise.all([
      supabase
        .from('programmes')
        .select('id, name')
        .eq('school_id', currentSchoolId)
        .order('name'),

      supabase
        .from('academic_years')
        .select('id, name, start_date')
        .eq('school_id', currentSchoolId)
        .order('start_date', {
          ascending: false,
        }),

      supabase
        .from('classes')
        .select(
          'id, name, level, programme_id, academic_year_id'
        )
        .eq('school_id', currentSchoolId)
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

    const loadedProgrammes = programmeData || [];
    const loadedYears = yearData || [];
    const loadedClasses = classData || [];

    setProgrammes(loadedProgrammes);
    setAcademicYears(loadedYears);
    setClasses(loadedClasses);

    const currentYear = loadedYears.find(
      (year) =>
        normalize(year.name).includes('current')
    );

    if (currentYear) {
      setAcademicYearId(currentYear.id);
    } else if (loadedYears[0]) {
      setAcademicYearId(loadedYears[0].id);
    }

    setLoadingData(false);
  }

  function downloadTemplate() {
    const sample = [
      {
        'FULL NAME': 'John Mensah',
        FORM: 'Form 1',
        PROGRAMME: 'Electrical Engineering',
        CLASS: 'A Class',
        GENDER: 'Male',
        RESIDENCE: 'Boarding',
        'DATE OF BIRTH': '2010-05-12',
        'GUARDIAN NAME': 'Kwame Mensah',
        'GUARDIAN PHONE': '0240000000',
        ADDRESS: 'Accra',
        'ADMISSION DATE': '2026-09-01',
        'JHS AGGREGATE': '18',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(
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

    const workbook = XLSX.utils.book_new();

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
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setMessage('');
    setErrors([]);
    setRows([]);

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(
        buffer,
        {
          type: 'array',
          cellDates: true,
        }
      );

      if (!workbook.SheetNames.length) {
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

      const mappedRows = json.map(mapRow);

      setRows(mappedRows);

      if (!mappedRows.length) {
        setMessage(
          'The selected Excel file contains no student records.'
        );
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
      programmes.find(
        (programme) =>
          normalize(programme.name) ===
          normalize(name)
      ) || null
    );
  }

  function classKey(
    academicYearIdValue: string,
    form: string,
    className: string,
    programmeId: string | null
  ) {
    return [
      academicYearIdValue,
      normalize(form),
      normalize(className),
      programmeId || 'no-programme',
    ].join('|');
  }

  function findExactClass(
    row: ImportRow,
    programmeId: string | null,
    currentClasses: SchoolClass[]
  ) {
    if (!row.class_name) {
      return null;
    }

    const matchingClasses =
      currentClasses.filter(
        (schoolClass) =>
          schoolClass.academic_year_id ===
            academicYearId &&
          normalize(
            schoolClass.name
          ) ===
            normalize(
              row.class_name
            ) &&
          normalize(
            schoolClass.level
          ) ===
            normalize(row.form)
      );

    if (programmeId) {
      const programmeMatch =
        matchingClasses.find(
          (schoolClass) =>
            schoolClass.programme_id ===
            programmeId
        );

      if (programmeMatch) {
        return programmeMatch;
      }
    }

    const genericMatch =
      matchingClasses.find(
        (schoolClass) =>
          !schoolClass.programme_id
      );

    if (genericMatch) {
      return genericMatch;
    }

    return null;
  }

  async function ensureExactClass(
    row: ImportRow,
    programmeId: string | null,
    currentClasses: SchoolClass[]
  ): Promise<{
    schoolClass: SchoolClass | null;
    created: boolean;
    repairedProgramme: boolean;
  }> {
    if (!schoolId || !academicYearId || !row.class_name) {
      return {
        schoolClass: null,
        created: false,
        repairedProgramme: false,
      };
    }

    const localMatch =
      findExactClass(
        row,
        programmeId,
        currentClasses
      );

    if (localMatch) {
      if (
        programmeId &&
        !localMatch.programme_id
      ) {
        const {
          data: updatedClass,
          error: updateClassError,
        } = await supabase
          .from('classes')
          .update({
            programme_id:
              programmeId,
          })
          .eq(
            'id',
            localMatch.id
          )
          .select(
            'id, name, level, programme_id, academic_year_id'
          )
          .single();

        if (
          !updateClassError &&
          updatedClass
        ) {
          const index =
            currentClasses.findIndex(
              (item) =>
                item.id ===
                localMatch.id
            );

          if (index >= 0) {
            currentClasses[index] =
              updatedClass;
          }

          return {
            schoolClass:
              updatedClass,
            created: false,
            repairedProgramme: true,
          };
        }
      }

      return {
        schoolClass: localMatch,
        created: false,
        repairedProgramme: false,
      };
    }

    const {
      data: databaseClasses,
      error: databaseClassError,
    } = await supabase
      .from('classes')
      .select(
        'id, name, level, programme_id, academic_year_id'
      )
      .eq(
        'school_id',
        schoolId
      )
      .eq(
        'academic_year_id',
        academicYearId
      )
      .ilike(
        'name',
        row.class_name
      );

    if (databaseClassError) {
      throw new Error(
        `Could not check class "${row.class_name}": ${databaseClassError.message}`
      );
    }

    const exactDatabaseClasses =
      (databaseClasses || []).filter(
        (schoolClass) =>
          normalize(
            schoolClass.name
          ) ===
            normalize(
              row.class_name
            ) &&
          normalize(
            schoolClass.level
          ) ===
            normalize(row.form)
      );

    if (programmeId) {
      const exactProgrammeClass =
        exactDatabaseClasses.find(
          (schoolClass) =>
            schoolClass.programme_id ===
            programmeId
        );

      if (
        exactProgrammeClass
      ) {
        currentClasses.push(
          exactProgrammeClass
        );

        return {
          schoolClass:
            exactProgrammeClass,
          created: false,
          repairedProgramme: false,
        };
      }
    }

    const genericClass =
      exactDatabaseClasses.find(
        (schoolClass) =>
          !schoolClass.programme_id
      );

    if (
      genericClass &&
      programmeId
    ) {
      const {
        data: updatedClass,
        error: updateError,
      } = await supabase
        .from('classes')
        .update({
          programme_id:
            programmeId,
        })
        .eq(
          'id',
          genericClass.id
        )
        .select(
          'id, name, level, programme_id, academic_year_id'
        )
        .single();

      if (
        updateError ||
        !updatedClass
      ) {
        throw new Error(
          updateError?.message ||
            `Unable to attach programme to class "${row.class_name}".`
        );
      }

      currentClasses.push(
        updatedClass
      );

      return {
        schoolClass:
          updatedClass,
        created: false,
        repairedProgramme: true,
      };
    }

    if (
      genericClass &&
      !programmeId
    ) {
      currentClasses.push(
        genericClass
      );

      return {
        schoolClass:
          genericClass,
        created: false,
        repairedProgramme: false,
      };
    }

    const {
      data: createdClass,
      error: createError,
    } = await supabase
      .from('classes')
      .insert({
        school_id: schoolId,
        programme_id:
          programmeId || null,
        name: row.class_name,
        level: row.form || null,
        academic_year_id:
          academicYearId,
      })
      .select(
        'id, name, level, programme_id, academic_year_id'
      )
      .single();

    if (
      createError ||
      !createdClass
    ) {
      throw new Error(
        createError?.message ||
          `Unable to create class "${row.class_name}".`
      );
    }

    currentClasses.push(
      createdClass
    );

    return {
      schoolClass:
        createdClass,
      created: true,
      repairedProgramme: false,
    };
  }

  async function importStudents() {
    if (!rows.length) {
      setMessage(
        'Please select an Excel file first.'
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
    setMessage('');
    setErrors([]);

    let imported = 0;
    let repaired = 0;
    let enrollmentsCreated = 0;
    let enrollmentsUpdated = 0;
    let classesCreated = 0;
    let skipped = 0;

    const resultErrors: ResultMessage[] = [];

    let workingClasses = [
      ...classes,
    ];

    const uniqueClassRequests =
      new Map<
        string,
        {
          row: ImportRow;
          programmeId: string | null;
        }
      >();

    for (const row of rows) {
      if (!row.class_name) {
        continue;
      }

      const programme =
        findProgramme(
          row.programme
        );

      const key = classKey(
        academicYearId,
        row.form,
        row.class_name,
        programme?.id || null
      );

      if (
        !uniqueClassRequests.has(
          key
        )
      ) {
        uniqueClassRequests.set(
          key,
          {
            row,
            programmeId:
              programme?.id ||
              null,
          }
        );
      }
    }

    for (const [
      ,
      classRequest,
    ] of uniqueClassRequests) {
      try {
        const result =
          await ensureExactClass(
            classRequest.row,
            classRequest.programmeId,
            workingClasses
          );

        if (result.created) {
          classesCreated++;
        }
      } catch (error) {
        resultErrors.push({
          row:
            rows.findIndex(
              (item) =>
                classKey(
                  academicYearId,
                  item.form,
                  item.class_name,
                  findProgramme(
                    item.programme
                  )?.id || null
                ) ===
                classKey(
                  academicYearId,
                  classRequest.row.form,
                  classRequest.row.class_name,
                  classRequest.programmeId
                )
            ) + 2,
          type: 'error',
          message:
            error instanceof Error
              ? error.message
              : `Unable to prepare class "${classRequest.row.class_name}".`,
        });
      }
    }

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row =
        rows[index];

      const excelRowNumber =
        index + 2;

      if (!row.full_name) {
        skipped++;

        resultErrors.push({
          row: excelRowNumber,
          type: 'error',
          message:
            'FULL NAME is required.',
        });

        continue;
      }

      const residentValue =
        normalizeResidence(
          row.resident
        );

      if (
        row.resident &&
        !residentValue
      ) {
        skipped++;

        resultErrors.push({
          row: excelRowNumber,
          type: 'error',
          message:
            'RESIDENCE must be Day or Boarding.',
        });

        continue;
      }

      try {
        const {
          data: existingStudent,
          error: duplicateError,
        } = await supabase
          .from('students')
          .select('id')
          .eq(
            'school_id',
            schoolId
          )
          .ilike(
            'full_name',
            row.full_name
          )
          .limit(1)
          .maybeSingle();

        if (duplicateError) {
          skipped++;

          resultErrors.push({
            row: excelRowNumber,
            type: 'error',
            message:
              `Could not check student: ${duplicateError.message}`,
          });

          continue;
        }

        let studentId: string;

        let isExistingStudent =
          false;

        if (existingStudent) {
          studentId =
            existingStudent.id;

          isExistingStudent =
            true;

          if (residentValue) {
            const {
              error: residenceUpdateError,
            } = await supabase
              .from('students')
              .update({
                resident:
                  residentValue,
              })
              .eq(
                'id',
                studentId
              )
              .eq(
                'school_id',
                schoolId
              );

            if (
              residenceUpdateError
            ) {
              resultErrors.push({
                row: excelRowNumber,
                type: 'error',
                message:
                  `Student exists, but residence could not be updated: ${residenceUpdateError.message}`,
              });

              continue;
            }
          }
        } else {
          const admissionDate =
            row.admission_date ||
            new Date()
              .toISOString()
              .slice(0, 10);

          let jhsAggregate:
            | number
            | null = null;

          if (
            row.jhs_aggregate
          ) {
            const numberValue =
              Number(
                row.jhs_aggregate
              );

            if (
              !Number.isNaN(
                numberValue
              )
            ) {
              jhsAggregate =
                numberValue;
            }
          }

          const studentPayload = {
            school_id:
              schoolId,
            full_name:
              row.full_name,
            date_of_birth:
              row.date_of_birth ||
              null,
            gender:
              row.gender ||
              null,
            resident:
              residentValue ||
              null,
            guardian_name:
              row.guardian_name ||
              null,
            guardian_phone:
              row.guardian_phone ||
              null,
            address:
              row.address ||
              null,
            admission_date:
              admissionDate,
            jhs_aggregate:
              jhsAggregate,
          };

          const {
            data: student,
            error: studentError,
          } = await supabase
            .from('students')
            .insert(
              studentPayload
            )
            .select('id')
            .single();

          if (
            studentError ||
            !student
          ) {
            skipped++;

            resultErrors.push({
              row: excelRowNumber,
              type: 'error',
              message:
                studentError?.message ||
                'Student could not be created.',
            });

            continue;
          }

          studentId =
            student.id;

          imported++;
        }

        const programme =
          findProgramme(
            row.programme
          );

        if (
          row.programme &&
          !programme
        ) {
          resultErrors.push({
            row: excelRowNumber,
            type: 'error',
            message:
              `Programme "${row.programme}" was not found in BTI-SMS. The student was saved, but no enrollment was created.`,
          });

          continue;
        }

        let schoolClass =
          findExactClass(
            row,
            programme?.id ||
              null,
            workingClasses
          );

        if (!schoolClass) {
          if (!row.class_name) {
            resultErrors.push({
              row: excelRowNumber,
              type: 'error',
              message:
                'No CLASS was supplied, so the student could not be assigned to a class.',
            });

            continue;
          }

          const result =
            await ensureExactClass(
              row,
              programme?.id ||
                null,
              workingClasses
            );

          schoolClass =
            result.schoolClass;

          if (result.created) {
            classesCreated++;
          }
        }

        if (!schoolClass) {
          resultErrors.push({
            row: excelRowNumber,
            type: 'error',
            message:
              `Student was saved, but the exact class "${row.class_name}" could not be found or created.`,
          });

          continue;
        }

        const programmeId =
          programme?.id ||
          schoolClass.programme_id ||
          null;

        const enrollmentDate =
          row.admission_date ||
          new Date()
            .toISOString()
            .slice(0, 10);

        const {
          data: existingEnrollment,
          error:
            existingEnrollmentError,
        } = await supabase
          .from('enrollments')
          .select('id')
          .eq(
            'student_id',
            studentId
          )
          .eq(
            'academic_year_id',
            academicYearId
          )
          .limit(1)
          .maybeSingle();

        if (
          existingEnrollmentError
        ) {
          resultErrors.push({
            row: excelRowNumber,
            type: 'error',
            message:
              `Student was saved, but enrollment could not be checked: ${existingEnrollmentError.message}`,
          });

          continue;
        }

        const enrollmentPayload = {
          student_id:
            studentId,
          class_id:
            schoolClass.id,
          academic_year_id:
            academicYearId,
          programme_id:
            programmeId,
          enrollment_date:
            enrollmentDate,
          status: 'active',
        };

        if (existingEnrollment) {
          const {
            error: updateError,
          } = await supabase
            .from('enrollments')
            .update(
              enrollmentPayload
            )
            .eq(
              'id',
              existingEnrollment.id
            );

          if (updateError) {
            resultErrors.push({
              row: excelRowNumber,
              type: 'error',
              message:
                `Student exists, but enrollment could not be updated: ${updateError.message}`,
            });

            continue;
          }

          enrollmentsUpdated++;

          if (
            isExistingStudent
          ) {
            repaired++;
          }
        } else {
          const {
            error: enrollmentError,
          } = await supabase
            .from('enrollments')
            .insert(
              enrollmentPayload
            );

          if (enrollmentError) {
            resultErrors.push({
              row: excelRowNumber,
              type: 'error',
              message:
                `Student was saved, but enrollment could not be created: ${enrollmentError.message}`,
            });

            continue;
          }

          enrollmentsCreated++;

          if (
            isExistingStudent
          ) {
            repaired++;
          }
        }
      } catch (error) {
        skipped++;

        resultErrors.push({
          row: excelRowNumber,
          type: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while importing this student.',
        });
      }
    }

    setErrors(
      resultErrors
    );

    setMessage(
      `Import complete: ${imported} new student(s), ${repaired} existing student(s) repaired, ${classesCreated} new class(es) created, ${enrollmentsCreated} enrollment(s) created, ${enrollmentsUpdated} enrollment(s) updated, ${skipped} row(s) skipped.`
    );

    const {
      data: refreshedClasses,
    } = await supabase
      .from('classes')
      .select(
        'id, name, level, programme_id, academic_year_id'
      )
      .eq(
        'school_id',
        schoolId
      )
      .order('name');

    if (refreshedClasses) {
      setClasses(
        refreshedClasses
      );
    }

    setImporting(false);
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
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
          >
            <i className="fa-solid fa-arrow-left" />
            Back to Students
          </a>

          <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>

              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-700">
                <i className="fa-solid fa-file-import" />
                Student Data Management
              </div>

              <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Bulk Student Import
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                Import multiple students into BTI-SMS
                quickly and accurately using the official
                Excel template.
              </p>

            </div>

            <div className="hidden rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200 md:block">
              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <i className="fa-solid fa-users-rectangle text-lg" />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Import fields
                  </p>
                  <p className="text-lg font-black text-slate-900">
                    {headers.length}
                  </p>
                </div>

              </div>
            </div>

          </div>

        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* =====================================================
              TEMPLATE CARD
          ====================================================== */}
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 lg:col-span-1">

            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                  <i className="fa-solid fa-file-excel text-lg" />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
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
                Use the official BTI-SMS template so your
                Excel columns match the importer exactly.
              </p>

              <button
                type="button"
                onClick={downloadTemplate}
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg"
              >
                <i className="fa-solid fa-download" />
                Download Excel Template
              </button>

              {/* FIELD LIST */}
              <div className="mt-7">

                <div className="flex items-center justify-between">

                  <h3 className="font-black text-slate-900">
                    Excel fields
                  </h3>

                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
                    {headers.length} columns
                  </span>

                </div>

                <div className="mt-3 space-y-1.5">

                  {headers.map(
                    (header, index) => (
                      <div
                        key={header}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                          header === 'RESIDENCE'
                            ? 'bg-blue-50 font-bold text-blue-800 ring-1 ring-blue-200'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >

                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-500">
                          {index + 1}
                        </span>

                        <span className="flex-1">
                          {header}
                        </span>

                        {header === 'RESIDENCE' && (
                          <i className="fa-solid fa-circle-check text-blue-600" />
                        )}

                      </div>
                    )
                  )}

                </div>

              </div>

              {/* RESIDENCE NOTICE */}
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">

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
                      <strong>Day</strong> or{' '}
                      <strong>Boarding</strong>.
                      The value will be saved directly
                      to the student's record.
                    </p>
                  </div>

                </div>

              </div>

              {/* OTHER NOTES */}
              <div className="mt-4 space-y-3">

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex gap-3">

                    <i className="fa-solid fa-circle-info mt-0.5 text-slate-500" />

                    <p className="text-xs leading-5 text-slate-600">
                      Blank optional fields are accepted.
                      FULL NAME is required.
                    </p>

                  </div>
                </div>

                <div className="rounded-2xl bg-emerald-50 p-4">
                  <div className="flex gap-3">

                    <i className="fa-solid fa-location-dot mt-0.5 text-emerald-600" />

                    <p className="text-xs leading-5 text-emerald-800">
                      <strong>Automatic placement:</strong>{' '}
                      FORM + PROGRAMME + CLASS determine
                      the student's exact class.
                    </p>

                  </div>
                </div>

                <div className="rounded-2xl bg-purple-50 p-4">
                  <div className="flex gap-3">

                    <i className="fa-solid fa-layer-group mt-0.5 text-purple-600" />

                    <p className="text-xs leading-5 text-purple-800">
                      A, B, C, D, E and F classes are
                      handled separately.
                    </p>

                  </div>
                </div>

              </div>

            </div>

          </section>

          {/* =====================================================
              UPLOAD CARD
          ====================================================== */}
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 lg:col-span-2">

            <div className="border-b border-slate-200 bg-white p-5">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <i className="fa-solid fa-cloud-arrow-up text-lg" />
                </div>

                <div>

                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Step 2
                  </p>

                  <h2 className="text-lg font-black text-slate-900">
                    Select Academic Year
                  </h2>

                </div>

              </div>

            </div>

            <div className="p-5">

              <select
                value={academicYearId}
                onChange={(event) =>
                  setAcademicYearId(
                    event.target.value
                  )
                }
                disabled={
                  loadingData ||
                  importing
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              >

                <option value="">
                  {loadingData
                    ? 'Loading academic years...'
                    : 'Select academic year'}
                </option>

                {academicYears.map(
                  (year) => (
                    <option
                      key={year.id}
                      value={year.id}
                    >
                      {year.name}
                    </option>
                  )
                )}

              </select>

              {selectedAcademicYear && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">

                  <i className="fa-solid fa-calendar-check text-blue-600" />

                  Students will be enrolled against{' '}
                  <strong className="text-slate-900">
                    {selectedAcademicYear.name}
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
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                      Step 3
                    </p>

                    <h2 className="text-lg font-black text-slate-900">
                      Upload Excel File
                    </h2>
                  </div>

                </div>

                <label className="group flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50/40 p-8 text-center transition duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50">

                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-blue-100 transition duration-200 group-hover:scale-105 group-hover:shadow-md">
                    <i className="fa-solid fa-file-excel text-2xl" />
                  </div>

                  <span className="mt-5 text-base font-black text-slate-800">
                    Choose Excel or CSV file
                  </span>

                  <span className="mt-1 text-xs text-slate-500">
                    .xlsx, .xls or .csv
                  </span>

                  <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm ring-1 ring-slate-200">
                    <i className="fa-solid fa-arrow-up-from-bracket" />
                    Select file
                  </span>

                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={
                      handleFile
                    }
                    disabled={importing}
                    className="hidden"
                  />

                </label>

              </div>

              {/* FILE SELECTED */}
              {fileName && (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <i className="fa-solid fa-file-circle-check" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                      File selected
                    </p>

                    <p className="truncate text-sm font-bold text-emerald-900">
                      {fileName}
                    </p>
                  </div>

                </div>
              )}

              {/* MESSAGE */}
              {message && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">

                  <i className="fa-solid fa-circle-info mt-0.5 text-blue-600" />

                  <span>
                    {message}
                  </span>

                </div>
              )}

              {/* =====================================================
                  PREVIEW
              ====================================================== */}
              {rows.length > 0 && (
                <div className="mt-8">

                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                    <div>

                      <div className="flex items-center gap-2">

                        <h2 className="text-xl font-black text-slate-900">
                          Preview
                        </h2>

                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">
                          {rows.length}
                        </span>

                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        Review the student records before
                        importing them into BTI-SMS.
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
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <i
                        className={
                          importing
                            ? 'fa-solid fa-spinner fa-spin'
                            : 'fa-solid fa-cloud-arrow-up'
                        }
                      />

                      {importing
                        ? 'Importing...'
                        : 'Import Students'}

                    </button>

                  </div>

                  <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">

                    <table className="min-w-[1250px] text-left text-xs">

                      <thead className="bg-slate-100">

                        <tr>

                          {headers.map(
                            (header) => (
                              <th
                                key={
                                  header
                                }
                                className={`whitespace-nowrap px-3 py-3.5 font-black ${
                                  header === 'RESIDENCE'
                                    ? 'bg-blue-50 text-blue-800'
                                    : 'text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">

                                  {header}

                                  {header === 'RESIDENCE' && (
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
                          .slice(0, 50)
                          .map(
                            (
                              row,
                              index
                            ) => (
                              <tr
                                key={
                                  index
                                }
                                className="border-t border-slate-200 transition hover:bg-slate-50"
                              >

                                <td className="px-3 py-3 font-semibold text-slate-800">
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

                  {rows.length > 50 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">

                      <i className="fa-solid fa-eye" />

                      Showing the first 50 rows in the
                      preview. All {rows.length} rows will
                      be imported or repaired.

                    </div>
                  )}

                </div>
              )}

              {/* =====================================================
                  IMPORT NOTES
              ====================================================== */}
              {errors.length > 0 && (
                <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <i className="fa-solid fa-triangle-exclamation" />
                    </div>

                    <div>

                      <h2 className="font-black text-amber-900">
                        Import Notes
                      </h2>

                      <p className="text-xs text-amber-700">
                        Please review the following items.
                      </p>

                    </div>

                  </div>

                  <div className="mt-4 max-h-72 space-y-2 overflow-y-auto text-sm text-amber-800">

                    {errors.map(
                      (
                        error,
                        index
                      ) => (
                        <div
                          key={
                            index
                          }
                          className="rounded-xl bg-white/60 p-3"
                        >
                          <strong>
                            Excel row{' '}
                            {
                              error.row
                            }:
                          </strong>{' '}
                          {
                            error.message
                          }
                        </div>
                      )
                    )}

                  </div>

                </div>
              )}

            </div>

          </section>

        </div>

        {/* =====================================================
            RESIDENCE QUICK GUIDE
        ====================================================== */}
        <section className="mt-6 rounded-3xl bg-slate-900 p-5 text-white shadow-sm md:p-6">

          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

            <div className="flex items-start gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600">
                <i className="fa-solid fa-house-user text-lg" />
              </div>

              <div>

                <h2 className="font-black">
                  Residence quick guide
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
                  The RESIDENCE column is part of the
                  official import template. Enter the
                  student's residence as either Day or
                  Boarding.
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

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}

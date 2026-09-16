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

/*
 * =========================================================
 * NORMALIZE RESIDENCE
 * =========================================================
 *
 * Accepted values:
 *
 * Day
 * Boarding
 *
 * Capitalization does not matter.
 *
 * Examples:
 * day       -> Day
 * DAY       -> Day
 * boarding  -> Boarding
 * BOARDING  -> Boarding
 */
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
    admission_date: excelDateToString(
      get('ADMISSION DATE')
    ),
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

  /*
   * =========================================================
   * LOAD SCHOOL DATA
   * =========================================================
   */
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

    const loadedProgrammes =
      programmeData || [];

    const loadedYears =
      yearData || [];

    const loadedClasses =
      classData || [];

    setProgrammes(loadedProgrammes);
    setAcademicYears(loadedYears);
    setClasses(loadedClasses);

    /*
     * Prefer an academic year marked current.
     */
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

  /*
   * =========================================================
   * DOWNLOAD TEMPLATE
   * =========================================================
   */
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

  /*
   * =========================================================
   * READ EXCEL FILE
   * =========================================================
   */
  async function handleFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setMessage('');
    setErrors([]);
    setRows([]);

    try {
      const buffer =
        await file.arrayBuffer();

      const workbook = XLSX.read(
        buffer,
        {
          type: 'array',
          cellDates: true,
        }
      );

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
      }
    } catch {
      setMessage(
        'Unable to read this file. Please use an Excel (.xlsx/.xls) or CSV file.'
      );
    }

    event.target.value = '';
  }

  /*
   * =========================================================
   * FIND PROGRAMME
   * =========================================================
   */
  function findProgramme(
    name: string
  ) {
    if (!name) return null;

    return (
      programmes.find(
        (programme) =>
          normalize(programme.name) ===
          normalize(name)
      ) || null
    );
  }

  /*
   * =========================================================
   * EXACT CLASS KEY
   * =========================================================
   *
   * THIS IS THE IMPORTANT FIX.
   *
   * A class is identified by:
   *
   * Academic Year
   * + FORM
   * + CLASS
   * + PROGRAMME
   *
   * Example:
   *
   * 2026/2027 + Form 2 + A Class + Wood Construction
   *
   * is different from:
   *
   * 2026/2027 + Form 2 + B Class + Wood Construction
   */
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

  /*
   * =========================================================
   * FIND EXACT CLASS
   * =========================================================
   *
   * IMPORTANT:
   *
   * There is NO fallback to another class.
   *
   * If Excel says B CLASS, we find B CLASS.
   *
   * If B CLASS does not exist, we create B CLASS.
   *
   * We NEVER return A CLASS simply because it has
   * the same FORM and PROGRAMME.
   */
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

    /*
     * First choice:
     * exact programme match.
     */
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

    /*
     * Second choice:
     * exact class/form with no programme.
     *
     * We can safely use this exact class and later
     * attach the programme.
     */
    const genericMatch =
      matchingClasses.find(
        (schoolClass) =>
          !schoolClass.programme_id
      );

    if (genericMatch) {
      return genericMatch;
    }

    /*
     * If a class with the same name/form exists
     * but belongs to another programme, DO NOT use it.
     */
    return null;
  }

  /*
   * =========================================================
   * ENSURE EXACT CLASS EXISTS
   * =========================================================
   *
   * This function guarantees that every distinct
   *
   * FORM + PROGRAMME + CLASS
   *
   * in Excel gets its own class record.
   */
  async function ensureExactClass(
    row: ImportRow,
    programmeId: string | null,
    currentClasses: SchoolClass[]
  ): Promise<{
    schoolClass: SchoolClass | null;
    created: boolean;
    repairedProgramme: boolean;
  }> {
    if (!schoolId) {
      return {
        schoolClass: null,
        created: false,
        repairedProgramme: false,
      };
    }

    if (!academicYearId) {
      return {
        schoolClass: null,
        created: false,
        repairedProgramme: false,
      };
    }

    if (!row.class_name) {
      return {
        schoolClass: null,
        created: false,
        repairedProgramme: false,
      };
    }

    /*
     * -------------------------------------------------------
     * FIRST: SEARCH LOCAL CLASS CACHE
     * -------------------------------------------------------
     */
    const localMatch =
      findExactClass(
        row,
        programmeId,
        currentClasses
      );

    if (localMatch) {
      /*
       * If the exact class exists but has no programme,
       * attach the Excel programme to it.
       */
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

    /*
     * -------------------------------------------------------
     * SECOND: CHECK DATABASE DIRECTLY
     * -------------------------------------------------------
     *
     * This protects us if a class was created by another
     * row during the same import.
     */
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

    /*
     * Exact programme match.
     */
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

    /*
     * Exact class/form with no programme.
     *
     * Attach programme to it instead of creating a
     * duplicate class.
     */
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

    /*
     * If no programme was supplied and an exact generic
     * class exists, use it.
     */
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

    /*
     * -------------------------------------------------------
     * IMPORTANT:
     *
     * If an A CLASS exists but Excel says B CLASS,
     * we reach this point and CREATE B CLASS.
     *
     * We do NOT return A CLASS.
     * -------------------------------------------------------
     */
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

  /*
   * =========================================================
   * IMPORT STUDENTS
   * =========================================================
   */
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

    /*
     * Local class cache.
     *
     * This is very important because when we create
     * A, B, C, D, E or F, later rows must find the
     * correct class instead of another class.
     */
    let workingClasses = [
      ...classes,
    ];

    /*
     * -------------------------------------------------------
     * PRE-CREATE ALL DISTINCT CLASSES FROM EXCEL
     * -------------------------------------------------------
     *
     * This guarantees that if Excel contains:
     *
     * A Class
     * B Class
     * C Class
     * D Class
     * E Class
     * F Class
     *
     * all six classes exist before student enrollment
     * processing begins.
     */
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

    /*
     * Create/repair every distinct class.
     */
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

    /*
     * -------------------------------------------------------
     * PROCESS STUDENTS
     * -------------------------------------------------------
     */
    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row =
        rows[index];

      const excelRowNumber =
        index + 2;

      /*
       * -----------------------------------------------------
       * VALIDATE NAME
       * -----------------------------------------------------
       */
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

      /*
       * -----------------------------------------------------
       * VALIDATE RESIDENCE
       * -----------------------------------------------------
       *
       * Blank residence is allowed for backward
       * compatibility.
       *
       * If supplied, it must be Day or Boarding.
       */
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
        /*
         * ---------------------------------------------------
         * FIND EXISTING STUDENT
         * ---------------------------------------------------
         */
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

        /*
         * ---------------------------------------------------
         * EXISTING STUDENT
         * ---------------------------------------------------
         */
        if (existingStudent) {
          studentId =
            existingStudent.id;

          isExistingStudent =
            true;

          /*
           * -------------------------------------------------
           * UPDATE RESIDENCE FOR EXISTING STUDENT
           * -------------------------------------------------
           *
           * Only update the residence when Excel actually
           * contains a valid value.
           */
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
          /*
           * -------------------------------------------------
           * NEW STUDENT
           * -------------------------------------------------
           */
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

        /*
         * ---------------------------------------------------
         * FIND PROGRAMME
         * ---------------------------------------------------
         */
        const programme =
          findProgramme(
            row.programme
          );

        /*
         * ---------------------------------------------------
         * VALIDATE PROGRAMME
         * ---------------------------------------------------
         */
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

        /*
         * ---------------------------------------------------
         * FIND THE EXACT CLASS
         * ---------------------------------------------------
         *
         * Notice:
         *
         * There is NO FORM + PROGRAMME fallback.
         *
         * The CLASS column is mandatory for placement.
         */
        let schoolClass =
          findExactClass(
            row,
            programme?.id ||
              null,
            workingClasses
          );

        /*
         * ---------------------------------------------------
         * CREATE EXACT CLASS IF MISSING
         * ---------------------------------------------------
         */
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

          /*
           * Normally classes were already prepared above,
           * but this handles any edge case.
           */
          if (result.created) {
            classesCreated++;
          }
        }

        /*
         * If still missing, stop this row.
         */
        if (!schoolClass) {
          resultErrors.push({
            row: excelRowNumber,
            type: 'error',
            message:
              `Student was saved, but the exact class "${row.class_name}" could not be found or created.`,
          });

          continue;
        }

        /*
         * ---------------------------------------------------
         * DETERMINE PROGRAMME
         * ---------------------------------------------------
         */
        const programmeId =
          programme?.id ||
          schoolClass.programme_id ||
          null;

        /*
         * ---------------------------------------------------
         * ENROLLMENT DATE
         * ---------------------------------------------------
         */
        const enrollmentDate =
          row.admission_date ||
          new Date()
            .toISOString()
            .slice(0, 10);

        /*
         * ---------------------------------------------------
         * FIND EXISTING ENROLLMENT
         * ---------------------------------------------------
         */
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

        /*
         * ---------------------------------------------------
         * ENROLLMENT PAYLOAD
         * ---------------------------------------------------
         */
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

        /*
         * ---------------------------------------------------
         * UPDATE EXISTING ENROLLMENT
         * ---------------------------------------------------
         */
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
          /*
           * -------------------------------------------------
           * CREATE ENROLLMENT
           * -------------------------------------------------
           */
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

    /*
     * -------------------------------------------------------
     * FINAL RESULT
     * -------------------------------------------------------
     */
    setErrors(
      resultErrors
    );

    setMessage(
      `Import complete: ${imported} new student(s), ${repaired} existing student(s) repaired, ${classesCreated} new class(es) created, ${enrollmentsCreated} enrollment(s) created, ${enrollmentsUpdated} enrollment(s) updated, ${skipped} row(s) skipped.`
    );

    /*
     * Refresh classes from database.
     */
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
            Upload many students from Excel or CSV
            instead of entering them one by one.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* =====================================================
              TEMPLATE
          ====================================================== */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-1">

            <h2 className="text-lg font-semibold text-slate-900">
              1. Download Template
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Use the official BTI-SMS template so
              your columns match the importer.
            </p>

            <button
              type="button"
              onClick={
                downloadTemplate
              }
              className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Download Excel Template
            </button>

            <div className="mt-6">

              <h3 className="font-semibold text-slate-900">
                Excel fields
              </h3>

              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {headers.map(
                  (header) => (
                    <li key={header}>
                      • {header}
                    </li>
                  )
                )}
              </ul>

            </div>

            <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
              Blank optional fields are accepted.
              FULL NAME is required. If ADMISSION
              DATE is blank, today's date will be used.
            </div>

            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              <strong>
                Residence:
              </strong>{' '}
              Use only <strong>Day</strong> or{' '}
              <strong>Boarding</strong>. This
              information is saved to the student's
              record.
            </div>

            <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              <strong>
                Automatic placement:
              </strong>{' '}
              FORM + PROGRAMME + CLASS from your
              Excel file determine the student's
              exact class.
            </div>

            <div className="mt-4 rounded-xl bg-purple-50 p-4 text-sm text-purple-800">
              <strong>
                Multiple classes supported:
              </strong>{' '}
              If your Excel contains A, B, C, D,
              E and F classes, BTI-SMS will create
              or reuse all six classes separately.
            </div>

          </section>

          {/* =====================================================
              UPLOAD
          ====================================================== */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2">

            <h2 className="text-lg font-semibold text-slate-900">
              2. Select Academic Year
            </h2>

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
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
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
              <p className="mt-2 text-xs text-slate-500">
                Students will be enrolled against{' '}
                <strong>
                  {
                    selectedAcademicYear.name
                  }
                </strong>
                .
              </p>
            )}

            <h2 className="mt-8 text-lg font-semibold text-slate-900">
              3. Upload Excel File
            </h2>

            <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-blue-400 hover:bg-blue-50">

              <span className="text-4xl">
                📊
              </span>

              <span className="mt-3 font-semibold text-slate-800">
                Choose Excel or CSV file
              </span>

              <span className="mt-1 text-xs text-slate-500">
                .xlsx, .xls or .csv
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

            {fileName && (
              <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
                Selected file:{' '}
                <strong>
                  {fileName}
                </strong>
              </div>
            )}

            {message && (
              <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                {message}
              </div>
            )}

            {/* =====================================================
                PREVIEW
            ====================================================== */}
            {rows.length > 0 && (
              <div className="mt-8">

                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Preview
                    </h2>

                    <p className="text-sm text-slate-500">
                      {rows.length}{' '}
                      student row(s)
                      found.
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
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {importing
                      ? 'Importing...'
                      : 'Import Students'}
                  </button>

                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">

                  <table className="min-w-[1200px] text-left text-xs">

                    <thead className="bg-slate-100">

                      <tr>

                        {headers.map(
                          (header) => (
                            <th
                              key={
                                header
                              }
                              className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700"
                            >
                              {header}
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
                              className="border-t border-slate-200"
                            >

                              <td className="px-3 py-3">
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

                              <td className="px-3 py-3">
                                {row.resident ? (
                                  <span
                                    className={
                                      normalizeResidence(
                                        row.resident
                                      ) ===
                                      'Boarding'
                                        ? 'inline-flex rounded-full bg-purple-100 px-2.5 py-1 font-semibold text-purple-700'
                                        : 'inline-flex rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700'
                                    }
                                  >
                                    {
                                      normalizeResidence(
                                        row.resident
                                      )
                                    }
                                  </span>
                                ) : (
                                  '—'
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
                  <p className="mt-2 text-xs text-slate-500">
                    Showing the first 50 rows in
                    the preview. All {rows.length}{' '}
                    rows will be imported/repaired.
                  </p>
                )}

              </div>
            )}

            {/* =====================================================
                IMPORT NOTES
            ====================================================== */}
            {errors.length > 0 && (
              <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">

                <h2 className="font-semibold text-amber-900">
                  Import Notes
                </h2>

                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm text-amber-800">

                  {errors.map(
                    (
                      error,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
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

          </section>

        </div>
      </div>
    </main>
  );
}

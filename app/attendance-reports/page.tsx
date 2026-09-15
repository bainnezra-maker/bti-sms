'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

type AcademicYear = {
  id: string;
  name: string;
  is_current: boolean;
};

type Term = {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

type Programme = {
  id: string;
  name: string;
  code: string | null;
};

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
  academic_year_id: string | null;
};

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
};

type AttendanceRecord = {
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
};

type StudentReport = {
  student: Student;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attended: number;
  percentage: number;
};

function formatDate(date: string | null) {
  if (!date) return '—';

  return new Date(`${date}T00:00:00`).toLocaleDateString(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  );
}

function percentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function statusLabel(status: string) {
  switch (status) {
    case 'present':
      return 'Present';
    case 'absent':
      return 'Absent';
    case 'late':
      return 'Late';
    case 'excused':
      return 'Excused';
    default:
      return status;
  }
}

export default function AttendanceReportsPage() {
  const supabase = createClient();

  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);

  const [terms, setTerms] = useState<Term[]>([]);

  const [programmes, setProgrammes] = useState<
    Programme[]
  >([]);

  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [students, setStudents] = useState<Student[]>([]);

  const [attendance, setAttendance] = useState<
    AttendanceRecord[]
  >([]);

  const [selectedYear, setSelectedYear] = useState('');

  const [selectedTerm, setSelectedTerm] = useState('');

  const [selectedProgramme, setSelectedProgramme] =
    useState('');

  const [selectedClass, setSelectedClass] = useState('');

  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);

  const [loadingReport, setLoadingReport] =
    useState(false);

  const [exporting, setExporting] = useState(false);

  const [message, setMessage] = useState('');

  /*
   * LOAD SCHOOL SETUP
   */
  useEffect(() => {
    async function loadSetup() {
      setLoading(true);
      setMessage('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage('You are not logged in.');
        setLoading(false);
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.school_id) {
        setMessage(
          'Could not determine your school.'
        );
        setLoading(false);
        return;
      }

      setSchoolId(profile.school_id);

      const [
        academicYearsResult,
        programmesResult,
        classesResult,
      ] = await Promise.all([
        supabase
          .from('academic_years')
          .select(
            'id, name, is_current'
          )
          .eq(
            'school_id',
            profile.school_id
          )
          .order('start_date', {
            ascending: false,
          }),

        supabase
          .from('programmes')
          .select(
            'id, name, code'
          )
          .eq(
            'school_id',
            profile.school_id
          )
          .order('name'),

        supabase
          .from('classes')
          .select(
            'id, name, level, programme_id, academic_year_id'
          )
          .eq(
            'school_id',
            profile.school_id
          )
          .order('name'),
      ]);

      if (academicYearsResult.error) {
        setMessage(
          academicYearsResult.error.message
        );
      }

      if (programmesResult.error) {
        setMessage(
          programmesResult.error.message
        );
      }

      if (classesResult.error) {
        setMessage(
          classesResult.error.message
        );
      }

      const years =
        academicYearsResult.data || [];

      setAcademicYears(years);

      setProgrammes(
        programmesResult.data || []
      );

      setClasses(
        classesResult.data || []
      );

      const currentYear =
        years.find(
          (year) => year.is_current
        ) || years[0];

      if (currentYear) {
        setSelectedYear(currentYear.id);
      }

      setLoading(false);
    }

    loadSetup();
  }, []);

  /*
   * LOAD TERMS
   */
  useEffect(() => {
    async function loadTerms() {
      if (!selectedYear) {
        setTerms([]);
        setSelectedTerm('');
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from('terms')
        .select(
          `
            id,
            academic_year_id,
            name,
            start_date,
            end_date,
            is_current
          `
        )
        .eq(
          'academic_year_id',
          selectedYear
        )
        .order('start_date');

      if (error) {
        setMessage(
          `Could not load terms: ${error.message}`
        );
        return;
      }

      const loadedTerms = data || [];

      setTerms(loadedTerms);

      const currentTerm =
        loadedTerms.find(
          (term) => term.is_current
        ) || loadedTerms[0];

      setSelectedTerm(
        currentTerm?.id || ''
      );
    }

    loadTerms();
  }, [selectedYear]);

  /*
   * AVAILABLE CLASSES
   */
  const filteredClasses = useMemo(() => {
    return classes.filter((item) => {
      const matchesYear =
        !item.academic_year_id ||
        item.academic_year_id ===
          selectedYear;

      const matchesProgramme =
        !selectedProgramme ||
        item.programme_id ===
          selectedProgramme;

      return (
        matchesYear &&
        matchesProgramme
      );
    });
  }, [
    classes,
    selectedYear,
    selectedProgramme,
  ]);

  /*
   * CLEAR INVALID PROGRAMME/CLASS
   */
  useEffect(() => {
    if (!selectedYear) return;

    const yearClasses =
      classes.filter(
        (item) =>
          !item.academic_year_id ||
          item.academic_year_id ===
            selectedYear
      );

    if (
      selectedProgramme &&
      !yearClasses.some(
        (item) =>
          item.programme_id ===
          selectedProgramme
      )
    ) {
      setSelectedProgramme('');
      setSelectedClass('');
    }
  }, [
    selectedYear,
    selectedProgramme,
    classes,
  ]);

  /*
   * LOAD ATTENDANCE REPORT
   */
  useEffect(() => {
    async function loadReport() {
      if (
        !schoolId ||
        !selectedYear ||
        !selectedTerm ||
        !selectedClass
      ) {
        setStudents([]);
        setAttendance([]);
        return;
      }

      setLoadingReport(true);
      setMessage('');

      const selectedTermData =
        terms.find(
          (term) =>
            term.id === selectedTerm
        );

      /*
       * ACTIVE STUDENTS IN CLASS
       */
      const {
        data: enrollmentData,
        error: enrollmentError,
      } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq(
          'class_id',
          selectedClass
        )
        .eq(
          'academic_year_id',
          selectedYear
        )
        .eq(
          'status',
          'active'
        );

      if (enrollmentError) {
        setMessage(
          `Could not load class students: ${enrollmentError.message}`
        );

        setLoadingReport(false);
        return;
      }

      const studentIds =
        (enrollmentData || []).map(
          (item) => item.student_id
        );

      if (studentIds.length === 0) {
        setStudents([]);
        setAttendance([]);

        setMessage(
          'There are no active students enrolled in this class.'
        );

        setLoadingReport(false);
        return;
      }

      /*
       * STUDENTS
       */
      const {
        data: studentData,
        error: studentError,
      } = await supabase
        .from('students')
        .select(
          `
            id,
            full_name,
            admission_number
          `
        )
        .in(
          'id',
          studentIds
        )
        .eq(
          'school_id',
          schoolId
        )
        .eq(
          'status',
          'active'
        )
        .order('full_name');

      if (studentError) {
        setMessage(
          `Could not load students: ${studentError.message}`
        );

        setLoadingReport(false);
        return;
      }

      setStudents(
        studentData || []
      );

      /*
       * ATTENDANCE RECORDS
       */
      let attendanceQuery =
        supabase
          .from('attendance')
          .select(
            `
              student_id,
              date,
              status
            `
          )
          .in(
            'student_id',
            studentIds
          )
          .eq(
            'class_id',
            selectedClass
          )
          .order('date', {
            ascending: false,
          });

      if (
        selectedTermData?.start_date
      ) {
        attendanceQuery =
          attendanceQuery.gte(
            'date',
            selectedTermData.start_date
          );
      }

      if (
        selectedTermData?.end_date
      ) {
        attendanceQuery =
          attendanceQuery.lte(
            'date',
            selectedTermData.end_date
          );
      }

      const {
        data: attendanceData,
        error: attendanceError,
      } =
        await attendanceQuery;

      if (attendanceError) {
        setMessage(
          `Could not load attendance: ${attendanceError.message}`
        );

        setLoadingReport(false);
        return;
      }

      setAttendance(
        attendanceData || []
      );

      setLoadingReport(false);
    }

    loadReport();
  }, [
    schoolId,
    selectedYear,
    selectedTerm,
    selectedClass,
    terms,
  ]);

  /*
   * STUDENT REPORTS
   */
  const reports = useMemo(() => {
    return students.map(
      (student): StudentReport => {
        const records =
          attendance.filter(
            (record) =>
              record.student_id ===
              student.id
          );

        const present =
          records.filter(
            (record) =>
              record.status ===
              'present'
          ).length;

        const absent =
          records.filter(
            (record) =>
              record.status ===
              'absent'
          ).length;

        const late =
          records.filter(
            (record) =>
              record.status ===
              'late'
          ).length;

        const excused =
          records.filter(
            (record) =>
              record.status ===
              'excused'
          ).length;

        const total =
          records.length;

        const attended =
          present + late;

        const attendancePercentage =
          total > 0
            ? (attended / total) * 100
            : 0;

        return {
          student,
          total,
          present,
          absent,
          late,
          excused,
          attended,
          percentage:
            attendancePercentage,
        };
      }
    );
  }, [
    students,
    attendance,
  ]);

  /*
   * SEARCH
   */
  const filteredReports =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return reports;
      }

      return reports.filter(
        (report) =>
          report.student.full_name
            .toLowerCase()
            .includes(query) ||
          report.student.admission_number
            .toLowerCase()
            .includes(query)
      );
    }, [
      reports,
      search,
    ]);

  /*
   * CLASS STATISTICS
   */
  const classSummary =
    useMemo(() => {
      const totalStudents =
        reports.length;

      const totalPresent =
        reports.reduce(
          (sum, report) =>
            sum + report.present,
          0
        );

      const totalAbsent =
        reports.reduce(
          (sum, report) =>
            sum + report.absent,
          0
        );

      const totalLate =
        reports.reduce(
          (sum, report) =>
            sum + report.late,
          0
        );

      const totalExcused =
        reports.reduce(
          (sum, report) =>
            sum + report.excused,
          0
        );

      const totalRecorded =
        reports.reduce(
          (sum, report) =>
            sum + report.total,
          0
        );

      const totalAttended =
        totalPresent +
        totalLate;

      const overallPercentage =
        totalRecorded > 0
          ? (totalAttended /
              totalRecorded) *
            100
          : 0;

      const absentPercentage =
        totalRecorded > 0
          ? (totalAbsent /
              totalRecorded) *
            100
          : 0;

      const latePercentage =
        totalRecorded > 0
          ? (totalLate /
              totalRecorded) *
            100
          : 0;

      const excusedPercentage =
        totalRecorded > 0
          ? (totalExcused /
              totalRecorded) *
            100
          : 0;

      return {
        totalStudents,
        totalPresent,
        totalAbsent,
        totalLate,
        totalExcused,
        totalRecorded,
        totalAttended,
        overallPercentage,
        absentPercentage,
        latePercentage,
        excusedPercentage,
      };
    }, [reports]);

  /*
   * SELECTED DATA
   */
  const selectedYearData =
    academicYears.find(
      (year) =>
        year.id === selectedYear
    );

  const selectedTermData =
    terms.find(
      (term) =>
        term.id === selectedTerm
    );

  const selectedClassData =
    classes.find(
      (item) =>
        item.id === selectedClass
    );

  const reportProgrammeId =
    selectedClassData?.programme_id ||
    selectedProgramme;

  const selectedProgrammeData =
    programmes.find(
      (programme) =>
        programme.id ===
        reportProgrammeId
    );

  /*
   * TOP STUDENTS
   */
  const topStudents = useMemo(() => {
    return [...reports]
      .filter(
        (report) =>
          report.total > 0
      )
      .sort(
        (a, b) =>
          b.percentage -
          a.percentage
      )
      .slice(0, 5);
  }, [reports]);

  /*
   * EXCEL EXPORT
   */
  async function exportToExcel() {
    if (
      !selectedClass ||
      !selectedTerm ||
      attendance.length === 0
    ) {
      setMessage(
        'There is no attendance information available to export.'
      );
      return;
    }

    setExporting(true);
    setMessage('');

    try {
      const className =
        selectedClassData?.name ||
        'Class';

      const yearName =
        selectedYearData?.name ||
        'Academic Year';

      const termName =
        selectedTermData?.name ||
        'Term';

      const programmeName =
        selectedProgrammeData?.name ||
        'All Programmes';

      const summaryRows =
        reports.map(
          (report, index) => ({
            No: index + 1,
            'Student Name':
              report.student.full_name,
            'Admission Number':
              report.student.admission_number,
            'Days Recorded':
              report.total,
            Present:
              report.present,
            Late:
              report.late,
            Absent:
              report.absent,
            Excused:
              report.excused,
            Attended:
              report.attended,
            'Attendance %':
              Number(
                report.percentage.toFixed(
                  1
                )
              ),
          })
        );

      const studentMap =
        new Map(
          students.map(
            (student) => [
              student.id,
              student,
            ]
          )
        );

      const recordRows =
        attendance.map(
          (record, index) => {
            const student =
              studentMap.get(
                record.student_id
              );

            return {
              No: index + 1,
              Date: record.date,
              'Student Name':
                student?.full_name ||
                'Unknown Student',
              'Admission Number':
                student?.admission_number ||
                '',
              Status:
                statusLabel(
                  record.status
                ),
              'Academic Year':
                yearName,
              Term:
                termName,
              Programme:
                programmeName,
              Class:
                className,
            };
          }
        );

      const workbook =
        XLSX.utils.book_new();

      /*
       * SUMMARY SHEET
       */
      const summarySheetData = [
        ['BTI SCHOOL MANAGEMENT SYSTEM'],
        ['CLASS ATTENDANCE REPORT'],
        [],
        ['Academic Year', yearName],
        ['Term', termName],
        ['Programme', programmeName],
        ['Class', className],
        [
          'Term Start',
          selectedTermData?.start_date ||
            '',
        ],
        [
          'Term End',
          selectedTermData?.end_date ||
            '',
        ],
        [],
        ['CLASS STATISTICS'],
        [
          'Total Students',
          classSummary.totalStudents,
        ],
        [
          'Total Present',
          classSummary.totalPresent,
        ],
        [
          'Total Late',
          classSummary.totalLate,
        ],
        [
          'Total Absent',
          classSummary.totalAbsent,
        ],
        [
          'Total Excused',
          classSummary.totalExcused,
        ],
        [
          'Total Attendance Records',
          classSummary.totalRecorded,
        ],
        [
          'Total Attended',
          classSummary.totalAttended,
        ],
        [
          'Overall Attendance %',
          Number(
            classSummary.overallPercentage.toFixed(
              1
            )
          ),
        ],
        [],
        ['STUDENT ATTENDANCE SUMMARY'],
        [
          'No',
          'Student Name',
          'Admission Number',
          'Days Recorded',
          'Present',
          'Late',
          'Absent',
          'Excused',
          'Attended',
          'Attendance %',
        ],
        ...summaryRows.map(
          (row) => [
            row.No,
            row['Student Name'],
            row['Admission Number'],
            row['Days Recorded'],
            row.Present,
            row.Late,
            row.Absent,
            row.Excused,
            row.Attended,
            row['Attendance %'],
          ]
        ),
      ];

      const summarySheet =
        XLSX.utils.aoa_to_sheet(
          summarySheetData
        );

      summarySheet['!cols'] = [
        { wch: 8 },
        { wch: 30 },
        { wch: 20 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 16 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        summarySheet,
        'Attendance Summary'
      );

      /*
       * DETAILED RECORDS SHEET
       */
      const recordsSheet =
        XLSX.utils.json_to_sheet(
          recordRows
        );

      recordsSheet['!cols'] = [
        { wch: 8 },
        { wch: 15 },
        { wch: 30 },
        { wch: 20 },
        { wch: 15 },
        { wch: 18 },
        { wch: 18 },
        { wch: 28 },
        { wch: 20 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        recordsSheet,
        'Attendance Records'
      );

      /*
       * SAFE FILE NAME
       */
      const safeClassName =
        className
          .replace(
            /[^a-zA-Z0-9-_]+/g,
            '-'
          )
          .replace(
            /^-+|-+$/g,
            ''
          );

      const safeYearName =
        yearName
          .replace(
            /[^a-zA-Z0-9-_]+/g,
            '-'
          )
          .replace(
            /^-+|-+$/g,
            ''
          );

      const safeTermName =
        termName
          .replace(
            /[^a-zA-Z0-9-_]+/g,
            '-'
          )
          .replace(
            /^-+|-+$/g,
            ''
          );

      const filename =
        `BTI-Attendance-${safeClassName}-${safeYearName}-${safeTermName}.xlsx`;

      XLSX.writeFile(
        workbook,
        filename
      );
    } catch (error) {
      console.error(
        'Attendance export error:',
        error
      );

      setMessage(
        'Could not export the attendance report to Excel.'
      );
    } finally {
      setExporting(false);
    }
  }

  /*
   * LOADING SCREEN
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">

        <div className="mx-auto max-w-7xl">

          <div className="mb-6 animate-pulse rounded-3xl bg-white p-6 shadow-sm">

            <div className="flex items-center gap-4">

              <div className="h-14 w-14 rounded-2xl bg-slate-200" />

              <div className="flex-1">

                <div className="h-5 w-56 rounded bg-slate-200" />

                <div className="mt-2 h-4 w-80 rounded bg-slate-100" />

              </div>

            </div>

          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="h-36 animate-pulse rounded-2xl bg-white shadow-sm"
                />
              )
            )}

          </div>

          <div className="mt-6 h-80 animate-pulse rounded-2xl bg-white shadow-sm" />

        </div>

      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 print:bg-white print:p-0">

        <div className="mx-auto max-w-7xl">

          {/* =======================================================
              PREMIUM HEADER
          ======================================================= */}

          <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 text-white shadow-xl sm:p-7 print:hidden">

            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-500/10 blur-2xl" />

            <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-start gap-4">

                <div className="group flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-lg backdrop-blur-sm">

                  <i className="fa-solid fa-chart-line text-2xl text-cyan-300 transition duration-500 group-hover:scale-110 group-hover:rotate-6" />

                </div>

                <div>

                  <div className="flex flex-wrap items-center gap-2">

                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                      Attendance Analytics
                    </h1>

                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      <i className="fa-solid fa-lock mr-1" />
                      Read Only
                    </span>

                  </div>

                  <p className="mt-2 max-w-2xl text-sm text-slate-300">
                    Monitor class attendance performance,
                    identify patterns and generate official
                    attendance reports.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">

                    <span>
                      <i className="fa-solid fa-database mr-1 text-blue-300" />
                      Live school records
                    </span>

                    <span>
                      <i className="fa-solid fa-file-excel mr-1 text-emerald-300" />
                      Excel export
                    </span>

                    <span>
                      <i className="fa-solid fa-print mr-1 text-cyan-300" />
                      Printable report
                    </span>

                  </div>

                </div>

              </div>

              <div className="flex flex-wrap gap-2">

                <button
                  onClick={() =>
                    window.print()
                  }
                  disabled={
                    !selectedClass ||
                    reports.length === 0
                  }
                  className="group rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fa-solid fa-print mr-2 transition-transform duration-300 group-hover:scale-110" />
                  Print
                </button>

                <button
                  onClick={exportToExcel}
                  disabled={
                    !selectedClass ||
                    attendance.length === 0 ||
                    exporting
                  }
                  className="group rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition duration-300 hover:-translate-y-0.5 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fa-solid fa-file-excel mr-2 transition-transform duration-300 group-hover:scale-110" />

                  {exporting
                    ? 'Preparing...'
                    : 'Excel Export'}
                </button>

              </div>

            </div>

          </div>

          {/* =======================================================
              FILTER PANEL
          ======================================================= */}

          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 print:hidden">

            <div className="mb-5 flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <i className="fa-solid fa-sliders text-sm" />
              </div>

              <div>

                <h2 className="font-bold text-slate-900">
                  Report Filters
                </h2>

                <p className="text-xs text-slate-500">
                  Choose the academic period and class to analyse.
                </p>

              </div>

            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

              {/* Academic Year */}
              <div>

                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Academic Year
                </label>

                <div className="relative">

                  <i className="fa-solid fa-calendar-days pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(
                        e.target.value
                      );
                      setSelectedClass('');
                    }}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-9 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">
                      Select academic year
                    </option>

                    {academicYears.map(
                      (year) => (
                        <option
                          key={year.id}
                          value={year.id}
                        >
                          {year.name}
                          {year.is_current
                            ? ' — Current'
                            : ''}
                        </option>
                      )
                    )}

                  </select>

                  <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />

                </div>

              </div>

              {/* Term */}
              <div>

                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Term
                </label>

                <div className="relative">

                  <i className="fa-solid fa-layer-group pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                  <select
                    value={selectedTerm}
                    onChange={(e) =>
                      setSelectedTerm(
                        e.target.value
                      )
                    }
                    disabled={
                      !selectedYear
                    }
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-9 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      Select term
                    </option>

                    {terms.map(
                      (term) => (
                        <option
                          key={term.id}
                          value={term.id}
                        >
                          {term.name}
                          {term.is_current
                            ? ' — Current'
                            : ''}
                        </option>
                      )
                    )}

                  </select>

                  <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />

                </div>

              </div>

              {/* Programme */}
              <div>

                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Programme
                </label>

                <div className="relative">

                  <i className="fa-solid fa-graduation-cap pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                  <select
                    value={
                      selectedProgramme
                    }
                    onChange={(e) => {
                      setSelectedProgramme(
                        e.target.value
                      );
                      setSelectedClass('');
                    }}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-9 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">
                      All programmes
                    </option>

                    {programmes.map(
                      (programme) => (
                        <option
                          key={programme.id}
                          value={programme.id}
                        >
                          {programme.name}
                          {programme.code
                            ? ` (${programme.code})`
                            : ''}
                        </option>
                      )
                    )}

                  </select>

                  <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />

                </div>

              </div>

              {/* Class */}
              <div>

                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Class
                </label>

                <div className="relative">

                  <i className="fa-solid fa-users-rectangle pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                  <select
                    value={selectedClass}
                    onChange={(e) =>
                      setSelectedClass(
                        e.target.value
                      )
                    }
                    disabled={
                      !selectedYear
                    }
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-9 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      Select class
                    </option>

                    {filteredClasses.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                          {item.level
                            ? ` — ${item.level}`
                            : ''}
                        </option>
                      )
                    )}

                  </select>

                  <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />

                </div>

              </div>

            </div>

          </div>

          {/* =======================================================
              ANALYTICS CONTENT
          ======================================================= */}

          {selectedClass ? (

            <div className="space-y-6">

              {/* ===================================================
                  STATISTIC CARDS
              =================================================== */}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                {/* Students */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">

                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-50 transition duration-500 group-hover:scale-150" />

                  <div className="relative flex items-start justify-between">

                    <div>

                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Total Students
                      </p>

                      <p className="mt-2 text-3xl font-black text-slate-900">
                        {classSummary.totalStudents}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Active students in class
                      </p>

                    </div>

                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm transition duration-500 group-hover:scale-110 group-hover:rotate-6">

                      <i className="fa-solid fa-users text-lg" />

                    </div>

                  </div>

                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">

                    <div className="h-full w-full rounded-full bg-blue-500 transition-all duration-1000" />

                  </div>

                </div>

                {/* Present */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">

                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-50 transition duration-500 group-hover:scale-150" />

                  <div className="relative flex items-start justify-between">

                    <div>

                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Present
                      </p>

                      <p className="mt-2 text-3xl font-black text-emerald-600">
                        {classSummary.totalPresent}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Attendance marked present
                      </p>

                    </div>

                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-sm transition duration-500 group-hover:scale-110 group-hover:rotate-6">

                      <i className="fa-solid fa-circle-check text-lg" />

                    </div>

                  </div>

                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">

                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
                      style={{
                        width: `${Math.min(
                          100,
                          classSummary.totalRecorded > 0
                            ? (classSummary.totalPresent /
                                classSummary.totalRecorded) *
                                100
                            : 0
                        )}%`,
                      }}
                    />

                  </div>

                </div>

                {/* Absent */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">

                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-rose-50 transition duration-500 group-hover:scale-150" />

                  <div className="relative flex items-start justify-between">

                    <div>

                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Absent
                      </p>

                      <p className="mt-2 text-3xl font-black text-rose-600">
                        {classSummary.totalAbsent}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Attendance marked absent
                      </p>

                    </div>

                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-sm transition duration-500 group-hover:scale-110 group-hover:rotate-6">

                      <i className="fa-solid fa-circle-xmark text-lg" />

                    </div>

                  </div>

                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">

                    <div
                      className="h-full rounded-full bg-rose-500 transition-all duration-1000"
                      style={{
                        width: `${Math.min(
                          100,
                          classSummary.absentPercentage
                        )}%`,
                      }}
                    />

                  </div>

                </div>

                {/* Overall */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">

                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-50 transition duration-500 group-hover:scale-150" />

                  <div className="relative flex items-start justify-between">

                    <div>

                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Attendance Rate
                      </p>

                      <p className="mt-2 text-3xl font-black text-violet-600">
                        {percentage(
                          classSummary.overallPercentage
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Present + Late
                      </p>

                    </div>

                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600 shadow-sm transition duration-500 group-hover:scale-110 group-hover:rotate-6">

                      <i className="fa-solid fa-chart-pie text-lg" />

                    </div>

                  </div>

                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">

                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-1000"
                      style={{
                        width: `${Math.min(
                          100,
                          classSummary.overallPercentage
                        )}%`,
                      }}
                    />

                  </div>

                </div>

              </div>

              {/* ===================================================
                  MAIN ANALYTICS
              =================================================== */}

              <div className="grid gap-6 lg:grid-cols-3">

                {/* Attendance performance */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">

                  <div className="mb-6 flex items-center justify-between">

                    <div className="flex items-center gap-3">

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">

                        <i className="fa-solid fa-chart-column" />

                      </div>

                      <div>

                        <h2 className="font-bold text-slate-900">
                          Attendance Performance
                        </h2>

                        <p className="text-xs text-slate-500">
                          Distribution of recorded attendance
                        </p>

                      </div>

                    </div>

                    <div className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 sm:block">
                      <i className="fa-solid fa-database mr-1" />
                      {classSummary.totalRecorded} records
                    </div>

                  </div>

                  <div className="space-y-5">

                    {/* Present */}
                    <div>

                      <div className="mb-2 flex items-center justify-between">

                        <div className="flex items-center gap-2">

                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

                          <span className="text-sm font-semibold text-slate-700">
                            Present
                          </span>

                        </div>

                        <span className="text-sm font-bold text-slate-900">
                          {classSummary.totalPresent}
                        </span>

                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">

                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
                          style={{
                            width: `${Math.min(
                              100,
                              classSummary.totalRecorded > 0
                                ? (classSummary.totalPresent /
                                    classSummary.totalRecorded) *
                                    100
                                : 0
                            )}%`,
                          }}
                        />

                      </div>

                    </div>

                    {/* Late */}
                    <div>

                      <div className="mb-2 flex items-center justify-between">

                        <div className="flex items-center gap-2">

                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />

                          <span className="text-sm font-semibold text-slate-700">
                            Late
                          </span>

                        </div>

                        <span className="text-sm font-bold text-slate-900">
                          {classSummary.totalLate}
                        </span>

                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">

                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-1000"
                          style={{
                            width: `${Math.min(
                              100,
                              classSummary.latePercentage
                            )}%`,
                          }}
                        />

                      </div>

                    </div>

                    {/* Absent */}
                    <div>

                      <div className="mb-2 flex items-center justify-between">

                        <div className="flex items-center gap-2">

                          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />

                          <span className="text-sm font-semibold text-slate-700">
                            Absent
                          </span>

                        </div>

                        <span className="text-sm font-bold text-slate-900">
                          {classSummary.totalAbsent}
                        </span>

                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">

                        <div
                          className="h-full rounded-full bg-rose-500 transition-all duration-1000"
                          style={{
                            width: `${Math.min(
                              100,
                              classSummary.absentPercentage
                            )}%`,
                          }}
                        />

                      </div>

                    </div>

                    {/* Excused */}
                    <div>

                      <div className="mb-2 flex items-center justify-between">

                        <div className="flex items-center gap-2">

                          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />

                          <span className="text-sm font-semibold text-slate-700">
                            Excused
                          </span>

                        </div>

                        <span className="text-sm font-bold text-slate-900">
                          {classSummary.totalExcused}
                        </span>

                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">

                        <div
                          className="h-full rounded-full bg-sky-500 transition-all duration-1000"
                          style={{
                            width: `${Math.min(
                              100,
                              classSummary.excusedPercentage
                            )}%`,
                          }}
                        />

                      </div>

                    </div>

                  </div>

                  <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">

                    <div className="rounded-xl bg-emerald-50 p-3">

                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                        Present
                      </p>

                      <p className="mt-1 text-lg font-black text-emerald-700">
                        {classSummary.totalPresent}
                      </p>

                    </div>

                    <div className="rounded-xl bg-amber-50 p-3">

                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
                        Late
                      </p>

                      <p className="mt-1 text-lg font-black text-amber-700">
                        {classSummary.totalLate}
                      </p>

                    </div>

                    <div className="rounded-xl bg-rose-50 p-3">

                      <p className="text-[10px] font-bold uppercase tracking-wide text-rose-600">
                        Absent
                      </p>

                      <p className="mt-1 text-lg font-black text-rose-700">
                        {classSummary.totalAbsent}
                      </p>

                    </div>

                    <div className="rounded-xl bg-sky-50 p-3">

                      <p className="text-[10px] font-bold uppercase tracking-wide text-sky-600">
                        Excused
                      </p>

                      <p className="mt-1 text-lg font-black text-sky-700">
                        {classSummary.totalExcused}
                      </p>

                    </div>

                  </div>

                </div>

                {/* Overall attendance gauge */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">

                      <i className="fa-solid fa-gauge-high" />

                    </div>

                    <div>

                      <h2 className="font-bold text-slate-900">
                        Overall Attendance
                      </h2>

                      <p className="text-xs text-slate-500">
                        Class performance
                      </p>

                    </div>

                  </div>

                  <div className="mt-8 flex justify-center">

                    <div
                      className="relative flex h-52 w-52 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(
                          rgb(124 58 237)
                          ${Math.min(
                            100,
                            classSummary.overallPercentage
                          ) * 3.6}deg,
                          rgb(241 245 249)
                          0deg
                        )`,
                      }}
                    >

                      <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full bg-white shadow-inner">

                        <i className="fa-solid fa-chart-pie mb-2 text-xl text-violet-500" />

                        <span className="text-3xl font-black text-slate-900">
                          {percentage(
                            classSummary.overallPercentage
                          )}
                        </span>

                        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Attendance Rate
                        </span>

                      </div>

                    </div>

                  </div>

                  <div className="mt-7 rounded-2xl bg-slate-50 p-4 text-center">

                    <p className="text-xs font-medium text-slate-500">
                      Total attended records
                    </p>

                    <p className="mt-1 text-2xl font-black text-slate-900">
                      {classSummary.totalAttended}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Present + Late
                    </p>

                  </div>

                </div>

              </div>

              {/* ===================================================
                  CLASS INFORMATION + TOP ATTENDANCE
              =================================================== */}

              <div className="grid gap-6 lg:grid-cols-3">

                {/* Class information */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">

                      <i className="fa-solid fa-school" />

                    </div>

                    <div>

                      <h2 className="font-bold text-slate-900">
                        Report Information
                      </h2>

                      <p className="text-xs text-slate-500">
                        Current report scope
                      </p>

                    </div>

                  </div>

                  <div className="mt-6 space-y-4">

                    <div className="flex items-start justify-between gap-4">

                      <span className="text-xs font-medium text-slate-400">
                        Academic Year
                      </span>

                      <span className="text-right text-sm font-bold text-slate-800">
                        {selectedYearData?.name ||
                          '—'}
                      </span>

                    </div>

                    <div className="flex items-start justify-between gap-4">

                      <span className="text-xs font-medium text-slate-400">
                        Term
                      </span>

                      <span className="text-right text-sm font-bold text-slate-800">
                        {selectedTermData?.name ||
                          '—'}
                      </span>

                    </div>

                    <div className="flex items-start justify-between gap-4">

                      <span className="text-xs font-medium text-slate-400">
                        Programme
                      </span>

                      <span className="text-right text-sm font-bold text-slate-800">
                        {selectedProgrammeData?.name ||
                          'All Programmes'}
                      </span>

                    </div>

                    <div className="flex items-start justify-between gap-4">

                      <span className="text-xs font-medium text-slate-400">
                        Class
                      </span>

                      <span className="text-right text-sm font-bold text-slate-800">
                        {selectedClassData?.name ||
                          '—'}
                      </span>

                    </div>

                    <div className="flex items-start justify-between gap-4">

                      <span className="text-xs font-medium text-slate-400">
                        Term Period
                      </span>

                      <span className="text-right text-sm font-bold text-slate-800">
                        {formatDate(
                          selectedTermData?.start_date ||
                            null
                        )}
                        {' – '}
                        {formatDate(
                          selectedTermData?.end_date ||
                            null
                        )}
                      </span>

                    </div>

                  </div>

                </div>

                {/* Top students */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">

                  <div className="flex items-center justify-between">

                    <div className="flex items-center gap-3">

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">

                        <i className="fa-solid fa-trophy" />

                      </div>

                      <div>

                        <h2 className="font-bold text-slate-900">
                          Attendance Leaders
                        </h2>

                        <p className="text-xs text-slate-500">
                          Highest attendance rates in this class
                        </p>

                      </div>

                    </div>

                    <i className="fa-solid fa-ranking-star text-amber-400" />

                  </div>

                  <div className="mt-5 space-y-3">

                    {topStudents.length === 0 ? (

                      <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                        No attendance data available yet.
                      </div>

                    ) : (

                      topStudents.map(
                        (
                          report,
                          index
                        ) => (

                          <div
                            key={
                              report.student.id
                            }
                            className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 transition duration-300 hover:-translate-y-0.5 hover:border-blue-100 hover:bg-blue-50/50"
                          >

                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                                index === 0
                                  ? 'bg-amber-100 text-amber-700'
                                  : index === 1
                                  ? 'bg-slate-200 text-slate-700'
                                  : index === 2
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              {index === 0 ? (
                                <i className="fa-solid fa-crown animate-pulse" />
                              ) : (
                                `#${index + 1}`
                              )}
                            </div>

                            <div className="min-w-0 flex-1">

                              <p className="truncate text-sm font-bold text-slate-800">
                                {
                                  report.student
                                    .full_name
                                }
                              </p>

                              <p className="text-xs text-slate-400">
                                {
                                  report.student
                                    .admission_number
                                }
                              </p>

                            </div>

                            <div className="hidden w-28 sm:block">

                              <div className="h-2 overflow-hidden rounded-full bg-slate-200">

                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-1000"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      report.percentage
                                    )}%`,
                                  }}
                                />

                              </div>

                            </div>

                            <div className="min-w-[62px] text-right">

                              <p className="text-sm font-black text-slate-900">
                                {percentage(
                                  report.percentage
                                )}
                              </p>

                              <p className="text-[10px] text-slate-400">
                                attendance
                              </p>

                            </div>

                          </div>

                        )
                      )

                    )}

                  </div>

                </div>

              </div>

              {/* ===================================================
                  STUDENT SEARCH + TABLE
              =================================================== */}

              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-200 p-5 sm:p-6">

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                    <div className="flex items-center gap-3">

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">

                        <i className="fa-solid fa-list-check" />

                      </div>

                      <div>

                        <h2 className="font-bold text-slate-900">
                          Student Attendance Details
                        </h2>

                        <p className="text-xs text-slate-500">
                          Individual attendance statistics for the selected class.
                        </p>

                      </div>

                    </div>

                    <div className="relative w-full lg:max-w-sm">

                      <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                      <input
                        type="text"
                        value={search}
                        onChange={(e) =>
                          setSearch(
                            e.target.value
                          )
                        }
                        placeholder="Search student..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />

                    </div>

                  </div>

                </div>

                {loadingReport ? (

                  <div className="p-12 text-center">

                    <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-blue-50 text-blue-500">

                      <i className="fa-solid fa-chart-line text-xl" />

                    </div>

                    <p className="mt-4 text-sm font-semibold text-slate-700">
                      Loading attendance analytics...
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Please wait while the records are prepared.
                    </p>

                  </div>

                ) : reports.length === 0 ? (

                  <div className="p-12 text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">

                      <i className="fa-solid fa-chart-simple text-2xl" />

                    </div>

                    <p className="mt-4 font-bold text-slate-700">
                      No attendance records found
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Attendance recorded for this class during the selected term will appear here.
                    </p>

                  </div>

                ) : filteredReports.length === 0 ? (

                  <div className="p-12 text-center">

                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">

                      <i className="fa-solid fa-user-slash text-xl" />

                    </div>

                    <p className="mt-4 font-bold text-slate-700">
                      No matching student
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Try another student name or admission number.
                    </p>

                  </div>

                ) : (

                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[900px] border-collapse text-sm">

                      <thead>

                        <tr className="border-b border-slate-200 bg-slate-50">

                          <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                            #
                          </th>

                          <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                            Student
                          </th>

                          <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                            Admission No.
                          </th>

                          <th className="px-4 py-4 text-center text-[11px] font-black uppercase tracking-wider text-slate-500">
                            Days
                          </th>

                          <th className="px-4 py-4 text-center text-[11px] font-black uppercase tracking-wider text-emerald-600">
                            Present
                          </th>

                          <th className="px-4 py-4 text-center text-[11px] font-black uppercase tracking-wider text-amber-600">
                            Late
                          </th>

                          <th className="px-4 py-4 text-center text-[11px] font-black uppercase tracking-wider text-rose-600">
                            Absent
                          </th>

                          <th className="px-4 py-4 text-center text-[11px] font-black uppercase tracking-wider text-sky-600">
                            Excused
                          </th>

                          <th className="px-4 py-4 text-center text-[11px] font-black uppercase tracking-wider text-slate-500">
                            Attended
                          </th>

                          <th className="px-4 py-4 text-center text-[11px] font-black uppercase tracking-wider text-violet-600">
                            Attendance
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {filteredReports.map(
                          (
                            report,
                            index
                          ) => (

                            <tr
                              key={
                                report.student.id
                              }
                              className="group border-b border-slate-100 transition duration-200 hover:bg-blue-50/40"
                            >

                              <td className="px-4 py-4">

                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 transition group-hover:bg-blue-100 group-hover:text-blue-600">
                                  {index + 1}
                                </span>

                              </td>

                              <td className="px-4 py-4">

                                <div className="flex items-center gap-3">

                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-black text-white shadow-sm">

                                    {report.student.full_name
                                      .charAt(0)
                                      .toUpperCase()}

                                  </div>

                                  <div>

                                    <p className="font-bold text-slate-800">
                                      {
                                        report.student
                                          .full_name
                                      }
                                    </p>

                                    <p className="text-[10px] text-slate-400">
                                      Student
                                    </p>

                                  </div>

                                </div>

                              </td>

                              <td className="px-4 py-4 font-medium text-slate-600">
                                {
                                  report.student
                                    .admission_number
                                }
                              </td>

                              <td className="px-4 py-4 text-center font-semibold text-slate-700">
                                {report.total}
                              </td>

                              <td className="px-4 py-4 text-center">

                                <span className="inline-flex min-w-[36px] items-center justify-center rounded-lg bg-emerald-50 px-2 py-1 font-bold text-emerald-700">
                                  {report.present}
                                </span>

                              </td>

                              <td className="px-4 py-4 text-center">

                                <span className="inline-flex min-w-[36px] items-center justify-center rounded-lg bg-amber-50 px-2 py-1 font-bold text-amber-700">
                                  {report.late}
                                </span>

                              </td>

                              <td className="px-4 py-4 text-center">

                                <span className="inline-flex min-w-[36px] items-center justify-center rounded-lg bg-rose-50 px-2 py-1 font-bold text-rose-700">
                                  {report.absent}
                                </span>

                              </td>

                              <td className="px-4 py-4 text-center">

                                <span className="inline-flex min-w-[36px] items-center justify-center rounded-lg bg-sky-50 px-2 py-1 font-bold text-sky-700">
                                  {report.excused}
                                </span>

                              </td>

                              <td className="px-4 py-4 text-center font-black text-slate-800">
                                {report.attended}
                              </td>

                              <td className="px-4 py-4">

                                <div className="flex flex-col items-center gap-1">

                                  <span className="font-black text-violet-700">
                                    {percentage(
                                      report.percentage
                                    )}
                                  </span>

                                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">

                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-700"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          report.percentage
                                        )}%`,
                                      }}
                                    />

                                  </div>

                                </div>

                              </td>

                            </tr>

                          )
                        )}

                      </tbody>

                      <tfoot>

                        <tr className="border-t-2 border-slate-300 bg-slate-50">

                          <td
                            colSpan={3}
                            className="px-4 py-5 text-right text-xs font-black uppercase tracking-wide text-slate-600"
                          >
                            Class Total
                          </td>

                          <td className="px-4 py-5 text-center font-black text-slate-800">
                            {
                              classSummary
                                .totalRecorded
                            }
                          </td>

                          <td className="px-4 py-5 text-center font-black text-emerald-700">
                            {
                              classSummary
                                .totalPresent
                            }
                          </td>

                          <td className="px-4 py-5 text-center font-black text-amber-700">
                            {
                              classSummary
                                .totalLate
                            }
                          </td>

                          <td className="px-4 py-5 text-center font-black text-rose-700">
                            {
                              classSummary
                                .totalAbsent
                            }
                          </td>

                          <td className="px-4 py-5 text-center font-black text-sky-700">
                            {
                              classSummary
                                .totalExcused
                            }
                          </td>

                          <td className="px-4 py-5 text-center font-black text-slate-800">
                            {
                              classSummary
                                .totalAttended
                            }
                          </td>

                          <td className="px-4 py-5 text-center font-black text-violet-700">
                            {percentage(
                              classSummary
                                .overallPercentage
                            )}
                          </td>

                        </tr>

                      </tfoot>

                    </table>

                  </div>

                )}

              </div>

              {/* ===================================================
                  REPORT FOOTER
              =================================================== */}

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="grid gap-4 sm:grid-cols-3">

                  <div className="rounded-2xl bg-slate-50 p-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">

                        <i className="fa-solid fa-calendar-check" />

                      </div>

                      <div>

                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Report Period
                        </p>

                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {selectedTermData?.name ||
                            '—'}
                        </p>

                      </div>

                    </div>

                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">

                        <i className="fa-solid fa-database" />

                      </div>

                      <div>

                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Records Analysed
                        </p>

                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {classSummary.totalRecorded}
                        </p>

                      </div>

                    </div>

                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">

                        <i className="fa-solid fa-chart-line" />

                      </div>

                      <div>

                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Attendance Rate
                        </p>

                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {percentage(
                            classSummary.overallPercentage
                          )}
                        </p>

                      </div>

                    </div>

                  </div>

                </div>

                <div className="mt-6 border-t border-slate-100 pt-5 text-center">

                  <p className="text-xs text-slate-400">

                    <i className="fa-solid fa-circle-info mr-1" />

                    Attendance percentage = (Present + Late)
                    ÷ Days Recorded × 100.

                  </p>

                  <p className="mt-1 text-[10px] text-slate-400">
                    Excused days are recorded separately and do not count toward the attendance percentage.
                  </p>

                </div>

              </div>

            </div>

          ) : (

            /* =====================================================
               NO CLASS SELECTED
            ===================================================== */

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

              <div className="relative px-6 py-16 text-center sm:px-10">

                <div className="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-blue-50 blur-3xl" />

                <div className="relative">

                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xl shadow-blue-200">

                    <i className="fa-solid fa-chart-column text-3xl animate-pulse" />

                  </div>

                  <h2 className="mt-6 text-xl font-black text-slate-900">
                    Attendance Analytics
                  </h2>

                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                    Select an academic year, term, programme and class above to view detailed attendance statistics and student performance.
                  </p>

                  <div className="mx-auto mt-7 flex max-w-xl flex-wrap justify-center gap-2">

                    <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600">
                      <i className="fa-solid fa-chart-pie mr-1" />
                      Statistics
                    </span>

                    <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-600">
                      <i className="fa-solid fa-file-excel mr-1" />
                      Excel Export
                    </span>

                    <span className="rounded-full bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-600">
                      <i className="fa-solid fa-print mr-1" />
                      Printable
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                      <i className="fa-solid fa-lock mr-1" />
                      Read Only
                    </span>

                  </div>

                </div>

              </div>

            </div>

          )}

          {/* ERROR / MESSAGE */}
          {message && (

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 print:hidden">

              <i className="fa-solid fa-triangle-exclamation mt-0.5 text-amber-500" />

              <span>
                {message}
              </span>

            </div>

          )}

        </div>

      </div>

      {/* =========================================================
          GLOBAL ANIMATION + PRINT STYLING
      ========================================================= */}

      <style jsx global>{`

        @keyframes softPulse {
          0%,
          100% {
            opacity: 1;
          }

          50% {
            opacity: 0.75;
          }
        }

        @keyframes floatIcon {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-3px);
          }
        }

        .fa-chart-line,
        .fa-chart-column,
        .fa-chart-pie {
          animation-duration: 3s;
        }

        .group:hover .fa-chart-line,
        .group:hover .fa-chart-column,
        .group:hover .fa-chart-pie,
        .group:hover .fa-users,
        .group:hover .fa-circle-check,
        .group:hover .fa-circle-xmark {
          animation: floatIcon 1.2s ease-in-out infinite;
        }

        @media print {

          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          body {
            background: white !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          .shadow-sm,
          .shadow-xl {
            box-shadow: none !important;
          }

          .rounded-3xl,
          .rounded-2xl {
            border-radius: 0 !important;
          }

        }

      `}</style>
    </>
  );
}

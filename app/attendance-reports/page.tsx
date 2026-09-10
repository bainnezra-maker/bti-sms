'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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

  const [message, setMessage] = useState('');

  /*
   * Load academic setup
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

      const { data: profile, error: profileError } =
        await supabase
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
   * Load terms whenever academic year changes
   */
  useEffect(() => {
    async function loadTerms() {
      if (!selectedYear) {
        setTerms([]);
        setSelectedTerm('');
        return;
      }

      const { data, error } =
        await supabase
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
   * Automatically select programme/class
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
   * Classes available for selected year/programme
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
   * Load report
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

      /*
       * Get selected term dates
       */
      const selectedTermData =
        terms.find(
          (term) =>
            term.id === selectedTerm
        );

      /*
       * Get active students in class
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
        .in('id', studentIds)
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

      const loadedStudents =
        studentData || [];

      setStudents(
        loadedStudents
      );

      /*
       * Load attendance records for the
       * selected term only.
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
   * Build student attendance report
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

        /*
         * Present + Late = attended.
         * Excused is separate and does not
         * count toward attendance percentage.
         */
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
   * Search
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
   * Class totals
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

      return {
        totalStudents,
        totalPresent,
        totalAbsent,
        totalLate,
        totalExcused,
        totalRecorded,
        totalAttended,
        overallPercentage,
      };
    }, [reports]);

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

  const selectedProgrammeData =
    programmes.find(
      (programme) =>
        programme.id ===
        selectedProgramme
    );

  const selectedClassData =
    classes.find(
      (item) =>
        item.id === selectedClass
    );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            Loading attendance reports...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 print:bg-white print:p-0">
        <div className="mx-auto max-w-7xl">

          {/* Screen controls */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div>
              <Link
                href="/attendance"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                ← Attendance Management
              </Link>

              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Attendance Reports
              </h1>

              <p className="text-sm text-slate-500">
                View and print attendance for a class and term.
              </p>
            </div>

            <button
              onClick={() =>
                window.print()
              }
              disabled={
                !selectedClass ||
                reports.length === 0
              }
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              🖨 Print Report
            </button>
          </div>

          {/* Filters */}
          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm print:hidden">
            <div className="mb-4">
              <h2 className="font-semibold text-slate-900">
                Report Filters
              </h2>
              <p className="text-xs text-slate-500">
                Select the academic year, term, programme and class.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Academic Year
                </label>

                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(
                      e.target.value
                    );
                    setSelectedClass('');
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
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
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Term
                </label>

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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
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
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Programme
                </label>

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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
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
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Class
                </label>

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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
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
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Report */}
          {selectedClass ? (
            <div className="rounded-2xl bg-white shadow-sm print:shadow-none">

              {/* Report header */}
              <div className="border-b border-slate-200 p-5 sm:p-7">

                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-4 border-slate-900 text-xl font-black text-slate-900">
                    BTI
                  </div>

                  <h2 className="text-2xl font-black uppercase tracking-wide text-slate-900">
                    Biriwa Technical Institute
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    CLASS ATTENDANCE REPORT
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {selectedYearData?.name || '—'}
                    {' • '}
                    {selectedTermData?.name || '—'}
                  </p>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Programme
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {selectedProgrammeData?.name ||
                        'All Programmes'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Class
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {selectedClassData?.name ||
                        '—'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Term Period
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatDate(
                        selectedTermData?.start_date ||
                          null
                      )}
                      {' – '}
                      {formatDate(
                        selectedTermData?.end_date ||
                          null
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">
                    Students
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {classSummary.totalStudents}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">
                    Present
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {classSummary.totalPresent}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">
                    Late
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {classSummary.totalLate}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">
                    Absent
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {classSummary.totalAbsent}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">
                    Excused
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {classSummary.totalExcused}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">
                    Attendance
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {percentage(
                      classSummary.overallPercentage
                    )}
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="px-5 pb-5 print:hidden">
                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search by student name or admission number..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* Loading */}
              {loadingReport ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Loading attendance report...
                </div>
              ) : reports.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-semibold text-slate-700">
                    No attendance records found.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Attendance recorded for this class during the selected term will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] border-collapse text-sm">
                    <thead>
                      <tr className="border-y border-slate-200 bg-slate-50">
                        <th className="px-3 py-3 text-left font-bold">
                          #
                        </th>

                        <th className="px-3 py-3 text-left font-bold">
                          Student
                        </th>

                        <th className="px-3 py-3 text-left font-bold">
                          Admission No.
                        </th>

                        <th className="px-3 py-3 text-center font-bold">
                          Days
                        </th>

                        <th className="px-3 py-3 text-center font-bold">
                          Present
                        </th>

                        <th className="px-3 py-3 text-center font-bold">
                          Late
                        </th>

                        <th className="px-3 py-3 text-center font-bold">
                          Absent
                        </th>

                        <th className="px-3 py-3 text-center font-bold">
                          Excused
                        </th>

                        <th className="px-3 py-3 text-center font-bold">
                          Attended
                        </th>

                        <th className="px-3 py-3 text-center font-bold">
                          Attendance %
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
                            className="border-b border-slate-100"
                          >
                            <td className="px-3 py-3">
                              {index + 1}
                            </td>

                            <td className="px-3 py-3 font-semibold text-slate-900">
                              {
                                report.student
                                  .full_name
                              }
                            </td>

                            <td className="px-3 py-3 text-slate-600">
                              {
                                report.student
                                  .admission_number
                              }
                            </td>

                            <td className="px-3 py-3 text-center">
                              {report.total}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {report.present}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {report.late}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {report.absent}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {report.excused}
                            </td>

                            <td className="px-3 py-3 text-center font-semibold">
                              {report.attended}
                            </td>

                            <td className="px-3 py-3 text-center font-bold">
                              {percentage(
                                report.percentage
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>

                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                        <td
                          colSpan={3}
                          className="px-3 py-4 text-right"
                        >
                          CLASS TOTAL
                        </td>

                        <td className="px-3 py-4 text-center">
                          {
                            classSummary
                              .totalRecorded
                          }
                        </td>

                        <td className="px-3 py-4 text-center">
                          {
                            classSummary
                              .totalPresent
                          }
                        </td>

                        <td className="px-3 py-4 text-center">
                          {
                            classSummary
                              .totalLate
                          }
                        </td>

                        <td className="px-3 py-4 text-center">
                          {
                            classSummary
                              .totalAbsent
                          }
                        </td>

                        <td className="px-3 py-4 text-center">
                          {
                            classSummary
                              .totalExcused
                          }
                        </td>

                        <td className="px-3 py-4 text-center">
                          {
                            classSummary
                              .totalAttended
                          }
                        </td>

                        <td className="px-3 py-4 text-center">
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

              {/* Footer */}
              <div className="border-t border-slate-200 p-5 sm:p-7">

                <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">

                  <div>
                    <p className="text-xs text-slate-500">
                      Prepared by
                    </p>
                    <div className="mt-8 w-48 border-b border-slate-400" />
                    <p className="mt-1 text-sm font-medium">
                      Attendance Officer / Class Teacher
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Approved by
                    </p>
                    <div className="mt-8 w-48 border-b border-slate-400" />
                    <p className="mt-1 text-sm font-medium">
                      Head of Department / Head
                    </p>
                  </div>

                </div>

                <p className="mt-8 text-center text-xs text-slate-400">
                  Attendance percentage = (Present + Late) ÷ Days Recorded × 100.
                  Excused days are recorded separately and do not count toward the percentage.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <div className="text-4xl">📊</div>

              <h2 className="mt-3 text-lg font-bold text-slate-900">
                Select a class
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Choose an academic year, term, programme and class to generate the attendance report.
              </p>
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {message}
            </div>
          )}
        </div>
      </div>

      {/* Print styling */}
      <style jsx global>{`
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
        }
      `}</style>
    </>
  );
}

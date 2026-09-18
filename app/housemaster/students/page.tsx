'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type UserProfile = {
  id: string;
  school_id: string;
  full_name: string;
  role: 'admin' | 'housemaster' | string;
  is_active: boolean | null;
};

type Student = {
  id: string;
  school_id: string;
  admission_number: string | null;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  address: string | null;
  admission_date: string;
  status: string | null;
  photo_url: string | null;
  resident: string | null;
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean | null;
};

type Programme = {
  id: string;
  name: string;
  code: string | null;
};

type ClassRow = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
  academic_year_id: string | null;
};

type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  programme_id: string | null;
  status: string | null;
  enrollment_date: string;
};

type AcademicContext = {
  enrollment: Enrollment;
  academicYear: AcademicYear | null;
  classRow: ClassRow | null;
  programme: Programme | null;
};

type ResidentialProfile = {
  id: string;
  student_id: string;
  health_insurance_number: string | null;
  home_location: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
};

type DayResidence = {
  id: string;
  student_id: string;
  academic_year_id: string;
  address: string;
  location: string | null;
  landlord_caretaker_name: string | null;
  landlord_caretaker_phone: string | null;
  is_current: boolean;
};

type ResidenceChoice = 'Day' | 'Boarding';

const PAGE_SIZE = 24;
const supabase = createClient();

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function HousemasterStudentsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [students, setStudents] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [residenceFilter, setResidenceFilter] = useState<'All' | ResidenceChoice | 'Unassigned'>('All');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [residenceChoice, setResidenceChoice] = useState<ResidenceChoice>('Boarding');

  const [healthInsurance, setHealthInsurance] = useState('');
  const [homeLocation, setHomeLocation] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [residentialNotes, setResidentialNotes] = useState('');

  const [dayAddress, setDayAddress] = useState('');
  const [dayLocation, setDayLocation] = useState('');
  const [caretakerName, setCaretakerName] = useState('');
  const [caretakerPhone, setCaretakerPhone] = useState('');

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setAuthLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('id, school_id, full_name, role, is_active')
        .eq('id', user.id)
        .maybeSingle();

      if (
        profileError ||
        !userProfile ||
        userProfile.is_active === false ||
        !['housemaster', 'admin'].includes(userProfile.role)
      ) {
        router.replace('/login');
        return;
      }

      if (!mounted) return;

      const safeProfile = userProfile as UserProfile;
      setProfile(safeProfile);

      const [yearsResult, classesResult, programmesResult] = await Promise.all([
        supabase
          .from('academic_years')
          .select('id, name, start_date, end_date, is_current')
          .eq('school_id', safeProfile.school_id)
          .order('start_date', { ascending: false }),
        supabase
          .from('classes')
          .select('id, name, level, programme_id, academic_year_id')
          .eq('school_id', safeProfile.school_id),
        supabase
          .from('programmes')
          .select('id, name, code')
          .eq('school_id', safeProfile.school_id)
          .order('name'),
      ]);

      if (!mounted) return;

      setAcademicYears((yearsResult.data ?? []) as AcademicYear[]);
      setClasses((classesResult.data ?? []) as ClassRow[]);
      setProgrammes((programmesResult.data ?? []) as Programme[]);

      const currentYear =
        (yearsResult.data ?? []).find((year: AcademicYear) => year.is_current) ??
        (yearsResult.data ?? [])[0];

      if (currentYear) setSelectedYearId(currentYear.id);
      setAuthLoading(false);
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [router]);

  const loadStudents = useCallback(async () => {
    if (!profile) return;

    setListLoading(true);
    setMessage(null);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE;

    let query = supabase
      .from('students')
      .select(
        'id, school_id, admission_number, full_name, date_of_birth, gender, guardian_name, guardian_phone, address, admission_date, status, photo_url, resident'
      )
      .eq('school_id', profile.school_id)
      .order('full_name', { ascending: true })
      .range(from, to);

    const q = search.trim();
    if (q) {
      const escaped = q.replace(/[%_,()]/g, ' ');
      query = query.or(`full_name.ilike.%${escaped}%,admission_number.ilike.%${escaped}%`);
    }

    if (residenceFilter === 'Day') {
      query = query.eq('resident', 'Day');
    } else if (residenceFilter === 'Boarding') {
      query = query.eq('resident', 'Boarding');
    } else if (residenceFilter === 'Unassigned') {
      query = query.is('resident', null);
    }

    const { data, error } = await query;

    if (error) {
      setStudents([]);
      setHasMore(false);
      setMessage({ type: 'error', text: error.message });
      setListLoading(false);
      return;
    }

    const rows = (data ?? []) as Student[];
    const visibleRows = rows.slice(0, PAGE_SIZE);
    setStudents(visibleRows);
    setHasMore(rows.length > PAGE_SIZE);

    const studentIds = visibleRows.map((student) => student.id);
    if (studentIds.length) {
      const { data: enrollmentRows } = await supabase
        .from('enrollments')
        .select('id, student_id, class_id, academic_year_id, programme_id, status, enrollment_date')
        .in('student_id', studentIds)
        .eq('status', 'active');

      setEnrollments((enrollmentRows ?? []) as Enrollment[]);
    } else {
      setEnrollments([]);
    }

    setListLoading(false);
  }, [profile, page, search, residenceFilter]);

  useEffect(() => {
    if (profile) loadStudents();
  }, [profile, loadStudents]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setSearch(searchInput);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const yearMap = useMemo(
    () => new Map(academicYears.map((year) => [year.id, year])),
    [academicYears]
  );
  const classMap = useMemo(
    () => new Map(classes.map((classRow) => [classRow.id, classRow])),
    [classes]
  );
  const programmeMap = useMemo(
    () => new Map(programmes.map((programme) => [programme.id, programme])),
    [programmes]
  );

  function academicContextFor(studentId: string): AcademicContext | null {
    const studentEnrollments = enrollments
      .filter((row) => row.student_id === studentId)
      .sort((a, b) => {
        const yearA = yearMap.get(a.academic_year_id)?.start_date ?? '';
        const yearB = yearMap.get(b.academic_year_id)?.start_date ?? '';
        return yearB.localeCompare(yearA);
      });

    const enrollment = studentEnrollments[0];
    if (!enrollment) return null;

    const classRow = classMap.get(enrollment.class_id) ?? null;
    const programmeId = enrollment.programme_id ?? classRow?.programme_id ?? null;

    return {
      enrollment,
      academicYear: yearMap.get(enrollment.academic_year_id) ?? null,
      classRow,
      programme: programmeId ? programmeMap.get(programmeId) ?? null : null,
    };
  }

  async function openStudent(student: Student) {
    if (!profile) return;

    setSelectedStudent(student);
    setResidenceChoice(student.resident === 'Day' ? 'Day' : 'Boarding');
    setDetailsLoading(true);
    setMessage(null);

    setHealthInsurance('');
    setHomeLocation('');
    setEmergencyName('');
    setEmergencyPhone('');
    setResidentialNotes('');
    setDayAddress(student.address ?? '');
    setDayLocation('');
    setCaretakerName('');
    setCaretakerPhone('');

    const context = academicContextFor(student.id);
    const preferredYearId =
      context?.enrollment.academic_year_id ||
      academicYears.find((year) => year.is_current)?.id ||
      academicYears[0]?.id ||
      '';

    setSelectedYearId(preferredYearId);

    const { data: residentialData, error: residentialError } = await supabase
      .from('student_residential_profiles')
      .select(
        'id, student_id, health_insurance_number, home_location, emergency_contact_name, emergency_contact_phone, notes'
      )
      .eq('school_id', profile.school_id)
      .eq('student_id', student.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (residentialError) {
      setMessage({ type: 'error', text: residentialError.message });
    } else if (residentialData) {
      const residential = residentialData as ResidentialProfile;
      setHealthInsurance(residential.health_insurance_number ?? '');
      setHomeLocation(residential.home_location ?? '');
      setEmergencyName(residential.emergency_contact_name ?? '');
      setEmergencyPhone(residential.emergency_contact_phone ?? '');
      setResidentialNotes(residential.notes ?? '');
    }

    if (preferredYearId) {
      await loadDayResidence(student.id, preferredYearId, student.address ?? '');
    }

    setDetailsLoading(false);
  }

  async function loadDayResidence(studentId: string, academicYearId: string, fallbackAddress = '') {
    if (!profile || !academicYearId) return;

    const { data, error } = await supabase
      .from('day_student_residences')
      .select(
        'id, student_id, academic_year_id, address, location, landlord_caretaker_name, landlord_caretaker_phone, is_current'
      )
      .eq('school_id', profile.school_id)
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .eq('is_current', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }

    const residence = data as DayResidence | null;
    setDayAddress(residence?.address ?? fallbackAddress);
    setDayLocation(residence?.location ?? '');
    setCaretakerName(residence?.landlord_caretaker_name ?? '');
    setCaretakerPhone(residence?.landlord_caretaker_phone ?? '');
  }

  async function changeYear(yearId: string) {
    setSelectedYearId(yearId);
    if (selectedStudent && residenceChoice === 'Day') {
      await loadDayResidence(selectedStudent.id, yearId, selectedStudent.address ?? '');
    }
  }

  async function saveResidentialProfile(student: Student) {
    if (!profile) throw new Error('Your user profile is unavailable.');

    const { data: existing, error: lookupError } = await supabase
      .from('student_residential_profiles')
      .select('id')
      .eq('school_id', profile.school_id)
      .eq('student_id', student.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;

    const payload = {
      school_id: profile.school_id,
      student_id: student.id,
      health_insurance_number: clean(healthInsurance),
      home_location: clean(homeLocation),
      emergency_contact_name: clean(emergencyName),
      emergency_contact_phone: clean(emergencyPhone),
      notes: clean(residentialNotes),
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from('student_residential_profiles')
        .update(payload)
        .eq('id', existing.id)
        .eq('school_id', profile.school_id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('student_residential_profiles').insert({
        ...payload,
        created_by: profile.id,
      });
      if (error) throw error;
    }
  }

  async function saveDayResidence(student: Student) {
    if (!profile) throw new Error('Your user profile is unavailable.');
    if (!selectedYearId) throw new Error('Select an academic year.');
    if (!dayAddress.trim()) throw new Error('Residential address is required for a Day Student.');

    const { data: existing, error: lookupError } = await supabase
      .from('day_student_residences')
      .select('id')
      .eq('school_id', profile.school_id)
      .eq('student_id', student.id)
      .eq('academic_year_id', selectedYearId)
      .eq('is_current', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;

    const payload = {
      school_id: profile.school_id,
      student_id: student.id,
      academic_year_id: selectedYearId,
      address: dayAddress.trim(),
      location: clean(dayLocation),
      landlord_caretaker_name: clean(caretakerName),
      landlord_caretaker_phone: clean(caretakerPhone),
      is_current: true,
      recorded_by: profile.id,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from('day_student_residences')
        .update(payload)
        .eq('id', existing.id)
        .eq('school_id', profile.school_id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('day_student_residences').insert(payload);
      if (error) throw error;
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!profile || !selectedStudent || saving) return;

    setSaving(true);
    setMessage(null);

    try {
      // Save the residence-specific detail first. The master student residence
      // flag is changed only after the detail write succeeds, reducing the
      // chance of leaving a student marked with incomplete residence data.
      if (residenceChoice === 'Boarding') {
        await saveResidentialProfile(selectedStudent);
      } else {
        await saveDayResidence(selectedStudent);
      }

      const residentValue = residenceChoice === 'Boarding' ? 'Boarding' : 'Day';

      const { error: studentError } = await supabase
        .from('students')
.update({
          resident: residentValue,
        })
        .eq('id', selectedStudent.id)
        .eq('school_id', profile.school_id);

      // Some deployments do not have students.updated_at. Supabase strips
      // undefined properties from the request; only resident is written.
      if (studentError) throw studentError;

      const updatedStudent = { ...selectedStudent, resident: residentValue };
      setSelectedStudent(updatedStudent);
      setStudents((current) =>
        current.map((student) => (student.id === updatedStudent.id ? updatedStudent : student))
      );

      setMessage({
        type: 'success',
        text:
          residenceChoice === 'Boarding'
            ? 'Boarder residential profile saved successfully.'
            : 'Day Student residential information saved successfully.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to save the student record.',
      });
    } finally {
      setSaving(false);
    }
  }

  const selectedAcademicContext = selectedStudent
    ? (() => {
        const rows = enrollments
          .filter(
            (row) =>
              row.student_id === selectedStudent.id &&
              (!selectedYearId || row.academic_year_id === selectedYearId)
          )
          .sort((a, b) => b.enrollment_date.localeCompare(a.enrollment_date));

        const enrollment = rows[0];
        if (!enrollment) return null;

        const classRow = classMap.get(enrollment.class_id) ?? null;
        const programmeId = enrollment.programme_id ?? classRow?.programme_id ?? null;

        return {
          enrollment,
          academicYear: yearMap.get(enrollment.academic_year_id) ?? null,
          classRow,
          programme: programmeId ? programmeMap.get(programmeId) ?? null : null,
        };
      })()
    : null;

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="h-40 rounded-3xl bg-slate-900" />
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="h-96 rounded-3xl bg-white" />
            <div className="h-96 rounded-3xl bg-white lg:col-span-2" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      />

      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 left-1/4 h-48 w-48 rounded-full bg-white/5" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
                <i className="fa-solid fa-house-user" />
                Residential Student Management
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                Students / Admission
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Search existing BTI students and maintain their Day Student or Boarder residential
                information without creating duplicate student identities.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <i className="fa-solid fa-user-shield" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Signed in
                </p>
                <p className="text-sm font-bold">{profile?.full_name}</p>
              </div>
            </div>
          </div>
        </section>

        {message && (
          <div
            className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            <i
              className={`mt-0.5 fa-solid ${
                message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'
              }`}
            />
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <label className="relative block">
              <span className="sr-only">Search students</span>
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by student name or admission number..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
              />
            </label>

            <select
              value={residenceFilter}
              onChange={(event) => {
                setPage(0);
                setResidenceFilter(event.target.value as typeof residenceFilter);
              }}
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            >
              <option value="All">All Residence Types</option>
              <option value="Boarding">Boarders</option>
              <option value="Day">Day Students</option>
              <option value="Unassigned">Not Assigned</option>
            </select>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-extrabold text-slate-900">Student Directory</h2>
                <p className="mt-0.5 text-xs text-slate-500">Select a student to manage</p>
              </div>
              {listLoading && <i className="fa-solid fa-spinner animate-spin text-slate-500" />}
            </div>

            <div className="max-h-[720px] divide-y divide-slate-100 overflow-y-auto">
              {!listLoading && students.length === 0 && (
                <div className="px-6 py-14 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <i className="fa-solid fa-user-slash text-xl" />
                  </span>
                  <p className="mt-4 font-bold text-slate-700">No students found</p>
                  <p className="mt-1 text-sm text-slate-500">Try another name or admission number.</p>
                </div>
              )}

              {students.map((student) => {
                const context = academicContextFor(student.id);
                const active = selectedStudent?.id === student.id;

                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => openStudent(student)}
                    className={`group flex w-full items-center gap-3 px-4 py-4 text-left transition ${
                      active ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                    }`}
                  >
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                          active ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {initials(student.full_name) || <i className="fa-solid fa-user" />}
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold">{student.full_name}</span>
                      <span
                        className={`mt-1 block truncate text-xs ${
                          active ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {student.admission_number || 'No admission number'}
                        {context?.classRow?.level ? ` • ${context.classRow.level}` : ''}
                      </span>
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        active
                          ? 'bg-white/10 text-white'
                          : student.resident === 'Boarding'
                            ? 'bg-indigo-50 text-indigo-700'
                            : student.resident === 'Day'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {student.resident === 'Boarding'
                        ? 'Boarder'
                        : student.resident === 'Day'
                          ? 'Day'
                          : 'Unassigned'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button
                type="button"
                disabled={page === 0 || listLoading}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <i className="fa-solid fa-chevron-left mr-2" />
                Previous
              </button>
              <span className="text-xs font-bold text-slate-500">Page {page + 1}</span>
              <button
                type="button"
                disabled={!hasMore || listLoading}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <i className="fa-solid fa-chevron-right ml-2" />
              </button>
            </div>
          </section>

          <section className="min-w-0">
            {!selectedStudent ? (
              <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                <div>
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-lg">
                    <i className="fa-solid fa-address-card text-2xl" />
                  </span>
                  <h2 className="mt-5 text-xl font-black text-slate-900">Select a student</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Choose an existing student from the directory to view academic information and
                    maintain residential details.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    {selectedStudent.photo_url ? (
                      <img
                        src={selectedStudent.photo_url}
                        alt=""
                        className="h-24 w-24 rounded-3xl object-cover ring-4 ring-slate-100"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-900 text-2xl font-black text-white shadow-lg">
                        {initials(selectedStudent.full_name) || <i className="fa-solid fa-user" />}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-black text-slate-900 sm:text-2xl">
                          {selectedStudent.full_name}
                        </h2>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
                          {selectedStudent.status || 'active'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {selectedStudent.admission_number || 'No admission number'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoCard icon="fa-cake-candles" label="Date of Birth" value={formatDate(selectedStudent.date_of_birth)} />
                    <InfoCard icon="fa-venus-mars" label="Gender" value={selectedStudent.gender || '—'} />
                    <InfoCard icon="fa-user-group" label="Guardian" value={selectedStudent.guardian_name || '—'} />
                    <InfoCard icon="fa-phone" label="Guardian Contact" value={selectedStudent.guardian_phone || '—'} />
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Academic Context</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Programme and class come from the student's existing enrollment.
                      </p>
                    </div>

                    <label className="block min-w-[220px]">
                      <span className="mb-1.5 block text-xs font-bold text-slate-600">Academic Year</span>
                      <select
                        value={selectedYearId}
                        onChange={(event) => changeYear(event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                      >
                        <option value="">Select academic year</option>
                        {academicYears.map((year) => (
                          <option key={year.id} value={year.id}>
                            {year.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <InfoCard
                      icon="fa-layer-group"
                      label="Programme"
                      value={
                        selectedAcademicContext?.programme
                          ? `${selectedAcademicContext.programme.name}${
                              selectedAcademicContext.programme.code
                                ? ` (${selectedAcademicContext.programme.code})`
                                : ''
                            }`
                          : 'No active enrollment'
                      }
                    />
                    <InfoCard
                      icon="fa-graduation-cap"
                      label="Form"
                      value={selectedAcademicContext?.classRow?.level || '—'}
                    />
                    <InfoCard
                      icon="fa-school"
                      label="Class"
                      value={selectedAcademicContext?.classRow?.name || '—'}
                    />
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Residence Status</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose the student's current residence type.
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <ResidenceButton
                      active={residenceChoice === 'Boarding'}
                      icon="fa-bed"
                      title="Boarder"
                      subtitle="Student resides in the school boarding facility."
                      onClick={() => setResidenceChoice('Boarding')}
                    />
                    <ResidenceButton
                      active={residenceChoice === 'Day'}
                      icon="fa-house"
                      title="Day Student"
                      subtitle="Student resides outside the school."
                      onClick={() => {
                        setResidenceChoice('Day');
                        if (selectedStudent && selectedYearId) {
                          loadDayResidence(
                            selectedStudent.id,
                            selectedYearId,
                            selectedStudent.address ?? ''
                          );
                        }
                      }}
                    />
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  {detailsLoading ? (
                    <div className="flex min-h-64 items-center justify-center">
                      <div className="text-center text-slate-500">
                        <i className="fa-solid fa-spinner animate-spin text-2xl" />
                        <p className="mt-3 text-sm font-semibold">Loading residential details...</p>
                      </div>
                    </div>
                  ) : residenceChoice === 'Boarding' ? (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                          <i className="fa-solid fa-bed" />
                        </span>
                        <div>
                          <h3 className="text-lg font-black text-slate-900">Boarder Information</h3>
                          <p className="text-sm text-slate-500">
                            Room allocation is managed separately under Boarding & Rooms.
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <Field label="Health Insurance Number" icon="fa-notes-medical">
                          <input
                            value={healthInsurance}
                            onChange={(event) => setHealthInsurance(event.target.value)}
                            placeholder="e.g. NHIS number"
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Home Location" icon="fa-location-dot">
                          <input
                            value={homeLocation}
                            onChange={(event) => setHomeLocation(event.target.value)}
                            placeholder="Town / community / district"
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Emergency Contact Name" icon="fa-user-shield">
                          <input
                            value={emergencyName}
                            onChange={(event) => setEmergencyName(event.target.value)}
                            placeholder="Emergency contact person"
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Emergency Contact Phone" icon="fa-phone-volume">
                          <input
                            type="tel"
                            value={emergencyPhone}
                            onChange={(event) => setEmergencyPhone(event.target.value)}
                            placeholder="Emergency phone number"
                            className={inputClass}
                          />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Residential Notes" icon="fa-note-sticky">
                            <textarea
                              value={residentialNotes}
                              onChange={(event) => setResidentialNotes(event.target.value)}
                              rows={4}
                              placeholder="Important residential information..."
                              className={`${inputClass} h-auto py-3`}
                            />
                          </Field>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                          <i className="fa-solid fa-house" />
                        </span>
                        <div>
                          <h3 className="text-lg font-black text-slate-900">Day Student Residence</h3>
                          <p className="text-sm text-slate-500">
                            Record where the student currently resides during this academic year.
                          </p>
                        </div>
                      </div>

                      {!selectedYearId && (
                        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                          Select an academic year before saving Day Student information.
                        </div>
                      )}

                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Residential Address *" icon="fa-map-location-dot">
                            <textarea
                              required
                              value={dayAddress}
                              onChange={(event) => setDayAddress(event.target.value)}
                              rows={3}
                              placeholder="Full residential address"
                              className={`${inputClass} h-auto py-3`}
                            />
                          </Field>
                        </div>
                        <Field label="Location / Area" icon="fa-location-dot">
                          <input
                            value={dayLocation}
                            onChange={(event) => setDayLocation(event.target.value)}
                            placeholder="Community / area"
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Landlord / Caretaker Name" icon="fa-user-tie">
                          <input
                            value={caretakerName}
                            onChange={(event) => setCaretakerName(event.target.value)}
                            placeholder="Name"
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Landlord / Caretaker Phone" icon="fa-phone">
                          <input
                            type="tel"
                            value={caretakerPhone}
                            onChange={(event) => setCaretakerPhone(event.target.value)}
                            placeholder="Phone number"
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Master Student Address" icon="fa-address-book">
                          <div className="flex min-h-12 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600">
                            {selectedStudent.address || 'No address currently stored'}
                          </div>
                        </Field>
                      </div>
                    </>
                  )}
                </section>

                <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                  <p className="px-2 text-xs leading-5 text-slate-500">
                    <i className="fa-solid fa-shield-halved mr-1.5 text-slate-700" />
                    This updates the existing student; it does not create another student identity.
                  </p>
                  <button
                    type="submit"
                    disabled={saving || detailsLoading || (residenceChoice === 'Day' && !selectedYearId)}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <i className={`fa-solid ${saving ? 'fa-spinner animate-spin' : 'fa-floppy-disk'}`} />
                    {saving ? 'Saving...' : 'Save Student Residence'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

const inputClass =
  'h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100';

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <i className={`fa-solid ${icon} text-xs`} />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className="mt-2 break-words text-sm font-extrabold text-slate-800">{value}</p>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-600">
        <i className={`fa-solid ${icon} text-[11px] text-slate-400`} />
        {label}
      </span>
      {children}
    </label>
  );
}

function ResidenceButton({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-start gap-4 rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          active ? 'bg-white/10 text-white' : 'bg-white text-slate-600 shadow-sm'
        }`}
      >
        <i className={`fa-solid ${icon}`} />
      </span>
      <span>
        <span className="block text-sm font-extrabold">{title}</span>
        <span className={`mt-1 block text-xs leading-5 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
          {subtitle}
        </span>
      </span>
    </button>
  );
}

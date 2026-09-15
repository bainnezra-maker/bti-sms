'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
  jhs_aggregate: number | null;
  resident: string | null;
};

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

type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  programme_id: string | null;
  enrollment_date: string;
  status: string | null;
};

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const studentId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [student, setStudent] = useState<Student | null>(null);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [currentEnrollment, setCurrentEnrollment] =
    useState<Enrollment | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    guardian_name: '',
    guardian_phone: '',
    address: '',
    admission_date: '',
    jhs_aggregate: '',
    status: '',
    resident: '',
    academic_year_id: '',
    programme_id: '',
    class_id: '',
  });

  useEffect(() => {
    if (!studentId) return;

    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error('You are not logged in.');
        }

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('school_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.school_id) {
          throw new Error('Your account is not linked to a school.');
        }

        const schoolId = profile.school_id;

        const [
          studentResult,
          programmesResult,
          yearsResult,
          classesResult,
          enrollmentResult,
        ] = await Promise.all([
          supabase
            .from('students')
            .select(
              `
              id,
              school_id,
              admission_number,
              full_name,
              date_of_birth,
              gender,
              guardian_name,
              guardian_phone,
              address,
              admission_date,
              status,
              jhs_aggregate,
              resident
            `
            )
            .eq('id', studentId)
            .eq('school_id', schoolId)
            .single(),

          supabase
            .from('programmes')
            .select('id, name')
            .eq('school_id', schoolId)
            .order('name'),

          supabase
            .from('academic_years')
            .select('id, name, start_date')
            .eq('school_id', schoolId)
            .order('start_date', { ascending: false }),

          supabase
            .from('classes')
            .select(
              'id, name, level, programme_id, academic_year_id'
            )
            .eq('school_id', schoolId)
            .order('level')
            .order('name'),

          supabase
            .from('enrollments')
            .select(
              `
              id,
              student_id,
              class_id,
              academic_year_id,
              programme_id,
              enrollment_date,
              status
            `
            )
            .eq('student_id', studentId)
            .order('enrollment_date', { ascending: false })
            .limit(1),
        ]);

        if (studentResult.error) {
          throw new Error(studentResult.error.message);
        }

        if (programmesResult.error) {
          throw new Error(programmesResult.error.message);
        }

        if (yearsResult.error) {
          throw new Error(yearsResult.error.message);
        }

        if (classesResult.error) {
          throw new Error(classesResult.error.message);
        }

        if (enrollmentResult.error) {
          throw new Error(enrollmentResult.error.message);
        }

        const loadedStudent = studentResult.data as Student;
        const loadedEnrollment =
          enrollmentResult.data?.[0] as Enrollment | undefined;

        setStudent(loadedStudent);
        setProgrammes((programmesResult.data || []) as Programme[]);
        setAcademicYears((yearsResult.data || []) as AcademicYear[]);
        setClasses((classesResult.data || []) as SchoolClass[]);
        setCurrentEnrollment(loadedEnrollment || null);

        setForm({
          full_name: loadedStudent.full_name || '',
          date_of_birth: loadedStudent.date_of_birth || '',
          gender: loadedStudent.gender || '',
          guardian_name: loadedStudent.guardian_name || '',
          guardian_phone: loadedStudent.guardian_phone || '',
          address: loadedStudent.address || '',
          admission_date: loadedStudent.admission_date || '',
          jhs_aggregate:
            loadedStudent.jhs_aggregate !== null
              ? String(loadedStudent.jhs_aggregate)
              : '',
          status: loadedStudent.status || '',
          resident: loadedStudent.resident || '',
          academic_year_id:
            loadedEnrollment?.academic_year_id || '',
          programme_id: loadedEnrollment?.programme_id || '',
          class_id: loadedEnrollment?.class_id || '',
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load student.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [studentId]);

  const selectedYearClasses = useMemo(() => {
    if (!form.academic_year_id) return [];

    return classes.filter(
      (schoolClass) =>
        schoolClass.academic_year_id === form.academic_year_id
    );
  }, [classes, form.academic_year_id]);

  const selectedProgrammeClasses = useMemo(() => {
    if (!form.programme_id) {
      return selectedYearClasses;
    }

    return selectedYearClasses.filter((schoolClass) => {
      return (
        schoolClass.programme_id === form.programme_id ||
        schoolClass.programme_id === null
      );
    });
  }, [
    selectedYearClasses,
    form.programme_id,
  ]);

  const selectedClass = classes.find(
    (schoolClass) => schoolClass.id === form.class_id
  );

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError('');
    setSuccess('');
  }

  function handleAcademicYearChange(value: string) {
    setForm((previous) => ({
      ...previous,
      academic_year_id: value,
      class_id: '',
    }));
  }

  function handleProgrammeChange(value: string) {
    setForm((previous) => ({
      ...previous,
      programme_id: value,
      class_id: '',
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!student) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!form.full_name.trim()) {
        throw new Error('Student full name is required.');
      }

      if (!form.admission_date) {
        throw new Error('Admission date is required.');
      }

      if (!form.resident) {
        throw new Error(
          'Please select whether the student is Day or Boarding.'
        );
      }

      if (
        form.academic_year_id &&
        form.programme_id &&
        !form.class_id
      ) {
        throw new Error(
          'Please select a class, or clear the academic year/programme selection.'
        );
      }

      const { error: studentError } = await supabase
        .from('students')
        .update({
          full_name: form.full_name.trim(),
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          guardian_name: form.guardian_name.trim() || null,
          guardian_phone: form.guardian_phone.trim() || null,
          address: form.address.trim() || null,
          admission_date: form.admission_date,
          jhs_aggregate:
            form.jhs_aggregate.trim() === ''
              ? null
              : Number(form.jhs_aggregate),
          status: form.status || null,
          resident: form.resident,
        })
        .eq('id', student.id);

      if (studentError) {
        throw new Error(studentError.message);
      }

      if (form.class_id && form.academic_year_id) {
        const selectedClass = classes.find(
          (schoolClass) => schoolClass.id === form.class_id
        );

        const programmeId =
          form.programme_id ||
          selectedClass?.programme_id ||
          null;

        if (currentEnrollment) {
          const { error: enrollmentError } = await supabase
            .from('enrollments')
            .update({
              class_id: form.class_id,
              academic_year_id: form.academic_year_id,
              programme_id: programmeId,
              status: currentEnrollment.status || 'active',
            })
            .eq('id', currentEnrollment.id);

          if (enrollmentError) {
            throw new Error(enrollmentError.message);
          }
        } else {
          const { error: enrollmentError } = await supabase
            .from('enrollments')
            .insert({
              student_id: student.id,
              class_id: form.class_id,
              academic_year_id: form.academic_year_id,
              programme_id: programmeId,
              enrollment_date:
                form.admission_date ||
                new Date().toISOString().slice(0, 10),
              status: 'active',
            });

          if (enrollmentError) {
            throw new Error(enrollmentError.message);
          }
        }
      }

      setSuccess('Student updated successfully.');

      setTimeout(() => {
        router.push('/students');
      }, 800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update student.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-slate-600">
            <i className="fa-solid fa-spinner fa-spin" />
            Loading student...
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Student not found
          </h1>

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}

          <Link
            href="/students"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <i className="fa-solid fa-arrow-left" />
            Back to Students
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Link href="/students" className="hover:text-blue-600">
                Students
              </Link>
              <i className="fa-solid fa-chevron-right text-xs" />
              <span>Edit Student</span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Edit Student
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {student.admission_number || 'No admission number'} —{' '}
              {student.full_name}
            </p>
          </div>

          <Link
            href="/students"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <i className="fa-solid fa-arrow-left" />
            Back
          </Link>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <i className="fa-solid fa-circle-exclamation mr-2" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <i className="fa-solid fa-circle-check mr-2" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">
                <i className="fa-solid fa-user text-blue-600" />
                Student Information
              </h2>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Full Name *
                  </label>
                  <input
                    value={form.full_name}
                    onChange={(e) =>
                      updateField('full_name', e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) =>
                      updateField('date_of_birth', e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) =>
                      updateField('gender', e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Resident *
                  </label>
                  <select
                    value={form.resident}
                    onChange={(e) =>
                      updateField('resident', e.target.value)
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select residence</option>
                    <option value="Day">Day</option>
                    <option value="Boarding">Boarding</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Admission Date *
                  </label>
                  <input
                    type="date"
                    value={form.admission_date}
                    onChange={(e) =>
                      updateField('admission_date', e.target.value)
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    JHS Aggregate
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.jhs_aggregate}
                    onChange={(e) =>
                      updateField('jhs_aggregate', e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      updateField('status', e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="graduated">Graduated</option>
                    <option value="withdrawn">Withdrawn</option>
                    <option value="transferred">Transferred</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">
                <i className="fa-solid fa-user-group text-blue-600" />
                Guardian Information
              </h2>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Guardian Name
                  </label>
                  <input
                    value={form.guardian_name}
                    onChange={(e) =>
                      updateField('guardian_name', e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Guardian Telephone
                  </label>
                  <input
                    type="tel"
                    value={form.guardian_phone}
                    onChange={(e) =>
                      updateField('guardian_phone', e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Address
                  </label>
                  <textarea
                    value={form.address}
                    onChange={(e) =>
                      updateField('address', e.target.value)
                    }
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-slate-900">
                <i className="fa-solid fa-school text-blue-600" />
                Academic Placement
              </h2>

              <p className="mb-5 text-sm text-slate-500">
                Change the student's current academic year, programme or
                class. Previous enrollment records are not deleted.
              </p>

              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Academic Year
                  </label>

                  <select
                    value={form.academic_year_id}
                    onChange={(e) =>
                      handleAcademicYearChange(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select year</option>

                    {academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Programme
                  </label>

                  <select
                    value={form.programme_id}
                    onChange={(e) =>
                      handleProgrammeChange(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select programme</option>

                    {programmes.map((programme) => (
                      <option
                        key={programme.id}
                        value={programme.id}
                      >
                        {programme.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Class
                  </label>

                  <select
                    value={form.class_id}
                    onChange={(e) =>
                      updateField('class_id', e.target.value)
                    }
                    disabled={!form.academic_year_id}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none disabled:bg-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select class</option>

                    {selectedProgrammeClasses.map((schoolClass) => (
                      <option
                        key={schoolClass.id}
                        value={schoolClass.id}
                      >
                        {schoolClass.level
                          ? `${schoolClass.level} — `
                          : ''}
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedClass && (
                <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                  <i className="fa-solid fa-circle-info mr-2" />
                  Selected class:{' '}
                  <strong>
                    {selectedClass.level
                      ? `${selectedClass.level} — `
                      : ''}
                    {selectedClass.name}
                  </strong>
                </div>
              )}
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/students"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

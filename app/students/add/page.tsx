'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const houses = ['House 1', 'House 2', 'House 3', 'House 4'];

const STUDENT_ID_REGEX = /^\d{7}-\d{4}-\d{3}$/;

export default function AddStudentPage() {
  const router = useRouter();
  const supabase = createClient();

  const emptyForm = () => ({
    admission_number: '',
    full_name: '',
    date_of_birth: '',
    gender: '',
    region: '',
    place_of_birth: '',
    religion: '',
    bece_index_number: '',
    admission_date: new Date().toISOString().slice(0, 10),
    jhs_aggregate: '',

    resident: '',
    house: '',
    address: '',
    house_number: '',
    digital_address: '',
    whatsapp_number: '',

    father_name: '',
    father_contact: '',
    mother_name: '',
    mother_contact: '',
    guardian_name: '',
    guardian_phone: '',

    health_issues: '',
    health_insurance_number: '',
    health_insurance_expiry_date: '',
  });

  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function updateField(field: keyof typeof form, value: string) {
    setForm(previous => {
      const next = { ...previous, [field]: value };

      if (field === 'resident' && value !== 'Boarding') {
        next.house = '';
      }

      return next;
    });

    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const admissionNumber = form.admission_number.trim();

      if (!admissionNumber) {
        throw new Error('Student ID / Admission ID is required.');
      }

      if (!STUDENT_ID_REGEX.test(admissionNumber)) {
        throw new Error(
          'Student ID must follow the format 9030301-2026-119.'
        );
      }

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

      if (form.resident === 'Boarding' && !form.house) {
        throw new Error(
          'Please select a house for the Boarding student.'
        );
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('You are not logged in.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('school_id, role, is_active')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.school_id) {
        throw new Error('Your account is not linked to a school.');
      }

      if (
        profile.is_active === false ||
        !['admin', 'owner'].includes(profile.role)
      ) {
        throw new Error(
          'Only an active Administrator or Owner can register students.'
        );
      }

      /*
       * Check whether this Student ID already exists in this school.
       */
      const { data: existingStudent, error: duplicateCheckError } =
        await supabase
          .from('students')
          .select('id')
          .eq('school_id', profile.school_id)
          .eq('admission_number', admissionNumber)
          .maybeSingle();

      if (duplicateCheckError) {
        throw new Error(
          'Unable to verify the Student ID. Please try again.'
        );
      }

      if (existingStudent) {
        throw new Error(
          `Student ID ${admissionNumber} is already registered.`
        );
      }

      const { error: studentError } = await supabase
        .from('students')
        .insert({
          school_id: profile.school_id,

          admission_number: admissionNumber,
          full_name: form.full_name.trim(),

          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,

          region: form.region.trim() || null,
          place_of_birth: form.place_of_birth.trim() || null,
          religion: form.religion.trim() || null,
          bece_index_number:
            form.bece_index_number.trim() || null,

          admission_date: form.admission_date,

          jhs_aggregate:
            form.jhs_aggregate.trim() === ''
              ? null
              : Number(form.jhs_aggregate),

          resident: form.resident,

          house:
            form.resident === 'Boarding'
              ? form.house
              : null,

          /*
           * Keep the existing address column populated for compatibility
           * with other parts of BIRITECH that currently use it.
           */
          address: form.address.trim() || null,

          /*
           * Also save the new dedicated residential address field.
           */
          residential_address:
            form.address.trim() || null,

          house_number:
            form.house_number.trim() || null,

          digital_address:
            form.digital_address.trim() || null,

          whatsapp_number:
            form.whatsapp_number.trim() || null,

          father_name:
            form.father_name.trim() || null,

          father_contact:
            form.father_contact.trim() || null,

          mother_name:
            form.mother_name.trim() || null,

          mother_contact:
            form.mother_contact.trim() || null,

          guardian_name:
            form.guardian_name.trim() || null,

          guardian_phone:
            form.guardian_phone.trim() || null,

          health_issues:
            form.health_issues.trim() || null,

          health_insurance_number:
            form.health_insurance_number.trim() || null,

          health_insurance_expiry_date:
            form.health_insurance_expiry_date || null,
        });

      if (studentError) {
        if (
          studentError.code === '23505' ||
          studentError.message
            .toLowerCase()
            .includes('duplicate')
        ) {
          throw new Error(
            `Student ID ${admissionNumber} is already registered.`
          );
        }

        throw new Error(studentError.message);
      }

      setSuccess(
        `Student ${form.full_name.trim()} registered successfully with Student ID ${admissionNumber}.`
      );

      setForm(emptyForm());

      setTimeout(() => {
        router.push('/students');
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to register student.'
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  const labelClass =
    'mb-2 block text-sm font-semibold text-slate-700';

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8">
      <div className="mx-auto max-w-5xl">

        {/* PAGE HEADER */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Link
                href="/students"
                className="hover:text-blue-600"
              >
                Students
              </Link>

              <i className="fa-solid fa-chevron-right text-xs" />

              <span>Add Student</span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Register Student
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Create a complete student profile including
              admission, personal, residence, parent and health
              information.
            </p>
          </div>

          <Link
            href="/students"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
          >
            <i className="fa-solid fa-arrow-left" />
            Back to Students
          </Link>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <i className="fa-solid fa-circle-exclamation mr-2" />
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <i className="fa-solid fa-circle-check mr-2" />
            {success}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* STUDENT INFORMATION */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">
              <i className="fa-solid fa-user-graduate text-blue-600" />
              Student Information
            </h2>

            <div className="grid gap-5 md:grid-cols-2">

              {/* STUDENT ID */}
              <div>
                <label className={labelClass}>
                  Student ID / Admission ID *
                </label>

                <div className="relative">
                  <i className="fa-solid fa-id-card absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                  <input
                    value={form.admission_number}
                    onChange={e =>
                      updateField(
                        'admission_number',
                        e.target.value
                      )
                    }
                    required
                    placeholder="9030301-2026-119"
                    className={`${inputClass} pl-11 font-medium`}
                  />
                </div>

                <p className="mt-1.5 text-xs text-slate-500">
                  Enter the official Student ID exactly as issued.
                  Example: 9030301-2026-119
                </p>
              </div>

              {/* BECE INDEX */}
              <div>
                <label className={labelClass}>
                  BECE Index Number
                </label>

                <input
                  value={form.bece_index_number}
                  onChange={e =>
                    updateField(
                      'bece_index_number',
                      e.target.value
                    )
                  }
                  placeholder="Enter BECE index number"
                  className={inputClass}
                />
              </div>

              {/* FULL NAME */}
              <div className="md:col-span-2">
                <label className={labelClass}>
                  Full Name *
                </label>

                <input
                  value={form.full_name}
                  onChange={e =>
                    updateField(
                      'full_name',
                      e.target.value
                    )
                  }
                  required
                  placeholder="Enter student's full name"
                  className={inputClass}
                />
              </div>

              {/* DOB */}
              <div>
                <label className={labelClass}>
                  Date of Birth
                </label>

                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={e =>
                    updateField(
                      'date_of_birth',
                      e.target.value
                    )
                  }
                  className={inputClass}
                />
              </div>

              {/* GENDER */}
              <div>
                <label className={labelClass}>
                  Gender
                </label>

                <select
                  value={form.gender}
                  onChange={e =>
                    updateField(
                      'gender',
                      e.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="">
                    Select gender
                  </option>

                  <option value="Male">
                    Male
                  </option>

                  <option value="Female">
                    Female
                  </option>
                </select>
              </div>

              {/* PLACE OF BIRTH */}
              <div>
                <label className={labelClass}>
                  Place of Birth
                </label>

                <input
                  value={form.place_of_birth}
                  onChange={e =>
                    updateField(
                      'place_of_birth',
                      e.target.value
                    )
                  }
                  placeholder="e.g. Accra"
                  className={inputClass}
                />
              </div>

              {/* REGION */}
              <div>
                <label className={labelClass}>
                  Region
                </label>

                <select
                  value={form.region}
                  onChange={e =>
                    updateField(
                      'region',
                      e.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="">
                    Select region
                  </option>

                  <option value="Ahafo">Ahafo</option>
                  <option value="Ashanti">Ashanti</option>
                  <option value="Bono">Bono</option>
                  <option value="Bono East">Bono East</option>
                  <option value="Central">Central</option>
                  <option value="Eastern">Eastern</option>
                  <option value="Greater Accra">
                    Greater Accra
                  </option>
                  <option value="North East">
                    North East
                  </option>
                  <option value="Northern">
                    Northern
                  </option>
                  <option value="Oti">Oti</option>
                  <option value="Savannah">
                    Savannah
                  </option>
                  <option value="Upper East">
                    Upper East
                  </option>
                  <option value="Upper West">
                    Upper West
                  </option>
                  <option value="Volta">Volta</option>
                  <option value="Western">
                    Western
                  </option>
                  <option value="Western North">
                    Western North
                  </option>
                </select>
              </div>

              {/* RELIGION */}
              <div>
                <label className={labelClass}>
                  Religion
                </label>

                <select
                  value={form.religion}
                  onChange={e =>
                    updateField(
                      'religion',
                      e.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="">
                    Select religion
                  </option>

                  <option value="Christianity">
                    Christianity
                  </option>

                  <option value="Islam">
                    Islam
                  </option>

                  <option value="Traditional">
                    Traditional
                  </option>

                  <option value="Other">
                    Other
                  </option>

                  <option value="None">
                    None
                  </option>
                </select>
              </div>

              {/* ADMISSION DATE */}
              <div>
                <label className={labelClass}>
                  Admission Date *
                </label>

                <input
                  type="date"
                  value={form.admission_date}
                  onChange={e =>
                    updateField(
                      'admission_date',
                      e.target.value
                    )
                  }
                  required
                  className={inputClass}
                />
              </div>

              {/* JHS AGGREGATE */}
              <div>
                <label className={labelClass}>
                  JHS Aggregate
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={form.jhs_aggregate}
                  onChange={e =>
                    updateField(
                      'jhs_aggregate',
                      e.target.value
                    )
                  }
                  placeholder="e.g. 18"
                  className={inputClass}
                />
              </div>

            </div>
          </section>

          {/* RESIDENCE */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">
              <i className="fa-solid fa-house text-violet-600" />
              Residence & Contact
            </h2>

            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label className={labelClass}>
                  Student Residence *
                </label>

                <select
                  value={form.resident}
                  onChange={e =>
                    updateField(
                      'resident',
                      e.target.value
                    )
                  }
                  required
                  className={inputClass}
                >
                  <option value="">
                    Select residence
                  </option>

                  <option value="Day">
                    Day Student
                  </option>

                  <option value="Boarding">
                    Boarding Student
                  </option>
                </select>
              </div>

              {form.resident === 'Boarding' && (
                <div>
                  <label className={labelClass}>
                    Boarding House *
                  </label>

                  <select
                    value={form.house}
                    onChange={e =>
                      updateField(
                        'house',
                        e.target.value
                      )
                    }
                    required
                    className={inputClass}
                  >
                    <option value="">
                      Select house
                    </option>

                    {houses.map(house => (
                      <option
                        key={house}
                        value={house}
                      >
                        {house}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={labelClass}>
                  House Number
                </label>

                <input
                  value={form.house_number}
                  onChange={e =>
                    updateField(
                      'house_number',
                      e.target.value
                    )
                  }
                  placeholder="Residential house number"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Digital Address
                </label>

                <input
                  value={form.digital_address}
                  onChange={e =>
                    updateField(
                      'digital_address',
                      e.target.value.toUpperCase()
                    )
                  }
                  placeholder="e.g. GA-123-4567"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  WhatsApp Number
                </label>

                <input
                  type="tel"
                  value={form.whatsapp_number}
                  onChange={e =>
                    updateField(
                      'whatsapp_number',
                      e.target.value
                    )
                  }
                  placeholder="e.g. 024 XXX XXXX"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>
                  Residential Address
                </label>

                <textarea
                  value={form.address}
                  onChange={e =>
                    updateField(
                      'address',
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Enter student's residential address"
                  className={inputClass}
                />
              </div>

            </div>
          </section>

          {/* PARENTS */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">
              <i className="fa-solid fa-people-roof text-blue-600" />
              Parent & Guardian Information
            </h2>

            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label className={labelClass}>
                  Father's Name
                </label>

                <input
                  value={form.father_name}
                  onChange={e =>
                    updateField(
                      'father_name',
                      e.target.value
                    )
                  }
                  placeholder="Father's full name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Father's Contact
                </label>

                <input
                  type="tel"
                  value={form.father_contact}
                  onChange={e =>
                    updateField(
                      'father_contact',
                      e.target.value
                    )
                  }
                  placeholder="e.g. 024 XXX XXXX"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Mother's Name
                </label>

                <input
                  value={form.mother_name}
                  onChange={e =>
                    updateField(
                      'mother_name',
                      e.target.value
                    )
                  }
                  placeholder="Mother's full name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Mother's Contact
                </label>

                <input
                  type="tel"
                  value={form.mother_contact}
                  onChange={e =>
                    updateField(
                      'mother_contact',
                      e.target.value
                    )
                  }
                  placeholder="e.g. 024 XXX XXXX"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Guardian Name
                </label>

                <input
                  value={form.guardian_name}
                  onChange={e =>
                    updateField(
                      'guardian_name',
                      e.target.value
                    )
                  }
                  placeholder="Guardian full name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Guardian Telephone
                </label>

                <input
                  type="tel"
                  value={form.guardian_phone}
                  onChange={e =>
                    updateField(
                      'guardian_phone',
                      e.target.value
                    )
                  }
                  placeholder="e.g. 024 XXX XXXX"
                  className={inputClass}
                />
              </div>

            </div>
          </section>

          {/* HEALTH */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">
              <i className="fa-solid fa-heart-pulse text-rose-600" />
              Health Information
            </h2>

            <div className="grid gap-5 md:grid-cols-2">

              <div className="md:col-span-2">
                <label className={labelClass}>
                  Health Issues / Medical Conditions
                </label>

                <textarea
                  value={form.health_issues}
                  onChange={e =>
                    updateField(
                      'health_issues',
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Enter any important health condition, allergy or medical information"
                  className={inputClass}
                />

                <p className="mt-1.5 text-xs text-slate-500">
                  Leave blank if there are no known health issues.
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  Health Insurance Number
                </label>

                <input
                  value={form.health_insurance_number}
                  onChange={e =>
                    updateField(
                      'health_insurance_number',
                      e.target.value
                    )
                  }
                  placeholder="Enter NHIS / insurance number"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Health Insurance Expiry Date
                </label>

                <input
                  type="date"
                  value={
                    form.health_insurance_expiry_date
                  }
                  onChange={e =>
                    updateField(
                      'health_insurance_expiry_date',
                      e.target.value
                    )
                  }
                  className={inputClass}
                />
              </div>

            </div>
          </section>

          {/* ACTIONS */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/students"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-user-plus" />
                  Register Student
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

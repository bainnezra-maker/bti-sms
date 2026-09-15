'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Staff = {
  id: string;
  full_name: string;
  staff_number: string;
  department: string | null;
  position: string | null;
  staff_category: 'teaching' | 'non_teaching';
  status: 'active' | 'inactive';
};

type DutyStatus =
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'cancelled';

type Duty = {
  id: string;
  school_id: string;
  staff_id: string;
  duty_type: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  status: DutyStatus;
  created_at: string | null;
  updated_at: string | null;
};

const supabase = createClient();

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition duration-300 placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100';

const emptyForm = {
  staff_id: '',
  duty_type: '',
  start_date: '',
  end_date: '',
  notes: '',
  status: 'scheduled' as DutyStatus,
};

const DUTY_TYPES = [
  'Morning Duty',
  'Closing Duty',
  'Break Duty',
  'Examination Duty',
  'Assembly Duty',
  'Weekend Duty',
  'Holiday Duty',
  'Boarding Duty',
  'Student Supervision',
  'Disciplinary Duty',
  'Event Duty',
  'Other',
];

function formatDate(value: string | null) {
  if (!value) return '—';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'ST'
  );
}

function getTodayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getWeekStart(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();

  const difference = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + difference);

  return date;
}

function getWeekEnd(dateString: string) {
  const start = getWeekStart(dateString);
  const end = new Date(start);

  end.setDate(start.getDate() + 6);

  return end;
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function overlapsRange(
  duty: Duty,
  rangeStart: string,
  rangeEnd: string
) {
  return (
    duty.start_date <= rangeEnd &&
    duty.end_date >= rangeStart
  );
}

function statusClasses(status: DutyStatus) {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700';

    case 'completed':
      return 'bg-blue-100 text-blue-700';

    case 'cancelled':
      return 'bg-red-100 text-red-700';

    default:
      return 'bg-amber-100 text-amber-700';
  }
}

function statusIcon(status: DutyStatus) {
  switch (status) {
    case 'active':
      return 'fa-solid fa-circle-play';

    case 'completed':
      return 'fa-solid fa-circle-check';

    case 'cancelled':
      return 'fa-solid fa-circle-xmark';

    default:
      return 'fa-solid fa-clock';
  }
}

export default function StaffDutyRosterPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [duties, setDuties] = useState<Duty[]>([]);

  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);

  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');

  const [selectedDate, setSelectedDate] =
    useState(getTodayString());

  const [search, setSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dutyTypeFilter, setDutyTypeFilter] =
    useState('all');

  useEffect(() => {
    loadPage();
  }, []);

  async function getProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return null;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profile?.school_id) {
      setError('School profile could not be found.');
      return null;
    }

    setSchoolId(profile.school_id);

    return {
      userId: user.id,
      schoolId: profile.school_id as string,
    };
  }

  async function loadPage() {
    setLoading(true);
    setError('');

    const profile = await getProfile();

    if (!profile) {
      setLoading(false);
      return;
    }

    const [staffResult, dutiesResult] =
      await Promise.all([
        supabase
          .from('staff')
          .select(
            'id, full_name, staff_number, department, position, staff_category, status'
          )
          .eq('school_id', profile.schoolId)
          .order('full_name', {
            ascending: true,
          }),

        supabase
          .from('staff_duty_roster')
          .select(
            'id, school_id, staff_id, duty_type, start_date, end_date, notes, status, created_at, updated_at'
          )
          .eq('school_id', profile.schoolId)
          .order('start_date', {
            ascending: true,
          }),
      ]);

    if (staffResult.error) {
      setError(staffResult.error.message);
    } else {
      setStaff((staffResult.data || []) as Staff[]);
    }

    if (dutiesResult.error) {
      setError(
        (current) =>
          current || dutiesResult.error!.message
      );
    } else {
      setDuties((dutiesResult.data || []) as Duty[]);
    }

    setLoading(false);
  }

  function openAddDuty() {
    setEditingId(null);

    setForm({
      ...emptyForm,
      start_date: selectedDate,
      end_date: selectedDate,
    });

    setError('');
    setMessage('');
    setShowForm(true);
  }

  function openEditDuty(duty: Duty) {
    setEditingId(duty.id);

    setForm({
      staff_id: duty.staff_id,
      duty_type: duty.duty_type,
      start_date: duty.start_date,
      end_date: duty.end_date,
      notes: duty.notes || '',
      status: duty.status,
    });

    setError('');
    setMessage('');
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function saveDuty(event: React.FormEvent) {
    event.preventDefault();

    setError('');
    setMessage('');

    if (!schoolId) {
      setError('School profile could not be found.');
      return;
    }

    if (!form.staff_id) {
      setError('Please select a staff member.');
      return;
    }

    if (!form.duty_type.trim()) {
      setError('Please select or enter a duty type.');
      return;
    }

    if (!form.start_date || !form.end_date) {
      setError(
        'Start date and end date are required.'
      );
      return;
    }

    if (form.end_date < form.start_date) {
      setError(
        'End date cannot be earlier than the start date.'
      );
      return;
    }

    setSaving(true);

    const payload = {
      school_id: schoolId,
      staff_id: form.staff_id,
      duty_type: form.duty_type.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      notes: form.notes.trim() || null,
      status: form.status,
    };

    if (editingId) {
      const { data, error: updateError } =
        await supabase
          .from('staff_duty_roster')
          .update(payload)
          .eq('id', editingId)
          .eq('school_id', schoolId)
          .select(
            'id, school_id, staff_id, duty_type, start_date, end_date, notes, status, created_at, updated_at'
          )
          .maybeSingle();

      if (updateError) {
        setError(updateError.message);
      } else if (!data) {
        setError(
          'Duty assignment could not be updated.'
        );
      } else {
        setDuties((current) =>
          current
            .map((item) =>
              item.id === editingId
                ? (data as Duty)
                : item
            )
            .sort((a, b) =>
              a.start_date.localeCompare(b.start_date)
            )
        );

        setMessage(
          'Duty assignment updated successfully.'
        );

        closeForm();
      }
    } else {
      const { data, error: insertError } =
        await supabase
          .from('staff_duty_roster')
          .insert(payload)
          .select(
            'id, school_id, staff_id, duty_type, start_date, end_date, notes, status, created_at, updated_at'
          )
          .single();

      if (insertError) {
        setError(insertError.message);
      } else {
        setDuties((current) =>
          [...current, data as Duty].sort((a, b) =>
            a.start_date.localeCompare(b.start_date)
          )
        );

        setMessage(
          'Duty assigned successfully.'
        );

        closeForm();
      }
    }

    setSaving(false);
  }

  async function deleteDuty(duty: Duty) {
    const person = staff.find(
      (item) => item.id === duty.staff_id
    );

    const confirmed = window.confirm(
      `Remove this duty assignment?\n\n${
        person?.full_name || 'Staff member'
      } — ${duty.duty_type}\n${formatDate(
        duty.start_date
      )} to ${formatDate(duty.end_date)}`
    );

    if (!confirmed) return;

    setError('');
    setMessage('');

    const { error: deleteError } = await supabase
      .from('staff_duty_roster')
      .delete()
      .eq('id', duty.id)
      .eq('school_id', schoolId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setDuties((current) =>
      current.filter((item) => item.id !== duty.id)
    );

    setMessage(
      'Duty assignment removed successfully.'
    );
  }

  function getStaff(staffId: string) {
    return staff.find(
      (person) => person.id === staffId
    );
  }

  const viewRange = useMemo(() => {
    if (view === 'weekly') {
      const start = getWeekStart(selectedDate);
      const end = getWeekEnd(selectedDate);

      return {
        start: toDateString(start),
        end: toDateString(end),
      };
    }

    const selected = new Date(
      `${selectedDate}T00:00:00`
    );

    const start = new Date(
      selected.getFullYear(),
      selected.getMonth(),
      1
    );

    const end = new Date(
      selected.getFullYear(),
      selected.getMonth() + 1,
      0
    );

    return {
      start: toDateString(start),
      end: toDateString(end),
    };
  }, [view, selectedDate]);

  const filteredDuties = useMemo(() => {
    const query = search.trim().toLowerCase();

    return duties.filter((duty) => {
      const person = getStaff(duty.staff_id);

      const matchesRange = overlapsRange(
        duty,
        viewRange.start,
        viewRange.end
      );

      const matchesSearch =
        !query ||
        duty.duty_type.toLowerCase().includes(query) ||
        (duty.notes || '').toLowerCase().includes(query) ||
        (person?.full_name || '')
          .toLowerCase()
          .includes(query) ||
        (person?.staff_number || '')
          .toLowerCase()
          .includes(query);

      const matchesStaff =
        staffFilter === 'all' ||
        duty.staff_id === staffFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        duty.status === statusFilter;

      const matchesDutyType =
        dutyTypeFilter === 'all' ||
        duty.duty_type === dutyTypeFilter;

      return (
        matchesRange &&
        matchesSearch &&
        matchesStaff &&
        matchesStatus &&
        matchesDutyType
      );
    });
  }, [
    duties,
    staff,
    viewRange,
    search,
    staffFilter,
    statusFilter,
    dutyTypeFilter,
  ]);

  const stats = useMemo(() => {
    const today = getTodayString();

    const scheduled = duties.filter(
      (duty) => duty.status === 'scheduled'
    ).length;

    const active = duties.filter(
      (duty) =>
        duty.status === 'active' ||
        (duty.start_date <= today &&
          duty.end_date >= today &&
          duty.status === 'scheduled')
    ).length;

    const completed = duties.filter(
      (duty) => duty.status === 'completed'
    ).length;

    const cancelled = duties.filter(
      (duty) => duty.status === 'cancelled'
    ).length;

    return {
      total: duties.length,
      scheduled,
      active,
      completed,
      cancelled,
    };
  }, [duties]);

  function shiftPeriod(direction: number) {
    const date = new Date(
      `${selectedDate}T00:00:00`
    );

    if (view === 'weekly') {
      date.setDate(date.getDate() + direction * 7);
    } else {
      date.setMonth(date.getMonth() + direction);
    }

    setSelectedDate(toDateString(date));
  }

  function periodTitle() {
    const date = new Date(
      `${selectedDate}T00:00:00`
    );

    if (view === 'weekly') {
      const start = getWeekStart(selectedDate);
      const end = getWeekEnd(selectedDate);

      return `${start.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })} – ${end.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}`;
    }

    return date.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      />

      <style jsx global>{`
        @keyframes btiDutyFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes btiDutyScale {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes btiDutyModal {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .bti-duty-page {
          animation: btiDutyFadeUp 0.55s ease-out both;
        }

        .bti-duty-card {
          animation: btiDutyFadeUp 0.45s ease-out both;
        }

        .bti-duty-stat {
          animation: btiDutyScale 0.4s ease-out both;
        }

        .bti-duty-modal {
          animation: btiDutyModal 0.3s
            cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .bti-duty-page,
          .bti-duty-card,
          .bti-duty-stat,
          .bti-duty-modal {
            animation: none !important;
          }
        }
      `}</style>

      <div className="bti-duty-page min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg transition duration-300 hover:scale-105 hover:rotate-2">
                <i className="fa-solid fa-calendar-check text-lg" />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Staff Duty Roster
                </h1>

                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                  Stage 3
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Assign, monitor, edit, reassign and remove staff
                duties from one central roster.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/staff"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition duration-300 hover:-translate-y-1 hover:bg-slate-50 hover:shadow-md"
              >
                <i className="fa-solid fa-arrow-left transition group-hover:-translate-x-1" />
                Staff Directory
              </Link>

              <button
                type="button"
                onClick={openAddDuty}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-slate-800 hover:shadow-xl"
              >
                <i className="fa-solid fa-calendar-plus transition group-hover:rotate-6" />
                Assign Duty
              </button>
            </div>
          </div>

          {/* ALERTS */}
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              <i className="fa-solid fa-circle-exclamation mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
              <i className="fa-solid fa-circle-check mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* STATS */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {[
              {
                label: 'Total Duties',
                value: stats.total,
                icon: 'fa-solid fa-list-check',
              },
              {
                label: 'Scheduled',
                value: stats.scheduled,
                icon: 'fa-solid fa-clock',
              },
              {
                label: 'Active',
                value: stats.active,
                icon: 'fa-solid fa-person-circle-check',
              },
              {
                label: 'Completed',
                value: stats.completed,
                icon: 'fa-solid fa-circle-check',
              },
              {
                label: 'Cancelled',
                value: stats.cancelled,
                icon: 'fa-solid fa-circle-xmark',
              },
            ].map((item, index) => (
              <div
                key={item.label}
                style={{
                  animationDelay: `${index * 70}ms`,
                }}
                className="bti-duty-stat group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {item.label}
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {item.value}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition duration-300 group-hover:bg-slate-900 group-hover:text-white">
                    <i className={item.icon} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* VIEW CONTROLS */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setView('weekly')}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition duration-300 ${
                    view === 'weekly'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <i className="fa-solid fa-calendar-week" />
                  Weekly
                </button>

                <button
                  type="button"
                  onClick={() => setView('monthly')}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition duration-300 ${
                    view === 'monthly'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <i className="fa-solid fa-calendar-days" />
                  Monthly
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedDate(getTodayString())
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition duration-300 hover:bg-slate-50"
                >
                  <i className="fa-solid fa-location-crosshairs" />
                  Today
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => shiftPeriod(-1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition duration-300 hover:-translate-x-0.5 hover:bg-slate-200"
                  aria-label="Previous period"
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>

                <div className="min-w-[190px] text-center">
                  <p className="text-sm font-bold text-slate-900">
                    {periodTitle()}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {view === 'weekly'
                      ? 'Weekly roster'
                      : 'Monthly roster'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => shiftPeriod(1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition duration-300 hover:translate-x-0.5 hover:bg-slate-200"
                  aria-label="Next period"
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>

              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(event.target.value)
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          {/* FILTERS */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">

              <div className="relative xl:col-span-2">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search staff, duty type or notes..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <select
                value={staffFilter}
                onChange={(event) =>
                  setStaffFilter(event.target.value)
                }
                className={inputClass}
              >
                <option value="all">All Staff</option>

                {staff.map((person) => (
                  <option
                    key={person.id}
                    value={person.id}
                  >
                    {person.full_name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className={inputClass}
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={dutyTypeFilter}
                onChange={(event) =>
                  setDutyTypeFilter(event.target.value)
                }
                className={inputClass}
              >
                <option value="all">All Duty Types</option>

                {DUTY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ROSTER */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Duty Assignments
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredDuties.length} assignment
                  {filteredDuties.length === 1 ? '' : 's'} in this
                  period
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <i className="fa-solid fa-shield-halved" />
                Staff Duty Management
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-slate-500">
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-spinner fa-spin text-lg" />
                  Loading duty roster...
                </div>
              </div>
            ) : filteredDuties.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 transition duration-300 hover:scale-110">
                  <i className="fa-solid fa-calendar-xmark text-xl" />
                </div>

                <h3 className="font-bold text-slate-800">
                  No duty assignments found
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Assign a duty or change the current filters.
                </p>

                <button
                  type="button"
                  onClick={openAddDuty}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  <i className="fa-solid fa-calendar-plus" />
                  Assign Duty
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredDuties.map((duty, index) => {
                  const person = getStaff(duty.staff_id);

                  return (
                    <div
                      key={duty.id}
                      style={{
                        animationDelay: `${Math.min(index, 12) * 45}ms`,
                      }}
                      className="bti-duty-card p-5 transition duration-300 hover:bg-slate-50/80"
                    >
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white transition duration-300 hover:scale-105 hover:rotate-2">
                            <i className="fa-solid fa-user-shield text-lg" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-bold text-slate-900">
                                {person?.full_name ||
                                  'Unknown staff'}
                              </h3>

                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                                  duty.status
                                )}`}
                              >
                                <i
                                  className={statusIcon(
                                    duty.status
                                  )}
                                />
                                {duty.status.toUpperCase()}
                              </span>
                            </div>

                            <p className="mt-1 text-sm font-semibold text-slate-600">
                              {duty.duty_type}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {person?.staff_number || '—'} ·{' '}
                              {person?.department ||
                                'No department'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-400">
                              Start Date
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-700">
                              {formatDate(
                                duty.start_date
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-400">
                              End Date
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-700">
                              {formatDate(
                                duty.end_date
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-400">
                              Notes
                            </p>

                            <p className="mt-1 truncate text-sm font-semibold text-slate-700">
                              {duty.notes || '—'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEditDuty(duty)
                            }
                            className="group inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                          >
                            <i className="fa-solid fa-pen-to-square transition group-hover:rotate-6" />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteDuty(duty)
                            }
                            className="group inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition duration-300 hover:-translate-y-0.5 hover:bg-red-50"
                          >
                            <i className="fa-solid fa-trash transition group-hover:scale-110" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FOOTER NOTE */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <i className="fa-solid fa-circle-info" />
              </div>

              <div>
                <p className="text-sm font-bold text-slate-800">
                  Central Duty Management
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Duties assigned here are stored centrally and can
                  later appear automatically in teacher dashboards,
                  My Schedule, School Calendar and notifications.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ASSIGN / EDIT DUTY MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6">
          <div className="bti-duty-modal my-4 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl sm:my-8">

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Staff Duty Roster
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {editingId
                    ? 'Edit Duty Assignment'
                    : 'Assign Staff Duty'}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition duration-300 hover:rotate-90 hover:bg-slate-200"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form
              onSubmit={saveDuty}
              className="p-5 sm:p-7"
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                <div className="sm:col-span-2 rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                      <i className="fa-solid fa-user-shield" />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Duty Assignment
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Assign a staff member to a school duty.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Staff Member <span className="text-red-500">*</span>
                  </label>

                  <select
                    value={form.staff_id}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        staff_id: event.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  >
                    <option value="">
                      Select staff member
                    </option>

                    {staff
                      .filter(
                        (person) =>
                          person.status === 'active'
                      )
                      .map((person) => (
                        <option
                          key={person.id}
                          value={person.id}
                        >
                          {person.full_name} —{' '}
                          {person.staff_number}
                          {person.department
                            ? ` · ${person.department}`
                            : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Duty Type <span className="text-red-500">*</span>
                  </label>

                  <select
                    value={
                      DUTY_TYPES.includes(
                        form.duty_type
                      )
                        ? form.duty_type
                        : 'Other'
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        duty_type:
                          event.target.value === 'Other'
                            ? ''
                            : event.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  >
                    <option value="">
                      Select duty type
                    </option>

                    {DUTY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Status
                  </label>

                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status:
                          event.target.value as DutyStatus,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="scheduled">
                      Scheduled
                    </option>
                    <option value="active">
                      Active
                    </option>
                    <option value="completed">
                      Completed
                    </option>
                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Start Date <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        start_date:
                          event.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    End Date <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="date"
                    value={form.end_date}
                    min={form.start_date || undefined}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        end_date:
                          event.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Notes
                  </label>

                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        notes: event.target.value,
                      })
                    }
                    rows={4}
                    placeholder="Optional instructions or notes about this duty..."
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-60"
                >
                  <i
                    className={
                      saving
                        ? 'fa-solid fa-spinner fa-spin'
                        : editingId
                          ? 'fa-solid fa-floppy-disk'
                          : 'fa-solid fa-calendar-plus'
                    }
                  />

                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Save Changes'
                      : 'Assign Duty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

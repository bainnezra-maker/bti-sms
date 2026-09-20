'use client';

import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faArrowRight,
  faCalendarDays,
  faCheck,
  faChevronDown,
  faCircleExclamation,
  faCloudArrowUp,
  faDownload,
  faFileExcel,
  faFilter,
  faPlus,
  faRotate,
  faTrash,
  faPen,
  faXmark,
  faUsers,
  faMagnifyingGlass,
  faCalendarPlus,
  faCircleCheck,
  faTriangleExclamation,
  faUpload,
  faListCheck,
  faTableCellsLarge,
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

type Staff = {
  id: string;
  full_name: string;
  staff_number?: string | null;
  department?: string | null;
  position?: string | null;
  status?: string | null;
};

type AcademicYear = {
  id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
};

type Activity = {
  id: string;
  school_id: string;
  academic_year_id: string;
  title: string;
  activity_date: string;
  end_date?: string | null;
  description?: string | null;
  activity_type?: string | null;
  is_all_staff?: boolean | null;
  created_at?: string | null;
  responsible_staff?: {
    id: string;
    staff_id: string;
    staff?: Staff | Staff[] | null;
  }[];
};

type ActivityForm = {
  activity_date: string;
  title: string;
  staff_ids: string[];
};

type ImportRow = {
  rowNumber: number;
  date: string;
  title: string;
  personnel: string;
  staffIds: string[];
  matchedStaff: string[];
  unmatchedStaff: string[];
  valid: boolean;
  error?: string;
};

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  if (!value) return '';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatLongDate(value: string) {
  if (!value) return '';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function parseExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) {
      return null;
    }

    const date = new Date(
      parsed.y,
      parsed.m - 1,
      parsed.d
    );

    return formatDateInput(date);
  }

  const raw = String(value).trim();

  if (!raw) {
    return null;
  }

  // yyyy-mm-dd
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (!Number.isNaN(date.getTime())) {
      return formatDateInput(date);
    }
  }

  // dd/mm/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/').map(Number);
    const date = new Date(year, month - 1, day);

    if (!Number.isNaN(date.getTime())) {
      return formatDateInput(date);
    }
  }

  // dd-mm-yyyy
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (!Number.isNaN(date.getTime())) {
      return formatDateInput(date);
    }
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return formatDateInput(parsed);
  }

  return null;
}

function splitPersonnel(value: string) {
  return value
    .split(/,|;|\s+&\s+|\s+and\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ActivityCalendarPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [schoolId, setSchoolId] = useState('');
  const [userId, setUserId] = useState('');

  const [staff, setStaff] = useState<Staff[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [currentMonth, setCurrentMonth] = useState(
    new Date().getMonth()
  );

  const [currentYear, setCurrentYear] = useState(
    new Date().getFullYear()
  );

  const [search, setSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] =
    useState<Activity | null>(null);

  const [form, setForm] = useState<ActivityForm>({
    activity_date: formatDateInput(new Date()),
    title: '',
    staff_ids: [],
  });

  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [selectedImportFile, setSelectedImportFile] =
    useState<File | null>(null);

  const [importMessage, setImportMessage] = useState('');

  const currentAcademicYear = useMemo(() => {
    return (
      academicYears.find((year) => year.is_current) ||
      academicYears.find((year) => {
        const today = new Date();
        const start = year.start_date
          ? new Date(year.start_date)
          : null;
        const end = year.end_date
          ? new Date(year.end_date)
          : null;

        if (!start || !end) return false;

        return today >= start && today <= end;
      }) ||
      academicYears[0] ||
      null
    );
  }, [academicYears]);

  const staffMap = useMemo(() => {
    const map = new Map<string, Staff>();

    staff.forEach((person) => {
      map.set(normalizeName(person.full_name), person);
    });

    return map;
  }, [staff]);

  const filteredActivities = useMemo(() => {
    const query = search.toLowerCase().trim();

    return activities.filter((activity) => {
      const personnel = (activity.responsible_staff || [])
        .map((item) => {
          const person = Array.isArray(item.staff)
            ? item.staff[0]
            : item.staff;

          return person?.full_name || '';
        })
        .join(' ');

      const matchesSearch =
        !query ||
        activity.title.toLowerCase().includes(query) ||
        personnel.toLowerCase().includes(query);

      const matchesStaff =
        selectedStaff === 'all' ||
        (activity.responsible_staff || []).some(
          (item) => item.staff_id === selectedStaff
        );

      return matchesSearch && matchesStaff;
    });
  }, [activities, search, selectedStaff]);

  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();

    filteredActivities.forEach((activity) => {
      const existing = map.get(activity.activity_date) || [];
      existing.push(activity);
      map.set(activity.activity_date, existing);
    });

    return map;
  }, [filteredActivities]);

  const monthDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(
      currentYear,
      currentMonth + 1,
      0
    ).getDate();

    const cells: (number | null)[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(day);
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [currentMonth, currentYear]);

  const todayKey = formatDateInput(new Date());

  const selectedDayActivities = useMemo(() => {
    if (!selectedDay) return [];

    return filteredActivities.filter(
      (activity) => activity.activity_date === selectedDay
    );
  }, [filteredActivities, selectedDay]);

  const upcomingActivities = useMemo(() => {
    return [...filteredActivities]
      .filter((activity) => activity.activity_date >= todayKey)
      .sort((a, b) =>
        a.activity_date.localeCompare(b.activity_date)
      )
      .slice(0, 8);
  }, [filteredActivities, todayKey]);

  const totalActivities = filteredActivities.length;

  const todayActivities = filteredActivities.filter(
    (activity) => activity.activity_date === todayKey
  ).length;

  const upcomingCount = filteredActivities.filter(
    (activity) => activity.activity_date > todayKey
  ).length;

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('You must be logged in to access the Activity Calendar.');
      }

      setUserId(user.id);

      const { data: profile, error: profileError } =
        await supabase
          .from('users')
          .select('id, school_id, role')
          .eq('id', user.id)
          .single();

      if (profileError || !profile) {
        throw new Error('Unable to load your school profile.');
      }

      if (
        profile.role !== 'admin' &&
        profile.role !== 'owner' &&
        profile.role !== 'super_admin'
      ) {
        throw new Error(
          'Only school administrators can manage the Activity Calendar.'
        );
      }

      setSchoolId(profile.school_id);

      await Promise.all([
        loadActivities(profile.school_id),
        loadStaff(profile.school_id),
        loadAcademicYears(profile.school_id),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Activity Calendar.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadActivities(currentSchoolId = schoolId) {
    if (!currentSchoolId) return;

    const { data, error: activityError } = await supabase
      .from('school_activities')
      .select(`
        id,
        school_id,
        academic_year_id,
        title,
        activity_date,
        end_date,
        description,
        activity_type,
        is_all_staff,
        created_at,
        responsible_staff:school_activity_responsible_staff (
          id,
          staff_id,
          staff:staff (
            id,
            full_name,
            staff_number,
            department,
            position,
            status
          )
        )
      `)
      .eq('school_id', currentSchoolId)
      .order('activity_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (activityError) {
      throw new Error(activityError.message);
    }

    setActivities((data || []) as Activity[]);
  }

  async function loadStaff(currentSchoolId = schoolId) {
    if (!currentSchoolId) return;

    const { data, error: staffError } = await supabase
      .from('staff')
      .select(
        'id, full_name, staff_number, department, position, status'
      )
      .eq('school_id', currentSchoolId)
      .order('full_name', { ascending: true });

    if (staffError) {
      throw new Error(staffError.message);
    }

    setStaff((data || []) as Staff[]);
  }

  async function loadAcademicYears(currentSchoolId = schoolId) {
    if (!currentSchoolId) return;

    const { data, error: yearError } = await supabase
      .from('academic_years')
      .select(
        'id, name, start_date, end_date, is_current'
      )
      .eq('school_id', currentSchoolId)
      .order('start_date', { ascending: false });

    if (yearError) {
      throw new Error(yearError.message);
    }

    setAcademicYears((data || []) as AcademicYear[]);
  }

  function getAcademicYearForDate(dateString: string) {
    const date = new Date(`${dateString}T00:00:00`);

    return (
      academicYears.find((year) => {
        if (!year.start_date || !year.end_date) return false;

        const start = new Date(`${year.start_date}T00:00:00`);
        const end = new Date(`${year.end_date}T23:59:59`);

        return date >= start && date <= end;
      }) ||
      currentAcademicYear ||
      null
    );
  }

  function resetForm() {
    setForm({
      activity_date: formatDateInput(new Date()),
      title: '',
      staff_ids: [],
    });
  }

  function openAddModal(date?: string) {
    setSuccess('');
    setError('');

    setForm({
      activity_date:
        date || formatDateInput(new Date()),
      title: '',
      staff_ids: [],
    });

    setShowAddModal(true);
  }

  function openEditModal(activity: Activity) {
    const ids = (activity.responsible_staff || []).map(
      (item) => item.staff_id
    );

    setEditingActivity(activity);

    setForm({
      activity_date: activity.activity_date,
      title: activity.title,
      staff_ids: ids,
    });

    setShowEditModal(true);
  }

  function toggleStaff(staffId: string) {
    setForm((previous) => ({
      ...previous,
      staff_ids: previous.staff_ids.includes(staffId)
        ? previous.staff_ids.filter((id) => id !== staffId)
        : [...previous.staff_ids, staffId],
    }));
  }

  function getPersonnelNames(activity: Activity) {
    return (activity.responsible_staff || [])
      .map((item) => {
        const person = Array.isArray(item.staff)
          ? item.staff[0]
          : item.staff;

        return person?.full_name || '';
      })
      .filter(Boolean);
  }

  async function saveActivity() {
    if (!schoolId || !userId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!form.activity_date) {
        throw new Error('Please select the activity date.');
      }

      if (!form.title.trim()) {
        throw new Error('Please enter the activity.');
      }

      if (form.staff_ids.length === 0) {
        throw new Error(
          'Please select at least one personnel responsible.'
        );
      }

      const academicYear = getAcademicYearForDate(
        form.activity_date
      );

      if (!academicYear) {
        throw new Error(
          'No academic year could be matched to this activity date.'
        );
      }

      if (editingActivity) {
        const { error: updateError } = await supabase
          .from('school_activities')
          .update({
            academic_year_id: academicYear.id,
            title: form.title.trim(),
            activity_date: form.activity_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingActivity.id)
          .eq('school_id', schoolId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        const { error: deleteResponsibleError } =
          await supabase
            .from('school_activity_responsible_staff')
            .delete()
            .eq('activity_id', editingActivity.id);

        if (deleteResponsibleError) {
          throw new Error(deleteResponsibleError.message);
        }

        const responsibleRows = form.staff_ids.map(
          (staffId) => ({
            activity_id: editingActivity.id,
            staff_id: staffId,
          })
        );

        const { error: responsibleError } =
          await supabase
            .from('school_activity_responsible_staff')
            .insert(responsibleRows);

        if (responsibleError) {
          throw new Error(responsibleError.message);
        }

        setSuccess('Activity updated successfully.');
      } else {
        const { data: createdActivity, error: insertError } =
          await supabase
            .from('school_activities')
            .insert({
              school_id: schoolId,
              academic_year_id: academicYear.id,
              title: form.title.trim(),
              activity_date: form.activity_date,
              end_date: form.activity_date,
              description: null,
              activity_type: 'general',
              is_all_staff: false,
              created_by: userId,
            })
            .select('id')
            .single();

        if (insertError || !createdActivity) {
          throw new Error(
            insertError?.message ||
              'Unable to create the activity.'
          );
        }

        const responsibleRows = form.staff_ids.map(
          (staffId) => ({
            activity_id: createdActivity.id,
            staff_id: staffId,
          })
        );

        const { error: responsibleError } =
          await supabase
            .from('school_activity_responsible_staff')
            .insert(responsibleRows);

        if (responsibleError) {
          await supabase
            .from('school_activities')
            .delete()
            .eq('id', createdActivity.id);

          throw new Error(responsibleError.message);
        }

        setSuccess('Activity added successfully.');
      }

      setShowAddModal(false);
      setShowEditModal(false);
      setEditingActivity(null);
      resetForm();

      await loadActivities();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save activity.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteActivity(activity: Activity) {
    const confirmed = window.confirm(
      `Delete "${activity.title}" from the Activity Calendar?`
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');

    const { error: deleteError } = await supabase
      .from('school_activities')
      .delete()
      .eq('id', activity.id)
      .eq('school_id', schoolId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSuccess('Activity deleted successfully.');
    await loadActivities();
  }

  function downloadTemplate() {
    const rows = [
      {
        Date: '15/09/2026',
        Activity: 'Staff Meeting',
        'Personnel Responsible': 'John Mensah',
      },
      {
        Date: '20/09/2026',
        Activity: 'Science Practical Examination',
        'Personnel Responsible': 'Mary Asante, Daniel Owusu',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 45 },
      { wch: 40 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Activity Calendar'
    );

    XLSX.writeFile(
      workbook,
      'BTI-Activity-Calendar-Template.xlsx'
    );
  }

  async function processImportFile(file: File) {
    setSelectedImportFile(file);
    setImportRows([]);
    setImportMessage('');
    setError('');

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
      });

      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error('The Excel file does not contain a worksheet.');
      }

      const worksheet =
        workbook.Sheets[firstSheetName];

      const rawRows = XLSX.utils.sheet_to_json<
        Record<string, unknown>
      >(worksheet, {
        defval: '',
      });

      if (rawRows.length === 0) {
        throw new Error(
          'The Excel file does not contain any activity rows.'
        );
      }

      const rows: ImportRow[] = rawRows.map(
        (rawRow, index) => {
          const dateValue =
            rawRow.Date ??
            rawRow.date ??
            rawRow['Activity Date'] ??
            rawRow['activity date'];

          const activityValue =
            rawRow.Activity ??
            rawRow.activity ??
            rawRow.Title ??
            rawRow.title;

          const personnelValue =
            rawRow['Personnel Responsible'] ??
            rawRow['Personnel responsible'] ??
            rawRow['Personnel in Charge'] ??
            rawRow['Personnel in charge'] ??
            rawRow.personnel ??
            rawRow.Personnel;

          const date = parseExcelDate(dateValue);

          const title = String(
            activityValue ?? ''
          ).trim();

          const personnel = String(
            personnelValue ?? ''
          ).trim();

          const personnelNames =
            splitPersonnel(personnel);

          const matchedStaff: string[] = [];
          const unmatchedStaff: string[] = [];
          const staffIds: string[] = [];

          personnelNames.forEach((name) => {
            const person = staffMap.get(
              normalizeName(name)
            );

            if (person) {
              matchedStaff.push(person.full_name);
              staffIds.push(person.id);
            } else {
              unmatchedStaff.push(name);
            }
          });

          let errorMessage = '';

          if (!date) {
            errorMessage =
              'Invalid or missing date.';
          } else if (!title) {
            errorMessage =
              'Missing activity.';
          } else if (!personnel) {
            errorMessage =
              'Missing personnel responsible.';
          } else if (unmatchedStaff.length > 0) {
            errorMessage =
              `Personnel not found: ${unmatchedStaff.join(
                ', '
              )}`;
          }

          return {
            rowNumber: index + 2,
            date: date || '',
            title,
            personnel,
            staffIds,
            matchedStaff,
            unmatchedStaff,
            valid: !errorMessage,
            error: errorMessage || undefined,
          };
        }
      );

      setImportRows(rows);

      const validCount = rows.filter(
        (row) => row.valid
      ).length;

      const invalidCount = rows.length - validCount;

      setImportMessage(
        `${validCount} valid row${
          validCount === 1 ? '' : 's'
        } and ${invalidCount} invalid row${
          invalidCount === 1 ? '' : 's'
        } found.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to read the Excel file.'
      );
    }
  }

  async function importActivities() {
    if (!schoolId || !userId) return;

    const validRows = importRows.filter(
      (row) => row.valid
    );

    if (validRows.length === 0) {
      setError(
        'There are no valid activity rows to import.'
      );
      return;
    }

    setImporting(true);
    setError('');
    setSuccess('');

    try {
      let importedCount = 0;
      let skippedCount = 0;

      for (const row of validRows) {
        const academicYear = getAcademicYearForDate(
          row.date
        );

        if (!academicYear) {
          skippedCount++;
          continue;
        }

        const { data: existingActivity } =
          await supabase
            .from('school_activities')
            .select('id')
            .eq('school_id', schoolId)
            .eq('activity_date', row.date)
            .eq('title', row.title)
            .maybeSingle();

        if (existingActivity) {
          skippedCount++;
          continue;
        }

        const { data: activity, error: activityError } =
          await supabase
            .from('school_activities')
            .insert({
              school_id: schoolId,
              academic_year_id: academicYear.id,
              title: row.title,
              activity_date: row.date,
              end_date: row.date,
              description: null,
              activity_type: 'general',
              is_all_staff: false,
              created_by: userId,
            })
            .select('id')
            .single();

        if (activityError || !activity) {
          throw new Error(
            activityError?.message ||
              `Unable to import row ${row.rowNumber}.`
          );
        }

        const responsibleRows = row.staffIds.map(
          (staffId) => ({
            activity_id: activity.id,
            staff_id: staffId,
          })
        );

        const { error: responsibleError } =
          await supabase
            .from('school_activity_responsible_staff')
            .insert(responsibleRows);

        if (responsibleError) {
          await supabase
            .from('school_activities')
            .delete()
            .eq('id', activity.id);

          throw new Error(
            `Row ${row.rowNumber}: ${responsibleError.message}`
          );
        }

        importedCount++;
      }

      setSuccess(
        `${importedCount} activit${
          importedCount === 1 ? 'y' : 'ies'
        } imported successfully${
          skippedCount
            ? `; ${skippedCount} skipped.`
            : '.'
        }`
      );

      setShowImportModal(false);
      setSelectedImportFile(null);
      setImportRows([]);
      setImportMessage('');

      await loadActivities();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to import activities.'
      );
    } finally {
      setImporting(false);
    }
  }

  function goPreviousMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((year) => year - 1);
    } else {
      setCurrentMonth((month) => month - 1);
    }
  }

  function goNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((year) => year + 1);
    } else {
      setCurrentMonth((month) => month + 1);
    }
  }

  function goToday() {
    const today = new Date();

    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  }

  function openDay(day: number) {
    const date = new Date(
      currentYear,
      currentMonth,
      day
    );

    const key = formatDateInput(date);

    setSelectedDay(key);

    if (
      activitiesByDate.has(key) ||
      key === todayKey
    ) {
      setShowDayModal(true);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
          <div className="h-32 rounded-3xl bg-slate-900" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 rounded-2xl bg-slate-900"
              />
            ))}
          </div>

          <div className="h-[520px] rounded-3xl bg-slate-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 md:px-6 lg:py-6">

        {/* Header */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/70 p-5 shadow-2xl md:p-7">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-300">
                <FontAwesomeIcon icon={faCalendarDays} />
                School Activities
              </div>

              <h1 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">
                Activity Calendar
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
                Plan, import, manage and monitor the school&apos;s
                activities from one unified calendar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => openAddModal()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 active:scale-95"
              >
                <FontAwesomeIcon icon={faPlus} />
                Add Activity
              </button>

              <button
                onClick={() => {
                  setError('');
                  setSuccess('');
                  setShowImportModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 active:scale-95"
              >
                <FontAwesomeIcon icon={faFileExcel} />
                Import Calendar
              </button>

              <button
                onClick={() => loadActivities()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 active:scale-95"
              >
                <FontAwesomeIcon icon={faRotate} />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {/* Alerts */}
        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            <FontAwesomeIcon
              icon={faCircleExclamation}
              className="mt-0.5"
            />
            <span>{error}</span>

            <button
              onClick={() => setError('')}
              className="ml-auto text-rose-300 hover:text-white"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}

        {success && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <FontAwesomeIcon
              icon={faCircleCheck}
              className="mt-0.5"
            />
            <span>{success}</span>

            <button
              onClick={() => setSuccess('')}
              className="ml-auto text-emerald-300 hover:text-white"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}

        {/* Statistics */}
        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: 'Total Activities',
              value: totalActivities,
              icon: faCalendarDays,
              style:
                'from-indigo-500/20 to-indigo-500/5 border-indigo-400/10',
              iconStyle: 'bg-indigo-500/15 text-indigo-300',
            },
            {
              label: 'Today',
              value: todayActivities,
              icon: faCalendarPlus,
              style:
                'from-cyan-500/20 to-cyan-500/5 border-cyan-400/10',
              iconStyle: 'bg-cyan-500/15 text-cyan-300',
            },
            {
              label: 'Upcoming',
              value: upcomingCount,
              icon: faListCheck,
              style:
                'from-emerald-500/20 to-emerald-500/5 border-emerald-400/10',
              iconStyle: 'bg-emerald-500/15 text-emerald-300',
            },
            {
              label: 'Personnel',
              value: staff.length,
              icon: faUsers,
              style:
                'from-violet-500/20 to-violet-500/5 border-violet-400/10',
              iconStyle: 'bg-violet-500/15 text-violet-300',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border bg-gradient-to-br p-4 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${stat.style}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">
                    {stat.label}
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {stat.value}
                  </p>
                </div>

                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconStyle}`}
                >
                  <FontAwesomeIcon icon={stat.icon} />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Filters */}
        <section className="mt-5 rounded-2xl border border-white/10 bg-slate-900/80 p-3 shadow-xl backdrop-blur md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search activities or personnel..."
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-500/50"
              />
            </div>

            <div className="relative min-w-[220px]">
              <FontAwesomeIcon
                icon={faFilter}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <select
                value={selectedStaff}
                onChange={(event) =>
                  setSelectedStaff(event.target.value)
                }
                className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/80 py-3 pl-11 pr-10 text-sm text-white outline-none focus:border-indigo-500/50"
              >
                <option value="all">
                  All Personnel
                </option>

                {staff.map((person) => (
                  <option
                    key={person.id}
                    value={person.id}
                  >
                    {person.full_name}
                  </option>
                ))}
              </select>

              <FontAwesomeIcon
                icon={faChevronDown}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </div>
          </div>
        </section>

        {/* Calendar */}
        <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur">
          {/* Calendar toolbar */}
          <div className="flex flex-col gap-4 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between md:p-5">
            <div>
              <h2 className="text-xl font-black">
                {MONTHS[currentMonth]} {currentYear}
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Click a date to view activities or add one.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={goPreviousMonth}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
              </button>

              <button
                onClick={goToday}
                className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-2.5 text-sm font-bold text-indigo-300 transition hover:bg-indigo-500/20"
              >
                Today
              </button>

              <button
                onClick={goNextMonth}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
              >
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 border-b border-white/10 bg-slate-950/70">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="border-r border-white/5 px-1 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500 last:border-r-0 sm:text-xs"
              >
                <span className="hidden sm:inline">
                  {day}
                </span>
                <span className="sm:hidden">
                  {day.slice(0, 3)}
                </span>
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {monthDays.map((day, index) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="min-h-[100px] border-b border-r border-white/5 bg-slate-950/20 p-1 sm:min-h-[125px]"
                  />
                );
              }

              const date = new Date(
                currentYear,
                currentMonth,
                day
              );

              const dateKey = formatDateInput(date);
              const dayActivities =
                activitiesByDate.get(dateKey) || [];

              const isToday =
                dateKey === todayKey;

              return (
                <button
                  key={dateKey}
                  onClick={() => openDay(day)}
                  className={`group min-h-[100px] border-b border-r border-white/5 p-1 text-left align-top transition hover:bg-indigo-500/5 sm:min-h-[125px] sm:p-2 ${
                    isToday
                      ? 'bg-indigo-500/[0.07]'
                      : 'bg-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black transition ${
                        isToday
                          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                          : 'text-slate-400 group-hover:bg-white/10 group-hover:text-white'
                      }`}
                    >
                      {day}
                    </span>

                    {dayActivities.length > 0 && (
                      <span className="rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">
                        {dayActivities.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    {dayActivities
                      .slice(0, 3)
                      .map((activity) => (
                        <div
                          key={activity.id}
                          className="rounded-md border border-indigo-400/10 bg-indigo-500/10 px-1.5 py-1"
                        >
                          <p className="line-clamp-2 text-[10px] font-semibold leading-4 text-indigo-200 sm:text-xs">
                            {activity.title}
                          </p>
                        </div>
                      ))}

                    {dayActivities.length > 3 && (
                      <p className="px-1 text-[9px] font-semibold text-slate-500">
                        +{dayActivities.length - 3} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Upcoming activities */}
        <section className="mt-5 rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-2xl md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">
                Upcoming Activities
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                The next scheduled activities in your school calendar.
              </p>
            </div>

            <FontAwesomeIcon
              icon={faCalendarDays}
              className="text-indigo-400"
            />
          </div>

          {upcomingActivities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-8 text-center">
              <FontAwesomeIcon
                icon={faCalendarDays}
                className="text-3xl text-slate-700"
              />

              <p className="mt-3 text-sm font-semibold text-slate-400">
                No upcoming activities.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {upcomingActivities.map((activity) => {
                const personnel =
                  getPersonnelNames(activity);

                return (
                  <div
                    key={activity.id}
                    className="group rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition duration-300 hover:-translate-y-1 hover:border-indigo-400/20 hover:bg-slate-950/80"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                        <FontAwesomeIcon
                          icon={faCalendarDays}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-indigo-300">
                          {formatDisplayDate(
                            activity.activity_date
                          )}
                        </p>

                        <h3 className="mt-1 truncate text-sm font-black text-white">
                          {activity.title}
                        </h3>

                        <div className="mt-2 flex items-start gap-2 text-xs text-slate-500">
                          <FontAwesomeIcon
                            icon={faUsers}
                            className="mt-0.5"
                          />

                          <span className="line-clamp-2">
                            {personnel.length > 0
                              ? personnel.join(', ')
                              : 'No personnel assigned'}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditModal(activity);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-indigo-500/10 hover:text-indigo-300"
                          title="Edit"
                        >
                          <FontAwesomeIcon icon={faPen} />
                        </button>

                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteActivity(activity);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                          title="Delete"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ADD / EDIT MODAL */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-900/95 p-5 backdrop-blur">
              <div>
                <div className="flex items-center gap-2 text-indigo-300">
                  <FontAwesomeIcon
                    icon={
                      editingActivity
                        ? faPen
                        : faCalendarPlus
                    }
                  />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {editingActivity
                      ? 'Edit Activity'
                      : 'New Activity'}
                  </span>
                </div>

                <h2 className="mt-1 text-xl font-black">
                  {editingActivity
                    ? 'Update Activity'
                    : 'Add Activity'}
                </h2>
              </div>

              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  setEditingActivity(null);
                  resetForm();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* Date */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-300">
                  Date
                </label>

                <input
                  type="date"
                  value={form.activity_date}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      activity_date:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Activity */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-300">
                  Activity
                </label>

                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Staff Meeting"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-500/50"
                />
              </div>

              {/* Personnel */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-300">
                    Personnel Responsible
                  </label>

                  <span className="text-xs text-slate-500">
                    {form.staff_ids.length} selected
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-2">
                  {staff.length === 0 ? (
                    <div className="p-5 text-center text-sm text-slate-500">
                      No staff found.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {staff.map((person) => {
                        const selected =
                          form.staff_ids.includes(
                            person.id
                          );

                        return (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() =>
                              toggleStaff(person.id)
                            }
                            className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                              selected
                                ? 'bg-indigo-500/10 text-white'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                                selected
                                  ? 'border-indigo-400 bg-indigo-500 text-white'
                                  : 'border-white/20 bg-white/5'
                              }`}
                            >
                              {selected && (
                                <FontAwesomeIcon
                                  icon={faCheck}
                                  className="text-[10px]"
                                />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {person.full_name}
                              </p>

                              <p className="truncate text-xs text-slate-600">
                                {[
                                  person.staff_number,
                                  person.position,
                                  person.department,
                                ]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingActivity(null);
                    resetForm();
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  onClick={saveActivity}
                  disabled={saving}
                  className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <FontAwesomeIcon
                        icon={faRotate}
                        className="mr-2 animate-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon
                        icon={faCheck}
                        className="mr-2"
                      />
                      {editingActivity
                        ? 'Save Changes'
                        : 'Add Activity'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-slate-900/95 p-5 backdrop-blur">
              <div>
                <div className="flex items-center gap-2 text-emerald-300">
                  <FontAwesomeIcon icon={faFileExcel} />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Activity Calendar Import
                  </span>
                </div>

                <h2 className="mt-1 text-xl font-black">
                  Import Activities from Excel
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Upload the school&apos;s three-column activity
                  calendar.
                </p>
              </div>

              <button
                onClick={() => {
                  if (importing) return;

                  setShowImportModal(false);
                  setSelectedImportFile(null);
                  setImportRows([]);
                  setImportMessage('');
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* Instructions */}
              <div className="rounded-2xl border border-indigo-400/10 bg-indigo-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                    <FontAwesomeIcon icon={faTableCellsLarge} />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white">
                      Excel format
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Your Excel file should contain exactly these
                      three main columns:
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        'Date',
                        'Activity',
                        'Personnel Responsible',
                      ].map((column) => (
                        <span
                          key={column}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300"
                        >
                          {column}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Template */}
              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold">
                    Need the template?
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Download the official BIRITECH SMS activity calendar
                    Excel template.
                  </p>
                </div>

                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  <FontAwesomeIcon icon={faDownload} />
                  Download Template
                </button>
              </div>

              {/* File upload */}
              <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-slate-950/50 p-8 text-center transition hover:border-indigo-400/30 hover:bg-indigo-500/5">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(event) => {
                    const file =
                      event.target.files?.[0];

                    if (file) {
                      processImportFile(file);
                    }
                  }}
                />

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-2xl text-indigo-300 transition group-hover:scale-110">
                  <FontAwesomeIcon
                    icon={faCloudArrowUp}
                  />
                </div>

                <h3 className="mt-4 text-sm font-black">
                  {selectedImportFile
                    ? selectedImportFile.name
                    : 'Choose Activity Calendar Excel File'}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  XLSX, XLS or CSV files
                </p>
              </label>

              {/* Import result message */}
              {importMessage && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                  <FontAwesomeIcon
                    icon={faCircleCheck}
                    className="mr-2 text-emerald-400"
                  />
                  {importMessage}
                </div>
              )}

              {/* Preview */}
              {importRows.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black">
                        Import Preview
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Activities shown here will be written into the
                        same calendar used by manual entries.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="min-w-[850px] w-full text-left text-sm">
                      <thead className="bg-slate-950">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                            Row
                          </th>

                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                            Date
                          </th>

                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                            Activity
                          </th>

                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                            Personnel
                          </th>

                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/5">
                        {importRows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={
                              row.valid
                                ? 'bg-transparent'
                                : 'bg-rose-500/5'
                            }
                          >
                            <td className="px-4 py-3 text-slate-500">
                              {row.rowNumber}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                              {row.date
                                ? formatDisplayDate(
                                    row.date
                                  )
                                : '—'}
                            </td>

                            <td className="px-4 py-3 font-semibold text-white">
                              {row.title || '—'}
                            </td>

                            <td className="px-4 py-3">
                              {row.matchedStaff.length > 0 && (
                                <div className="space-y-1">
                                  {row.matchedStaff.map(
                                    (person) => (
                                      <div
                                        key={person}
                                        className="text-xs text-emerald-300"
                                      >
                                        <FontAwesomeIcon
                                          icon={faCheck}
                                          className="mr-1"
                                        />
                                        {person}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}

                              {row.unmatchedStaff.length >
                                0 && (
                                <div className="mt-2 space-y-1">
                                  {row.unmatchedStaff.map(
                                    (person) => (
                                      <div
                                        key={person}
                                        className="text-xs text-rose-300"
                                      >
                                        <FontAwesomeIcon
                                          icon={
                                            faCircleExclamation
                                          }
                                          className="mr-1"
                                        />
                                        {person}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}

                              {!row.matchedStaff.length &&
                                !row.unmatchedStaff.length && (
                                  <span className="text-xs text-slate-600">
                                    —
                                  </span>
                                )}
                            </td>

                            <td className="px-4 py-3">
                              {row.valid ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
                                  <FontAwesomeIcon
                                    icon={faCheck}
                                  />
                                  Ready
                                </span>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-300">
                                    <FontAwesomeIcon
                                      icon={
                                        faTriangleExclamation
                                      }
                                    />
                                    Invalid
                                  </span>

                                  <p className="mt-1 max-w-xs text-[11px] text-rose-400">
                                    {row.error}
                                  </p>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import buttons */}
              <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  onClick={() => {
                    if (importing) return;

                    setShowImportModal(false);
                    setSelectedImportFile(null);
                    setImportRows([]);
                    setImportMessage('');
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  onClick={importActivities}
                  disabled={
                    importing ||
                    importRows.length === 0 ||
                    !importRows.some((row) => row.valid)
                  }
                  className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {importing ? (
                    <>
                      <FontAwesomeIcon
                        icon={faRotate}
                        className="mr-2 animate-spin"
                      />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon
                        icon={faUpload}
                        className="mr-2"
                      />
                      Import Activities
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAY DETAILS MODAL */}
      {showDayModal && selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-900/95 p-5 backdrop-blur">
              <div>
                <div className="flex items-center gap-2 text-indigo-300">
                  <FontAwesomeIcon icon={faCalendarDays} />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Daily Activities
                  </span>
                </div>

                <h2 className="mt-1 text-xl font-black">
                  {formatLongDate(selectedDay)}
                </h2>
              </div>

              <button
                onClick={() => setShowDayModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="space-y-3 p-5">
              {selectedDayActivities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
                  <FontAwesomeIcon
                    icon={faCalendarPlus}
                    className="text-3xl text-slate-700"
                  />

                  <p className="mt-3 text-sm text-slate-500">
                    No activities for this date.
                  </p>
                </div>
              ) : (
                selectedDayActivities.map(
                  (activity) => {
                    const personnel =
                      getPersonnelNames(activity);

                    return (
                      <div
                        key={activity.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition hover:border-indigo-400/20"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                            <FontAwesomeIcon
                              icon={faCalendarDays}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="font-black text-white">
                              {activity.title}
                            </h3>

                            <div className="mt-2 flex items-start gap-2 text-xs text-slate-500">
                              <FontAwesomeIcon
                                icon={faUsers}
                                className="mt-0.5"
                              />

                              <span>
                                {personnel.length > 0
                                  ? personnel.join(', ')
                                  : 'No personnel assigned'}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setShowDayModal(false);
                                openEditModal(activity);
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-300"
                              title="Edit"
                            >
                              <FontAwesomeIcon
                                icon={faPen}
                              />
                            </button>

                            <button
                              onClick={() =>
                                deleteActivity(activity)
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                              title="Delete"
                            >
                              <FontAwesomeIcon
                                icon={faTrash}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )
              )}

              <button
                onClick={() => {
                  setShowDayModal(false);
                  openAddModal(selectedDay);
                }}
                className="mt-2 w-full rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm font-bold text-indigo-300 transition hover:bg-indigo-500/20"
              >
                <FontAwesomeIcon
                  icon={faPlus}
                  className="mr-2"
                />
                Add Activity for This Date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

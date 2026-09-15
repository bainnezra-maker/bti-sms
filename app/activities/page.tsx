'use client';

import {
useEffect,
useMemo,
useState,
type ChangeEvent,
type FormEvent,
} from 'react';
import { createClient } from '@/lib/supabase/client';

type ActivityType =
| 'general'
| 'academic'
| 'examination'
| 'meeting'
| 'sports'
| 'ceremony'
| 'holiday'
| 'workshop'
| 'welfare'
| 'other';

type Staff = {
id: string;
full_name: string;
staff_number: string | null;
department: string | null;
position: string | null;
status: string | null;
};

type AcademicYear = {
id: string;
name: string;
start_date: string;
end_date: string;
is_current: boolean;
};

type ResponsibleStaff = {
id: string;
staff_id: string;
staff: Staff | null;
};

type Attachment = {
id: string;
activity_id: string;
file_name: string;
file_path: string;
file_type: string | null;
file_size: number | null;
uploaded_at: string;
};

type Activity = {
id: string;
school_id: string;
academic_year_id: string | null;
title: string;
activity_date: string;
end_date: string | null;
description: string | null;
activity_type: ActivityType;
is_all_staff: boolean;
created_by: string | null;
created_at: string;
updated_at: string;
responsible_staff: ResponsibleStaff[];
attachments: Attachment[];
};

type ActivityForm = {
title: string;
activity_type: ActivityType;
activity_date: string;
end_date: string;
academic_year_id: string;
description: string;
is_all_staff: boolean;
staff_ids: string[];
};

/*

* Supabase may infer a nested staff relationship as Staff[] even when
* each responsible-staff record represents one staff member.
* 
* We intentionally keep the raw query result separate from our application
* type and normalize it before storing it in React state.
  */
  type ActivityQueryRow = {
  id: string;
  school_id: string;
  academic_year_id: string | null;
  title: string;
  activity_date: string;
  end_date: string | null;
  description: string | null;
  activity_type: ActivityType;
  is_all_staff: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;

responsible_staff?:
| Array<{
id: string;
staff_id: string;
staff?: Staff | Staff[] | null;
}>
| null;

attachments?: Attachment[] | null;
};

const supabase = createClient();

const ACTIVITY_TYPES: {
value: ActivityType;
label: string;
icon: string;
}[] = [
{
value: 'general',
label: 'General',
icon: 'fa-solid fa-calendar-day',
},
{
value: 'academic',
label: 'Academic',
icon: 'fa-solid fa-graduation-cap',
},
{
value: 'examination',
label: 'Examination',
icon: 'fa-solid fa-file-pen',
},
{
value: 'meeting',
label: 'Meeting',
icon: 'fa-solid fa-users',
},
{
value: 'sports',
label: 'Sports',
icon: 'fa-solid fa-futbol',
},
{
value: 'ceremony',
label: 'Ceremony',
icon: 'fa-solid fa-champagne-glasses',
},
{
value: 'holiday',
label: 'Holiday',
icon: 'fa-solid fa-umbrella-beach',
},
{
value: 'workshop',
label: 'Workshop',
icon: 'fa-solid fa-people-group',
},
{
value: 'welfare',
label: 'Welfare',
icon: 'fa-solid fa-heart',
},
{
value: 'other',
label: 'Other',
icon: 'fa-solid fa-circle-info',
},
];

function emptyForm(): ActivityForm {
return {
title: '',
activity_type: 'general',
activity_date: '',
end_date: '',
academic_year_id: '',
description: '',
is_all_staff: true,
staff_ids: [],
};
}

function formatDate(date: string | null) {
if (!date) return '—';

return new Intl.DateTimeFormat('en-GB', {
day: '2-digit',
month: 'short',
year: 'numeric',
}).format(new Date("${date}T00:00:00"));
}

function formatShortDate(date: string) {
return new Intl.DateTimeFormat('en-GB', {
day: '2-digit',
month: 'short',
}).format(new Date("${date}T00:00:00"));
}

function getTodayString() {
return new Date().toISOString().slice(0, 10);
}

function getActivityType(value: ActivityType) {
return (
ACTIVITY_TYPES.find((item) => item.value === value) ??
ACTIVITY_TYPES[0]
);
}

function getTypeBadge(value: ActivityType) {
const styles: Record<ActivityType, string> = {
general: 'bg-slate-100 text-slate-700',
academic: 'bg-blue-100 text-blue-700',
examination: 'bg-red-100 text-red-700',
meeting: 'bg-purple-100 text-purple-700',
sports: 'bg-emerald-100 text-emerald-700',
ceremony: 'bg-amber-100 text-amber-700',
holiday: 'bg-cyan-100 text-cyan-700',
workshop: 'bg-indigo-100 text-indigo-700',
welfare: 'bg-pink-100 text-pink-700',
other: 'bg-gray-100 text-gray-700',
};

return styles[value] ?? styles.general;
}

function getTypeIconColor(value: ActivityType) {
const styles: Record<ActivityType, string> = {
general: 'bg-slate-100 text-slate-600',
academic: 'bg-blue-100 text-blue-600',
examination: 'bg-red-100 text-red-600',
meeting: 'bg-purple-100 text-purple-600',
sports: 'bg-emerald-100 text-emerald-600',
ceremony: 'bg-amber-100 text-amber-600',
holiday: 'bg-cyan-100 text-cyan-600',
workshop: 'bg-indigo-100 text-indigo-600',
welfare: 'bg-pink-100 text-pink-600',
other: 'bg-gray-100 text-gray-600',
};

return styles[value] ?? styles.general;
}

function getActivityStatus(activity: Activity) {
const today = getTodayString();

if (activity.end_date && activity.end_date < today) {
return {
label: 'Completed',
className: 'bg-slate-100 text-slate-600',
};
}

if (activity.activity_date < today) {
return {
label: 'In progress',
className: 'bg-amber-100 text-amber-700',
};
}

if (activity.activity_date === today) {
return {
label: 'Today',
className: 'bg-emerald-100 text-emerald-700',
};
}

return {
label: 'Upcoming',
className: 'bg-blue-100 text-blue-700',
};
}

function normalizeActivityRows(data: unknown[]): Activity[] {
return data.map((row) => {
const item = row as ActivityQueryRow;

return {
  id: item.id,
  school_id: item.school_id,
  academic_year_id: item.academic_year_id,
  title: item.title,
  activity_date: item.activity_date,
  end_date: item.end_date,
  description: item.description,
  activity_type: item.activity_type,
  is_all_staff: item.is_all_staff,
  created_by: item.created_by,
  created_at: item.created_at,
  updated_at: item.updated_at,

  responsible_staff: (item.responsible_staff ?? []).map(
    (person) => ({
      id: person.id,
      staff_id: person.staff_id,
      staff: Array.isArray(person.staff)
        ? person.staff[0] ?? null
        : person.staff ?? null,
    })
  ),

  attachments: item.attachments ?? [],
};

});
}

export default function ActivitiesPage() {
const [schoolId, setSchoolId] = useState<string | null>(null);

const [activities, setActivities] = useState<Activity[]>([]);
const [staff, setStaff] = useState<Staff[]>([]);
const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);

const [search, setSearch] = useState('');
const [typeFilter, setTypeFilter] = useState<'all' | ActivityType>(
'all'
);
const [yearFilter, setYearFilter] = useState('all');
const [statusFilter, setStatusFilter] = useState<
'all' | 'upcoming' | 'today' | 'completed'

«('all');»

const [showModal, setShowModal] = useState(false);
const [editingActivity, setEditingActivity] =
useState<Activity | null>(null);

const [form, setForm] = useState<ActivityForm>(emptyForm());

const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

const [selectedActivity, setSelectedActivity] =
useState<Activity | null>(null);

const [deleteId, setDeleteId] = useState<string | null>(null);

const [notice, setNotice] = useState<{
type: 'success' | 'error';
message: string;
} | null>(null);

useEffect(() => {
loadPage();
}, []);

async function loadPage() {
setLoading(true);

try {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    setNotice({
      type: 'error',
      message: 'Your session has expired. Please sign in again.',
    });
    setLoading(false);
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('school_id, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (
    !profile ||
    profile.is_active === false ||
    profile.role !== 'admin'
  ) {
    setNotice({
      type: 'error',
      message:
        'You do not have permission to manage school activities.',
    });
    setLoading(false);
    return;
  }

  setSchoolId(profile.school_id);

  await Promise.all([
    loadActivities(profile.school_id),
    loadStaff(profile.school_id),
    loadAcademicYears(profile.school_id),
  ]);
} catch (error) {
  console.error(error);

  setNotice({
    type: 'error',
    message: 'Unable to load the activities page.',
  });
} finally {
  setLoading(false);
}

}

async function loadActivities(currentSchoolId: string) {
const { data, error } = await supabase
.from('school_activities')
.select(
"id, school_id, academic_year_id, title, activity_date, end_date, description, activity_type, is_all_staff, created_by, created_at, updated_at, responsible_staff:school_activity_responsible_staff ( id, staff_id, staff:staff ( id, full_name, staff_number, department, position, status ) ), attachments:school_activity_attachments ( id, activity_id, file_name, file_path, file_type, file_size, uploaded_at )"
)
.eq('school_id', currentSchoolId)
.order('activity_date', { ascending: true });

if (error) {
  console.error(error);
  throw error;
}

/*
 * Treat the Supabase response as unknown and normalize it.
 * This avoids the TypeScript conflict caused by Supabase inferring
 * the nested staff relationship as Staff[].
 */
setActivities(
  normalizeActivityRows((data ?? []) as unknown[])
);

}

async function loadStaff(currentSchoolId: string) {
const { data, error } = await supabase
.from('staff')
.select(
"id, full_name, staff_number, department, position, status"
)
.eq('school_id', currentSchoolId)
.order('full_name', { ascending: true });

if (error) {
  console.error(error);
  throw error;
}

setStaff((data ?? []) as Staff[]);

}

async function loadAcademicYears(currentSchoolId: string) {
const { data, error } = await supabase
.from('academic_years')
.select(
"id, name, start_date, end_date, is_current"
)
.eq('school_id', currentSchoolId)
.order('start_date', { ascending: false });

if (error) {
  console.error(error);
  throw error;
}

setAcademicYears((data ?? []) as AcademicYear[]);

}

function openAddModal() {
const currentYear = academicYears.find(
(year) => year.is_current
);

setEditingActivity(null);

setForm({
  ...emptyForm(),
  academic_year_id: currentYear?.id ?? '',
  activity_date: getTodayString(),
});

setSelectedFiles([]);
setShowModal(true);

}

function openEditModal(activity: Activity) {
setEditingActivity(activity);

setForm({
  title: activity.title,
  activity_type: activity.activity_type,
  activity_date: activity.activity_date,
  end_date: activity.end_date ?? '',
  academic_year_id: activity.academic_year_id ?? '',
  description: activity.description ?? '',
  is_all_staff: activity.is_all_staff,
  staff_ids: activity.responsible_staff.map(
    (person) => person.staff_id
  ),
});

setSelectedFiles([]);
setShowModal(true);

}

function closeModal() {
if (saving) return;

setShowModal(false);
setEditingActivity(null);
setForm(emptyForm());
setSelectedFiles([]);

}

function toggleStaff(staffId: string) {
setForm((current) => ({
...current,
staff_ids: current.staff_ids.includes(staffId)
? current.staff_ids.filter((id) => id !== staffId)
: [...current.staff_ids, staffId],
}));
}

function handleFileChange(
event: ChangeEvent<HTMLInputElement>
) {
const files = Array.from(event.target.files ?? []);

const allowed = files.filter(
  (file) => file.size <= 10 * 1024 * 1024
);

if (allowed.length !== files.length) {
  setNotice({
    type: 'error',
    message: 'Each attachment must be 10 MB or smaller.',
  });
}

setSelectedFiles(allowed);

}

async function uploadAttachments(
activityId: string,
currentSchoolId: string,
userId: string
) {
if (selectedFiles.length === 0) return;

for (const file of selectedFiles) {
  const safeName = file.name.replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );

  const filePath = `${currentSchoolId}/${activityId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('school-activity-attachments')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { error: attachmentError } = await supabase
    .from('school_activity_attachments')
    .insert({
      activity_id: activityId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type || null,
      file_size: file.size,
      uploaded_by: userId,
    });

  if (attachmentError) {
    await supabase.storage
      .from('school-activity-attachments')
      .remove([filePath]);

    throw attachmentError;
  }
}

}

async function saveActivity(event: FormEvent) {
event.preventDefault();

if (!schoolId) return;

if (!form.title.trim()) {
  setNotice({
    type: 'error',
    message: 'Please enter an activity title.',
  });
  return;
}

if (!form.activity_date) {
  setNotice({
    type: 'error',
    message: 'Please select the activity date.',
  });
  return;
}

if (
  form.end_date &&
  form.end_date < form.activity_date
) {
  setNotice({
    type: 'error',
    message:
      'The end date cannot be before the start date.',
  });
  return;
}

setSaving(true);

try {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Your session has expired.');
  }

  let activityId = editingActivity?.id;

  const payload = {
    school_id: schoolId,
    academic_year_id:
      form.academic_year_id || null,
    title: form.title.trim(),
    activity_date: form.activity_date,
    end_date: form.end_date || null,
    description:
      form.description.trim() || null,
    activity_type: form.activity_type,
    is_all_staff: form.is_all_staff,
  };

  if (editingActivity) {
    const { error } = await supabase
      .from('school_activities')
      .update(payload)
      .eq('id', editingActivity.id)
      .eq('school_id', schoolId);

    if (error) throw error;

    const {
      error: responsibleDeleteError,
    } = await supabase
      .from('school_activity_responsible_staff')
      .delete()
      .eq('activity_id', editingActivity.id);

    if (responsibleDeleteError) {
      throw responsibleDeleteError;
    }

    activityId = editingActivity.id;
  } else {
    const { data, error } = await supabase
      .from('school_activities')
      .insert({
        ...payload,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) throw error;

    activityId = data.id;
  }

  if (!activityId) {
    throw new Error(
      'Activity could not be created.'
    );
  }

  if (form.staff_ids.length > 0) {
    const responsibleRows =
      form.staff_ids.map((staffId) => ({
        activity_id: activityId,
        staff_id: staffId,
      }));

    const { error: staffError } = await supabase
      .from('school_activity_responsible_staff')
      .insert(responsibleRows);

    if (staffError) throw staffError;
  }

  await uploadAttachments(
    activityId,
    schoolId,
    user.id
  );

  await loadActivities(schoolId);

  setNotice({
    type: 'success',
    message: editingActivity
      ? 'Activity updated successfully.'
      : 'Activity created successfully.',
  });

  closeModal();
} catch (error) {
  console.error(error);

  setNotice({
    type: 'error',
    message:
      error instanceof Error
        ? error.message
        : 'Unable to save the activity.',
  });
} finally {
  setSaving(false);
}

}

async function deleteActivity(activity: Activity) {
if (!schoolId) return;

const confirmed = window.confirm(
  `Delete "${activity.title}"? This will also remove its responsible staff and attachments.`
);

if (!confirmed) return;

setDeleteId(activity.id);

try {
  for (const attachment of activity.attachments) {
    const { error: storageError } =
      await supabase.storage
        .from('school-activity-attachments')
        .remove([attachment.file_path]);

    if (storageError) {
      console.warn(
        'Unable to remove attachment from storage:',
        storageError
      );
    }
  }

  const { error } = await supabase
    .from('school_activities')
    .delete()
    .eq('id', activity.id)
    .eq('school_id', schoolId);

  if (error) throw error;

  setActivities((current) =>
    current.filter(
      (item) => item.id !== activity.id
    )
  );

  if (selectedActivity?.id === activity.id) {
    setSelectedActivity(null);
  }

  setNotice({
    type: 'success',
    message: 'Activity deleted successfully.',
  });
} catch (error) {
  console.error(error);

  setNotice({
    type: 'error',
    message: 'Unable to delete this activity.',
  });
} finally {
  setDeleteId(null);
}

}

async function openAttachment(
attachment: Attachment
) {
const { data, error } = await supabase.storage
.from('school-activity-attachments')
.createSignedUrl(
attachment.file_path,
60 * 10
);

if (error || !data?.signedUrl) {
  setNotice({
    type: 'error',
    message: 'Unable to open this attachment.',
  });
  return;
}

window.open(
  data.signedUrl,
  '_blank',
  'noopener,noreferrer'
);

}

const filteredActivities = useMemo(() => {
const normalizedSearch =
search.trim().toLowerCase();

const today = getTodayString();

return activities.filter((activity) => {
  const matchesSearch =
    !normalizedSearch ||
    activity.title
      .toLowerCase()
      .includes(normalizedSearch) ||
    activity.description
      ?.toLowerCase()
      .includes(normalizedSearch) ||
    activity.responsible_staff.some((person) =>
      person.staff?.full_name
        ?.toLowerCase()
        .includes(normalizedSearch)
    );

  const matchesType =
    typeFilter === 'all' ||
    activity.activity_type === typeFilter;

  const matchesYear =
    yearFilter === 'all' ||
    activity.academic_year_id === yearFilter;

  let matchesStatus = true;

  if (statusFilter === 'upcoming') {
    matchesStatus =
      activity.activity_date > today;
  }

  if (statusFilter === 'today') {
    matchesStatus =
      activity.activity_date <= today &&
      (!activity.end_date ||
        activity.end_date >= today);
  }

  if (statusFilter === 'completed') {
    matchesStatus = activity.end_date
      ? activity.end_date < today
      : activity.activity_date < today;
  }

  return (
    matchesSearch &&
    matchesType &&
    matchesYear &&
    matchesStatus
  );
});

}, [
activities,
search,
typeFilter,
yearFilter,
statusFilter,
]);

const upcomingActivities = useMemo(() => {
const today = getTodayString();

return activities
  .filter(
    (activity) =>
      activity.activity_date >= today
  )
  .sort((a, b) =>
    a.activity_date.localeCompare(
      b.activity_date
    )
  )
  .slice(0, 5);

}, [activities]);

const stats = useMemo(() => {
const today = getTodayString();

return {
  total: activities.length,

  upcoming: activities.filter(
    (activity) =>
      activity.activity_date > today
  ).length,

  today: activities.filter(
    (activity) =>
      activity.activity_date <= today &&
      (!activity.end_date ||
        activity.end_date >= today)
  ).length,

  completed: activities.filter((activity) =>
    activity.end_date
      ? activity.end_date < today
      : activity.activity_date < today
  ).length,
};

}, [activities]);

function getAcademicYearName(id: string | null) {
return (
academicYears.find(
(year) => year.id === id
)?.name ?? 'General'
);
}

if (loading) {
return (
<>
<link
rel="stylesheet"
href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
/>

    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl bg-white shadow-sm"
            />
          ))}
        </div>

        <div className="h-[500px] animate-pulse rounded-3xl bg-white shadow-sm" />
      </div>
    </main>
  </>
);

}

return (
<>
<link
rel="stylesheet"
href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
/>

  <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl md:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-white/5" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                <i className="fa-solid fa-calendar-days text-xl" />
              </span>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  School Administration
                </p>

                <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                  Activities Calendar
                </h1>
              </div>
            </div>

            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              Manage school-wide activities, events,
              responsible staff and supporting documents
              from one central place.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-xl active:scale-95"
          >
            <i className="fa-solid fa-plus" />
            Add Activity
          </button>
        </div>
      </section>

      {notice && (
        <div
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-sm ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <i
            className={`mt-0.5 ${
              notice.type === 'success'
                ? 'fa-solid fa-circle-check'
                : 'fa-solid fa-circle-exclamation'
            }`}
          />

          <p className="flex-1 text-sm font-medium">
            {notice.message}
          </p>

          <button
            type="button"
            onClick={() => setNotice(null)}
            className="opacity-60 transition hover:opacity-100"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Total Activities',
            value: stats.total,
            icon: 'fa-solid fa-calendar-days',
            iconClass:
              'bg-slate-100 text-slate-700',
          },
          {
            label: 'Upcoming',
            value: stats.upcoming,
            icon: 'fa-solid fa-clock',
            iconClass:
              'bg-blue-100 text-blue-700',
          },
          {
            label: 'Today',
            value: stats.today,
            icon: 'fa-solid fa-calendar-check',
            iconClass:
              'bg-emerald-100 text-emerald-700',
          },
          {
            label: 'Completed',
            value: stats.completed,
            icon: 'fa-solid fa-circle-check',
            iconClass:
              'bg-purple-100 text-purple-700',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconClass}`}
              >
                <i
                  className={`${stat.icon} transition-transform duration-200 group-hover:scale-110`}
                />
              </span>

              <span className="text-3xl font-black text-slate-900">
                {stat.value}
              </span>
            </div>

            <p className="mt-4 text-sm font-semibold text-slate-500">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <i className="fa-solid fa-bolt text-amber-500" />
              Upcoming Activities
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              The next scheduled school activities
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {upcomingActivities.length}
          </span>
        </div>

        {upcomingActivities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <i className="fa-regular fa-calendar-xmark text-3xl text-slate-300" />

            <p className="mt-3 text-sm font-semibold text-slate-500">
              No upcoming activities.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {upcomingActivities.map((activity) => {
              const type = getActivityType(
                activity.activity_type
              );

              return (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() =>
                    setSelectedActivity(activity)
                  }
                  className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:bg-white hover:shadow-md"
                >
                  <div
                    className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${getTypeIconColor(
                      activity.activity_type
                    )}`}
                  >
                    <i
                      className={`${type.icon} text-sm`}
                    />
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {formatShortDate(
                      activity.activity_date
                    )}
                  </p>

                  <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-800">
                    {activity.title}
                  </p>

                  <p className="mt-2 text-[11px] font-medium text-slate-500">
                    {type.label}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                All Activities
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Search and manage scheduled school
                activities.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:flex">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search activities..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 sm:w-56"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value as
                      | 'all'
                      | ActivityType
                  )
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="all">
                  All Types
                </option>

                {ACTIVITY_TYPES.map((type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                ))}
              </select>

              <select
                value={yearFilter}
                onChange={(event) =>
                  setYearFilter(event.target.value)
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="all">
                  All Academic Years
                </option>

                {academicYears.map((year) => (
                  <option
                    key={year.id}
                    value={year.id}
                  >
                    {year.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | 'all'
                      | 'upcoming'
                      | 'today'
                      | 'completed'
                  )
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="all">
                  All Statuses
                </option>
                <option value="upcoming">
                  Upcoming
                </option>
                <option value="today">
                  Today / Active
                </option>
                <option value="completed">
                  Completed
                </option>
              </select>
            </div>
          </div>
        </div>

        {filteredActivities.length === 0 ? (
          <div className="px-5 py-16 text-center md:px-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <i className="fa-regular fa-calendar-xmark text-2xl" />
            </div>

            <h3 className="mt-4 text-base font-black text-slate-800">
              No activities found
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Try changing your filters or create a new
              school activity.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredActivities.map((activity) => {
              const type = getActivityType(
                activity.activity_type
              );

              const status =
                getActivityStatus(activity);

              return (
                <div
                  key={activity.id}
                  className="group p-5 transition-colors duration-200 hover:bg-slate-50 md:p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                    <div className="flex shrink-0 items-center gap-3 lg:w-32 lg:flex-col lg:items-start">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
                        <i className="fa-solid fa-calendar-day" />
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          {activity.end_date &&
                          activity.end_date !==
                            activity.activity_date
                            ? 'Starts'
                            : 'Date'}
                        </p>

                        <p className="mt-0.5 text-sm font-black text-slate-800">
                          {formatDate(
                            activity.activity_date
                          )}
                        </p>

                        {activity.end_date &&
                          activity.end_date !==
                            activity.activity_date && (
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              to{' '}
                              {formatDate(
                                activity.end_date
                              )}
                            </p>
                          )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${getTypeBadge(
                            activity.activity_type
                          )}`}
                        >
                          <i
                            className={`${type.icon} text-[9px]`}
                          />

                          {type.label}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <h3 className="mt-2 text-base font-black text-slate-900">
                        {activity.title}
                      </h3>

                      {activity.description && (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                          {activity.description}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <i className="fa-solid fa-graduation-cap text-slate-400" />

                          {getAcademicYearName(
                            activity.academic_year_id
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <i className="fa-solid fa-users text-slate-400" />

                          {activity.is_all_staff
                            ? 'All staff'
                            : `${activity.responsible_staff.length} responsible`}
                        </span>

                        {activity.attachments.length >
                          0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <i className="fa-solid fa-paperclip text-slate-400" />

                            {
                              activity.attachments
                                .length
                            }{' '}
                            attachment
                            {activity.attachments
                              .length === 1
                              ? ''
                              : 's'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedActivity(
                            activity
                          )
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-900 hover:text-white"
                        title="View activity"
                      >
                        <i className="fa-solid fa-eye text-xs" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEditModal(activity)
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-600"
                        title="Edit activity"
                      >
                        <i className="fa-solid fa-pen-to-square text-xs" />
                      </button>

                      <button
                        type="button"
                        disabled={
                          deleteId === activity.id
                        }
                        onClick={() =>
                          deleteActivity(activity)
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Delete activity"
                      >
                        <i
                          className={
                            deleteId === activity.id
                              ? 'fa-solid fa-spinner animate-spin text-xs'
                              : 'fa-solid fa-trash-can text-xs'
                          }
                        />
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
  </main>

  {showModal && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {editingActivity
                ? 'Edit Activity'
                : 'Add School Activity'}
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Manage the activity details and
              responsible staff.
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form
          onSubmit={saveActivity}
          className="space-y-6 p-5 md:p-6"
        >
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Activity Title
            </label>

            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="e.g. Staff General Meeting"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Activity Type
              </label>

              <select
                value={form.activity_type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    activity_type:
                      event.target.value as ActivityType,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white"
              >
                {ACTIVITY_TYPES.map((type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Academic Year
              </label>

              <select
                value={form.academic_year_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    academic_year_id:
                      event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="">
                  General / Not Specified
                </option>

                {academicYears.map((year) => (
                  <option
                    key={year.id}
                    value={year.id}
                  >
                    {year.name}
                    {year.is_current
                      ? ' — Current'
                      : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Start Date
              </label>

              <input
                type="date"
                value={form.activity_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    activity_date:
                      event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                End Date
                <span className="ml-1 font-normal normal-case text-slate-400">
                  optional
                </span>
              </label>

              <input
                type="date"
                value={form.end_date}
                min={form.activity_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    end_date:
                      event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Description
            </label>

            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description:
                    event.target.value,
                }))
              }
              rows={4}
              placeholder="Add any important information about this activity..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={form.is_all_staff}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  is_all_staff:
                    event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 accent-slate-900"
            />

            <span>
              <span className="block text-sm font-bold text-slate-800">
                School-wide activity
              </span>

              <span className="mt-1 block text-xs leading-5 text-slate-500">
                This activity is relevant to all staff.
                You can still assign responsible staff
                members below.
              </span>
            </span>
          </label>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Responsible Staff
                </label>

                <p className="mt-1 text-xs text-slate-400">
                  Select one or more staff members
                  responsible for this activity.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                {form.staff_ids.length} selected
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
              {staff.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <i className="fa-solid fa-users-slash text-2xl text-slate-300" />

                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    No staff records available.
                  </p>
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
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            selected
                              ? 'bg-white/10'
                              : 'bg-slate-100'
                          }`}
                        >
                          <i
                            className={`fa-solid fa-user ${
                              selected
                                ? 'text-white'
                                : 'text-slate-400'
                            }`}
                          />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">
                            {person.full_name}
                          </span>

                          <span
                            className={`mt-0.5 block truncate text-[11px] ${
                              selected
                                ? 'text-slate-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {person.position ||
                              person.department ||
                              person.staff_number ||
                              'Staff'}
                          </span>
                        </span>

                        {selected && (
                          <i className="fa-solid fa-circle-check text-sm" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Attachments
            </label>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-7 text-center transition hover:border-slate-400 hover:bg-slate-50">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <i className="fa-solid fa-cloud-arrow-up text-lg" />
                </span>

                <span className="mt-3 text-sm font-bold text-slate-700">
                  Choose files
                </span>

                <span className="mt-1 text-xs text-slate-400">
                  Maximum 10 MB per file
                </span>

                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="flex items-center gap-3 rounded-xl bg-white p-3"
                    >
                      <i className="fa-solid fa-paperclip text-slate-400" />

                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">
                        {file.name}
                      </span>

                      <span className="text-[10px] font-medium text-slate-400">
                        {(
                          file.size /
                          1024 /
                          1024
                        ).toFixed(2)}{' '}
                        MB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <i className="fa-solid fa-spinner mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk mr-2" />
                  {editingActivity
                    ? 'Save Changes'
                    : 'Create Activity'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {selectedActivity && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div
                className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold ${getTypeBadge(
                  selectedActivity.activity_type
                )}`}
              >
                <i
                  className={
                    getActivityType(
                      selectedActivity.activity_type
                    ).icon
                  }
                />

                {
                  getActivityType(
                    selectedActivity.activity_type
                  ).label
                }
              </div>

              <h2 className="text-2xl font-black tracking-tight">
                {selectedActivity.title}
              </h2>

              <p className="mt-2 text-sm text-slate-300">
                {formatDate(
                  selectedActivity.activity_date
                )}

                {selectedActivity.end_date &&
                  selectedActivity.end_date !==
                    selectedActivity.activity_date &&
                  ` — ${formatDate(
                    selectedActivity.end_date
                  )}`}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedActivity(null)
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-300 transition hover:bg-white/20 hover:text-white"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {selectedActivity.description && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Description
              </h3>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {selectedActivity.description}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Academic Year
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {getAcademicYearName(
                  selectedActivity.academic_year_id
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Audience
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {selectedActivity.is_all_staff
                  ? 'All Staff'
                  : 'Selected Staff'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Responsible Staff
            </h3>

            {selectedActivity.responsible_staff
              .length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No specific staff members assigned.
              </p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selectedActivity.responsible_staff.map(
                  (person) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <i className="fa-solid fa-user text-xs" />
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {person.staff
                            ?.full_name ??
                            'Unknown Staff'}
                        </p>

                        <p className="truncate text-[11px] text-slate-400">
                          {person.staff
                            ?.position ??
                            person.staff
                              ?.department ??
                            ''}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Attachments
            </h3>

            {selectedActivity.attachments
              .length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No attachments.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {selectedActivity.attachments.map(
                  (attachment) => (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() =>
                        openAttachment(
                          attachment
                        )
                      }
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <i className="fa-solid fa-paperclip text-xs" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-700">
                          {attachment.file_name}
                        </span>

                        <span className="block text-[10px] text-slate-400">
                          {attachment.file_size
                            ? `${(
                                attachment.file_size /
                                1024 /
                                1024
                              ).toFixed(
                                2
                              )} MB`
                            : 'File'}
                        </span>
                      </span>

                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-slate-400" />
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                openEditModal(
                  selectedActivity
                );
                setSelectedActivity(null);
              }}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-600"
            >
              <i className="fa-solid fa-pen-to-square mr-2" />
              Edit Activity
            </button>

            <button
              type="button"
              onClick={() =>
                deleteActivity(selectedActivity)
              }
              disabled={
                deleteId === selectedActivity.id
              }
              className="rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <i className="fa-solid fa-trash-can mr-2" />
              Delete Activity
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  <style jsx global>{`
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(8px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `}</style>
</>

);
}

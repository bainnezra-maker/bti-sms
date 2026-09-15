'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Staff = {
  id: string;
  school_id: string;
  staff_number: string;
  full_name: string;
  gender: string | null;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  staff_category: 'teaching' | 'non_teaching';
  department: string | null;
  position: string | null;
  qualification: string | null;
  specialization: string | null;
  employment_date: string | null;
  status: 'active' | 'inactive';
  photo_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DocumentType =
  | 'unit_specification'
  | 'learning_session_plan'
  | 'particulars_of_work_done';

type DocumentRecord = {
  id: string;
  staff_id: string;
  document_type: DocumentType;
  academic_year_id: string | null;
  semester_id: string | null;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
  notes: string | null;
};

type AcademicYear = {
  id: string;
  name: string;
};

type Semester = {
  id: string;
  academic_year_id: string;
  name: string;
};

type DutyStatus =
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'cancelled';

type DutyRecord = {
  id: string;
  school_id: string;
  staff_id: string;
  duty_type: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  status: DutyStatus;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DutyForm = {
  staff_id: string;
  duty_type: string;
  start_date: string;
  end_date: string;
  notes: string;
  status: DutyStatus;
};

const supabase = createClient();

const emptyForm = {
  staff_number: '',
  full_name: '',
  gender: '',
  date_of_birth: '',
  phone: '',
  email: '',
  address: '',
  staff_category: 'teaching' as 'teaching' | 'non_teaching',
  department: '',
  position: '',
  qualification: '',
  specialization: '',
  employment_date: '',
  status: 'active' as 'active' | 'inactive',
  photo_url: '',
};

const emptyDutyForm: DutyForm = {
  staff_id: '',
  duty_type: '',
  start_date: '',
  end_date: '',
  notes: '',
  status: 'scheduled',
};

const documentLabels: Record<DocumentType, string> = {
  unit_specification: 'Unit Specification Breakdown',
  learning_session_plan: 'Learning Session Plan',
  particulars_of_work_done: 'Particulars of Work Done',
};

const documentIcons: Record<DocumentType, string> = {
  unit_specification: 'fa-solid fa-list-check',
  learning_session_plan: 'fa-solid fa-chalkboard-user',
  particulars_of_work_done: 'fa-solid fa-file-circle-check',
};

const dutyStatusLabels: Record<DutyStatus, string> = {
  scheduled: 'Scheduled',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const dutyStatusIcons: Record<DutyStatus, string> = {
  scheduled: 'fa-solid fa-calendar-check',
  active: 'fa-solid fa-person-circle-check',
  completed: 'fa-solid fa-circle-check',
  cancelled: 'fa-solid fa-circle-xmark',
};

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition duration-300 placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100';

function formatDate(value: string | null) {
  if (!value) return '—';

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

function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return '—';

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(date: Date) {
  const copy = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const day = copy.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  copy.setDate(copy.getDate() + difference);

  return copy;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getDutyStatusClass(status: DutyStatus) {
  switch (status) {
    case 'active':
      return 'bg-blue-100 text-blue-700';

    case 'completed':
      return 'bg-emerald-100 text-emerald-700';

    case 'cancelled':
      return 'bg-red-100 text-red-700';

    case 'scheduled':
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      {children}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-slate-700">
        {value}
      </p>
    </div>
  );
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [duties, setDuties] = useState<DutyRecord[]>([]);

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingDuty, setSavingDuty] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(
    null
  );
  const [showDetails, setShowDetails] = useState(false);

  const [documentType, setDocumentType] =
    useState<DocumentType>('unit_specification');

  const [documentTitle, setDocumentTitle] = useState('');
  const [documentNotes, setDocumentNotes] = useState('');
  const [documentYearId, setDocumentYearId] = useState('');
  const [documentSemesterId, setDocumentSemesterId] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const [showDutyForm, setShowDutyForm] = useState(false);
  const [editingDutyId, setEditingDutyId] = useState<string | null>(null);
  const [dutyForm, setDutyForm] = useState<DutyForm>({
    ...emptyDutyForm,
  });

  const [dutyView, setDutyView] = useState<'week' | 'month'>('week');

  const [dutyAnchorDate, setDutyAnchorDate] = useState(
    formatDateKey(new Date())
  );

  const [dutySearch, setDutySearch] = useState('');
  const [dutyStatusFilter, setDutyStatusFilter] =
    useState<DutyStatus | 'all'>('all');

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

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.school_id) {
      setError('School profile could not be found.');
      return null;
    }

    setCurrentUserId(user.id);
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

    const [
      staffResult,
      documentsResult,
      yearsResult,
      semestersResult,
      dutiesResult,
    ] = await Promise.all([
      supabase
        .from('staff')
        .select('*')
        .eq('school_id', profile.schoolId)
        .order('full_name', { ascending: true }),

      supabase
        .from('staff_teaching_documents')
        .select(
          'id, staff_id, document_type, academic_year_id, semester_id, title, file_name, file_path, file_type, file_size, uploaded_at, notes'
        )
        .eq('school_id', profile.schoolId)
        .order('uploaded_at', { ascending: false }),

      supabase
        .from('academic_years')
        .select('id, name')
        .eq('school_id', profile.schoolId)
        .order('start_date', {
          ascending: false,
          nullsFirst: false,
        }),

      supabase
        .from('terms')
        .select('id, academic_year_id, name')
        .order('start_date', {
          ascending: true,
          nullsFirst: false,
        }),

      supabase
        .from('staff_duty_roster')
        .select('*')
        .eq('school_id', profile.schoolId)
        .order('start_date', {
          ascending: true,
        })
        .order('end_date', {
          ascending: true,
        }),
    ]);

    if (staffResult.error) {
      setError(staffResult.error.message);
    } else {
      setStaff((staffResult.data || []) as Staff[]);
    }

    if (documentsResult.error) {
      setError((current) => current || documentsResult.error!.message);
    } else {
      setDocuments((documentsResult.data || []) as DocumentRecord[]);
    }

    if (yearsResult.error) {
      setError((current) => current || yearsResult.error!.message);
    } else {
      setAcademicYears((yearsResult.data || []) as AcademicYear[]);
    }

    if (semestersResult.error) {
      setError((current) => current || semestersResult.error!.message);
    } else {
      setSemesters((semestersResult.data || []) as Semester[]);
    }

    if (dutiesResult.error) {
      setError((current) => current || dutiesResult.error!.message);
    } else {
      setDuties((dutiesResult.data || []) as DutyRecord[]);
    }

    setLoading(false);
  }

  function openAddForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setMessage('');
    setShowForm(true);
  }

  function openEditForm(person: Staff) {
    setEditingId(person.id);

    setForm({
      staff_number: person.staff_number || '',
      full_name: person.full_name || '',
      gender: person.gender || '',
      date_of_birth: person.date_of_birth || '',
      phone: person.phone || '',
      email: person.email || '',
      address: person.address || '',
      staff_category: person.staff_category || 'teaching',
      department: person.department || '',
      position: person.position || '',
      qualification: person.qualification || '',
      specialization: person.specialization || '',
      employment_date: person.employment_date || '',
      status: person.status || 'active',
      photo_url: person.photo_url || '',
    });

    setError('');
    setMessage('');
    setShowForm(true);
  }

  async function saveStaff(event: React.FormEvent) {
    event.preventDefault();

    setError('');
    setMessage('');

    if (!schoolId) {
      setError('School profile could not be found.');
      return;
    }

    if (!form.staff_number.trim() || !form.full_name.trim()) {
      setError('Staff ID and full name are required.');
      return;
    }

    setSaving(true);

    const payload = {
      school_id: schoolId,
      staff_number: form.staff_number.trim(),
      full_name: form.full_name.trim(),
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      staff_category: form.staff_category,
      department: form.department.trim() || null,
      position: form.position.trim() || null,
      qualification: form.qualification.trim() || null,
      specialization: form.specialization.trim() || null,
      employment_date: form.employment_date || null,
      status: form.status,
      photo_url: form.photo_url.trim() || null,
    };

    if (editingId) {
      const { data, error: updateError } = await supabase
        .from('staff')
        .update(payload)
        .eq('id', editingId)
        .eq('school_id', schoolId)
        .select('*')
        .maybeSingle();

      if (updateError) {
        setError(updateError.message);
      } else if (!data) {
        setError(
          'Staff record could not be updated. Please check staff permissions.'
        );
      } else {
        setStaff((current) =>
          current.map((item) =>
            item.id === editingId ? (data as Staff) : item
          )
        );

        setMessage('Staff record updated successfully.');
        setShowForm(false);
        setEditingId(null);
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('staff')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) {
        setError(insertError.message);
      } else {
        setStaff((current) =>
          [...current, data as Staff].sort((a, b) =>
            a.full_name.localeCompare(b.full_name)
          )
        );

        setMessage('Staff member added successfully.');
        setShowForm(false);
        setForm({ ...emptyForm });
      }
    }

    setSaving(false);
  }

  async function toggleStatus(person: Staff) {
    if (!schoolId) return;

    setError('');
    setMessage('');

    const nextStatus =
      person.status === 'active' ? 'inactive' : 'active';

    const { data, error: updateError } = await supabase
      .from('staff')
      .update({ status: nextStatus })
      .eq('id', person.id)
      .eq('school_id', schoolId)
      .select('*')
      .maybeSingle();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!data) {
      setError('Staff status could not be changed.');
      return;
    }

    setStaff((current) =>
      current.map((item) =>
        item.id === person.id ? (data as Staff) : item
      )
    );

    setMessage(`${person.full_name} is now ${nextStatus}.`);
  }

  async function deleteStaff(person: Staff) {
    if (!schoolId) return;

    const confirmed = window.confirm(
      `Delete ${person.full_name}?\n\nThis should normally only be used when the staff record was created by mistake.`
    );

    if (!confirmed) return;

    setError('');
    setMessage('');

    const { error: deleteError } = await supabase
      .from('staff')
      .delete()
      .eq('id', person.id)
      .eq('school_id', schoolId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setStaff((current) =>
      current.filter((item) => item.id !== person.id)
    );

    setDocuments((current) =>
      current.filter((item) => item.staff_id !== person.id)
    );

    setDuties((current) =>
      current.filter((item) => item.staff_id !== person.id)
    );

    setSelectedStaffId(null);
    setShowDetails(false);

    setMessage('Staff record deleted successfully.');
  }

  function openDetails(person: Staff) {
    setSelectedStaffId(person.id);
    setShowDetails(true);
    setError('');
    setMessage('');
  }

  function resetDocumentForm() {
    setDocumentType('unit_specification');
    setDocumentTitle('');
    setDocumentNotes('');
    setDocumentYearId('');
    setDocumentSemesterId('');
    setDocumentFile(null);
  }

  async function uploadDocument(event: React.FormEvent) {
    event.preventDefault();

    setError('');
    setMessage('');

    if (!schoolId || !currentUserId || !selectedStaffId) {
      setError('Please select a staff member first.');
      return;
    }

    if (!documentFile) {
      setError('Please choose a document to upload.');
      return;
    }

    if (
      documentType === 'unit_specification' &&
      (!documentYearId || !documentSemesterId)
    ) {
      setError(
        'Unit Specification requires an academic year and semester.'
      );
      return;
    }

    if (documentType === 'unit_specification') {
      const duplicate = documents.some(
        (doc) =>
          doc.staff_id === selectedStaffId &&
          doc.document_type === 'unit_specification' &&
          doc.academic_year_id === documentYearId &&
          doc.semester_id === documentSemesterId
      );

      if (duplicate) {
        setError(
          'This teacher already has a Unit Specification uploaded for the selected semester.'
        );
        return;
      }
    }

    if (documentFile.size > 10 * 1024 * 1024) {
      setError('The selected file is larger than 10 MB.');
      return;
    }

    setUploading(true);

    const safeName = documentFile.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );

    const path = `${schoolId}/${selectedStaffId}/${Date.now()}-${safeName}`;

    const { error: storageError } = await supabase.storage
      .from('staff-documents')
      .upload(path, documentFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) {
      setError(
        `${storageError.message}. If this is the first document upload, make sure the private "staff-documents" Supabase Storage bucket and its Storage policies have been created.`
      );

      setUploading(false);
      return;
    }

    const { data, error: recordError } = await supabase
      .from('staff_teaching_documents')
      .insert({
        staff_id: selectedStaffId,
        school_id: schoolId,
        document_type: documentType,
        academic_year_id: documentYearId || null,
        semester_id: documentSemesterId || null,
        title:
          documentTitle.trim() ||
          documentLabels[documentType],
        file_name: documentFile.name,
        file_path: path,
        file_type: documentFile.type || null,
        file_size: documentFile.size,
        uploaded_by: currentUserId,
        notes: documentNotes.trim() || null,
      })
      .select(
        'id, staff_id, document_type, academic_year_id, semester_id, title, file_name, file_path, file_type, file_size, uploaded_at, notes'
      )
      .single();

    if (recordError) {
      await supabase.storage
        .from('staff-documents')
        .remove([path]);

      setError(recordError.message);
    } else {
      setDocuments((current) => [
        data as DocumentRecord,
        ...current,
      ]);

      resetDocumentForm();

      setMessage('Teaching document uploaded successfully.');
    }

    setUploading(false);
  }

  async function openDocument(document: DocumentRecord) {
    setError('');

    const { data, error: signedUrlError } =
      await supabase.storage
        .from('staff-documents')
        .createSignedUrl(document.file_path, 60 * 10);

    if (signedUrlError || !data?.signedUrl) {
      setError(
        signedUrlError?.message ||
          'The document could not be opened.'
      );

      return;
    }

    window.open(
      data.signedUrl,
      '_blank',
      'noopener,noreferrer'
    );
  }

  async function deleteDocument(document: DocumentRecord) {
    const confirmed = window.confirm(
      `Delete ${document.file_name}?`
    );

    if (!confirmed) return;

    setError('');
    setMessage('');

    const { error: storageError } =
      await supabase.storage
        .from('staff-documents')
        .remove([document.file_path]);

    if (storageError) {
      setError(storageError.message);
      return;
    }

    const { error: recordError } =
      await supabase
        .from('staff_teaching_documents')
        .delete()
        .eq('id', document.id);

    if (recordError) {
      setError(recordError.message);
      return;
    }

    setDocuments((current) =>
      current.filter((item) => item.id !== document.id)
    );

    setMessage('Teaching document deleted successfully.');
  }

  function openAddDutyForm(staffId?: string) {
    const today = formatDateKey(new Date());

    setEditingDutyId(null);

    setDutyForm({
      ...emptyDutyForm,
      staff_id:
        staffId ||
        selectedStaffId ||
        '',
      start_date: today,
      end_date: today,
      status: 'scheduled',
    });

    setError('');
    setMessage('');
    setShowDutyForm(true);
  }

  function openEditDutyForm(duty: DutyRecord) {
    setEditingDutyId(duty.id);

    setDutyForm({
      staff_id: duty.staff_id,
      duty_type: duty.duty_type,
      start_date: duty.start_date,
      end_date: duty.end_date,
      notes: duty.notes || '',
      status: duty.status,
    });

    setError('');
    setMessage('');
    setShowDutyForm(true);
  }

  function closeDutyForm() {
    if (savingDuty) return;

    setShowDutyForm(false);
    setEditingDutyId(null);
    setDutyForm({ ...emptyDutyForm });
  }

  async function saveDuty(event: React.FormEvent) {
    event.preventDefault();

    setError('');
    setMessage('');

    if (!schoolId) {
      setError('School profile could not be found.');
      return;
    }

    if (!dutyForm.staff_id) {
      setError('Please select a staff member.');
      return;
    }

    if (!dutyForm.duty_type.trim()) {
      setError('Duty type is required.');
      return;
    }

    if (!dutyForm.start_date || !dutyForm.end_date) {
      setError('Start date and end date are required.');
      return;
    }

    if (dutyForm.end_date < dutyForm.start_date) {
      setError('End date cannot be earlier than the start date.');
      return;
    }

    const selectedPerson = staff.find(
      (person) => person.id === dutyForm.staff_id
    );

    if (!selectedPerson) {
      setError('The selected staff member could not be found.');
      return;
    }

    setSavingDuty(true);

    if (editingDutyId) {
      const { data, error: updateError } = await supabase
        .from('staff_duty_roster')
        .update({
          staff_id: dutyForm.staff_id,
          duty_type: dutyForm.duty_type.trim(),
          start_date: dutyForm.start_date,
          end_date: dutyForm.end_date,
          notes: dutyForm.notes.trim() || null,
          status: dutyForm.status,
        })
        .eq('id', editingDutyId)
        .eq('school_id', schoolId)
        .select('*')
        .maybeSingle();

      if (updateError) {
        setError(updateError.message);
      } else if (!data) {
        setError(
          'Duty assignment could not be updated. Please check your permissions.'
        );
      } else {
        setDuties((current) =>
          current
            .map((item) =>
              item.id === editingDutyId
                ? (data as DutyRecord)
                : item
            )
            .sort((a, b) =>
              a.start_date.localeCompare(b.start_date)
            )
        );

        setMessage(
          `Duty assignment updated for ${selectedPerson.full_name}.`
        );

        closeDutyForm();
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('staff_duty_roster')
        .insert({
          school_id: schoolId,
          staff_id: dutyForm.staff_id,
          duty_type: dutyForm.duty_type.trim(),
          start_date: dutyForm.start_date,
          end_date: dutyForm.end_date,
          notes: dutyForm.notes.trim() || null,
          status: dutyForm.status,
          created_by: currentUserId,
        })
        .select('*')
        .single();

      if (insertError) {
        setError(insertError.message);
      } else {
        setDuties((current) =>
          [...current, data as DutyRecord].sort((a, b) =>
            a.start_date.localeCompare(b.start_date)
          )
        );

        setMessage(
          `Duty assigned successfully to ${selectedPerson.full_name}.`
        );

        closeDutyForm();
      }
    }

    setSavingDuty(false);
  }

  async function deleteDuty(duty: DutyRecord) {
    if (!schoolId) return;

    const person = staff.find(
      (item) => item.id === duty.staff_id
    );

    const confirmed = window.confirm(
      `Remove this duty assignment?\n\nStaff: ${
        person?.full_name || 'Unknown staff'
      }\nDuty: ${duty.duty_type}\nDate: ${formatDate(
        duty.start_date
      )} - ${formatDate(duty.end_date)}`
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

    setMessage('Duty assignment removed successfully.');
  }

  function scrollToDutyRoster() {
    document
      .getElementById('staff-duty-roster')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
  }

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          staff
            .map((person) => person.department?.trim())
            .filter(Boolean) as string[]
        )
      ).sort((a, b) => a.localeCompare(b)),
    [staff]
  );

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    return staff.filter((person) => {
      const matchesSearch =
        !query ||
        person.full_name.toLowerCase().includes(query) ||
        person.staff_number.toLowerCase().includes(query) ||
        (person.department || '').toLowerCase().includes(query) ||
        (person.position || '').toLowerCase().includes(query) ||
        (person.phone || '').toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === 'all' ||
        person.staff_category === categoryFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        person.status === statusFilter;

      const matchesDepartment =
        departmentFilter === 'all' ||
        person.department === departmentFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesDepartment
      );
    });
  }, [
    staff,
    search,
    categoryFilter,
    statusFilter,
    departmentFilter,
  ]);

  const stats = useMemo(
    () => ({
      total: staff.length,
      teaching: staff.filter(
        (person) => person.staff_category === 'teaching'
      ).length,
      nonTeaching: staff.filter(
        (person) => person.staff_category === 'non_teaching'
      ).length,
      active: staff.filter(
        (person) => person.status === 'active'
      ).length,
      inactive: staff.filter(
        (person) => person.status === 'inactive'
      ).length,
    }),
    [staff]
  );

  const dutyStats = useMemo(
    () => ({
      total: duties.length,
      scheduled: duties.filter(
        (duty) => duty.status === 'scheduled'
      ).length,
      active: duties.filter(
        (duty) => duty.status === 'active'
      ).length,
      completed: duties.filter(
        (duty) => duty.status === 'completed'
      ).length,
      cancelled: duties.filter(
        (duty) => duty.status === 'cancelled'
      ).length,
    }),
    [duties]
  );

  const selectedStaff =
    staff.find(
      (person) => person.id === selectedStaffId
    ) || null;

  const selectedDocuments = documents.filter(
    (document) => document.staff_id === selectedStaffId
  );

  const selectedDuties = duties.filter(
    (duty) => duty.staff_id === selectedStaffId
  );

  const selectedUnitDocuments =
    selectedDocuments.filter(
      (document) =>
        document.document_type === 'unit_specification'
    );

  const selectedLspDocuments =
    selectedDocuments.filter(
      (document) =>
        document.document_type === 'learning_session_plan'
    );

  const selectedParticularsDocuments =
    selectedDocuments.filter(
      (document) =>
        document.document_type === 'particulars_of_work_done'
    );

  const selectedYearSemesters = semesters.filter(
    (semester) =>
      semester.academic_year_id === documentYearId
  );

  function getSemesterName(semesterId: string | null) {
    return (
      semesters.find(
        (semester) => semester.id === semesterId
      )?.name || '—'
    );
  }

  function getYearName(yearId: string | null) {
    return (
      academicYears.find(
        (year) => year.id === yearId
      )?.name || '—'
    );
  }

  const filteredDuties = useMemo(() => {
    const query = dutySearch.trim().toLowerCase();

    return duties.filter((duty) => {
      const person = staff.find(
        (item) => item.id === duty.staff_id
      );

      const matchesSearch =
        !query ||
        (person?.full_name || '').toLowerCase().includes(query) ||
        duty.duty_type.toLowerCase().includes(query) ||
        (duty.notes || '').toLowerCase().includes(query);

      const matchesStatus =
        dutyStatusFilter === 'all' ||
        duty.status === dutyStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    duties,
    staff,
    dutySearch,
    dutyStatusFilter,
  ]);

  function dutyAppliesOnDate(
    duty: DutyRecord,
    dateKey: string
  ) {
    return (
      duty.start_date <= dateKey &&
      duty.end_date >= dateKey
    );
  }

  function dutiesForDate(dateKey: string) {
    return filteredDuties.filter((duty) =>
      dutyAppliesOnDate(duty, dateKey)
    );
  }

  const dutyWeekDays = useMemo(() => {
    const anchor = parseDateKey(dutyAnchorDate);
    const monday = startOfWeek(anchor);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);

      return date;
    });
  }, [dutyAnchorDate]);

  const dutyMonthDays = useMemo(() => {
    const anchor = parseDateKey(dutyAnchorDate);
    const monthStart = startOfMonth(anchor);
    const gridStart = startOfWeek(monthStart);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);

      return date;
    });
  }, [dutyAnchorDate]);

  const dutyMonthLabel = useMemo(() => {
    const anchor = parseDateKey(dutyAnchorDate);

    return anchor.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  }, [dutyAnchorDate]);

  const dutyWeekLabel = useMemo(() => {
    if (dutyWeekDays.length !== 7) return '';

    const first = dutyWeekDays[0];
    const last = dutyWeekDays[6];

    const firstLabel = first.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });

    const lastLabel = last.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return `${firstLabel} – ${lastLabel}`;
  }, [dutyWeekDays]);

  function goToDutyPrevious() {
    const date = parseDateKey(dutyAnchorDate);

    if (dutyView === 'week') {
      date.setDate(date.getDate() - 7);
    } else {
      date.setMonth(date.getMonth() - 1);
    }

    setDutyAnchorDate(formatDateKey(date));
  }

  function goToDutyNext() {
    const date = parseDateKey(dutyAnchorDate);

    if (dutyView === 'week') {
      date.setDate(date.getDate() + 7);
    } else {
      date.setMonth(date.getMonth() + 1);
    }

    setDutyAnchorDate(formatDateKey(date));
  }

  function goToDutyToday() {
    setDutyAnchorDate(formatDateKey(new Date()));
  }

  function staffDutyCount(staffId: string) {
    return duties.filter(
      (duty) => duty.staff_id === staffId
    ).length;
  }

  function staffActiveDutyCount(staffId: string) {
    return duties.filter(
      (duty) =>
        duty.staff_id === staffId &&
        duty.status === 'active'
    ).length;
  }

  function renderDutyCard(
    duty: DutyRecord,
    compact = false
  ) {
    const person = staff.find(
      (item) => item.id === duty.staff_id
    );

    return (
      <div
        key={duty.id}
        className={`group rounded-xl border border-slate-200 bg-white transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
          compact ? 'p-2.5' : 'p-3'
        }`}
      >
        <div className="flex items-start gap-2">
          <div
            className={`flex shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white ${
              compact
                ? 'h-8 w-8 text-xs'
                : 'h-9 w-9 text-sm'
            }`}
          >
            <i className="fa-solid fa-user-shield" />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={`truncate font-bold text-slate-800 ${
                compact ? 'text-xs' : 'text-sm'
              }`}
            >
              {person?.full_name || 'Unknown Staff'}
            </p>

            <p
              className={`mt-0.5 truncate font-semibold text-slate-500 ${
                compact ? 'text-[11px]' : 'text-xs'
              }`}
            >
              {duty.duty_type}
            </p>

            {!compact && (
              <p className="mt-1 text-[11px] text-slate-400">
                {formatDate(duty.start_date)} –{' '}
                {formatDate(duty.end_date)}
              </p>
            )}
          </div>
        </div>

        <div
          className={`mt-2 flex items-center justify-between gap-2 ${
            compact ? 'flex-col items-start' : ''
          }`}
        >
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${getDutyStatusClass(
              duty.status
            )}`}
          >
            <i className={dutyStatusIcons[duty.status]} />
            {dutyStatusLabels[duty.status]}
          </span>

          <div className="flex gap-1 opacity-70 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={() => openEditDutyForm(duty)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition duration-300 hover:bg-slate-900 hover:text-white"
              title="Edit duty"
            >
              <i className="fa-solid fa-pen text-[10px]" />
            </button>

            <button
              type="button"
              onClick={() => deleteDuty(duty)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 transition duration-300 hover:bg-red-600 hover:text-white"
              title="Remove duty"
            >
              <i className="fa-solid fa-trash text-[10px]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      />

      <style jsx global>{`
        @keyframes btiStaffFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes btiStaffScale {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes btiStaffModal {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes btiStaffPulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.04);
          }
        }

        @keyframes btiDutyGlow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(15, 23, 42, 0);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.04);
          }
        }

        .bti-staff-page {
          animation: btiStaffFadeUp 0.55s ease-out both;
        }

        .bti-staff-card {
          animation: btiStaffFadeUp 0.55s ease-out both;
        }

        .bti-staff-stat {
          animation: btiStaffScale 0.45s ease-out both;
        }

        .bti-staff-modal {
          animation: btiStaffModal 0.32s
            cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .bti-staff-icon-pulse:hover {
          animation: btiStaffPulse 0.7s ease-in-out;
        }

        .bti-duty-glow {
          animation: btiDutyGlow 2.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .bti-staff-page,
          .bti-staff-card,
          .bti-staff-stat,
          .bti-staff-modal,
          .bti-duty-glow {
            animation: none !important;
          }
        }
      `}</style>

      <div className="bti-staff-page min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="bti-staff-icon-pulse mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg transition duration-300">
                <i className="fa-solid fa-users text-lg" />
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Staff Management
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Manage teaching and non-teaching staff,
                employment details, staff status, teaching
                documents, and staff duties from one place.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={scrollToDutyRoster}
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition duration-300 hover:-translate-y-1 hover:bg-slate-50 hover:shadow-lg"
              >
                <i className="fa-solid fa-calendar-check transition duration-300 group-hover:scale-110" />
                Duty Roster
              </button>

              <button
                type="button"
                onClick={openAddForm}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition duration-300 hover:-translate-y-1 hover:bg-slate-800 hover:shadow-xl"
              >
                <i className="fa-solid fa-user-plus transition duration-300 group-hover:rotate-6" />
                Add Staff
              </button>
            </div>
          </div>

          {/* ALERTS */}
          {error && (
            <div className="mb-5 flex animate-[btiStaffFadeUp_.35s_ease-out] items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              <i className="fa-solid fa-circle-exclamation mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-5 flex animate-[btiStaffFadeUp_.35s_ease-out] items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
              <i className="fa-solid fa-circle-check mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* STAFF STATS */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              {
                label: 'Total Staff',
                value: stats.total,
                icon: 'fa-solid fa-users',
              },
              {
                label: 'Teaching',
                value: stats.teaching,
                icon: 'fa-solid fa-chalkboard-user',
              },
              {
                label: 'Non-Teaching',
                value: stats.nonTeaching,
                icon: 'fa-solid fa-briefcase',
              },
              {
                label: 'Active',
                value: stats.active,
                icon: 'fa-solid fa-circle-check',
              },
              {
                label: 'Inactive',
                value: stats.inactive,
                icon: 'fa-solid fa-user-slash',
              },
            ].map((item, index) => (
              <div
                key={item.label}
                style={{
                  animationDelay: `${index * 70}ms`,
                }}
                className="bti-staff-stat group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {item.label}
                    </p>

                    <p className="mt-2 text-3xl font-bold text-slate-900 transition duration-300 group-hover:scale-105 group-hover:origin-left">
                      {item.value}
                    </p>
                  </div>

                  <div className="bti-staff-icon-pulse flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition duration-300 group-hover:bg-slate-900 group-hover:text-white">
                    <i className={item.icon} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* SEARCH / FILTERS */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-300 hover:shadow-md sm:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="relative xl:col-span-2">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition duration-300" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search name, Staff ID, department, position..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition duration-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                className={inputClass}
              >
                <option value="all">All Categories</option>
                <option value="teaching">Teaching</option>
                <option value="non_teaching">Non-Teaching</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className={inputClass}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(event) =>
                  setDepartmentFilter(event.target.value)
                }
                className={inputClass}
              >
                <option value="all">All Departments</option>

                {departments.map((department) => (
                  <option
                    key={department}
                    value={department}
                  >
                    {department}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* STAFF DIRECTORY */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Staff Directory
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Showing {filteredStaff.length} of {staff.length}{' '}
                  staff member{staff.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <i className="fa-solid fa-building-columns" />
                BTI Staff Records
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-slate-500">
                <div className="flex animate-[btiStaffFadeUp_.4s_ease-out] items-center gap-3">
                  <i className="fa-solid fa-spinner fa-spin text-lg" />
                  Loading staff records...
                </div>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="px-6 py-16 text-center animate-[btiStaffFadeUp_.4s_ease-out]">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 transition duration-300 hover:scale-110">
                  <i className="fa-solid fa-users-slash text-xl" />
                </div>

                <h3 className="font-bold text-slate-800">
                  No staff found
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Try changing your search or filters, or add a new
                  staff member.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredStaff.map((person, index) => (
                  <div
                    key={person.id}
                    style={{
                      animationDelay: `${Math.min(index, 12) * 45}ms`,
                    }}
                    className="bti-staff-card p-5 transition duration-300 hover:bg-slate-50/80"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                      {/* IDENTITY */}
                      <div className="flex min-w-0 items-center gap-4">
                        {person.photo_url ? (
                          <img
                            src={person.photo_url}
                            alt={person.full_name}
                            className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-2 ring-slate-100 transition duration-300 hover:scale-105 hover:ring-slate-300"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white transition duration-300 hover:scale-105 hover:rotate-2">
                            {initials(person.full_name)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-bold text-slate-900">
                              {person.full_name}
                            </h3>

                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                person.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {person.status === 'active'
                                ? 'ACTIVE'
                                : 'INACTIVE'}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {person.staff_number} ·{' '}
                            {person.position || 'Position not set'}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {person.department || 'No department'} ·{' '}
                            {person.staff_category === 'teaching'
                              ? 'Teaching'
                              : 'Non-Teaching'}
                          </p>
                        </div>
                      </div>

                      {/* QUICK DETAILS */}
                      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5 xl:min-w-[700px]">
                        <div className="rounded-xl bg-slate-50 p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
                          <p className="text-xs font-medium text-slate-400">
                            Phone
                          </p>

                          <p className="mt-1 truncate font-semibold text-slate-700">
                            {person.phone || '—'}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
                          <p className="text-xs font-medium text-slate-400">
                            Qualification
                          </p>

                          <p className="mt-1 truncate font-semibold text-slate-700">
                            {person.qualification || '—'}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
                          <p className="text-xs font-medium text-slate-400">
                            Employed
                          </p>

                          <p className="mt-1 truncate font-semibold text-slate-700">
                            {formatDate(person.employment_date)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
                          <p className="text-xs font-medium text-slate-400">
                            Documents
                          </p>

                          <p className="mt-1 font-semibold text-slate-700">
                            {
                              documents.filter(
                                (document) =>
                                  document.staff_id === person.id
                              ).length
                            }
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
                          <p className="text-xs font-medium text-slate-400">
                            Duties
                          </p>

                          <p className="mt-1 font-semibold text-slate-700">
                            {staffDutyCount(person.id)}
                          </p>
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openDetails(person)}
                          className="group inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                        >
                          <i className="fa-solid fa-eye transition group-hover:scale-110" />
                          Details
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditForm(person)}
                          className="group inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                        >
                          <i className="fa-solid fa-pen transition group-hover:rotate-6" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => openAddDutyForm(person.id)}
                          className="group inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-slate-800"
                        >
                          <i className="fa-solid fa-calendar-plus transition group-hover:scale-110" />
                          Duty
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleStatus(person)}
                          className={`group inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition duration-300 hover:-translate-y-0.5 ${
                            person.status === 'active'
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <i
                            className={
                              person.status === 'active'
                                ? 'fa-solid fa-user-slash'
                                : 'fa-solid fa-user-check'
                            }
                          />

                          {person.status === 'active'
                            ? 'Deactivate'
                            : 'Activate'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STAFF DUTY ROSTER */}
          <section
            id="staff-duty-roster"
            className="mt-8 scroll-mt-20 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 bg-slate-900 px-5 py-6 text-white sm:px-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="bti-staff-icon-pulse flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 transition duration-300">
                      <i className="fa-solid fa-calendar-check" />
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-white/50">
                        Staff Management
                      </p>

                      <h2 className="text-2xl font-bold">
                        Staff Duty Roster
                      </h2>
                    </div>
                  </div>

                  <p className="max-w-2xl text-sm leading-6 text-white/60">
                    Assign, manage, and monitor staff duties using a
                    central weekly or monthly roster.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openAddDutyForm()}
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-slate-100 hover:shadow-xl"
                >
                  <i className="fa-solid fa-calendar-plus transition duration-300 group-hover:scale-110" />
                  Assign Duty
                </button>
              </div>
            </div>

            {/* DUTY STATS */}
            <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-4 sm:p-5">
              {[
                {
                  label: 'Total',
                  value: dutyStats.total,
                  icon: 'fa-solid fa-calendar-days',
                },
                {
                  label: 'Scheduled',
                  value: dutyStats.scheduled,
                  icon: 'fa-solid fa-calendar-check',
                },
                {
                  label: 'Active',
                  value: dutyStats.active,
                  icon: 'fa-solid fa-person-circle-check',
                },
                {
                  label: 'Completed',
                  value: dutyStats.completed,
                  icon: 'fa-solid fa-circle-check',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {item.label}
                      </p>

                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {item.value}
                      </p>
                    </div>

                    <i className={`${item.icon} text-slate-400`} />
                  </div>
                </div>
              ))}
            </div>

            {/* DUTY FILTERS */}
            <div className="border-b border-slate-200 p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="relative md:col-span-2">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                  <input
                    value={dutySearch}
                    onChange={(event) =>
                      setDutySearch(event.target.value)
                    }
                    placeholder="Search staff member, duty type or notes..."
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition duration-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <select
                  value={dutyStatusFilter}
                  onChange={(event) =>
                    setDutyStatusFilter(
                      event.target.value as DutyStatus | 'all'
                    )
                  }
                  className={inputClass}
                >
                  <option value="all">All Duty Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* DUTY TOOLBAR */}
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDutyView('week')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition duration-300 ${
                      dutyView === 'week'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <i className="fa-solid fa-calendar-week" />
                    Weekly
                  </button>

                  <button
                    type="button"
                    onClick={() => setDutyView('month')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition duration-300 ${
                      dutyView === 'month'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <i className="fa-solid fa-calendar-days" />
                    Monthly
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={goToDutyPrevious}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-50"
                    title="Previous"
                  >
                    <i className="fa-solid fa-chevron-left" />
                  </button>

                  <button
                    type="button"
                    onClick={goToDutyToday}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-50"
                  >
                    Today
                  </button>

                  <button
                    type="button"
                    onClick={goToDutyNext}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-50"
                    title="Next"
                  >
                    <i className="fa-solid fa-chevron-right" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-center">
                <i className="fa-solid fa-calendar text-slate-400" />

                <h3 className="text-lg font-bold text-slate-900">
                  {dutyView === 'week'
                    ? dutyWeekLabel
                    : dutyMonthLabel}
                </h3>
              </div>
            </div>

            {/* EMPTY DUTY STATE */}
            {filteredDuties.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <i className="fa-solid fa-calendar-xmark text-2xl" />
                </div>

                <h3 className="font-bold text-slate-800">
                  No duty assignments found
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {duties.length === 0
                    ? 'No staff duties have been assigned yet. Use Assign Duty to create the first roster entry.'
                    : 'Try changing your duty search or status filter.'}
                </p>

                {duties.length === 0 && (
                  <button
                    type="button"
                    onClick={() => openAddDutyForm()}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    <i className="fa-solid fa-calendar-plus" />
                    Assign Duty
                  </button>
                )}
              </div>
            ) : dutyView === 'week' ? (
              /* WEEKLY ROSTER */
              <div className="overflow-x-auto">
                <div className="grid min-w-[980px] grid-cols-7 divide-x divide-slate-200">
                  {dutyWeekDays.map((date) => {
                    const dateKey = formatDateKey(date);
                    const dateDuties = dutiesForDate(dateKey);
                    const isToday =
                      dateKey === formatDateKey(new Date());

                    return (
                      <div
                        key={dateKey}
                        className={`min-h-[330px] bg-white ${
                          isToday ? 'bg-slate-50' : ''
                        }`}
                      >
                        <div
                          className={`border-b border-slate-200 p-3 text-center ${
                            isToday
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-50'
                          }`}
                        >
                          <p
                            className={`text-xs font-bold uppercase tracking-wide ${
                              isToday
                                ? 'text-white/60'
                                : 'text-slate-400'
                            }`}
                          >
                            {date.toLocaleDateString('en-GB', {
                              weekday: 'short',
                            })}
                          </p>

                          <p
                            className={`mt-1 text-xl font-bold ${
                              isToday
                                ? 'text-white'
                                : 'text-slate-900'
                            }`}
                          >
                            {date.getDate()}
                          </p>

                          <p
                            className={`text-[11px] ${
                              isToday
                                ? 'text-white/60'
                                : 'text-slate-400'
                            }`}
                          >
                            {date.toLocaleDateString('en-GB', {
                              month: 'short',
                            })}
                          </p>
                        </div>

                        <div className="space-y-2 p-2">
                          {dateDuties.length === 0 ? (
                            <div className="py-8 text-center text-slate-300">
                              <i className="fa-regular fa-calendar text-lg" />
                              <p className="mt-1 text-[10px]">
                                No duty
                              </p>
                            </div>
                          ) : (
                            dateDuties.map((duty) =>
                              renderDutyCard(duty, true)
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* MONTHLY ROSTER */
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                    {[
                      'Monday',
                      'Tuesday',
                      'Wednesday',
                      'Thursday',
                      'Friday',
                      'Saturday',
                      'Sunday',
                    ].map((day) => (
                      <div
                        key={day}
                        className="border-r border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500 last:border-r-0"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {dutyMonthDays.map((date) => {
                      const dateKey = formatDateKey(date);
                      const dateDuties = dutiesForDate(dateKey);

                      const isCurrentMonth =
                        date.getMonth() ===
                        parseDateKey(
                          dutyAnchorDate
                        ).getMonth();

                      const isToday =
                        dateKey === formatDateKey(new Date());

                      return (
                        <div
                          key={dateKey}
                          className={`min-h-[145px] border-b border-r border-slate-200 p-2 transition duration-300 hover:bg-slate-50 ${
                            !isCurrentMonth
                              ? 'bg-slate-50/50'
                              : 'bg-white'
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                                isToday
                                  ? 'bg-slate-900 text-white'
                                  : isCurrentMonth
                                    ? 'text-slate-700'
                                    : 'text-slate-300'
                              }`}
                            >
                              {date.getDate()}
                            </span>

                            {dateDuties.length > 0 && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">
                                {dateDuties.length}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            {dateDuties
                              .slice(0, 3)
                              .map((duty) =>
                                renderDutyCard(
                                  duty,
                                  true
                                )
                              )}

                            {dateDuties.length > 3 && (
                              <p className="px-1 text-[10px] font-semibold text-slate-400">
                                +{dateDuties.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ADD / EDIT STAFF MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6">
          <div className="bti-staff-modal my-4 w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl sm:my-8">

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Staff Records
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {editingId
                    ? 'Edit Staff Member'
                    : 'Add Staff Member'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition duration-300 hover:rotate-90 hover:bg-slate-200"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form
              onSubmit={saveStaff}
              className="max-h-[75vh] overflow-y-auto p-5 sm:p-7"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                      <i className="fa-solid fa-id-card" />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Basic Information
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Enter the staff member&apos;s official school
                        details.
                      </p>
                    </div>
                  </div>
                </div>

                <Field label="Staff ID" required>
                  <input
                    value={form.staff_number}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        staff_number: event.target.value,
                      })
                    }
                    placeholder="e.g. BTI-ST-001"
                    required
                    className={inputClass}
                  />
                </Field>

                <Field label="Full Name" required>
                  <input
                    value={form.full_name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        full_name: event.target.value,
                      })
                    }
                    placeholder="Full name"
                    required
                    className={inputClass}
                  />
                </Field>

                <Field label="Staff Category" required>
                  <select
                    value={form.staff_category}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        staff_category:
                          event.target.value as
                            | 'teaching'
                            | 'non_teaching',
                      })
                    }
                    className={inputClass}
                  >
                    <option value="teaching">Teaching</option>
                    <option value="non_teaching">Non-Teaching</option>
                  </select>
                </Field>

                <Field label="Status" required>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status:
                          event.target.value as
                            | 'active'
                            | 'inactive',
                      })
                    }
                    className={inputClass}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>

                <Field label="Gender">
                  <select
                    value={form.gender}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        gender: event.target.value,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>

                <Field label="Date of Birth">
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        date_of_birth: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Department">
                  <input
                    value={form.department}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        department: event.target.value,
                      })
                    }
                    placeholder="e.g. Science"
                    className={inputClass}
                  />
                </Field>

                <Field label="Position / Role">
                  <input
                    value={form.position}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        position: event.target.value,
                      })
                    }
                    placeholder="e.g. Science Teacher"
                    className={inputClass}
                  />
                </Field>

                <Field label="Date Employed">
                  <input
                    type="date"
                    value={form.employment_date}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        employment_date: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Qualification">
                  <input
                    value={form.qualification}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        qualification: event.target.value,
                      })
                    }
                    placeholder="e.g. B.Ed, M.Ed"
                    className={inputClass}
                  />
                </Field>

                <Field label="Specialization">
                  <input
                    value={form.specialization}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        specialization: event.target.value,
                      })
                    }
                    placeholder="e.g. Integrated Science"
                    className={inputClass}
                  />
                </Field>

                <Field label="Phone">
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        phone: event.target.value,
                      })
                    }
                    placeholder="Phone number"
                    className={inputClass}
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        email: event.target.value,
                      })
                    }
                    placeholder="name@example.com"
                    className={inputClass}
                  />
                </Field>

                <Field label="Profile Photo URL">
                  <input
                    value={form.photo_url}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        photo_url: event.target.value,
                      })
                    }
                    placeholder="https://..."
                    className={inputClass}
                  />
                </Field>

                <Field label="Address">
                  <textarea
                    value={form.address}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        address: event.target.value,
                      })
                    }
                    placeholder="Residential address"
                    rows={3}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-50"
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
                          : 'fa-solid fa-user-plus'
                    }
                  />

                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Save Changes'
                      : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DUTY FORM MODAL */}
      {showDutyForm && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6">
          <div className="bti-staff-modal my-4 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl sm:my-8">

            <div className="border-b border-slate-200 bg-slate-900 px-5 py-6 text-white sm:px-7">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                    <i className="fa-solid fa-calendar-plus" />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-white/50">
                      Staff Duty Roster
                    </p>

                    <h2 className="mt-1 text-xl font-bold">
                      {editingDutyId
                        ? 'Edit Duty Assignment'
                        : 'Assign Duty'}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeDutyForm}
                  disabled={savingDuty}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition duration-300 hover:rotate-90 hover:bg-white/20 disabled:opacity-50"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </div>

            <form
              onSubmit={saveDuty}
              className="p-5 sm:p-7"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                <div className="md:col-span-2">
                  <Field label="Staff Member" required>
                    <select
                      value={dutyForm.staff_id}
                      onChange={(event) =>
                        setDutyForm({
                          ...dutyForm,
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
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Duty Type" required>
                    <input
                      value={dutyForm.duty_type}
                      onChange={(event) =>
                        setDutyForm({
                          ...dutyForm,
                          duty_type: event.target.value,
                        })
                      }
                      required
                      placeholder="e.g. Morning Duty, Break Duty, Closing Duty"
                      className={inputClass}
                    />

                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        'Morning Duty',
                        'Break Duty',
                        'Closing Duty',
                        'Assembly Duty',
                        'Examination Duty',
                        'Weekend Duty',
                      ].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            setDutyForm({
                              ...dutyForm,
                              duty_type: type,
                            })
                          }
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition duration-300 hover:bg-slate-900 hover:text-white"
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                <Field label="Start Date" required>
                  <input
                    type="date"
                    value={dutyForm.start_date}
                    onChange={(event) =>
                      setDutyForm({
                        ...dutyForm,
                        start_date: event.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  />
                </Field>

                <Field label="End Date" required>
                  <input
                    type="date"
                    value={dutyForm.end_date}
                    min={dutyForm.start_date || undefined}
                    onChange={(event) =>
                      setDutyForm({
                        ...dutyForm,
                        end_date: event.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  />
                </Field>

                <Field label="Status" required>
                  <select
                    value={dutyForm.status}
                    onChange={(event) =>
                      setDutyForm({
                        ...dutyForm,
                        status:
                          event.target.value as DutyStatus,
                      })
                    }
                    required
                    className={inputClass}
                  >
                    <option value="scheduled">
                      Scheduled
                    </option>
                    <option value="active">Active</option>
                    <option value="completed">
                      Completed
                    </option>
                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </Field>

                <div className="md:col-span-2">
                  <Field label="Notes">
                    <textarea
                      value={dutyForm.notes}
                      onChange={(event) =>
                        setDutyForm({
                          ...dutyForm,
                          notes: event.target.value,
                        })
                      }
                      rows={4}
                      placeholder="Optional notes about the duty assignment..."
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-7 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <i className="fa-solid fa-circle-info mt-0.5 text-slate-400" />

                  <p className="text-xs leading-5 text-slate-500">
                    Duty assignments are stored centrally and will
                    later be available to the relevant teacher
                    dashboard, My Schedule, School Calendar, and
                    notification system.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDutyForm}
                  disabled={savingDuty}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingDuty}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-60"
                >
                  <i
                    className={
                      savingDuty
                        ? 'fa-solid fa-spinner fa-spin'
                        : editingDutyId
                          ? 'fa-solid fa-floppy-disk'
                          : 'fa-solid fa-calendar-plus'
                    }
                  />

                  {savingDuty
                    ? 'Saving...'
                    : editingDutyId
                      ? 'Save Duty Changes'
                      : 'Assign Duty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STAFF DETAILS MODAL */}
      {showDetails && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6">
          <div className="bti-staff-modal my-4 w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl sm:my-8">

            {/* PROFILE HEADER */}
            <div className="border-b border-slate-200 bg-slate-900 px-5 py-6 text-white sm:px-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-center gap-4">
                  {selectedStaff.photo_url ? (
                    <img
                      src={selectedStaff.photo_url}
                      alt={selectedStaff.full_name}
                      className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/20 transition duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold transition duration-300 hover:scale-105">
                      {initials(selectedStaff.full_name)}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-white/50">
                      Staff Profile
                    </p>

                    <h2 className="mt-1 text-2xl font-bold">
                      {selectedStaff.full_name}
                    </h2>

                    <p className="mt-1 text-sm text-white/60">
                      {selectedStaff.staff_number} ·{' '}
                      {selectedStaff.position || 'Position not set'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  className="flex h-10 w-10 self-end items-center justify-center rounded-xl bg-white/10 text-white transition duration-300 hover:rotate-90 hover:bg-white/20 sm:self-auto"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </div>

            <div className="max-h-[78vh] overflow-y-auto p-5 sm:p-7">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

                {/* LEFT / MAIN */}
                <div className="space-y-5 lg:col-span-2">

                  {/* STAFF INFORMATION */}
                  <div className="rounded-2xl border border-slate-200 p-5 transition duration-300 hover:shadow-md">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          Personal & Employment Details
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Official staff information
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          selectedStaff.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {selectedStaff.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Info
                        label="Staff ID"
                        value={selectedStaff.staff_number}
                      />

                      <Info
                        label="Category"
                        value={
                          selectedStaff.staff_category === 'teaching'
                            ? 'Teaching'
                            : 'Non-Teaching'
                        }
                      />

                      <Info
                        label="Gender"
                        value={selectedStaff.gender || '—'}
                      />

                      <Info
                        label="Department"
                        value={selectedStaff.department || '—'}
                      />

                      <Info
                        label="Position / Role"
                        value={selectedStaff.position || '—'}
                      />

                      <Info
                        label="Qualification"
                        value={selectedStaff.qualification || '—'}
                      />

                      <Info
                        label="Specialization"
                        value={selectedStaff.specialization || '—'}
                      />

                      <Info
                        label="Date Employed"
                        value={formatDate(selectedStaff.employment_date)}
                      />

                      <Info
                        label="Date of Birth"
                        value={formatDate(selectedStaff.date_of_birth)}
                      />

                      <Info
                        label="Phone"
                        value={selectedStaff.phone || '—'}
                      />

                      <Info
                        label="Email"
                        value={selectedStaff.email || '—'}
                      />

                      <Info
                        label="Address"
                        value={selectedStaff.address || '—'}
                      />
                    </div>
                  </div>

                  {/* DUTY SUMMARY */}
                  <div className="bti-duty-glow rounded-2xl border border-slate-200 p-5 transition duration-300 hover:shadow-md">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          Duty Roster
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Duty assignments for this staff member.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openAddDutyForm(selectedStaff.id)
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-slate-800"
                      >
                        <i className="fa-solid fa-calendar-plus" />
                        Assign Duty
                      </button>
                    </div>

                    <div className="mb-5 grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3 text-center">
                        <p className="text-xl font-bold text-slate-900">
                          {selectedDuties.length}
                        </p>

                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Total
                        </p>
                      </div>

                      <div className="rounded-xl bg-blue-50 p-3 text-center">
                        <p className="text-xl font-bold text-blue-700">
                          {staffActiveDutyCount(
                            selectedStaff.id
                          )}
                        </p>

                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-blue-400">
                          Active
                        </p>
                      </div>

                      <div className="rounded-xl bg-amber-50 p-3 text-center">
                        <p className="text-xl font-bold text-amber-700">
                          {
                            selectedDuties.filter(
                              (duty) =>
                                duty.status === 'scheduled'
                            ).length
                          }
                        </p>

                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                          Scheduled
                        </p>
                      </div>
                    </div>

                    {selectedDuties.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                        <i className="fa-solid fa-calendar-plus mb-3 text-xl text-slate-300" />

                        <p>
                          No duty assignments have been created for
                          this staff member.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedDuties
                          .slice()
                          .sort((a, b) =>
                            a.start_date.localeCompare(
                              b.start_date
                            )
                          )
                          .slice(0, 5)
                          .map((duty) =>
                            renderDutyCard(duty)
                          )}

                        {selectedDuties.length > 5 && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowDetails(false);
                              scrollToDutyRoster();
                            }}
                            className="mt-2 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 transition duration-300 hover:bg-slate-50"
                          >
                            View all {selectedDuties.length} duty
                            assignments
                            <i className="fa-solid fa-arrow-right ml-2" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* TEACHING DOCUMENTS */}
                  <div className="rounded-2xl border border-slate-200 p-5 transition duration-300 hover:shadow-md">

                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          Teaching Documents
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Upload and retrieve teaching documents for
                          this staff member.
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {selectedDocuments.length} document
                        {selectedDocuments.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {/* UPLOAD FORM */}
                    <form
                      onSubmit={uploadDocument}
                      className="rounded-2xl bg-slate-50 p-4"
                    >
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                        <Field label="Document Type">
                          <select
                            value={documentType}
                            onChange={(event) =>
                              setDocumentType(
                                event.target.value as DocumentType
                              )
                            }
                            className={inputClass}
                          >
                            <option value="unit_specification">
                              Unit Specification Breakdown
                            </option>

                            <option value="learning_session_plan">
                              Learning Session Plan
                            </option>

                            <option value="particulars_of_work_done">
                              Particulars of Work Done
                            </option>
                          </select>
                        </Field>

                        <Field label="Document Title">
                          <input
                            value={documentTitle}
                            onChange={(event) =>
                              setDocumentTitle(event.target.value)
                            }
                            placeholder={documentLabels[documentType]}
                            className={inputClass}
                          />
                        </Field>

                        {documentType === 'unit_specification' && (
                          <>
                            <Field
                              label="Academic Year"
                              required
                            >
                              <select
                                value={documentYearId}
                                onChange={(event) => {
                                  setDocumentYearId(
                                    event.target.value
                                  );
                                  setDocumentSemesterId('');
                                }}
                                required
                                className={inputClass}
                              >
                                <option value="">
                                  Select academic year
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
                            </Field>

                            <Field label="Semester" required>
                              <select
                                value={documentSemesterId}
                                onChange={(event) =>
                                  setDocumentSemesterId(
                                    event.target.value
                                  )
                                }
                                required
                                className={inputClass}
                                disabled={!documentYearId}
                              >
                                <option value="">
                                  {documentYearId
                                    ? 'Select semester'
                                    : 'Select academic year first'}
                                </option>

                                {selectedYearSemesters.map(
                                  (semester) => (
                                    <option
                                      key={semester.id}
                                      value={semester.id}
                                    >
                                      {semester.name}
                                    </option>
                                  )
                                )}
                              </select>
                            </Field>
                          </>
                        )}

                        <Field label="File" required>
                          <input
                            type="file"
                            onChange={(event) =>
                              setDocumentFile(
                                event.target.files?.[0] || null
                              )
                            }
                            required
                            className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold"
                          />
                        </Field>

                        <Field label="Notes">
                          <input
                            value={documentNotes}
                            onChange={(event) =>
                              setDocumentNotes(event.target.value)
                            }
                            placeholder="Optional note"
                            className={inputClass}
                          />
                        </Field>
                      </div>

                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-400">
                          Maximum file size: 10 MB.
                        </p>

                        <button
                          type="submit"
                          disabled={uploading}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-60"
                        >
                          <i
                            className={
                              uploading
                                ? 'fa-solid fa-spinner fa-spin'
                                : 'fa-solid fa-cloud-arrow-up'
                            }
                          />

                          {uploading
                            ? 'Uploading...'
                            : 'Upload Document'}
                        </button>
                      </div>
                    </form>

                    {/* DOCUMENT COUNTS */}
                    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                      {[
                        {
                          type: 'unit_specification' as const,
                          label: 'Unit Specification',
                          count: selectedUnitDocuments.length,
                        },
                        {
                          type: 'learning_session_plan' as const,
                          label: 'Learning Session Plans',
                          count: selectedLspDocuments.length,
                        },
                        {
                          type: 'particulars_of_work_done' as const,
                          label: 'Particulars of Work',
                          count:
                            selectedParticularsDocuments.length,
                        },
                      ].map((item) => (
                        <div
                          key={item.type}
                          className="group rounded-xl border border-slate-200 p-4 transition duration-300 hover:-translate-y-1 hover:shadow-md"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <i
                              className={`${documentIcons[item.type]} text-slate-500 transition duration-300 group-hover:scale-110 group-hover:text-slate-900`}
                            />

                            <span className="text-lg font-bold text-slate-900">
                              {item.count}
                            </span>
                          </div>

                          <p className="mt-3 text-xs font-bold text-slate-600">
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* DOCUMENT LIST */}
                    {selectedDocuments.length === 0 ? (
                      <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-7 text-center text-sm text-slate-500 animate-[btiStaffFadeUp_.35s_ease-out]">
                        <i className="fa-solid fa-folder-open mb-3 text-2xl text-slate-300" />
                        <p>
                          No teaching documents have been uploaded for
                          this staff member yet.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {selectedDocuments.map(
                          (document, index) => (
                            <div
                              key={document.id}
                              style={{
                                animationDelay: `${index * 55}ms`,
                              }}
                              className="bti-staff-card flex flex-col gap-3 rounded-xl border border-slate-200 p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition duration-300 hover:scale-110">
                                  <i
                                    className={
                                      documentIcons[
                                        document.document_type
                                      ]
                                    }
                                  />
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-800">
                                    {document.title}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {
                                      documentLabels[
                                        document.document_type
                                      ]
                                    }{' '}
                                    · {document.file_name} ·{' '}
                                    {formatFileSize(
                                      document.file_size
                                    )}
                                  </p>

                                  {document.document_type ===
                                    'unit_specification' && (
                                    <p className="mt-1 text-xs font-medium text-slate-400">
                                      {getYearName(
                                        document.academic_year_id
                                      )}{' '}
                                      ·{' '}
                                      {getSemesterName(
                                        document.semester_id
                                      )}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDocument(document)
                                  }
                                  className="group rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-slate-800"
                                >
                                  <i className="fa-solid fa-arrow-up-right-from-square mr-1 transition group-hover:scale-110" />
                                  Open
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteDocument(document)
                                  }
                                  className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 transition duration-300 hover:-translate-y-0.5 hover:bg-red-50"
                                >
                                  <i className="fa-solid fa-trash" />
                                </button>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-5">

                  {/* UNIT SPECIFICATION COMPLIANCE */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                        <i className="fa-solid fa-clipboard-check" />
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          Teaching Compliance
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          Unit Specification
                        </h3>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      Every teacher is expected to upload one Unit
                      Specification Breakdown for each semester.
                    </p>

                    <div className="mt-5 space-y-3">
                      {academicYears.slice(0, 4).map((year) => {
                        const yearSemesters = semesters.filter(
                          (semester) =>
                            semester.academic_year_id === year.id
                        );

                        return yearSemesters.map((semester) => {
                          const uploaded =
                            selectedUnitDocuments.some(
                              (document) =>
                                document.academic_year_id ===
                                  year.id &&
                                document.semester_id === semester.id
                            );

                          return (
                            <div
                              key={`${year.id}-${semester.id}`}
                              className="group flex items-center justify-between rounded-xl border border-white bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-700">
                                  {year.name}
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">
                                  {semester.name}
                                </p>
                              </div>

                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                  uploaded
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                <i
                                  className={
                                    uploaded
                                      ? 'fa-solid fa-circle-check'
                                      : 'fa-solid fa-circle-xmark'
                                  }
                                />

                                {uploaded
                                  ? 'Uploaded'
                                  : 'Not Uploaded'}
                              </span>
                            </div>
                          );
                        });
                      })}
                    </div>
                  </div>

                  {/* RECORD ACTIONS */}
                  <div className="rounded-2xl border border-slate-200 p-5 transition duration-300 hover:shadow-md">
                    <h3 className="font-bold text-slate-900">
                      Record Actions
                    </h3>

                    <div className="mt-4 space-y-2">

                      <button
                        type="button"
                        onClick={() =>
                          openAddDutyForm(selectedStaff.id)
                        }
                        className="group flex w-full items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md"
                      >
                        <i className="fa-solid fa-calendar-plus w-4 text-center transition group-hover:scale-110" />
                        Assign Duty
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEditForm(selectedStaff)
                        }
                        className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm"
                      >
                        <i className="fa-solid fa-pen w-4 text-center transition group-hover:rotate-6" />
                        Edit Staff Details
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleStatus(selectedStaff)
                        }
                        className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm"
                      >
                        <i
                          className={`${
                            selectedStaff.status === 'active'
                              ? 'fa-solid fa-user-slash'
                              : 'fa-solid fa-user-check'
                          } w-4 text-center transition group-hover:scale-110`}
                        />

                        {selectedStaff.status === 'active'
                          ? 'Deactivate Staff'
                          : 'Activate Staff'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteStaff(selectedStaff)
                        }
                        className="group flex w-full items-center gap-3 rounded-xl border border-red-100 px-4 py-3 text-left text-sm font-semibold text-red-600 transition duration-300 hover:-translate-y-0.5 hover:bg-red-50"
                      >
                        <i className="fa-solid fa-trash w-4 text-center transition group-hover:scale-110" />
                        Delete Staff Record
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

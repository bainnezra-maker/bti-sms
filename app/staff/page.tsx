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

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100';

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
    <div>
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

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    ]);

    if (staffResult.error) {
      setError(staffResult.error.message);
    } else {
      setStaff((staffResult.data || []) as Staff[]);
    }

    if (documentsResult.error) {
      setError(
        (current) => current || documentsResult.error!.message
      );
    } else {
      setDocuments(
        (documentsResult.data || []) as DocumentRecord[]
      );
    }

    if (yearsResult.error) {
      setError(
        (current) => current || yearsResult.error!.message
      );
    } else {
      setAcademicYears(
        (yearsResult.data || []) as AcademicYear[]
      );
    }

    if (semestersResult.error) {
      setError(
        (current) => current || semestersResult.error!.message
      );
    } else {
      setSemesters(
        (semestersResult.data || []) as Semester[]
      );
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

    setMessage(
      `${person.full_name} is now ${nextStatus}.`
    );
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

      setMessage(
        'Teaching document uploaded successfully.'
      );
    }

    setUploading(false);
  }

  async function openDocument(document: DocumentRecord) {
    setError('');

    const { data, error: signedUrlError } =
      await supabase.storage
        .from('staff-documents')
        .createSignedUrl(
          document.file_path,
          60 * 10
        );

    if (
      signedUrlError ||
      !data?.signedUrl
    ) {
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

  async function deleteDocument(
    document: DocumentRecord
  ) {
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
      current.filter(
        (item) => item.id !== document.id
      )
    );

    setMessage(
      'Teaching document deleted successfully.'
    );
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
        person.full_name
          .toLowerCase()
          .includes(query) ||
        person.staff_number
          .toLowerCase()
          .includes(query) ||
        (person.department || '')
          .toLowerCase()
          .includes(query) ||
        (person.position || '')
          .toLowerCase()
          .includes(query) ||
        (person.phone || '')
          .toLowerCase()
          .includes(query);

      const matchesCategory =
        categoryFilter === 'all' ||
        person.staff_category ===
          categoryFilter;

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
        (person) =>
          person.staff_category === 'teaching'
      ).length,

      nonTeaching: staff.filter(
        (person) =>
          person.staff_category ===
          'non_teaching'
      ).length,

      active: staff.filter(
        (person) =>
          person.status === 'active'
      ).length,

      inactive: staff.filter(
        (person) =>
          person.status === 'inactive'
      ).length,
    }),
    [staff]
  );

  const selectedStaff =
    staff.find(
      (person) =>
        person.id === selectedStaffId
    ) || null;

  const selectedDocuments =
    documents.filter(
      (document) =>
        document.staff_id ===
        selectedStaffId
    );

  const selectedUnitDocuments =
    selectedDocuments.filter(
      (document) =>
        document.document_type ===
        'unit_specification'
    );

  const selectedLspDocuments =
    selectedDocuments.filter(
      (document) =>
        document.document_type ===
        'learning_session_plan'
    );

  const selectedParticularsDocuments =
    selectedDocuments.filter(
      (document) =>
        document.document_type ===
        'particulars_of_work_done'
    );

  const selectedYearSemesters =
    semesters.filter(
      (semester) =>
        semester.academic_year_id ===
        documentYearId
    );

  function getSemesterName(
    semesterId: string | null
  ) {
    return (
      semesters.find(
        (semester) =>
          semester.id === semesterId
      )?.name || '—'
    );
  }

  function getYearName(
    yearId: string | null
  ) {
    return (
      academicYears.find(
        (year) => year.id === yearId
      )?.name || '—'
    );
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      />

      <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                <i className="fa-solid fa-users text-lg" />
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Staff Management
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Manage teaching and non-teaching staff,
                employment details, staff status, and
                teaching documents from one place.
              </p>
            </div>

            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              <i className="fa-solid fa-user-plus" />
              Add Staff
            </button>
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
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {item.label}
                    </p>

                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {item.value}
                    </p>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <i className={item.icon} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* SEARCH / FILTERS */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">

              <div className="relative xl:col-span-2">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search name, Staff ID, department, position..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value
                  )
                }
                className={inputClass}
              >
                <option value="all">
                  All Categories
                </option>

                <option value="teaching">
                  Teaching
                </option>

                <option value="non_teaching">
                  Non-Teaching
                </option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className={inputClass}
              >
                <option value="all">
                  All Statuses
                </option>

                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>

              <select
                value={departmentFilter}
                onChange={(event) =>
                  setDepartmentFilter(
                    event.target.value
                  )
                }
                className={inputClass}
              >
                <option value="all">
                  All Departments
                </option>

                {departments.map(
                  (department) => (
                    <option
                      key={department}
                      value={department}
                    >
                      {department}
                    </option>
                  )
                )}
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
                  Showing {filteredStaff.length} of{' '}
                  {staff.length} staff member
                  {staff.length === 1
                    ? ''
                    : 's'}
                </p>
              </div>

              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                BTI Staff Records
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-slate-500">
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-spinner fa-spin" />
                  Loading staff records...
                </div>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <i className="fa-solid fa-users-slash text-xl" />
                </div>

                <h3 className="font-bold text-slate-800">
                  No staff found
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Try changing your search or
                  filters, or add a new staff member.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredStaff.map(
                  (person) => (
                    <div
                      key={person.id}
                      className="p-5 transition hover:bg-slate-50/80"
                    >
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                        {/* IDENTITY */}
                        <div className="flex min-w-0 items-center gap-4">
                          {person.photo_url ? (
                            <img
                              src={person.photo_url}
                              alt={person.full_name}
                              className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-2 ring-slate-100"
                            />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                              {initials(
                                person.full_name
                              )}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-bold text-slate-900">
                                {person.full_name}
                              </h3>

                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                  person.status ===
                                  'active'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {person.status ===
                                'active'
                                  ? 'ACTIVE'
                                  : 'INACTIVE'}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                              {person.staff_number} ·{' '}
                              {person.position ||
                                'Position not set'}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {person.department ||
                                'No department'}{' '}
                              ·{' '}
                              {person.staff_category ===
                              'teaching'
                                ? 'Teaching'
                                : 'Non-Teaching'}
                            </p>
                          </div>
                        </div>

                        {/* QUICK DETAILS */}
                        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 xl:min-w-[560px]">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-400">
                              Phone
                            </p>

                            <p className="mt-1 truncate font-semibold text-slate-700">
                              {person.phone || '—'}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-400">
                              Qualification
                            </p>

                            <p className="mt-1 truncate font-semibold text-slate-700">
                              {person.qualification ||
                                '—'}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-400">
                              Employed
                            </p>

                            <p className="mt-1 truncate font-semibold text-slate-700">
                              {formatDate(
                                person.employment_date
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-400">
                              Documents
                            </p>

                            <p className="mt-1 font-semibold text-slate-700">
                              {
                                documents.filter(
                                  (document) =>
                                    document.staff_id ===
                                    person.id
                                ).length
                              }
                            </p>
                          </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openDetails(person)
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                          >
                            <i className="fa-solid fa-eye" />
                            Details
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEditForm(person)
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                          >
                            <i className="fa-solid fa-pen" />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              toggleStatus(person)
                            }
                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                              person.status ===
                              'active'
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            <i
                              className={
                                person.status ===
                                'active'
                                  ? 'fa-solid fa-user-slash'
                                  : 'fa-solid fa-user-check'
                              }
                            />

                            {person.status ===
                            'active'
                              ? 'Deactivate'
                              : 'Activate'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD / EDIT STAFF MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6">
          <div className="my-4 w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl sm:my-8">

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
                onClick={() =>
                  setShowForm(false)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
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
                  <p className="text-sm font-bold text-slate-800">
                    Basic Information
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Enter the staff member&apos;s official
                    school details.
                  </p>
                </div>

                <Field
                  label="Staff ID"
                  required
                >
                  <input
                    value={form.staff_number}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        staff_number:
                          event.target.value,
                      })
                    }
                    placeholder="e.g. BTI-ST-001"
                    required
                    className={inputClass}
                  />
                </Field>

                <Field
                  label="Full Name"
                  required
                >
                  <input
                    value={form.full_name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        full_name:
                          event.target.value,
                      })
                    }
                    placeholder="Full name"
                    required
                    className={inputClass}
                  />
                </Field>

                <Field
                  label="Staff Category"
                  required
                >
                  <select
                    value={
                      form.staff_category
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        staff_category:
                          event.target
                            .value as
                            | 'teaching'
                            | 'non_teaching',
                      })
                    }
                    className={inputClass}
                  >
                    <option value="teaching">
                      Teaching
                    </option>

                    <option value="non_teaching">
                      Non-Teaching
                    </option>
                  </select>
                </Field>

                <Field
                  label="Status"
                  required
                >
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status:
                          event.target
                            .value as
                            | 'active'
                            | 'inactive',
                      })
                    }
                    className={inputClass}
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </Field>

                <Field label="Gender">
                  <select
                    value={form.gender}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        gender:
                          event.target.value,
                      })
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

                    <option value="Other">
                      Other
                    </option>
                  </select>
                </Field>

                <Field label="Date of Birth">
                  <input
                    type="date"
                    value={
                      form.date_of_birth
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        date_of_birth:
                          event.target.value,
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
                        department:
                          event.target.value,
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
                        position:
                          event.target.value,
                      })
                    }
                    placeholder="e.g. Science Teacher"
                    className={inputClass}
                  />
                </Field>

                <Field label="Date Employed">
                  <input
                    type="date"
                    value={
                      form.employment_date
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        employment_date:
                          event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Qualification">
                  <input
                    value={
                      form.qualification
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        qualification:
                          event.target.value,
                      })
                    }
                    placeholder="e.g. B.Ed, M.Ed"
                    className={inputClass}
                  />
                </Field>

                <Field label="Specialization">
                  <input
                    value={
                      form.specialization
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        specialization:
                          event.target.value,
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
                        phone:
                          event.target.value,
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
                        email:
                          event.target.value,
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
                        photo_url:
                          event.target.value,
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
                        address:
                          event.target.value,
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
                  onClick={() =>
                    setShowForm(false)
                  }
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
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

      {/* STAFF DETAILS MODAL */}
      {showDetails && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6">
          <div className="my-4 w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl sm:my-8">

            {/* PROFILE HEADER */}
            <div className="border-b border-slate-200 bg-slate-900 px-5 py-6 text-white sm:px-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-center gap-4">
                  {selectedStaff.photo_url ? (
                    <img
                      src={
                        selectedStaff.photo_url
                      }
                      alt={
                        selectedStaff.full_name
                      }
                      className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/20"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold">
                      {initials(
                        selectedStaff.full_name
                      )}
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
                      {selectedStaff.position ||
                        'Position not set'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowDetails(false)
                  }
                  className="flex h-10 w-10 self-end items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 sm:self-auto"
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
                  <div className="rounded-2xl border border-slate-200 p-5">
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
                          selectedStaff.status ===
                          'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {selectedStaff.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Info
                        label="Staff ID"
                        value={
                          selectedStaff.staff_number
                        }
                      />

                      <Info
                        label="Category"
                        value={
                          selectedStaff.staff_category ===
                          'teaching'
                            ? 'Teaching'
                            : 'Non-Teaching'
                        }
                      />

                      <Info
                        label="Gender"
                        value={
                          selectedStaff.gender ||
                          '—'
                        }
                      />

                      <Info
                        label="Department"
                        value={
                          selectedStaff.department ||
                          '—'
                        }
                      />

                      <Info
                        label="Position / Role"
                        value={
                          selectedStaff.position ||
                          '—'
                        }
                      />

                      <Info
                        label="Qualification"
                        value={
                          selectedStaff.qualification ||
                          '—'
                        }
                      />

                      <Info
                        label="Specialization"
                        value={
                          selectedStaff.specialization ||
                          '—'
                        }
                      />

                      <Info
                        label="Date Employed"
                        value={formatDate(
                          selectedStaff.employment_date
                        )}
                      />

                      <Info
                        label="Date of Birth"
                        value={formatDate(
                          selectedStaff.date_of_birth
                        )}
                      />

                      <Info
                        label="Phone"
                        value={
                          selectedStaff.phone ||
                          '—'
                        }
                      />

                      <Info
                        label="Email"
                        value={
                          selectedStaff.email ||
                          '—'
                        }
                      />

                      <Info
                        label="Address"
                        value={
                          selectedStaff.address ||
                          '—'
                        }
                      />
                    </div>
                  </div>

                  {/* TEACHING DOCUMENTS */}
                  <div className="rounded-2xl border border-slate-200 p-5">

                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          Teaching Documents
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Upload and retrieve teaching
                          documents for this staff member.
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {selectedDocuments.length}{' '}
                        document
                        {selectedDocuments.length ===
                        1
                          ? ''
                          : 's'}
                      </span>
                    </div>

                    {/* UPLOAD FORM */}
                    <form
                      onSubmit={
                        uploadDocument
                      }
                      className="rounded-2xl bg-slate-50 p-4"
                    >
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                        <Field label="Document Type">
                          <select
                            value={documentType}
                            onChange={(event) =>
                              setDocumentType(
                                event.target
                                  .value as DocumentType
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
                            value={
                              documentTitle
                            }
                            onChange={(event) =>
                              setDocumentTitle(
                                event.target
                                  .value
                              )
                            }
                            placeholder={
                              documentLabels[
                                documentType
                              ]
                            }
                            className={inputClass}
                          />
                        </Field>

                        {documentType ===
                          'unit_specification' && (
                          <>
                            <Field
                              label="Academic Year"
                              required
                            >
                              <select
                                value={
                                  documentYearId
                                }
                                onChange={(
                                  event
                                ) => {
                                  setDocumentYearId(
                                    event.target
                                      .value
                                  );

                                  setDocumentSemesterId(
                                    ''
                                  );
                                }}
                                required
                                className={
                                  inputClass
                                }
                              >
                                <option value="">
                                  Select academic year
                                </option>

                                {academicYears.map(
                                  (year) => (
                                    <option
                                      key={
                                        year.id
                                      }
                                      value={
                                        year.id
                                      }
                                    >
                                      {year.name}
                                    </option>
                                  )
                                )}
                              </select>
                            </Field>

                            <Field
                              label="Semester"
                              required
                            >
                              <select
                                value={
                                  documentSemesterId
                                }
                                onChange={(
                                  event
                                ) =>
                                  setDocumentSemesterId(
                                    event.target
                                      .value
                                  )
                                }
                                required
                                className={
                                  inputClass
                                }
                                disabled={
                                  !documentYearId
                                }
                              >
                                <option value="">
                                  {documentYearId
                                    ? 'Select semester'
                                    : 'Select academic year first'}
                                </option>

                                {selectedYearSemesters.map(
                                  (
                                    semester
                                  ) => (
                                    <option
                                      key={
                                        semester.id
                                      }
                                      value={
                                        semester.id
                                      }
                                    >
                                      {
                                        semester.name
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </Field>
                          </>
                        )}

                        <Field
                          label="File"
                          required
                        >
                          <input
                            type="file"
                            onChange={(event) =>
                              setDocumentFile(
                                event.target
                                  .files?.[0] ||
                                  null
                              )
                            }
                            required
                            className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold"
                          />
                        </Field>

                        <Field label="Notes">
                          <input
                            value={
                              documentNotes
                            }
                            onChange={(event) =>
                              setDocumentNotes(
                                event.target
                                  .value
                              )
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
                          disabled={
                            uploading
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
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
                          label:
                            'Unit Specification',
                          count:
                            selectedUnitDocuments.length,
                        },
                        {
                          type: 'learning_session_plan' as const,
                          label:
                            'Learning Session Plans',
                          count:
                            selectedLspDocuments.length,
                        },
                        {
                          type: 'particulars_of_work_done' as const,
                          label:
                            'Particulars of Work',
                          count:
                            selectedParticularsDocuments.length,
                        },
                      ].map((item) => (
                        <div
                          key={item.type}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <i
                              className={`${documentIcons[item.type]} text-slate-500`}
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
                    {selectedDocuments.length ===
                    0 ? (
                      <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-7 text-center text-sm text-slate-500">
                        No teaching documents have
                        been uploaded for this staff
                        member yet.
                      </div>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {selectedDocuments.map(
                          (document) => (
                            <div
                              key={
                                document.id
                              }
                              className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                  <i
                                    className={
                                      documentIcons[
                                        document
                                          .document_type
                                      ]
                                    }
                                  />
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-800">
                                    {
                                      document.title
                                    }
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {
                                      documentLabels[
                                        document
                                          .document_type
                                      ]
                                    }{' '}
                                    ·{' '}
                                    {
                                      document.file_name
                                    }{' '}
                                    ·{' '}
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
                                    openDocument(
                                      document
                                    )
                                  }
                                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                                >
                                  <i className="fa-solid fa-arrow-up-right-from-square mr-1" />
                                  Open
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteDocument(
                                      document
                                    )
                                  }
                                  className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
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
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      Teaching Compliance
                    </p>

                    <h3 className="mt-2 text-lg font-bold text-slate-900">
                      Unit Specification
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Every teacher is expected to
                      upload one Unit Specification
                      Breakdown for each semester.
                    </p>

                    <div className="mt-5 space-y-3">
                      {academicYears
                        .slice(0, 4)
                        .map((year) => {
                          const yearSemesters =
                            semesters.filter(
                              (semester) =>
                                semester.academic_year_id ===
                                year.id
                            );

                          return yearSemesters.map(
                            (semester) => {
                              const uploaded =
                                selectedUnitDocuments.some(
                                  (document) =>
                                    document.academic_year_id ===
                                      year.id &&
                                    document.semester_id ===
                                      semester.id
                                );

                              return (
                                <div
                                  key={`${year.id}-${semester.id}`}
                                  className="flex items-center justify-between rounded-xl border border-white bg-white p-3 shadow-sm"
                                >
                                  <div>
                                    <p className="text-xs font-bold text-slate-700">
                                      {year.name}
                                    </p>

                                    <p className="mt-0.5 text-xs text-slate-400">
                                      {
                                        semester.name
                                      }
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
                            }
                          );
                        })}
                    </div>
                  </div>

                  {/* RECORD ACTIONS */}
                  <div className="rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-900">
                      Record Actions
                    </h3>

                    <div className="mt-4 space-y-2">

                      <button
                        type="button"
                        onClick={() =>
                          openEditForm(
                            selectedStaff
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <i className="fa-solid fa-pen w-4 text-center" />
                        Edit Staff Details
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleStatus(
                            selectedStaff
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <i
                          className={`${
                            selectedStaff.status ===
                            'active'
                              ? 'fa-solid fa-user-slash'
                              : 'fa-solid fa-user-check'
                          } w-4 text-center`}
                        />

                        {selectedStaff.status ===
                        'active'
                          ? 'Deactivate Staff'
                          : 'Activate Staff'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteStaff(
                            selectedStaff
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl border border-red-100 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        <i className="fa-solid fa-trash w-4 text-center" />
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

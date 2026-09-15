'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Field = {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
};

type Props = {
  table: string;
  title: string;
  description: string;
  icon: string;
  fields: Field[];
  columns: string[];
};

export default function AcademicManager({
  table,
  title,
  description,
  icon,
  fields,
  columns,
}: Props) {
  const supabase = createClient();

  const [records, setRecords] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function getSchoolId() {
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

    return profile.school_id;
  }

  async function loadRecords() {
    setLoading(true);
    setError('');

    const schoolId = await getSchoolId();

    if (!schoolId) {
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from(table as any)
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setRecords(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRecords();
  }, []);

  function updateField(name: string, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function clearMessages() {
    setError('');
    setSuccess('');
  }

  function startEdit(record: any) {
    clearMessages();

    const values: Record<string, string> = {};

    fields.forEach((field) => {
      values[field.name] =
        record[field.name] === null ||
        record[field.name] === undefined
          ? ''
          : String(record[field.name]);
    });

    setForm(values);
    setEditingId(record.id);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({});
    clearMessages();
  }

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();

    clearMessages();
    setSaving(true);

    const schoolId = await getSchoolId();

    if (!schoolId) {
      setSaving(false);
      return;
    }

    const payload: Record<string, any> = {
      school_id: schoolId,
    };

    fields.forEach((field) => {
      const value = form[field.name]?.trim();

      payload[field.name] = value || null;
    });

    let saveError: any = null;

    if (editingId) {
      const { error: updateError } = await supabase
        .from(table as any)
        .update(payload)
        .eq('id', editingId)
        .eq('school_id', schoolId);

      saveError = updateError;
    } else {
      const { error: insertError } = await supabase
        .from(table as any)
        .insert(payload);

      saveError = insertError;
    }

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    if (editingId) {
      setSuccess(`${title.slice(0, -1) || title} updated successfully.`);
    } else {
      setSuccess(`${title.slice(0, -1) || title} added successfully.`);
    }

    setForm({});
    setEditingId(null);

    await loadRecords();

    setSaving(false);
  }

  async function deleteRecord(record: any) {
    clearMessages();

    const recordName =
      record.name ||
      record.title ||
      record.code ||
      'this record';

    const confirmed = window.confirm(
      `Are you sure you want to delete "${recordName}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(record.id);

    const schoolId = await getSchoolId();

    if (!schoolId) {
      setDeleting(null);
      return;
    }

    /*
     * Subjects may be referenced by teacher_assignments.
     * Check this first so the user receives a clear explanation
     * instead of a confusing foreign-key error.
     */
    if (table === 'subjects') {
      const { count, error: assignmentCheckError } = await supabase
        .from('teacher_assignments')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('subject_id', record.id);

      if (assignmentCheckError) {
        console.warn(
          'Could not check teacher assignments:',
          assignmentCheckError.message
        );
      }

      if ((count || 0) > 0) {
        setError(
          `"${recordName}" cannot be deleted because it is already assigned to a teacher. Remove the teacher assignment first, then delete the subject.`
        );

        setDeleting(null);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from(table as any)
      .delete()
      .eq('id', record.id)
      .eq('school_id', schoolId);

    if (deleteError) {
      console.error('Delete error:', deleteError);

      setError(
        deleteError.message ||
          `Unable to delete ${recordName}. Please try again.`
      );

      setDeleting(null);
      return;
    }

    setRecords((current) =>
      current.filter((item) => item.id !== record.id)
    );

    setSuccess(`${recordName} deleted successfully.`);

    setDeleting(null);
  }

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return records;

    return records.filter((record) => {
      const text = Object.values(record)
        .map((value) =>
          value === null || value === undefined
            ? ''
            : String(value)
        )
        .join(' ')
        .toLowerCase();

      return text.includes(query);
    });
  }, [records, search]);

  const singularTitle =
    title.endsWith('s') && title.length > 1
      ? title.slice(0, -1)
      : title;

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 shadow-xl sm:p-8">

            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl animate-pulse" />
            <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/20 backdrop-blur">

                  <i className="fa-solid fa-book-open text-2xl text-cyan-300 animate-pulse" />

                </div>

                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
                      <i className="fa-solid fa-circle-check mr-1" />
                      Academic Management
                    </span>
                  </div>

                  <h1 className="text-2xl font-bold text-white sm:text-3xl">
                    {title}
                  </h1>

                  <p className="mt-1 max-w-2xl text-sm text-slate-300">
                    {description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-300">
                <i className="fa-solid fa-layer-group text-cyan-300" />
                <span>
                  {records.length} {title.toLowerCase()}
                </span>
              </div>

            </div>
          </div>
        </div>

        {/* MESSAGES */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm animate-[fadeIn_.3s_ease-out]">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>

            <div className="flex-1">
              <p className="font-bold">Action could not be completed</p>
              <p className="mt-1">{error}</p>
            </div>

            <button
              onClick={() => setError('')}
              className="rounded-lg p-2 text-red-500 hover:bg-red-100"
              aria-label="Close error"
            >
              <i className="fa-solid fa-xmark" />
            </button>

          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
              <i className="fa-solid fa-circle-check animate-bounce" />
            </div>

            <div className="flex-1">
              <p className="font-bold">Success</p>
              <p className="mt-1">{success}</p>
            </div>

            <button
              onClick={() => setSuccess('')}
              className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-100"
              aria-label="Close success message"
            >
              <i className="fa-solid fa-xmark" />
            </button>

          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* FORM */}
          <div className="lg:col-span-1">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">

              <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-6">

                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
                    <i
                      className={`fa-solid ${
                        editingId
                          ? 'fa-pen-to-square'
                          : 'fa-plus'
                      }`}
                    />
                  </div>

                  <div>
                    <h2 className="font-bold text-slate-900">
                      {editingId
                        ? `Edit ${singularTitle}`
                        : `Add New ${singularTitle}`}
                    </h2>

                    <p className="text-xs text-slate-500">
                      {editingId
                        ? 'Update the information below'
                        : `Create a new ${singularTitle.toLowerCase()}`}
                    </p>
                  </div>
                </div>

              </div>

              <div className="p-6">
                <form
                  onSubmit={saveRecord}
                  className="space-y-5"
                >
                  {fields.map((field) => (
                    <div key={field.name}>

                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        <i className="fa-solid fa-tag mr-2 text-blue-500" />
                        {field.label}
                      </label>

                      <div className="relative">

                        <i className="fa-solid fa-pen absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400" />

                        <input
                          type={field.type || 'text'}
                          value={form[field.name] || ''}
                          onChange={(e) =>
                            updateField(
                              field.name,
                              e.target.value
                            )
                          }
                          placeholder={field.placeholder}
                          required
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        />

                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row">

                    <button
                      type="submit"
                      disabled={saving}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3 font-bold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <i className="fa-solid fa-spinner animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <i
                            className={`fa-solid ${
                              editingId
                                ? 'fa-floppy-disk'
                                : 'fa-plus'
                            }`}
                          />
                          {editingId
                            ? `Save Changes`
                            : `Add ${singularTitle}`}
                        </>
                      )}
                    </button>

                    {editingId && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <i className="fa-solid fa-xmark mr-2" />
                        Cancel
                      </button>
                    )}

                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* RECORDS */}
          <div className="lg:col-span-2">

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

              {/* RECORD HEADER */}
              <div className="border-b border-slate-100 p-5 sm:p-6">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <i className="fa-solid fa-list" />
                      </div>

                      <div>
                        <h2 className="font-bold text-slate-900">
                          {title}
                        </h2>

                        <p className="text-sm text-slate-500">
                          {filteredRecords.length} of{' '}
                          {records.length} records
                        </p>
                      </div>

                    </div>
                  </div>

                  <div className="relative w-full sm:max-w-xs">

                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400" />

                    <input
                      type="text"
                      placeholder={`Search ${title.toLowerCase()}...`}
                      value={search}
                      onChange={(e) =>
                        setSearch(e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />

                  </div>

                </div>
              </div>

              {/* RECORD BODY */}
              <div className="p-5 sm:p-6">

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16">

                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                      <i className="fa-solid fa-spinner fa-spin text-xl text-blue-600" />
                    </div>

                    <p className="font-medium text-slate-600">
                      Loading {title.toLowerCase()}...
                    </p>

                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">

                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <i className="fa-solid fa-inbox text-2xl text-slate-400" />
                    </div>

                    <h3 className="font-bold text-slate-800">
                      No records found
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {search
                        ? 'Try a different search term.'
                        : `No ${title.toLowerCase()} have been added yet.`}
                    </p>

                  </div>
                ) : (
                  <div className="space-y-3">

                    {filteredRecords.map((record, index) => (
                      <div
                        key={record.id}
                        className="group rounded-2xl border border-slate-100 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-md"
                        style={{
                          animationDelay: `${index * 40}ms`,
                        }}
                      >

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

                          {/* ICON */}
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all duration-300 group-hover:bg-blue-100 group-hover:text-blue-600">

                            <i className="fa-solid fa-book" />

                          </div>

                          {/* INFORMATION */}
                          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">

                            {columns.map((column) => (
                              <div key={column}>

                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {column.replaceAll(
                                    '_',
                                    ' '
                                  )}
                                </p>

                                <p className="mt-0.5 font-semibold text-slate-800">
                                  {record[column] || '—'}
                                </p>

                              </div>
                            ))}

                          </div>

                          {/* ACTIONS */}
                          <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">

                            <button
                              onClick={() =>
                                startEdit(record)
                              }
                              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                            >
                              <i className="fa-solid fa-pen-to-square" />
                              <span className="hidden sm:inline">
                                Edit
                              </span>
                            </button>

                            <button
                              onClick={() =>
                                deleteRecord(record)
                              }
                              disabled={
                                deleting === record.id
                              }
                              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deleting === record.id ? (
                                <i className="fa-solid fa-spinner fa-spin" />
                              ) : (
                                <i className="fa-solid fa-trash-can" />
                              )}

                              <span className="hidden sm:inline">
                                {deleting === record.id
                                  ? 'Deleting...'
                                  : 'Delete'}
                              </span>
                            </button>

                          </div>

                        </div>

                      </div>
                    ))}

                  </div>
                )}

              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-6 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-2">
            <i className="fa-solid fa-shield-halved text-emerald-500" />
            <span>School academic data</span>
          </div>

          <div className="flex items-center gap-2">
            <i className="fa-solid fa-database" />
            <span>Connected to BTI-SMS database</span>
          </div>

        </div>

      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

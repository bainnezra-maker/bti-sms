'use client';

import { useEffect, useState } from 'react';
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
  const [error, setError] = useState('');

  async function loadRecords() {
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    const { data: profile } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      setError('School profile could not be found.');
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from(table as any)
      .select('*')
      .eq('school_id', profile.school_id)
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

  async function addRecord(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    const { data: profile } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      setError('School profile could not be found.');
      return;
    }

    setSaving(true);

    const payload: Record<string, any> = {
      school_id: profile.school_id,
    };

    fields.forEach((field) => {
      payload[field.name] = form[field.name] || null;
    });

    const { error: insertError } = await supabase
      .from(table as any)
      .insert(payload);

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setForm({});
    await loadRecords();
    setSaving(false);
  }

  async function deleteRecord(id: string) {
    if (!window.confirm('Delete this record?')) return;

    const { error: deleteError } = await supabase
      .from(table as any)
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setRecords((current) =>
      current.filter((record) => record.id !== id)
    );
  }

  const filteredRecords = records.filter((record) => {
    const text = Object.values(record)
      .join(' ')
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <div className="mb-2 text-4xl">{icon}</div>

          <h1 className="text-3xl font-bold text-slate-900">
            {title}
          </h1>

          <p className="mt-1 text-slate-500">
            {description}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Add form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-bold text-slate-900">
              Add New
            </h2>

            <form onSubmit={addRecord} className="space-y-4">
              {fields.map((field) => (
                <div key={field.name}>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    {field.label}
                  </label>

                  <input
                    type={field.type || 'text'}
                    value={form[field.name] || ''}
                    onChange={(e) =>
                      updateField(field.name, e.target.value)
                    }
                    placeholder={field.placeholder}
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : `Add ${title}`}
              </button>
            </form>
          </div>

          {/* Records */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {title}
                  </h2>

                  <p className="text-sm text-slate-500">
                    {records.length} record{records.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500"
                />
              </div>

              {loading ? (
                <p className="py-10 text-center text-slate-500">
                  Loading...
                </p>
              ) : filteredRecords.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mb-2 text-4xl">📭</div>
                  <p className="text-slate-500">
                    No records found.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col gap-4 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                        {columns.map((column) => (
                          <div key={column}>
                            <p className="text-xs uppercase text-slate-400">
                              {column.replaceAll('_', ' ')}
                            </p>

                            <p className="font-medium text-slate-800">
                              {record[column] || '—'}
                            </p>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => deleteRecord(record.id)}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
          }

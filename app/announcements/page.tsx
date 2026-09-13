'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type NewsCategory =
  | 'General'
  | 'Reopening'
  | 'Examination'
  | 'Fees'
  | 'Parents'
  | 'Academic'
  | 'Event'
  | 'Urgent';

type NewsItem = {
  id: string;
  school_id: string;
  title: string;
  content: string;
  category: NewsCategory;
  is_published: boolean;
  is_urgent: boolean;
  publish_date: string;
  created_at: string;
  updated_at: string;
};

type FormState = {
  title: string;
  content: string;
  category: NewsCategory;
  is_published: boolean;
  is_urgent: boolean;
  publish_date: string;
};

const supabase = createClient();

const categories: NewsCategory[] = [
  'General',
  'Reopening',
  'Examination',
  'Fees',
  'Parents',
  'Academic',
  'Event',
  'Urgent',
];

const categoryIcons: Record<NewsCategory, string> = {
  General: 'fa-solid fa-bullhorn',
  Reopening: 'fa-solid fa-school',
  Examination: 'fa-solid fa-file-pen',
  Fees: 'fa-solid fa-money-bill-wave',
  Parents: 'fa-solid fa-people-roof',
  Academic: 'fa-solid fa-book-open',
  Event: 'fa-solid fa-calendar-star',
  Urgent: 'fa-solid fa-triangle-exclamation',
};

const categoryStyles: Record<
  NewsCategory,
  { badge: string; icon: string }
> = {
  General: {
    badge: 'bg-slate-100 text-slate-700 ring-slate-200',
    icon: 'bg-slate-900 text-white',
  },
  Reopening: {
    badge: 'bg-blue-50 text-blue-700 ring-blue-200',
    icon: 'bg-blue-600 text-white',
  },
  Examination: {
    badge: 'bg-purple-50 text-purple-700 ring-purple-200',
    icon: 'bg-purple-600 text-white',
  },
  Fees: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    icon: 'bg-emerald-600 text-white',
  },
  Parents: {
    badge: 'bg-orange-50 text-orange-700 ring-orange-200',
    icon: 'bg-orange-600 text-white',
  },
  Academic: {
    badge: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
    icon: 'bg-cyan-600 text-white',
  },
  Event: {
    badge: 'bg-pink-50 text-pink-700 ring-pink-200',
    icon: 'bg-pink-600 text-white',
  },
  Urgent: {
    badge: 'bg-red-50 text-red-700 ring-red-200',
    icon: 'bg-red-600 text-white',
  },
};

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function emptyForm(): FormState {
  return {
    title: '',
    content: '',
    category: 'General',
    is_published: true,
    is_urgent: false,
    publish_date: getToday(),
  };
}

function formatDate(dateString: string) {
  if (!dateString) return '—';

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AnnouncementsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] =
    useState<'All' | NewsCategory>('All');
  const [statusFilter, setStatusFilter] =
    useState<'All' | 'Published' | 'Draft'>('All');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function loadAnnouncements() {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('You are not signed in. Please sign in again.');
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('school_id, role, is_active')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (
        !profile ||
        profile.role !== 'admin' ||
        profile.is_active === false
      ) {
        setError(
          'Only an active administrator can manage school announcements.'
        );
        setLoading(false);
        return;
      }

      if (!profile.school_id) {
        setError('Your administrator account is not linked to a school.');
        setLoading(false);
        return;
      }

      setSchoolId(profile.school_id);

      const { data, error: newsError } = await supabase
        .from('school_news')
        .select(
          `
            id,
            school_id,
            title,
            content,
            category,
            is_published,
            is_urgent,
            publish_date,
            created_at,
            updated_at
          `
        )
        .eq('school_id', profile.school_id)
        .order('publish_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (newsError) {
        throw newsError;
      }

      setNews((data ?? []) as NewsItem[]);
    } catch (err) {
      console.error(err);
      setError('Unable to load announcements. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function updateForm<K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startEditing(item: NewsItem) {
    setEditingId(item.id);

    setForm({
      title: item.title,
      content: item.content,
      category: item.category,
      is_published: item.is_published,
      is_urgent: item.is_urgent,
      publish_date: item.publish_date,
    });

    setMessage('');
    setError('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm());
    setMessage('');
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage('');
    setError('');

    if (!schoolId) {
      setError('School information is unavailable. Please reload the page.');
      return;
    }

    const title = form.title.trim();
    const content = form.content.trim();

    if (!title) {
      setError('Please enter an announcement title.');
      return;
    }

    if (!content) {
      setError('Please enter the announcement message.');
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You are not signed in.');
      }

      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('school_news')
          .update({
            title,
            content,
            category: form.category,
            is_published: form.is_published,
            is_urgent: form.is_urgent,
            publish_date: form.publish_date,
          })
          .eq('id', editingId)
          .eq('school_id', schoolId)
          .select(
            `
              id,
              school_id,
              title,
              content,
              category,
              is_published,
              is_urgent,
              publish_date,
              created_at,
              updated_at
            `
          )
          .single();

        if (updateError) {
          throw updateError;
        }

        setNews((current) =>
          current.map((item) =>
            item.id === editingId ? (data as NewsItem) : item
          )
        );

        setMessage('Announcement updated successfully.');
      } else {
        const { data, error: insertError } = await supabase
          .from('school_news')
          .insert({
            school_id: schoolId,
            title,
            content,
            category: form.category,
            is_published: form.is_published,
            is_urgent: form.is_urgent,
            publish_date: form.publish_date,
            created_by: user.id,
          })
          .select(
            `
              id,
              school_id,
              title,
              content,
              category,
              is_published,
              is_urgent,
              publish_date,
              created_at,
              updated_at
            `
          )
          .single();

        if (insertError) {
          throw insertError;
        }

        setNews((current) => [data as NewsItem, ...current]);

        setMessage(
          form.is_published
            ? 'Announcement published successfully.'
            : 'Announcement saved as a draft.'
        );
      }

      setEditingId(null);
      setForm(emptyForm());
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save the announcement.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(item: NewsItem) {
    setMessage('');
    setError('');
    setTogglingId(item.id);

    try {
      const { data, error: updateError } = await supabase
        .from('school_news')
        .update({
          is_published: !item.is_published,
        })
        .eq('id', item.id)
        .eq('school_id', schoolId)
        .select(
          `
            id,
            school_id,
            title,
            content,
            category,
            is_published,
            is_urgent,
            publish_date,
            created_at,
            updated_at
          `
        )
        .single();

      if (updateError) {
        throw updateError;
      }

      setNews((current) =>
        current.map((newsItem) =>
          newsItem.id === item.id ? (data as NewsItem) : newsItem
        )
      );

      setMessage(
        data.is_published
          ? 'Announcement published.'
          : 'Announcement moved to drafts.'
      );
    } catch (err) {
      console.error(err);
      setError('Unable to change the announcement status.');
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteAnnouncement(item: NewsItem) {
    const confirmed = window.confirm(
      `Delete "${item.title}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setMessage('');
    setError('');
    setDeletingId(item.id);

    try {
      const { error: deleteError } = await supabase
        .from('school_news')
        .delete()
        .eq('id', item.id)
        .eq('school_id', schoolId);

      if (deleteError) {
        throw deleteError;
      }

      setNews((current) =>
        current.filter((newsItem) => newsItem.id !== item.id)
      );

      if (editingId === item.id) {
        cancelEditing();
      }

      setMessage('Announcement deleted successfully.');
    } catch (err) {
      console.error(err);
      setError('Unable to delete the announcement.');
    } finally {
      setDeletingId(null);
    }
  }

  const filteredNews = useMemo(() => {
    const query = search.trim().toLowerCase();

    return news.filter((item) => {
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === 'All' ||
        item.category === categoryFilter;

      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Published' && item.is_published) ||
        (statusFilter === 'Draft' && !item.is_published);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [news, search, categoryFilter, statusFilter]);

  const publishedCount = news.filter(
    (item) => item.is_published
  ).length;

  const draftCount = news.filter(
    (item) => !item.is_published
  ).length;

  const urgentCount = news.filter(
    (item) => item.is_urgent
  ).length;

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      />

      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">

          {/* ===================================================== */}
          {/* HEADER */}
          {/* ===================================================== */}

          <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="animate-[btiFadeUp_0.6s_ease-out]">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur">
                  <i className="fa-solid fa-bullhorn text-blue-300" />
                  School Communication Centre
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Announcements
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Publish important school information directly to the
                  BTI-SMS student portal.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-300">
                  <i className="fa-solid fa-paper-plane text-lg" />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Published to Students
                  </p>

                  <p className="text-2xl font-black">
                    {publishedCount}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ===================================================== */}
          {/* MESSAGES */}
          {/* ===================================================== */}

          {message && (
            <div className="mb-6 flex animate-[btiFadeUp_0.35s_ease-out] items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 shadow-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <i className="fa-solid fa-check text-sm" />
              </div>

              <div className="pt-1 text-sm font-semibold">
                {message}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 flex animate-[btiFadeUp_0.35s_ease-out] items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                <i className="fa-solid fa-triangle-exclamation text-sm" />
              </div>

              <div className="pt-1 text-sm font-semibold">
                {error}
              </div>
            </div>
          )}

          {/* ===================================================== */}
          {/* STATISTICS */}
          {/* ===================================================== */}

          <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Total',
                value: news.length,
                icon: 'fa-solid fa-layer-group',
                box: 'bg-slate-900',
              },
              {
                label: 'Published',
                value: publishedCount,
                icon: 'fa-solid fa-circle-check',
                box: 'bg-emerald-600',
              },
              {
                label: 'Drafts',
                value: draftCount,
                icon: 'fa-solid fa-file',
                box: 'bg-amber-500',
              },
              {
                label: 'Urgent',
                value: urgentCount,
                icon: 'fa-solid fa-triangle-exclamation',
                box: 'bg-red-600',
              },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={{
                  animation: `btiFadeUp 0.45s ease-out ${index * 0.08}s both`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      {stat.label}
                    </p>

                    <p className="mt-1 text-2xl font-black text-slate-900">
                      {stat.value}
                    </p>
                  </div>

                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.box} text-white shadow-sm transition-transform duration-300 group-hover:scale-110`}
                  >
                    <i className={`${stat.icon} text-sm`} />
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* ===================================================== */}
          {/* CREATE / EDIT FORM */}
          {/* ===================================================== */}

          <section className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 sm:px-7">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
                    <i
                      className={
                        editingId
                          ? 'fa-solid fa-pen-to-square'
                          : 'fa-solid fa-plus'
                      }
                    />
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      {editingId
                        ? 'Edit Announcement'
                        : 'Create Announcement'}
                    </h2>

                    <p className="text-xs text-slate-500">
                      {editingId
                        ? 'Update the selected school announcement.'
                        : 'Create a message for students and the school community.'}
                    </p>
                  </div>
                </div>

                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <i className="fa-solid fa-xmark mr-1.5" />
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-7">
              <div className="grid gap-6 lg:grid-cols-2">

                {/* TITLE */}
                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Announcement Title
                  </label>

                  <div className="relative">
                    <i className="fa-solid fa-heading pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={form.title}
                      onChange={(event) =>
                        updateForm('title', event.target.value)
                      }
                      placeholder="e.g. School Reopening Announcement"
                      maxLength={180}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/10"
                    />
                  </div>
                </div>

                {/* CATEGORY */}
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Category
                  </label>

                  <div className="relative">
                    <i className="fa-solid fa-tag pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400" />

                    <select
                      value={form.category}
                      onChange={(event) =>
                        updateForm(
                          'category',
                          event.target.value as NewsCategory
                        )
                      }
                      className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-10 text-sm font-semibold text-slate-900 outline-none transition-all duration-200 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/10"
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>

                    <i className="fa-solid fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                  </div>
                </div>

                {/* DATE */}
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Publication Date
                  </label>

                  <div className="relative">
                    <i className="fa-solid fa-calendar-days pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                    <input
                      type="date"
                      value={form.publish_date}
                      onChange={(event) =>
                        updateForm(
                          'publish_date',
                          event.target.value
                        )
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all duration-200 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/10"
                    />
                  </div>
                </div>

                {/* MESSAGE */}
                <div className="lg:col-span-2">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-bold text-slate-700">
                      Announcement Message
                    </label>

                    <span className="text-xs font-medium text-slate-400">
                      {form.content.length} characters
                    </span>
                  </div>

                  <textarea
                    value={form.content}
                    onChange={(event) =>
                      updateForm('content', event.target.value)
                    }
                    placeholder="Write the announcement here. Include all important details students and parents need to know..."
                    rows={7}
                    maxLength={5000}
                    className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-6 text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/10"
                  />
                </div>

                {/* OPTIONS */}
                <div className="lg:col-span-2">
                  <div className="grid gap-3 sm:grid-cols-2">

                    <label
                      className={`group flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200 ${
                        form.is_published
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            form.is_published
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <i className="fa-solid fa-paper-plane text-sm" />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            Publish to Students
                          </p>

                          <p className="text-xs text-slate-500">
                            Make this announcement visible.
                          </p>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={form.is_published}
                        onChange={(event) =>
                          updateForm(
                            'is_published',
                            event.target.checked
                          )
                        }
                        className="h-5 w-5 accent-emerald-600"
                      />
                    </label>

                    <label
                      className={`group flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200 ${
                        form.is_urgent
                          ? 'border-red-200 bg-red-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            form.is_urgent
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <i className="fa-solid fa-triangle-exclamation text-sm" />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            Mark as Urgent
                          </p>

                          <p className="text-xs text-slate-500">
                            Highlight this important message.
                          </p>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={form.is_urgent}
                        onChange={(event) =>
                          updateForm(
                            'is_urgent',
                            event.target.checked
                          )
                        }
                        className="h-5 w-5 accent-red-600"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* SUBMIT */}
              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="group rounded-2xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <i className="fa-solid fa-spinner mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : editingId ? (
                    <>
                      <i className="fa-solid fa-floppy-disk mr-2 transition-transform duration-300 group-hover:scale-110" />
                      Update Announcement
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane mr-2 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      {form.is_published
                        ? 'Publish Announcement'
                        : 'Save Draft'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* ===================================================== */}
          {/* ANNOUNCEMENT LIST */}
          {/* ===================================================== */}

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    School Announcements
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Manage messages currently stored in BTI-SMS.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">

                  {/* SEARCH */}
                  <div className="relative">
                    <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400" />

                    <input
                      type="search"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search announcements..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs font-medium outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/10 sm:w-56"
                    />
                  </div>

                  {/* CATEGORY */}
                  <select
                    value={categoryFilter}
                    onChange={(event) =>
                      setCategoryFilter(
                        event.target.value as
                          | 'All'
                          | NewsCategory
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-900"
                  >
                    <option value="All">
                      All Categories
                    </option>

                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>

                  {/* STATUS */}
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as
                          | 'All'
                          | 'Published'
                          | 'Draft'
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-900"
                  >
                    <option value="All">
                      All Status
                    </option>
                    <option value="Published">
                      Published
                    </option>
                    <option value="Draft">
                      Drafts
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* LOADING */}
            {loading ? (
              <div className="space-y-4 p-5 sm:p-7">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-2xl border border-slate-100 p-5"
                  >
                    <div className="flex gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-slate-200" />

                      <div className="flex-1 space-y-3">
                        <div className="h-4 w-1/3 rounded bg-slate-200" />
                        <div className="h-3 w-3/4 rounded bg-slate-100" />
                        <div className="h-3 w-1/2 rounded bg-slate-100" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNews.length === 0 ? (
              <div className="px-5 py-16 text-center sm:px-7">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                  <i className="fa-solid fa-bullhorn text-2xl" />
                </div>

                <h3 className="mt-5 text-lg font-black text-slate-900">
                  No announcements found
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {news.length === 0
                    ? 'Create your first school announcement using the form above.'
                    : 'Try changing your search or filter settings.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredNews.map((item, index) => {
                  const styles =
                    categoryStyles[item.category] ??
                    categoryStyles.General;

                  return (
                    <article
                      key={item.id}
                      className="group p-5 transition-all duration-300 hover:bg-slate-50 sm:p-7"
                      style={{
                        animation: `btiFadeUp 0.45s ease-out ${
                          index * 0.06
                        }s both`,
                      }}
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                        <div className="flex min-w-0 gap-4">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-105 ${styles.icon}`}
                          >
                            <i
                              className={
                                categoryIcons[item.category] ??
                                categoryIcons.General
                              }
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${styles.badge}`}
                              >
                                {item.category}
                              </span>

                              {item.is_urgent && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black text-red-700 ring-1 ring-red-200">
                                  <i className="fa-solid fa-bolt" />
                                  URGENT
                                </span>
                              )}

                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${
                                  item.is_published
                                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                    : 'bg-amber-50 text-amber-700 ring-amber-200'
                                }`}
                              >
                                <i
                                  className={
                                    item.is_published
                                      ? 'fa-solid fa-eye'
                                      : 'fa-solid fa-eye-slash'
                                  }
                                />

                                {item.is_published
                                  ? 'Published'
                                  : 'Draft'}
                              </span>
                            </div>

                            <h3 className="text-base font-black text-slate-900 sm:text-lg">
                              {item.title}
                            </h3>

                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                              {item.content}
                            </p>

                            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-400">
                              <span className="inline-flex items-center gap-1.5">
                                <i className="fa-solid fa-calendar-days" />
                                {formatDate(item.publish_date)}
                              </span>

                              <span className="inline-flex items-center gap-1.5">
                                <i className="fa-solid fa-clock" />
                                Created{' '}
                                {formatDate(
                                  item.created_at.split('T')[0]
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                          >
                            <i className="fa-solid fa-pen-to-square" />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => togglePublished(item)}
                            disabled={togglingId === item.id}
                            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${
                              item.is_published
                                ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {togglingId === item.id ? (
                              <i className="fa-solid fa-spinner animate-spin" />
                            ) : (
                              <i
                                className={
                                  item.is_published
                                    ? 'fa-solid fa-eye-slash'
                                    : 'fa-solid fa-paper-plane'
                                }
                              />
                            )}

                            {item.is_published
                              ? 'Unpublish'
                              : 'Publish'}
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteAnnouncement(item)}
                            disabled={deletingId === item.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === item.id ? (
                              <i className="fa-solid fa-spinner animate-spin" />
                            ) : (
                              <i className="fa-solid fa-trash-can" />
                            )}

                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ========================================================= */}
      {/* PREMIUM ANIMATIONS */}
      {/* ========================================================= */}

      <style jsx global>{`
        @keyframes btiFadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </>
  );
}

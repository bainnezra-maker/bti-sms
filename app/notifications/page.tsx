'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  school_id: string;
};

type NotificationItem = {
  id: string;
  school_id: string;
  recipient_user_id: string;
  type: 'system' | 'news' | 'activity' | 'duty' | 'timetable' | 'leave' | string;
  title: string;
  message: string;
  link: string | null;
  icon: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent' | string;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, unknown> | null;
  expires_at: string | null;
  created_at: string;
};

const supabase = createClient();

const FILTERS = [
  { key: 'all', label: 'All', icon: 'fa-solid fa-layer-group' },
  { key: 'unread', label: 'Unread', icon: 'fa-solid fa-envelope' },
  { key: 'news', label: 'News', icon: 'fa-solid fa-newspaper' },
  { key: 'activity', label: 'Activities', icon: 'fa-solid fa-calendar-days' },
  { key: 'duty', label: 'Duties', icon: 'fa-solid fa-user-shield' },
  { key: 'timetable', label: 'Timetable', icon: 'fa-solid fa-calendar-check' },
  { key: 'leave', label: 'Leave', icon: 'fa-solid fa-person-walking-arrow-right' },
];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const now = new Date();

  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'news':
      return 'School News';
    case 'activity':
      return 'Activity';
    case 'duty':
      return 'Duty';
    case 'timetable':
      return 'Timetable';
    case 'leave':
      return 'Leave';
    case 'system':
      return 'System';
    default:
      return 'Notification';
  }
}

function getFallbackIcon(type: string) {
  switch (type) {
    case 'news':
      return 'fa-solid fa-newspaper';
    case 'activity':
      return 'fa-solid fa-calendar-days';
    case 'duty':
      return 'fa-solid fa-user-shield';
    case 'timetable':
      return 'fa-solid fa-calendar-check';
    case 'leave':
      return 'fa-solid fa-person-walking-arrow-right';
    case 'system':
      return 'fa-solid fa-gear';
    default:
      return 'fa-solid fa-bell';
  }
}

function getPriorityStyles(priority: string) {
  switch (priority) {
    case 'urgent':
      return {
        badge: 'bg-red-500/15 text-red-300 border-red-400/20',
        icon: 'text-red-300',
        dot: 'bg-red-400',
      };

    case 'high':
      return {
        badge: 'bg-orange-500/15 text-orange-300 border-orange-400/20',
        icon: 'text-orange-300',
        dot: 'bg-orange-400',
      };

    case 'low':
      return {
        badge: 'bg-slate-500/15 text-slate-300 border-slate-400/20',
        icon: 'text-slate-300',
        dot: 'bg-slate-400',
      };

    default:
      return {
        badge: 'bg-blue-500/15 text-blue-300 border-blue-400/20',
        icon: 'text-blue-300',
        dot: 'bg-blue-400',
      };
  }
}

export default function NotificationsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadNotifications() {
      setLoading(true);
      setError('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('id, full_name, email, role, school_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        if (mounted) {
          setError(profileError?.message || 'Unable to load your profile.');
          setLoading(false);
        }
        return;
      }

      if (
        profileData.role?.toLowerCase() === 'admin' ||
        profileData.role?.toLowerCase() === 'administrator'
      ) {
        // Admins are allowed to use this page.
      }

      const { data: notificationData, error: notificationError } =
        await supabase
          .from('notifications')
          .select(
            'id, school_id, recipient_user_id, type, title, message, link, icon, priority, is_read, read_at, metadata, expires_at, created_at'
          )
          .eq('recipient_user_id', user.id)
          .order('created_at', { ascending: false });

      if (notificationError) {
        if (mounted) {
          setError(notificationError.message);
          setLoading(false);
        }
        return;
      }

      if (mounted) {
        setProfile(profileData as Profile);
        setNotifications((notificationData ?? []) as NotificationItem[]);
        setLoading(false);
      }
    }

    loadNotifications();

    return () => {
      mounted = false;
    };
  }, [router]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter((item) => !item.is_read);
    }

    if (activeFilter === 'all') {
      return notifications;
    }

    return notifications.filter((item) => item.type === activeFilter);
  }, [notifications, activeFilter]);

  const markAsRead = async (notification: NotificationItem) => {
    if (notification.is_read) return;

    setSelectedId(notification.id);

    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notification.id)
      .eq('recipient_user_id', profile?.id);

    if (!updateError) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                is_read: true,
                read_at: new Date().toISOString(),
              }
            : item
        )
      );
    }

    setSelectedId(null);
  };

  const openNotification = async (notification: NotificationItem) => {
    await markAsRead(notification);

    if (notification.link) {
      router.push(notification.link);
    }
  };

  const markAllAsRead = async () => {
    if (!profile || unreadCount === 0) return;

    setProcessing(true);

    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('recipient_user_id', profile.id)
      .eq('is_read', false);

    if (!updateError) {
      const timestamp = new Date().toISOString();

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at ?? timestamp,
        }))
      );
    }

    setProcessing(false);
  };

  const clearReadNotifications = async () => {
    if (!profile) return;

    const readItems = notifications.filter((item) => item.is_read);

    if (!readItems.length) return;

    setProcessing(true);

    const ids = readItems.map((item) => item.id);

    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .in('id', ids)
      .eq('recipient_user_id', profile.id);

    if (!deleteError) {
      setNotifications((current) =>
        current.filter((item) => !item.is_read)
      );
    }

    setProcessing(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-600/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <section className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/60 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 ring-1 ring-blue-400/20">
                <i className="fa-solid fa-bell text-xl text-blue-300" />
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Notifications
                  </h1>

                  {unreadCount > 0 && (
                    <span className="rounded-full bg-blue-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg shadow-blue-500/20">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                <p className="max-w-2xl text-sm leading-6 text-slate-400">
                  Stay updated with school announcements, activities, duties,
                  timetable changes and other important information.
                </p>
              </div>
            </div>

            {profile && (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold">
                  {initials(profile.full_name)}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {profile.full_name}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {profile.role}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Filters and actions */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="flex flex-col gap-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => {
                const active = activeFilter === filter.key;

                const count =
                  filter.key === 'unread'
                    ? unreadCount
                    : filter.key === 'all'
                      ? notifications.length
                      : notifications.filter(
                          (item) => item.type === filter.key
                        ).length;

                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? 'border-blue-400/30 bg-blue-500/15 text-blue-200 shadow-lg shadow-blue-500/10'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <i className={filter.icon} />

                    <span>{filter.label}</span>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        active
                          ? 'bg-blue-500/20 text-blue-200'
                          : 'bg-white/5 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <i className="fa-solid fa-inbox text-slate-500" />
                <span>
                  {filteredNotifications.length}{' '}
                  {filteredNotifications.length === 1
                    ? 'notification'
                    : 'notifications'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={processing || unreadCount === 0}
                  onClick={markAllAsRead}
                  className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fa-solid fa-check-double mr-2" />
                  Mark all as read
                </button>

                <button
                  type="button"
                  disabled={
                    processing ||
                    notifications.filter((item) => item.is_read).length === 0
                  }
                  onClick={clearReadNotifications}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fa-solid fa-trash-can mr-2" />
                  Clear read
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <section className="space-y-3">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-3xl border border-white/10 bg-slate-900/70 p-5"
              >
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/5" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-1/3 rounded bg-white/5" />
                    <div className="h-3 w-4/5 rounded bg-white/5" />
                    <div className="h-3 w-1/4 rounded bg-white/5" />
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Error */}
        {!loading && error && (
          <section className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/15">
                <i className="fa-solid fa-triangle-exclamation text-red-300" />
              </div>

              <div>
                <h2 className="font-semibold text-red-200">
                  Unable to load notifications
                </h2>
                <p className="mt-1 text-sm text-red-300/80">{error}</p>
              </div>
            </div>
          </section>
        )}

        {/* Empty */}
        {!loading && !error && filteredNotifications.length === 0 && (
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center shadow-xl shadow-black/10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-500/10 ring-1 ring-blue-400/10">
              <i className="fa-regular fa-bell-slash text-3xl text-blue-300" />
            </div>

            <h2 className="mt-6 text-xl font-bold text-white">
              {activeFilter === 'unread'
                ? 'You are all caught up'
                : 'No notifications yet'}
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              {activeFilter === 'unread'
                ? 'There are no unread notifications waiting for you.'
                : 'Important school updates will appear here automatically.'}
            </p>

            {activeFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                <i className="fa-solid fa-layer-group mr-2" />
                View all notifications
              </button>
            )}
          </section>
        )}

        {/* Notifications */}
        {!loading && !error && filteredNotifications.length > 0 && (
          <section className="space-y-3">
            {filteredNotifications.map((notification, index) => {
              const styles = getPriorityStyles(notification.priority);
              const icon = notification.icon || getFallbackIcon(notification.type);
              const selected = selectedId === notification.id;

              return (
                <article
                  key={notification.id}
                  className={`group relative overflow-hidden rounded-3xl border transition-all duration-300 ${
                    notification.is_read
                      ? 'border-white/10 bg-slate-900/60 hover:border-white/20 hover:bg-slate-900/80'
                      : 'border-blue-400/20 bg-gradient-to-r from-blue-500/[0.08] to-slate-900/80 shadow-lg shadow-blue-950/10 hover:border-blue-400/30'
                  }`}
                  style={{
                    animation: `notificationIn 420ms ease-out ${index * 45}ms both`,
                  }}
                >
                  {!notification.is_read && (
                    <div className="absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-500" />
                  )}

                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="block w-full text-left"
                  >
                    <div className="flex gap-4 p-5 sm:p-6">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] ${
                          styles.icon
                        } transition-transform duration-300 group-hover:scale-105`}
                      >
                        <i className={`${icon} text-lg`} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2
                                className={`text-sm font-bold sm:text-base ${
                                  notification.is_read
                                    ? 'text-slate-200'
                                    : 'text-white'
                                }`}
                              >
                                {notification.title}
                              </h2>

                              {!notification.is_read && (
                                <span className="flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                  New
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-xs font-medium text-slate-500">
                              {getTypeLabel(notification.type)}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${styles.badge}`}
                            >
                              {notification.priority}
                            </span>

                            <span className="text-xs text-slate-500">
                              {formatNotificationTime(notification.created_at)}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
                          {notification.message}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          {notification.link && (
                            <span className="text-xs font-semibold text-blue-300 transition group-hover:text-blue-200">
                              View details
                              <i className="fa-solid fa-arrow-right ml-2 transition-transform group-hover:translate-x-1" />
                            </span>
                          )}

                          {notification.is_read && (
                            <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                              <i className="fa-solid fa-check-double" />
                              Read
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="hidden items-center sm:flex">
                        <i className="fa-solid fa-chevron-right text-xs text-slate-700 transition-all group-hover:translate-x-1 group-hover:text-slate-400" />
                      </div>
                    </div>
                  </button>

                  {selected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]">
                      <i className="fa-solid fa-spinner fa-spin text-blue-300" />
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {/* Footer */}
        <footer className="mt-8 flex flex-col gap-2 border-t border-white/5 py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            BTI-SMS Notification Center
          </span>

          <Link
            href="/"
            className="font-medium transition hover:text-slate-400"
          >
            <i className="fa-solid fa-house mr-2" />
            Back to Dashboard
          </Link>
        </footer>
      </div>

      <style jsx>{`
        @keyframes notificationIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}

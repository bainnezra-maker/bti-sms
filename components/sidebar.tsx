'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type UserRole = 'admin' | 'teacher' | 'Student' | 'staff' | null;

type MenuItem = {
  name: string;
  href: string;
  icon: string;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const adminMenuSections: MenuSection[] = [
  {
    title: 'MAIN',
    items: [
      {
        name: 'Dashboard',
        href: '/',
        icon: 'fa-solid fa-house',
      },
      {
        name: 'Students',
        href: '/students',
        icon: 'fa-solid fa-user-graduate',
      },
      {
        name: 'Transfer & Withdrawal',
        href: '/student-movements',
        icon: 'fa-solid fa-right-left',
      },
      {
        name: 'Add Student',
        href: '/students/new',
        icon: 'fa-solid fa-user-plus',
      },
      {
        name: 'Attendance',
        href: '/attendance',
        icon: 'fa-solid fa-calendar-check',
      },
      {
        name: 'Attendance Reports',
        href: '/attendance-reports',
        icon: 'fa-solid fa-chart-column',
      },
      {
        name: 'Assessment',
        href: '/assessment',
        icon: 'fa-solid fa-clipboard-check',
      },
      {
        name: 'Promotion',
        href: '/promotion',
        icon: 'fa-solid fa-graduation-cap',
      },
    ],
  },

  {
    title: 'ACADEMICS',
    items: [
      {
        name: 'Classes',
        href: '/classes',
        icon: 'fa-solid fa-school',
      },
      {
        name: 'Subjects',
        href: '/subjects',
        icon: 'fa-solid fa-book-open',
      },
      {
        name: 'Programmes',
        href: '/programmes',
        icon: 'fa-solid fa-layer-group',
      },
      {
        name: 'Academic Years',
        href: '/academic-years',
        icon: 'fa-solid fa-calendar-days',
      },
      {
        name: 'Semesters',
        href: '/terms',
        icon: 'fa-solid fa-calendar-week',
      },
      {
        name: 'Enrollment',
        href: '/enrollment',
        icon: 'fa-solid fa-user-check',
      },
      {
        name: 'Results',
        href: '/results',
        icon: 'fa-solid fa-chart-line',
      },
    ],
  },

  {
    title: 'ADMINISTRATION',
    items: [
      {
        name: 'Staff',
        href: '/staff',
        icon: 'fa-solid fa-users',
      },
      {
        name: 'Fees',
        href: '/fees',
        icon: 'fa-solid fa-money-bill-wave',
      },
      {
        name: 'Reports',
        href: '/reports',
        icon: 'fa-solid fa-file-lines',
      },
    ],
  },

  {
    title: 'SYSTEM',
    items: [
      {
        name: 'Settings',
        href: '/settings',
        icon: 'fa-solid fa-gear',
      },
    ],
  },
];

const teacherMenuSections: MenuSection[] = [
  {
    title: 'TEACHER',
    items: [
      {
        name: 'Teacher Dashboard',
        href: '/teacher',
        icon: 'fa-solid fa-chalkboard-user',
      },
      {
        name: 'Attendance',
        href: '/attendance',
        icon: 'fa-solid fa-calendar-check',
      },
      {
        name: 'Assessment',
        href: '/assessment',
        icon: 'fa-solid fa-clipboard-check',
      },
      {
        name: 'Results',
        href: '/results',
        icon: 'fa-solid fa-chart-line',
      },
      {
        name: 'Attendance Reports',
        href: '/attendance-reports',
        icon: 'fa-solid fa-chart-column',
      },
    ],
  },
];

const studentMenuSections: MenuSection[] = [
  {
    title: 'STUDENT',
    items: [
      {
        name: 'Student Dashboard',
        href: '/student',
        icon: 'fa-solid fa-user-graduate',
      },
    ],
  },
];

const supabase = createClient();

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (mounted) {
          setRole(null);
          setRoleLoading(false);
        }

        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role, is_active')
        .eq('id', user.id)
        .maybeSingle();

      if (!mounted) return;

      if (!profile || profile.is_active === false) {
        setRole(null);
        setRoleLoading(false);
        return;
      }

      if (
        profile.role === 'admin' ||
        profile.role === 'teacher' ||
        profile.role === 'Student' ||
        profile.role === 'staff'
      ) {
        setRole(profile.role as UserRole);
      } else {
        setRole(null);
      }

      setRoleLoading(false);
    }

    loadRole();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  async function handleLogout() {
    closeMobileMenu();

    await supabase.auth.signOut();

    router.replace('/login');
    router.refresh();
  }

  function getMenuSections(): MenuSection[] {
    if (role === 'teacher') {
      return teacherMenuSections;
    }

    if (role === 'Student') {
      return studentMenuSections;
    }

    if (role === 'admin') {
      return adminMenuSections;
    }

    return [];
  }

  function isItemActive(href: string) {
    if (pathname === href) {
      return true;
    }

    if (href === '/') {
      return false;
    }

    const menuSections = getMenuSections();

    return (
      pathname.startsWith(`${href}/`) &&
      !menuSections.some((section) =>
        section.items.some(
          (otherItem) =>
            otherItem.href !== href &&
            otherItem.href !== '/' &&
            otherItem.href.length > href.length &&
            pathname.startsWith(`${otherItem.href}/`)
        )
      )
    );
  }

  const menuSections = getMenuSections();

  const roleTitle =
    role === 'admin'
      ? 'Administrator'
      : role === 'teacher'
        ? 'Teacher Workspace'
        : role === 'Student'
          ? 'Student Portal'
          : 'BTI-SMS';

  /*
   * Avoid showing the wrong role's navigation
   * while the current user's profile is loading.
   */
  if (roleLoading) {
    return (
      <>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
        />

        <div className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur lg:hidden">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />

          <div className="mx-auto h-6 w-24 animate-pulse rounded-lg bg-slate-200" />

          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />
        </div>

        <aside className="fixed bottom-0 left-0 top-0 z-50 hidden w-64 border-r border-slate-200 bg-white lg:block">
          <div className="flex min-h-full flex-col">
            <div className="h-28 animate-pulse bg-slate-900" />

            <div className="space-y-3 p-5">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                  key={item}
                  className="h-10 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          </div>
        </aside>
      </>
    );
  }

  /*
   * If there is no valid application role,
   * don't expose navigation.
   */
  if (!role) {
    return null;
  }

  return (
    <>
      {/* Font Awesome */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      />

      {/* ========================================================= */}
      {/* MOBILE / TABLET TOP BAR */}
      {/* ========================================================= */}

      <div className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur lg:hidden">

        {/* Hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={
            mobileOpen
              ? 'Close navigation menu'
              : 'Open navigation menu'
          }
          aria-expanded={mobileOpen}
          className="group flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md active:scale-95"
        >
          <span className="sr-only">
            {mobileOpen ? 'Close menu' : 'Open menu'}
          </span>

          <span className="flex flex-col gap-1.5">
            <span
              className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                mobileOpen
                  ? 'translate-y-2 rotate-45'
                  : ''
              }`}
            />

            <span
              className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                mobileOpen ? 'opacity-0' : ''
              }`}
            />

            <span
              className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                mobileOpen
                  ? '-translate-y-2 -rotate-45'
                  : ''
              }`}
            />
          </span>
        </button>

        {/* Mobile Brand */}
        <Link
          href={role === 'admin' ? '/' : role === 'teacher' ? '/teacher' : '/student'}
          onClick={closeMobileMenu}
          className="group flex items-center gap-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md transition-transform duration-200 group-hover:scale-105">
            <i className="fa-solid fa-school text-sm" />
          </span>

          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            BTI-SMS
          </span>
        </Link>

        {/* Role Indicator */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500"
          title={roleTitle}
        >
          <i
            className={
              role === 'teacher'
                ? 'fa-solid fa-chalkboard-user text-sm'
                : role === 'Student'
                  ? 'fa-solid fa-user-graduate text-sm'
                  : 'fa-solid fa-user-shield text-sm'
            }
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* MOBILE / TABLET OVERLAY */}
      {/* ========================================================= */}

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* ========================================================= */}
      {/* MOBILE / TABLET SIDEBAR DRAWER */}
      {/* ========================================================= */}

      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 w-72 max-w-[88vw] overflow-y-auto border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        }`}
      >
        <div className="flex min-h-full flex-col">

          {/* Drawer Header */}
          <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-5 py-6 text-white">

            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/5" />

            <div className="absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-white/5" />

            <div className="relative flex items-center justify-between">

              <Link
                href={
                  role === 'admin'
                    ? '/'
                    : role === 'teacher'
                      ? '/teacher'
                      : '/student'
                }
                onClick={closeMobileMenu}
                className="group flex items-center gap-3"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 shadow-lg ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-105">
                  <i className="fa-solid fa-school text-lg" />
                </span>

                <div>
                  <div className="text-xl font-extrabold tracking-tight">
                    BTI-SMS
                  </div>

                  <p className="mt-0.5 text-[11px] font-medium text-slate-300">
                    {roleTitle}
                  </p>
                </div>
              </Link>

              <button
                type="button"
                onClick={closeMobileMenu}
                aria-label="Close navigation menu"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-300 transition-all duration-200 hover:bg-white/20 hover:text-white active:scale-95"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <nav className="flex-1 px-3 py-5">

            {menuSections.map((section) => (
              <div
                key={section.title}
                className="mb-6 animate-[fadeInUp_0.4s_ease-out]"
              >
                <div className="mb-2 flex items-center gap-2 px-3">
                  <span className="h-1 w-1 rounded-full bg-slate-400" />

                  <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400">
                    {section.title}
                  </p>
                </div>

                <div className="space-y-1">

                  {section.items.map((item) => {
                    const isActive = isItemActive(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobileMenu}
                        className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                            : 'text-slate-600 hover:translate-x-1 hover:bg-slate-100 hover:text-slate-950'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-white" />
                        )}

                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                            isActive
                              ? 'bg-white/10 text-white'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-900 group-hover:shadow-sm'
                          }`}
                        >
                          <i
                            className={`${item.icon} text-sm`}
                          />
                        </span>

                        <span className="flex-1">
                          {item.name}
                        </span>

                        {isActive && (
                          <i className="fa-solid fa-chevron-right text-[10px] text-white/70" />
                        )}
                      </Link>
                    );
                  })}

                </div>
              </div>
            ))}

          </nav>

          {/* Mobile Logout */}
          <div className="border-t border-slate-200 bg-slate-50 p-4">
            <button
              type="button"
              onClick={handleLogout}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm transition-colors group-hover:text-red-500">
                <i className="fa-solid fa-right-from-bracket text-sm" />
              </span>

              <span>Logout</span>
            </button>
          </div>

        </div>
      </aside>

      {/* ========================================================= */}
      {/* DESKTOP SIDEBAR */}
      {/* ========================================================= */}

      <aside className="fixed bottom-0 left-0 top-0 z-50 hidden w-64 overflow-y-auto border-r border-slate-200 bg-white shadow-[4px_0_20px_rgba(15,23,42,0.04)] lg:block">

        <div className="flex min-h-full flex-col">

          {/* Desktop Brand */}
          <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-5 py-6 text-white">

            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/5" />

            <div className="absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-white/5" />

            <Link
              href={
                role === 'admin'
                  ? '/'
                  : role === 'teacher'
                    ? '/teacher'
                    : '/student'
              }
              className="group relative flex items-center gap-3"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 shadow-lg ring-1 ring-white/10 transition-all duration-300 group-hover:scale-105 group-hover:bg-white/15">
                <i className="fa-solid fa-school text-lg" />
              </span>

              <div>
                <div className="text-xl font-extrabold tracking-tight">
                  BTI-SMS
                </div>

                <p className="mt-0.5 text-[11px] font-medium text-slate-300">
                  {roleTitle}
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="flex-1 px-3 py-5">

            {menuSections.map((section, sectionIndex) => (
              <div
                key={section.title}
                className="mb-6 animate-[fadeInUp_0.45s_ease-out]"
                style={{
                  animationDelay: `${sectionIndex * 80}ms`,
                }}
              >
                {/* Section Title */}
                <div className="mb-2 flex items-center gap-2 px-3">
                  <span className="h-1 w-1 rounded-full bg-slate-400" />

                  <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400">
                    {section.title}
                  </p>
                </div>

                {/* Menu Items */}
                <div className="space-y-1">

                  {section.items.map((item) => {
                    const isActive = isItemActive(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                            : 'text-slate-600 hover:translate-x-1 hover:bg-slate-100 hover:text-slate-950'
                        }`}
                      >
                        {/* Active indicator */}
                        {isActive && (
                          <span className="absolute bottom-2 left-0 top-2 w-1 animate-pulse rounded-r-full bg-white" />
                        )}

                        {/* Icon */}
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                            isActive
                              ? 'bg-white/10 text-white'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-900 group-hover:shadow-sm'
                          }`}
                        >
                          <i
                            className={`${item.icon} text-sm transition-transform duration-200 group-hover:scale-110`}
                          />
                        </span>

                        {/* Name */}
                        <span className="flex-1">
                          {item.name}
                        </span>

                        {/* Active Arrow */}
                        {isActive && (
                          <i className="fa-solid fa-chevron-right text-[9px] text-white/60" />
                        )}
                      </Link>
                    );
                  })}

                </div>
              </div>
            ))}

          </nav>

          {/* Desktop Logout */}
          <div className="border-t border-slate-200 bg-slate-50 p-4">
            <button
              type="button"
              onClick={handleLogout}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm transition-colors duration-200 group-hover:text-red-500">
                <i className="fa-solid fa-right-from-bracket text-sm" />
              </span>

              <span>Logout</span>

              <i className="fa-solid fa-arrow-right-from-bracket ml-auto text-xs opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100" />
            </button>
          </div>

        </div>
      </aside>
    </>
  );
}

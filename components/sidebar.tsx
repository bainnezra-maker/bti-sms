'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const menuSections = [
  {
    title: 'MAIN',
    items: [
      { name: 'Dashboard', href: '/', icon: '🏠' },
      { name: 'Students', href: '/students', icon: '👨‍🎓' },
      { name: 'Add Student', href: '/students/new', icon: '➕' },
      { name: 'Attendance', href: '/attendance', icon: '📋' },
      {
        name: 'Attendance Reports',
        href: '/attendance-reports',
        icon: '📊',
      },
      { name: 'Assessment', href: '/assessment', icon: '📝' },
      { name: 'Promotion', href: '/promotion', icon: '🎓' },
    ],
  },

  {
    title: 'ACADEMICS',
    items: [
      { name: 'Classes', href: '/classes', icon: '🏫' },
      { name: 'Subjects', href: '/subjects', icon: '📚' },
      { name: 'Programmes', href: '/programmes', icon: '🎓' },
      { name: 'Academic Years', href: '/academic-years', icon: '📅' },
      { name: 'Semesters', href: '/terms', icon: '🗓️' },
      { name: 'Enrollment', href: '/enrollment', icon: '📋' },
      { name: 'Results', href: '/results', icon: '📈' },
    ],
  },

  {
    title: 'ADMINISTRATION',
    items: [
      { name: 'Staff', href: '/staff', icon: '👥' },
      { name: 'Fees', href: '/fees', icon: '💰' },
      { name: 'Reports', href: '/reports', icon: '📊' },
    ],
  },

  {
    title: 'SYSTEM',
    items: [
      { name: 'Settings', href: '/settings', icon: '⚙️' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  function isItemActive(href: string) {
    if (pathname === href) {
      return true;
    }

    if (href === '/') {
      return false;
    }

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

  return (
    <>
      {/* Mobile / Tablet Top Bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        {/* Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={
            mobileOpen
              ? 'Close navigation menu'
              : 'Open navigation menu'
          }
          aria-expanded={mobileOpen}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          <span className="sr-only">
            {mobileOpen ? 'Close menu' : 'Open menu'}
          </span>

          <span className="flex flex-col gap-1.5">
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
          </span>
        </button>

        {/* BTI-SMS */}
        <Link
          href="/"
          onClick={closeMobileMenu}
          className="text-lg font-bold text-slate-900"
        >
          BTI-SMS
        </Link>

        {/* Dashboard */}
        <Link
          href="/"
          onClick={closeMobileMenu}
          className="text-sm font-medium text-slate-600"
        >
          Dashboard
        </Link>
      </div>

      {/* Mobile / Tablet Background Overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
        />
      )}

      {/* Mobile / Tablet Sidebar Drawer */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 w-72 max-w-[85vw] overflow-y-auto border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 lg:hidden ${
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        }`}
      >
        <div className="flex min-h-full flex-col">

          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5">
            <div>
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="text-xl font-bold text-slate-900"
              >
                BTI-SMS
              </Link>

              <p className="mt-1 text-xs text-slate-500">
                School Management System
              </p>
            </div>

            <button
              type="button"
              onClick={closeMobileMenu}
              aria-label="Close navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              ×
            </button>
          </div>

          {/* Mobile / Tablet Navigation */}
          <nav className="flex-1 px-3 py-4">
            {menuSections.map((section) => (
              <div
                key={section.title}
                className="mb-6"
              >
                <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-slate-400">
                  {section.title}
                </p>

                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = isItemActive(
                      item.href
                    );

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobileMenu}
                        className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="text-base">
                          {item.icon}
                        </span>

                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Mobile / Tablet Logout */}
          <div className="border-t border-slate-200 p-4">
            <Link
              href="/login"
              onClick={closeMobileMenu}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <span>🚪</span>
              <span>Logout</span>
            </Link>
          </div>

        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="fixed bottom-0 left-0 top-0 z-50 hidden w-64 overflow-y-auto border-r border-slate-200 bg-white lg:block">
        <div className="flex min-h-full flex-col">

          {/* Logo */}
          <div className="border-b border-slate-200 px-6 py-5">
            <Link
              href="/"
              className="text-xl font-bold text-slate-900"
            >
              BTI-SMS
            </Link>

            <p className="mt-1 text-xs text-slate-500">
              School Management System
            </p>
          </div>

          {/* Desktop Navigation */}
          <nav className="flex-1 px-3 py-4">
            {menuSections.map((section) => (
              <div
                key={section.title}
                className="mb-6"
              >
                <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-slate-400">
                  {section.title}
                </p>

                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = isItemActive(
                      item.href
                    );

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="text-base">
                          {item.icon}
                        </span>

                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Desktop Logout */}
          <div className="border-t border-slate-200 p-4">
            <Link
              href="/login"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <span>🚪</span>
              <span>Logout</span>
            </Link>
          </div>

        </div>
      </aside>
    </>
  );
}

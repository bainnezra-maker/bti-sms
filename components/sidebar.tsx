'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

      // Student promotion
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

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Link
          href="/"
          className="text-lg font-bold text-slate-900"
        >
          BTI-SMS
        </Link>

        <Link
          href="/"
          className="text-sm font-medium text-slate-600"
        >
          Dashboard
        </Link>
      </div>

      {/* Sidebar */}
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

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4">

            {menuSections.map((section) => (
              <div key={section.title} className="mb-6">

                <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-slate-400">
                  {section.title}
                </p>

                <div className="space-y-1">

                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/' &&
                        pathname.startsWith(`${item.href}/`));

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

          {/* Footer */}
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

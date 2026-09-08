'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const menuSections = [
  {
    title: 'MAIN',
    items: [
      { name: 'Dashboard', href: '/', icon: '🏠' },
      { name: 'Students', href: '/students', icon: '👨‍🎓' },
      { name: 'Add Student', href: '/students/add', icon: '➕' },
      { name: 'Attendance', href: '/attendance', icon: '📋' },
      { name: 'Assessment', href: '/assessment', icon: '📝' },
    ],
  },
  {
    title: 'ACADEMICS',
    items: [
      { name: 'Classes', href: '/classes', icon: '🏫', comingSoon: true },
      { name: 'Subjects', href: '/subjects', icon: '📚', comingSoon: true },
      { name: 'Results', href: '/results', icon: '📊', comingSoon: true },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { name: 'Staff', href: '/staff', icon: '👥', comingSoon: true },
      { name: 'Fees', href: '/fees', icon: '💰', comingSoon: true },
      { name: 'Reports', href: '/reports', icon: '📑', comingSoon: true },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-slate-900 text-white shadow-xl">

      {/* Logo */}
      <div className="flex h-20 items-center border-b border-slate-700 px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold">
            BTI
          </div>

          <div>
            <h1 className="font-bold text-lg">BTI-SMS</h1>
            <p className="text-xs text-slate-400">
              School Management
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="h-[calc(100vh-140px)] overflow-y-auto px-3 py-5">

        {menuSections.map((section) => (
          <div key={section.title} className="mb-6">

            <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-slate-500">
              {section.title}
            </p>

            <div className="space-y-1">

              {section.items.map((item) => {

                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);

                if (item.comingSoon) {
                  return (
                    <div
                      key={item.name}
                      className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-sm text-slate-500"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{item.icon}</span>
                        <span>{item.name}</span>
                      </div>

                      <span className="text-[9px] uppercase tracking-wide">
                        Soon
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      active
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}

            </div>
          </div>
        ))}

      </nav>

      {/* Bottom */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-700 bg-slate-900 p-3">

        <Link
          href="/settings"
          className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <span className="text-lg">⚙️</span>
          <span>Settings</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-red-600 hover:text-white"
        >
          <span className="text-lg">🚪</span>
          <span>Logout</span>
        </button>

      </div>

    </aside>
  );
          }

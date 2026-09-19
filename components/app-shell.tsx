'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './sidebar';
import BoardingGenderFilter from './boarding-gender-filter';

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <main className="min-h-screen pt-16 lg:ml-64 lg:pt-0">
        <Suspense
          fallback={
            <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-slate-500">
              Loading portal…
            </div>
          }
        >
          {pathname.startsWith('/housemaster') && <BoardingGenderFilter />}
          {children}
        </Suspense>
      </main>
    </div>
  );
}

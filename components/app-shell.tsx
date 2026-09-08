'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './sidebar';

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

      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}

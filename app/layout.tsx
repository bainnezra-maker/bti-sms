import './globals.css';
import { Suspense } from 'react';
import AppShell from '@/components/app-shell';

export const metadata = {
  title: 'BIRITECH SMS',
  description: 'BIRITECH SMS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">
              Loading BIRITECH SMS…
            </div>
          }
        >
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}

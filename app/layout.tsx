import './globals.css';
import AppShell from '@/components/app-shell';

export const metadata = {
  title: 'BTI School Management System',
  description: 'BTI School Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

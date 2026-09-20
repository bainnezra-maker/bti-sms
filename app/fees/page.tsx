import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type AnyRow = Record<string, unknown>;

function numberValue(row: AnyRow, keys: string[]) {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function textValue(row: AnyRow, keys: string[], fallback = '—') {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

function money(value: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(value);
}

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('school_id, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin' || profile.is_active === false || !profile.school_id) {
    redirect('/login');
  }

  const { data, error } = await supabase
    .from('fees')
    .select('*')
    .eq('school_id', profile.school_id)
    .order('created_at', { ascending: false });

  const bills = ((data || []) as AnyRow[]).map((row) => {
    const amount = numberValue(row, ['amount', 'total_amount', 'fee_amount', 'amount_due']);
    const paid = numberValue(row, ['amount_paid', 'paid_amount', 'payment_amount']);
    const storedBalance = numberValue(row, ['balance', 'outstanding_balance']);
    const balance = Math.max(0, storedBalance || amount - paid);
    const dueDate = textValue(row, ['due_date', 'payment_due_date'], '');
    const rawStatus = textValue(row, ['status', 'payment_status'], '').toLowerCase();
    const status = balance <= 0 || ['paid', 'settled', 'completed'].includes(rawStatus)
      ? 'Paid'
      : dueDate && dueDate < new Date().toISOString().slice(0, 10)
        ? 'Overdue'
        : 'Outstanding';
    return {
      id: String(row.id || crypto.randomUUID()),
      studentId: typeof row.student_id === 'string' ? row.student_id : '',
      description: textValue(row, ['description', 'fee_type', 'name', 'title'], 'School bill'),
      amount,
      paid,
      balance,
      dueDate,
      status,
    };
  });

  const studentIds = [...new Set(bills.map((bill) => bill.studentId).filter(Boolean))];
  const { data: students } = studentIds.length
    ? await supabase.from('students').select('id, full_name, admission_number').in('id', studentIds)
    : { data: [] };
  const studentMap = new Map((students || []).map((student) => [student.id, student]));

  const totalBilled = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalPaid = bills.reduce((sum, bill) => sum + bill.paid, 0);
  const outstanding = bills.reduce((sum, bill) => sum + bill.balance, 0);
  const overdue = bills.filter((bill) => bill.status === 'Overdue');

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-12 pt-20 sm:px-6 lg:px-10 lg:pt-10">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" />
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-300">Finance</p>
          <h1 className="mt-2 text-3xl font-black"><i className="fa-solid fa-file-invoice-dollar mr-3 text-emerald-400" />Billing</h1>
          <p className="mt-2 text-sm text-slate-300">See all school bills, amounts paid and balances that still need payment.</p>
        </header>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-semibold text-red-700">Billing records could not be loaded: {error.message}</div>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Total billed', totalBilled, 'fa-receipt', 'text-blue-600', 'bg-blue-50'],
            ['Total paid', totalPaid, 'fa-circle-check', 'text-emerald-600', 'bg-emerald-50'],
            ['Outstanding', outstanding, 'fa-wallet', 'text-amber-600', 'bg-amber-50'],
            ['Overdue bills', overdue.length, 'fa-triangle-exclamation', 'text-red-600', 'bg-red-50'],
          ].map(([label, value, icon, color, background]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${background} ${color}`}><i className={`fa-solid ${icon}`} /></div>
              <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{label === 'Overdue bills' ? value : money(Number(value))}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-xl font-black text-slate-950">Bills and payments</h2>
            <p className="mt-1 text-sm text-slate-500">Outstanding and overdue bills appear first.</p>
          </div>
          {!bills.length ? (
            <div className="p-12 text-center">
              <i className="fa-solid fa-circle-check text-4xl text-emerald-500" />
              <h3 className="mt-4 text-lg font-black text-slate-900">No billing records</h3>
              <p className="mt-2 text-sm text-slate-500">There are currently no bills to pay.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-4">Student</th><th className="px-6 py-4">Bill</th><th className="px-6 py-4">Amount</th><th className="px-6 py-4">Paid</th><th className="px-6 py-4">Balance</th><th className="px-6 py-4">Due date</th><th className="px-6 py-4">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {[...bills].sort((a, b) => Number(b.balance > 0) - Number(a.balance > 0) || b.balance - a.balance).map((bill) => {
                    const student = studentMap.get(bill.studentId);
                    return <tr key={bill.id} className="hover:bg-slate-50"><td className="px-6 py-4"><p className="font-bold text-slate-900">{student?.full_name || 'Unlinked student'}</p><p className="text-xs text-slate-500">{student?.admission_number || '—'}</p></td><td className="px-6 py-4 font-semibold text-slate-700">{bill.description}</td><td className="px-6 py-4">{money(bill.amount)}</td><td className="px-6 py-4 text-emerald-700">{money(bill.paid)}</td><td className="px-6 py-4 font-black text-slate-950">{money(bill.balance)}</td><td className="px-6 py-4">{bill.dueDate ? new Date(`${bill.dueDate}T00:00:00`).toLocaleDateString('en-GH') : '—'}</td><td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${bill.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : bill.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{bill.status}</span></td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

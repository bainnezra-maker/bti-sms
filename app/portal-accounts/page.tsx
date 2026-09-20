'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Staff = {
  id: string;
  staff_number: string;
  full_name: string;
  email: string | null;
  department: string | null;
  position: string | null;
  status: string;
};
type Account = {
  id: string;
  school_id: string;
  staff_id: string | null;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean | null;
};
type PortalRole = 'admin' | 'housemaster' | 'teacher';
type Administrator = { id: string; school_id: string };
const roleLabels: Record<string, string> = {
  admin: 'Administrator', teacher: 'Teacher',
  housemaster: 'Housemaster / Housemistress', staff: 'Staff',
};
const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200';
const buttonClass = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50';

function generatePassword() {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*-_'];
  const pick = (length: number) => {
    const limit = 256 - (256 % length);
    const byte = new Uint8Array(1);
    do { crypto.getRandomValues(byte); } while (byte[0] >= limit);
    return byte[0] % length;
  };
  const alphabet = groups.join('');
  const characters = groups.map((group) => group[pick(group.length)]);
  while (characters.length < 18) characters.push(alphabet[pick(alphabet.length)]);
  for (let i = characters.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters.join('');
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request failed. Please try again.';
}

export default function PortalAccountsPage() {
  const [supabase] = useState(() => createClient());
  const [administrator, setAdministrator] = useState<Administrator | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [staffId, setStaffId] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PortalRole>('housemaster');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState('');
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const requireAdministrator = useCallback(async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error('Please sign in with an Administrator account.');
    const { data: profile, error: profileError } = await supabase.from('users')
      .select('id, school_id, role, is_active').eq('id', auth.user.id).maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile || profile.role !== 'admin' || profile.is_active !== true || !profile.school_id) {
      throw new Error('An active Administrator account is required.');
    }
    return { id: profile.id as string, school_id: profile.school_id as string };
  }, [supabase]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setReady(false);
    setError('');
    try {
      const admin = await requireAdministrator();
      setAdministrator(admin);
      // Fetch all pages so an account beyond the API row limit cannot appear unlinked.
      const staffRows: Staff[] = [];
      const accountRows: Account[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error: queryError } = await supabase.from('staff')
          .select('id, staff_number, full_name, email, department, position, status')
          .eq('school_id', admin.school_id).order('id').range(offset, offset + 499);
        if (queryError) throw new Error(queryError.message);
        staffRows.push(...(data || []));
        if (!data || data.length < 500) break;
      }
      for (let offset = 0; ; offset += 500) {
        const { data, error: queryError } = await supabase.from('users')
          .select('id, school_id, staff_id, full_name, email, role, is_active')
          .eq('school_id', admin.school_id).order('id').range(offset, offset + 499);
        if (queryError) throw new Error(queryError.message);
        accountRows.push(...(data || []));
        if (!data || data.length < 500) break;
      }
      setStaff(staffRows.sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setAccounts(accountRows.sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setReady(true);
    } catch (cause) {
      setError(errorMessage(cause));
      setAdministrator(null);
      setStaff([]);
      setAccounts([]);
    } finally { setLoading(false); }
  }, [requireAdministrator, supabase]);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  const eligibleStaff = useMemo(() => {
    const linked = new Set(accounts.map((account) => account.staff_id).filter(Boolean));
    return staff.filter((person) => person.status === 'active' && !linked.has(person.id));
  }, [staff, accounts]);
  const selectedStaff = eligibleStaff.find((person) => person.id === staffId);
  const portalAccounts = accounts.filter((account) => account.role !== 'Student');
  const visibleAccounts = portalAccounts.filter((account) =>
    `${account.full_name} ${account.email} ${roleLabels[account.role] || account.role}`
      .toLowerCase().includes(search.trim().toLowerCase()));

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationPending.current || !ready || !selectedStaff) return;
    if (password.length < 10) { setError('Use a temporary password of at least 10 characters.'); return; }
    mutationPending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setCredentials(null);
    try {
      const admin = await requireAdministrator();
      if (admin.school_id !== administrator?.school_id) throw new Error('Your session changed. Refresh the page before continuing.');
      const { data, error: invokeError } = await supabase.functions.invoke('create-portal-account', {
        body: { staff_id: selectedStaff.id, email: email.trim().toLowerCase(), role, temporary_password: password },
      });
      if (invokeError) {
        let message = invokeError.message;
        if (invokeError.context instanceof Response) {
          const body = await invokeError.context.json().catch(() => null);
          if (typeof body?.error === 'string') message = body.error;
        }
        throw new Error(message);
      }
      if (!data?.ok || !data?.account) throw new Error(data?.error || 'The service did not confirm account creation. Refresh the accounts before retrying.');
      setCredentials({ email: data.account.email, password });
      setNotice(`Account created for ${selectedStaff.full_name}. Share the temporary credentials securely.`);
      setStaffId('');
      setEmail('');
      setPassword('');
      setShowPassword(false);
      await loadAccounts();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { mutationPending.current = false; setBusy(false); }
  }

  async function toggleAccount(account: Account) {
    // Legacy accounts and administrator accounts are deliberately read-only here.
    if (mutationPending.current || !ready || !account.staff_id || !['teacher', 'housemaster'].includes(account.role)) return;
    const activate = account.is_active !== true;
    if (!window.confirm(`${activate ? 'Activate' : 'Deactivate'} portal access for ${account.full_name}?`)) return;
    mutationPending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const admin = await requireAdministrator();
      if (admin.school_id !== account.school_id || admin.id === account.id) throw new Error('This account cannot be changed here.');
      const { data, error: updateError } = await supabase.from('users')
        .update({ is_active: activate }).eq('id', account.id).eq('school_id', admin.school_id)
        .eq('staff_id', account.staff_id).eq('role', account.role)
        .select('id').single();
      if (updateError || !data) throw new Error(updateError?.message || 'The account was not updated.');
      setNotice(`Portal access ${activate ? 'activated' : 'deactivated'} for ${account.full_name}.`);
      await loadAccounts();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { mutationPending.current = false; setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Administration</p>
        <h1 className="mt-2 text-3xl font-bold">Portal Accounts</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">Create login accounts for Administrators, Teachers and Housemasters / Housemistresses, and manage staff portal access.</p>
        <Link href="/staff" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">Open Staff Management</Link>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</div>}
      {credentials && (
        <section aria-label="New account credentials" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-bold text-slate-900">Save these temporary credentials</h2>
          <p className="break-all text-sm">Email: <strong>{credentials.email}</strong></p>
          <p className="break-all text-sm">Temporary password: <code className="select-all font-bold">{credentials.password}</code></p>
          <p className="text-sm text-slate-700">Share privately with the staff member. These credentials disappear when dismissed or when you leave this page.</p>
          <button type="button" className={buttonClass} onClick={() => setCredentials(null)}>Dismiss credentials</button>
        </section>
      )}

      {loading ? <p role="status" className="p-6 text-slate-600">Loading portal accounts…</p> : !administrator ? (
        <div className="flex gap-4"><Link href="/login" className={buttonClass}>Go to login</Link><button type="button" className={buttonClass} onClick={() => void loadAccounts()}>Retry</button></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Portal accounts', portalAccounts.length],
              ['Active accounts', portalAccounts.filter((account) => account.is_active === true).length],
              ['Staff eligible for an account', eligibleStaff.length],
            ].map(([label, count]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{count}</p></div>)}
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-xl font-bold text-slate-900">Create a portal account</h2>
            <p className="mt-2 text-sm text-slate-500">Select an active staff member who does not already have a linked account.</p>
            {!eligibleStaff.length && <p className="mt-4 text-sm text-amber-800">No eligible staff found. Add or activate a staff record in Staff Management first.</p>}
            <form onSubmit={createAccount} className="mt-5">
              <fieldset disabled={busy || !ready || !eligibleStaff.length} className="grid gap-5 disabled:opacity-60 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Staff member
                  <select required value={staffId} className={inputClass} onChange={(event) => {
                    const person = eligibleStaff.find((item) => item.id === event.target.value);
                    setStaffId(event.target.value); setEmail(person?.email || ''); setPassword(''); setShowPassword(false);
                  }}><option value="">Select staff member</option>{eligibleStaff.map((person) => <option key={person.id} value={person.id}>{person.full_name} — {person.staff_number}</option>)}</select>
                </label>
                <label className="text-sm font-semibold text-slate-700">Portal role
                  <select value={role} className={inputClass} onChange={(event) => setRole(event.target.value as PortalRole)}><option value="admin">Administrator</option><option value="housemaster">Housemaster / Housemistress</option><option value="teacher">Teacher</option></select>
                </label>
                {selectedStaff && <p className="text-sm text-slate-500 sm:col-span-2">{selectedStaff.department || 'No department'} · {selectedStaff.position || 'No position'}</p>}
                <label className="text-sm font-semibold text-slate-700">Login email
                  <input required type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
                </label>
                <div>
                  <label className="text-sm font-semibold text-slate-700" htmlFor="temporary-password">Temporary password</label>
                  <input id="temporary-password" required minLength={10} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
                  <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => setPassword(generatePassword())}>Generate password</button><button type="button" aria-pressed={showPassword} className={buttonClass} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'} password</button></div>
                </div>
                <p className="text-sm text-slate-500 sm:col-span-2">Use at least 10 characters. The account service marks the password for changing; the current login flow does not yet enforce a password change.</p>
                <div className="sm:col-span-2"><button type="submit" disabled={!selectedStaff} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">{busy ? 'Saving…' : 'Create portal account'}</button></div>
              </fieldset>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="space-y-3 p-5 sm:p-6">
              <h2 className="text-xl font-bold text-slate-900">Existing accounts</h2>
              <p className="text-sm text-slate-500">Legacy accounts are not linked to staff and are read-only here. Administrator accounts are also protected.</p>
              <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">Search accounts<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or role" className={inputClass} /></label><button type="button" disabled={busy} onClick={() => void loadAccounts()} className={buttonClass}>Refresh</button></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600"><tr>{['Account', 'Role', 'Staff link', 'Status', 'Action'].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-5 py-3 font-semibold">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleAccounts.map((account) => <tr key={account.id}>
                    <td className="px-5 py-4"><p className="font-semibold text-slate-900">{account.full_name}</p><p className="text-slate-500">{account.email}</p></td>
                    <td className="px-5 py-4">{roleLabels[account.role] || account.role}</td>
                    <td className="px-5 py-4">{account.staff_id ? staff.find((person) => person.id === account.staff_id)?.staff_number || 'Linked staff account' : 'Legacy account — not linked'}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${account.is_active === true ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{account.is_active === true ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-5 py-4">{account.staff_id && ['teacher', 'housemaster'].includes(account.role) && account.id !== administrator.id ? <button type="button" disabled={busy || !ready} onClick={() => void toggleAccount(account)} className={buttonClass}>{account.is_active === true ? 'Deactivate' : 'Activate'}</button> : <span className="text-slate-400">Read-only</span>}</td>
                  </tr>)}
                  {!visibleAccounts.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No matching portal accounts.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

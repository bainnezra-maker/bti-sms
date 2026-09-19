import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Student = { id:string; full_name:string; admission_number:string|null; gender:string|null; guardian_name:string|null; guardian_phone:string|null; house:string|null };
type Allocation = { student_id:string; house_id:string; room_number:string; bed_space:string|null; status:string };
type House = { id:string; name:string; gender:string|null };
type Exeat = { id:string; student_id:string; expected_return_at:string; status:string; sms_status:string; sms_error:string|null; sms_recipient:string|null; guardian_contact:string|null; created_at:string };
type Checkout = { student_id:string; expected_return_at:string|null; status:string };
type Incident = { student_id:string; severity:string; status:string };

export default async function AdminBoardingDashboard() {
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data:profile } = await supabase.from('users').select('school_id,role,is_active').eq('id',user.id).maybeSingle();
  if (!profile || profile.role !== 'admin' || profile.is_active === false) redirect('/login');

  const [studentsQ,housesQ,roomsQ,allocQ,exeatsQ,checkoutsQ,incidentsQ] = await Promise.all([
    supabase.from('students').select('id,full_name,admission_number,gender,guardian_name,guardian_phone,house').eq('school_id',profile.school_id).eq('resident','Boarding').eq('status','active'),
    supabase.from('residential_houses').select('id,name,gender').eq('school_id',profile.school_id).eq('is_active',true),
    supabase.from('residential_rooms').select('id,house_id,capacity').eq('school_id',profile.school_id).eq('is_active',true),
    supabase.from('boarding_allocations').select('student_id,house_id,room_number,bed_space,status').eq('school_id',profile.school_id).eq('status','Active'),
    supabase.from('student_exiats').select('id,student_id,expected_return_at,status,sms_status,sms_error,sms_recipient,guardian_contact,created_at').eq('school_id',profile.school_id).order('created_at',{ascending:false}),
    supabase.from('student_checkouts').select('student_id,expected_return_at,status').eq('school_id',profile.school_id),
    supabase.from('student_incidents').select('student_id,severity,status').eq('school_id',profile.school_id),
  ]);
  const error=[studentsQ,housesQ,roomsQ,allocQ,exeatsQ,checkoutsQ,incidentsQ].find(q=>q.error)?.error;
  if(error) throw error;

  const students=(studentsQ.data||[]) as Student[], houses=(housesQ.data||[]) as House[], allocations=(allocQ.data||[]) as Allocation[], exeats=(exeatsQ.data||[]) as Exeat[], checkouts=(checkoutsQ.data||[]) as Checkout[], incidents=(incidentsQ.data||[]) as Incident[];
  const studentMap=new Map(students.map(s=>[s.id,s]));
  const allocatedIds=new Set(allocations.map(a=>a.student_id));
  const activeExeat=exeats.filter(x=>x.status==='Out');
  const activeCheckout=checkouts.filter(x=>x.status==='Checked Out');
  const awayIds=new Set([...activeExeat.map(x=>x.student_id),...activeCheckout.map(x=>x.student_id)]);
  const now=Date.now();
  const overdueExeats=activeExeat.filter(x=>new Date(x.expected_return_at).getTime()<now);
  const overdueCheckouts=activeCheckout.filter(x=>x.expected_return_at&&new Date(x.expected_return_at).getTime()<now);
  const failedSms=exeats.filter(x=>x.sms_status==='Failed').slice(0,30);
  const missingContacts=students.filter(s=>!s.guardian_phone?.trim());
  const capacity=(roomsQ.data||[]).reduce((n,r)=>n+(r.capacity||0),0);
  const boys=students.filter(s=>(s.gender||'').toLowerCase()==='male').length;
  const girls=students.filter(s=>(s.gender||'').toLowerCase()==='female').length;
  const unresolved=incidents.filter(i=>!['Resolved','Closed'].includes(i.status));
  const critical=unresolved.filter(i=>i.severity==='Critical');
  const occupancy=capacity?Math.round(allocations.length/capacity*100):0;

  const stats=[
    ['Boarders',students.length,'fa-users','text-blue-700 bg-blue-50'],
    ['Boys',boys,'fa-person','text-indigo-700 bg-indigo-50'],
    ['Girls',girls,'fa-person-dress','text-purple-700 bg-purple-50'],
    ['On Campus',students.length-awayIds.size,'fa-house-circle-check','text-emerald-700 bg-emerald-50'],
    ['On Exeat',activeExeat.length,'fa-person-walking-arrow-right','text-amber-700 bg-amber-50'],
    ['Checked Out',activeCheckout.length,'fa-suitcase-rolling','text-cyan-700 bg-cyan-50'],
    ['Needs Room',students.length-allocatedIds.size,'fa-user-clock','text-orange-700 bg-orange-50'],
    ['Open Incidents',unresolved.length,'fa-triangle-exclamation','text-red-700 bg-red-50'],
  ] as const;

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"/><div className="mx-auto max-w-7xl space-y-6">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl sm:p-8"><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black"><i className="fa-solid fa-building-shield mr-2"/>Administration · Boarding Oversight</span><div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-3xl font-black">Admin Boarding Dashboard</h1><p className="mt-2 max-w-3xl text-sm text-slate-300">School-wide boarding, movement, accommodation, welfare and guardian communication information from the Housemaster portal.</p></div><Link href="/housemaster" className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-900"><i className="fa-solid fa-arrow-up-right-from-square mr-2"/>Open Operational Portal</Link></div></header>

    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">{stats.map(([label,value,icon,style])=><div key={label} className="rounded-2xl border bg-white p-4 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${style}`}><i className={`fa-solid ${icon}`}/></span><p className="mt-3 text-2xl font-black">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p></div>)}</section>

    <section className="grid gap-5 lg:grid-cols-3"><div className="rounded-3xl border bg-white p-5 shadow-sm lg:col-span-2"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-indigo-600">Accommodation</p><h2 className="mt-1 text-xl font-black">Occupancy Overview</h2></div><span className="text-3xl font-black">{occupancy}%</span></div><div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{width:`${Math.min(occupancy,100)}%`}}/></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Houses',houses.length],['Formal Capacity',capacity],['Allocated',allocations.length],['Available',Math.max(capacity-allocations.length,0)]].map(([l,n])=><div key={String(l)} className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-black">{n}</p><p className="text-[11px] font-bold text-slate-500">{l}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">Capacity uses formally configured rooms; free-text room and bed allocations remain visible in the operational register.</p></div>
      <div className="rounded-3xl border bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-rose-600">Attention</p><h2 className="mt-1 text-xl font-black">Urgent Items</h2><div className="mt-4 space-y-2">{[['Overdue Exeats',overdueExeats.length],['Overdue Checkouts',overdueCheckouts.length],['Failed SMS',failedSms.length],['Missing Contacts',missingContacts.length],['Critical Incidents',critical.length]].map(([l,n])=><div key={String(l)} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold"><span>{l}</span><span className={Number(n)?'text-red-600':'text-emerald-600'}>{n}</span></div>)}</div></div></section>

    <section className="grid gap-5 lg:grid-cols-2"><AlertList title="Failed Guardian SMS" icon="fa-message" tone="red" empty="No failed Exeat SMS messages." rows={failedSms.map(x=>({id:x.id,title:studentMap.get(x.student_id)?.full_name||'Boarder',sub:x.sms_error||'SMS delivery failed',meta:x.sms_recipient||x.guardian_contact||'No number'}))}/><AlertList title="Missing Guardian Contacts" icon="fa-address-book" tone="amber" empty="Every boarder has a guardian contact." rows={missingContacts.slice(0,30).map(s=>({id:s.id,title:s.full_name,sub:s.admission_number||'No admission number',meta:s.house||'No house'}))}/></section>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
      ['Boarding & Rooms','Room and bed register','/housemaster/boarding','fa-bed'],['Exeat Register','Returns and SMS delivery','/housemaster/exiat','fa-person-walking-arrow-right'],['Incidents','Welfare and follow-up','/housemaster/incidents','fa-triangle-exclamation'],['Boarding Reports','Export school-wide records','/housemaster/reports','fa-file-export']
    ].map(([title,sub,href,icon])=><Link key={href} href={href} className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><i className={`fa-solid ${icon} text-slate-400`}/><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-xs text-slate-500">{sub}</p><span className="mt-4 inline-block text-xs font-black text-blue-600">Open <i className="fa-solid fa-arrow-right ml-1 transition group-hover:translate-x-1"/></span></Link>)}</section>
  </div></main>;
}

function AlertList({title,icon,tone,empty,rows}:{title:string;icon:string;tone:'red'|'amber';empty:string;rows:{id:string;title:string;sub:string;meta:string}[]}){
  const colors=tone==='red'?'text-red-700 bg-red-50':'text-amber-700 bg-amber-50';
  return <section className="overflow-hidden rounded-3xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b p-5"><div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Guardian Communication</p><h2 className="mt-1 text-lg font-black"><i className={`fa-solid ${icon} mr-2`}/>{title}</h2></div><span className={`rounded-full px-3 py-1 text-xs font-black ${colors}`}>{rows.length}</span></div>{rows.length?<div className="max-h-96 divide-y overflow-y-auto">{rows.map(r=><div key={r.id} className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm font-black">{r.title}</p><p className="mt-1 text-xs text-slate-500">{r.sub}</p></div><span className="text-right text-[11px] font-bold text-slate-400">{r.meta}</span></div>)}</div>:<p className="p-10 text-center text-sm text-slate-500"><i className="fa-solid fa-circle-check mr-2 text-emerald-500"/>{empty}</p>}</section>
}

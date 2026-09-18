import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function HousemasterDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('users')
    .select('school_id,full_name,role,is_active').eq('id', user.id).maybeSingle();
  if (!profile || profile.is_active === false || profile.role !== 'housemaster' || !profile.school_id) redirect('/login');
  const schoolId = profile.school_id;

  const [students, boarders, day, missing, houses, rooms, capacities, allocations, checkouts, exiats, incidents, recent] =
    await Promise.all([
      supabase.from('students').select('*',{count:'exact',head:true}).eq('school_id',schoolId),
      supabase.from('students').select('*',{count:'exact',head:true}).eq('school_id',schoolId).eq('resident','Boarding'),
      supabase.from('students').select('*',{count:'exact',head:true}).eq('school_id',schoolId).eq('resident','Day'),
      supabase.from('students').select('*',{count:'exact',head:true}).eq('school_id',schoolId).is('resident',null),
      supabase.from('residential_houses').select('*',{count:'exact',head:true}).eq('school_id',schoolId).eq('is_active',true),
      supabase.from('residential_rooms').select('*',{count:'exact',head:true}).eq('school_id',schoolId).eq('is_active',true),
      supabase.from('residential_rooms').select('capacity').eq('school_id',schoolId).eq('is_active',true),
      supabase.from('boarding_allocations').select('student_id',{count:'exact'}).eq('school_id',schoolId).eq('status','Active'),
      supabase.from('student_checkouts').select('student_id',{count:'exact'}).eq('school_id',schoolId).eq('status','Checked Out'),
      supabase.from('student_exiats').select('student_id',{count:'exact'}).eq('school_id',schoolId).eq('status','Out'),
      supabase.from('student_incidents').select('*',{count:'exact',head:true}).eq('school_id',schoolId).in('status',['Open','Under Review']),
      supabase.from('student_incidents').select('id,student_id,incident_at,category,severity,status,location').eq('school_id',schoolId).order('incident_at',{ascending:false}).limit(5),
    ]);

  const recentRows=recent.data||[];
  const ids=[...new Set(recentRows.map(x=>x.student_id).filter(Boolean))];
  const {data: incidentStudents}=ids.length
    ? await supabase.from('students').select('id,full_name,admission_number').in('id',ids)
    : {data:[] as {id:string;full_name:string;admission_number:string|null}[]};
  const sm=new Map((incidentStudents||[]).map(x=>[x.id,x]));

  const allocationIds=new Set((allocations.data||[]).map(x=>x.student_id));
  const awayBoarderIds=new Set([
    ...(checkouts.data||[]).map(x=>x.student_id),
    ...(exiats.data||[]).map(x=>x.student_id),
  ].filter(id=>allocationIds.has(id)));
  const allocated=allocations.count||0, checkedOut=checkouts.count||0, onExiat=exiats.count||0;
  const capacity=(capacities.data||[]).reduce((n,r)=>n+(r.capacity||0),0);
  const onCampus=Math.max(allocated-awayBoarderIds.size,0);
  const occupancy=capacity?Math.min(Math.round(allocated/capacity*100),100):0;

  const stats=[
    ['Total Students',students.count||0,'fa-users','bg-blue-100 text-blue-600'],
    ['Boarders',boarders.count||0,'fa-bed','bg-indigo-100 text-indigo-600'],
    ['Day Students',day.count||0,'fa-house-user','bg-emerald-100 text-emerald-600'],
    ['Open Incidents',incidents.count||0,'fa-triangle-exclamation','bg-amber-100 text-amber-600'],
  ];
  const actions=[
    ['Students / Admission','Search students and manage residential details.','/housemaster/students','fa-user-plus','bg-blue-100 text-blue-600'],
    ['Boarding & Rooms','Manage houses, rooms and student allocations.','/housemaster/boarding','fa-bed','bg-indigo-100 text-indigo-600'],
    ['Day Students','Manage residence and caretaker information.','/housemaster/day-students','fa-house-user','bg-emerald-100 text-emerald-600'],
    ['Incident Reports','Record and follow up student incidents.','/housemaster/incidents','fa-file-circle-exclamation','bg-rose-100 text-rose-600'],
    ['Exiat',`Temporary leave permissions · ${onExiat} currently out.`,'/housemaster/exiat','fa-person-walking-arrow-right','bg-amber-100 text-amber-600'],
    ['Checkout / Vacation','Record vacation departures and returns.','/housemaster/checkout','fa-suitcase-rolling','bg-cyan-100 text-cyan-600'],
    ['Student Profiles','Open the residential 360° student profile.','/housemaster/student-profiles','fa-id-card','bg-violet-100 text-violet-600'],
    ['Reports','Residential intelligence and Excel reports.','/housemaster/reports','fa-chart-column','bg-slate-100 text-slate-700'],
  ];

  return <><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"/>
  <div className="min-h-screen bg-slate-50">
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-4 pb-20 pt-20 text-white sm:px-6 lg:px-10 lg:pt-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 animate-pulse rounded-full bg-blue-500/20 blur-3xl"/>
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"><div>
          <div className="mb-5 flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><i className="fa-solid fa-house-user text-xl text-cyan-300"/></span><div><p className="text-xs font-bold uppercase tracking-[.22em] text-blue-200">Residential Management</p><p className="text-sm text-blue-100">BTI School Management System</p></div></div>
          <h1 className="text-3xl font-black sm:text-4xl">Housemaster / Housemistress <span className="block text-cyan-300">Dashboard</span></h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100/80">Welcome, {profile.full_name}. Monitor residence, welfare and student movement from one workspace.</p>
        </div><div className="flex gap-2"><span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">{houses.count||0} Active Houses</span><span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">{rooms.count||0} Rooms</span></div></div>
      </div>
    </section>
    <main className="relative z-10 -mt-10 px-4 pb-12 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl space-y-7">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">{stats.map(([l,n,i,c])=><div key={String(l)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/40 transition hover:-translate-y-1"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${c}`}><i className={`fa-solid ${i}`}/></span><p className="mt-4 text-3xl font-black text-slate-900">{Number(n).toLocaleString()}</p><p className="text-xs font-bold text-slate-500">{l}</p></div>)}</section>
      <section className="grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Boarding</p><h2 className="mt-1 text-xl font-black">Occupancy Overview</h2><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Capacity',capacity],['Allocated',allocated],['Available',Math.max(capacity-allocated,0)],['On Campus',onCampus]].map(([l,n])=><div key={String(l)} className="rounded-xl bg-slate-50 p-4"><p className="text-2xl font-black">{n}</p><p className="text-xs text-slate-500">{l}</p></div>)}</div><div className="mt-6"><div className="mb-2 flex justify-between text-xs font-semibold text-slate-500"><span>Room occupancy</span><span>{occupancy}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{width:`${occupancy}%`}}/></div></div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-amber-600">Campus Status</p><h2 className="mt-1 text-xl font-black">Movement Snapshot</h2><div className="mt-6 space-y-3">{[['On Campus',onCampus,'emerald'],['Checked Out',checkedOut,'cyan'],['On Exiat',onExiat,'amber'],['Residence Missing',missing.count||0,'slate']].map(([l,n])=><div key={String(l)} className="flex items-center justify-between rounded-xl bg-slate-50 p-4"><span className="text-sm font-semibold">{l}</span><span className="text-xl font-black">{n}</span></div>)}</div></div></section>
      <section><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Quick Access</p><h2 className="mt-1 text-2xl font-black">Residential Operations</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{actions.map(([t,d,h,i,c])=><Link key={String(h)} href={String(h)} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><span className={`flex h-12 w-12 items-center justify-center rounded-xl ${c}`}><i className={`fa-solid ${i}`}/></span><h3 className="mt-5 font-bold">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{d}</p></Link>)}</div></section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-rose-600">Student Welfare</p><h2 className="mt-1 text-xl font-black">Recent Incidents</h2></div><Link href="/housemaster/incidents" className="text-sm font-bold text-blue-600">View all →</Link></div>{recentRows.length===0?<div className="p-10 text-center text-sm text-slate-500">No incidents recorded.</div>:<div className="divide-y">{recentRows.map(x=>{const s=sm.get(x.student_id);return <div key={x.id} className="flex items-center justify-between gap-3 p-5"><div><p className="font-bold">{s?.full_name||'Student'}</p><p className="mt-1 text-xs text-slate-500">{s?.admission_number||'No admission number'} · {x.category}{x.location?` · ${x.location}`:''}</p></div><div className="text-right"><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold">{x.severity}</span><p className="mt-2 text-xs text-slate-400">{new Date(x.incident_at).toLocaleDateString('en-GB')}</p></div></div>})}</div>}</section>
    </div></main>
  </div></>;
}

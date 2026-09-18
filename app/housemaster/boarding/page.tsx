'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Profile={id:string;school_id:string;full_name:string;role:string;is_active:boolean|null};
type Year={id:string;name:string;start_date:string;is_current:boolean|null};
type Term={id:string;academic_year_id:string;name:string;is_current:boolean|null};
type House={id:string;name:string;description:string|null;gender:string|null;is_active:boolean};
type Room={id:string;house_id:string;room_number:string;location:string|null;capacity:number;is_active:boolean};
type Student={id:string;admission_number:string|null;full_name:string;gender:string|null;photo_url:string|null;resident:string|null};
type Allocation={id:string;student_id:string;academic_year_id:string;term_id:string|null;term:string|null;house_id:string;room_id:string;bed_space:string|null;status:string;allocated_at:string;notes:string|null};

const supabase=createClient();
const input='h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100';

export default function BoardingPage(){
 const router=useRouter();
 const [profile,setProfile]=useState<Profile|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState<{kind:'ok'|'err';text:string}|null>(null);
 const [years,setYears]=useState<Year[]>([]);
 const [terms,setTerms]=useState<Term[]>([]);
 const [houses,setHouses]=useState<House[]>([]);
 const [rooms,setRooms]=useState<Room[]>([]);
 const [students,setStudents]=useState<Student[]>([]);
 const [allocations,setAllocations]=useState<Allocation[]>([]);
 const [yearId,setYearId]=useState('');
 const [termId,setTermId]=useState('');
 const [termText,setTermText]=useState('Semester 1');
 const [houseId,setHouseId]=useState('');
 const [roomId,setRoomId]=useState('');
 const [studentId,setStudentId]=useState('');
 const [bedSpace,setBedSpace]=useState('');
 const [notes,setNotes]=useState('');
 const [studentSearch,setStudentSearch]=useState('');
 const [houseName,setHouseName]=useState('');
 const [houseGender,setHouseGender]=useState('Mixed');
 const [houseDescription,setHouseDescription]=useState('');
 const [roomNumber,setRoomNumber]=useState('');
 const [roomLocation,setRoomLocation]=useState('');
 const [roomCapacity,setRoomCapacity]=useState('4');

 async function refresh(schoolId:string){
  const [y,t,h,r,s,a]=await Promise.all([
   supabase.from('academic_years').select('id,name,start_date,is_current').eq('school_id',schoolId).order('start_date',{ascending:false}),
   supabase.from('terms').select('id,academic_year_id,name,is_current'),
   supabase.from('residential_houses').select('id,name,description,gender,is_active').eq('school_id',schoolId).order('name'),
   supabase.from('residential_rooms').select('id,house_id,room_number,location,capacity,is_active').eq('school_id',schoolId).order('room_number'),
   supabase.from('students').select('id,admission_number,full_name,gender,photo_url,resident').eq('school_id',schoolId).eq('resident','Boarding').eq('status','active').order('full_name'),
   supabase.from('boarding_allocations').select('id,student_id,academic_year_id,term_id,term,house_id,room_id,bed_space,status,allocated_at,notes').eq('school_id',schoolId).order('allocated_at',{ascending:false})
  ]);
  if(y.error||t.error||h.error||r.error||s.error||a.error) throw new Error(y.error?.message||t.error?.message||h.error?.message||r.error?.message||s.error?.message||a.error?.message);
  setYears((y.data??[]) as Year[]); setTerms((t.data??[]) as Term[]); setHouses((h.data??[]) as House[]);
  setRooms((r.data??[]) as Room[]); setStudents((s.data??[]) as Student[]); setAllocations((a.data??[]) as Allocation[]);
  const cy=(y.data??[]).find((x:any)=>x.is_current)||(y.data??[])[0]; if(cy&&!yearId)setYearId(cy.id);
 }
 useEffect(()=>{(async()=>{
  const {data:{user}}=await supabase.auth.getUser(); if(!user){router.replace('/login');return;}
  const {data:p}=await supabase.from('users').select('id,school_id,full_name,role,is_active').eq('id',user.id).maybeSingle();
  if(!p||p.is_active===false||!['housemaster','admin'].includes(p.role)){router.replace('/login');return;}
  setProfile(p as Profile); try{await refresh(p.school_id);}catch(e){setMessage({kind:'err',text:e instanceof Error?e.message:'Unable to load boarding data.'});}finally{setLoading(false);}
 })()},[router]);

 const yearTerms=useMemo(()=>terms.filter(t=>t.academic_year_id===yearId),[terms,yearId]);
 useEffect(()=>{const current=yearTerms.find(t=>t.is_current)||yearTerms[0];setTermId(current?.id||'');if(current)setTermText(current.name);},[yearId,yearTerms.length]);
 const activeHouses=houses.filter(h=>h.is_active);
 const selectedHouse=houses.find(h=>h.id===houseId);
 const houseRooms=rooms.filter(r=>r.house_id===houseId&&r.is_active);
 const scopedAlloc=allocations.filter(a=>a.academic_year_id===yearId&&a.status==='Active'&&(termId?a.term_id===termId:!a.term_id));
 const occupied=(rid:string)=>scopedAlloc.filter(a=>a.room_id===rid).length;
 const allocatedIds=new Set(scopedAlloc.map(a=>a.student_id));
 const eligible=students.filter(s=>!allocatedIds.has(s.id)&&(!selectedHouse||!selectedHouse.gender||selectedHouse.gender==='Mixed'||!s.gender||s.gender===selectedHouse.gender)).filter(s=>`${s.full_name} ${s.admission_number||''}`.toLowerCase().includes(studentSearch.toLowerCase()));
 const totalCapacity=rooms.filter(r=>r.is_active&&activeHouses.some(h=>h.id===r.house_id)).reduce((n,r)=>n+r.capacity,0);
 const activeOccupied=scopedAlloc.length;
 const selectedRoom=rooms.find(r=>r.id===roomId);
 const available=selectedRoom?Math.max(0,selectedRoom.capacity-occupied(selectedRoom.id)):0;

 async function addHouse(e:FormEvent){e.preventDefault();if(!profile||!houseName.trim())return;setBusy(true);setMessage(null);
  const {error}=await supabase.from('residential_houses').insert({school_id:profile.school_id,name:houseName.trim(),description:houseDescription.trim()||null,gender:houseGender,is_active:true,created_by:profile.id});
  if(error)setMessage({kind:'err',text:error.message});else{setHouseName('');setHouseDescription('');setMessage({kind:'ok',text:'House / dormitory created.'});await refresh(profile.school_id);}setBusy(false);
 }
 async function addRoom(e:FormEvent){e.preventDefault();if(!profile||!houseId||!roomNumber.trim())return;const cap=Number(roomCapacity);if(!Number.isInteger(cap)||cap<1){setMessage({kind:'err',text:'Room capacity must be at least 1.'});return;}setBusy(true);setMessage(null);
  const {error}=await supabase.from('residential_rooms').insert({school_id:profile.school_id,house_id:houseId,room_number:roomNumber.trim(),location:roomLocation.trim()||null,capacity:cap,is_active:true,created_by:profile.id});
  if(error)setMessage({kind:'err',text:error.message});else{setRoomNumber('');setRoomLocation('');setMessage({kind:'ok',text:'Room created successfully.'});await refresh(profile.school_id);}setBusy(false);
 }
 async function allocate(e:FormEvent){e.preventDefault();if(!profile||!studentId||!yearId||!houseId||!roomId)return;setBusy(true);setMessage(null);
  const {error}=await supabase.rpc('allocate_boarding_student',{p_student_id:studentId,p_academic_year_id:yearId,p_term_id:termId||null,p_term:termText,p_house_id:houseId,p_room_id:roomId,p_bed_space:bedSpace.trim()||null,p_notes:notes.trim()||null});
  if(error)setMessage({kind:'err',text:error.message});else{setStudentId('');setBedSpace('');setNotes('');setMessage({kind:'ok',text:'Student allocated successfully. Room capacity was checked by the database.'});await refresh(profile.school_id);}setBusy(false);
 }
 async function endAllocation(id:string){if(!profile||!confirm('End this room allocation? The history will be preserved.'))return;setBusy(true);
  const {error}=await supabase.from('boarding_allocations').update({status:'Ended',ended_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id).eq('school_id',profile.school_id);
  if(error)setMessage({kind:'err',text:error.message});else{setMessage({kind:'ok',text:'Allocation ended. Historical record preserved.'});await refresh(profile.school_id);}setBusy(false);
 }
 if(loading)return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-7xl animate-pulse"><div className="h-40 rounded-3xl bg-slate-900"/><div className="mt-6 h-96 rounded-3xl bg-white"/></div></main>;

 return <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"/>
  <div className="mx-auto max-w-7xl space-y-6">
   <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
    <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><span className="inline-flex rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><i className="fa-solid fa-bed mr-2"/>Residential Management</span><h1 className="mt-4 text-2xl font-black sm:text-3xl">Boarding & Room Allocation</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Create houses and rooms, monitor occupancy, and safely allocate existing Boarders without exceeding room capacity.</p></div><div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold"><i className="fa-solid fa-user-shield mr-2"/>{profile?.full_name}</div></div>
   </header>
   {message&&<div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${message.kind==='ok'?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-red-200 bg-red-50 text-red-700'}`}><i className={`fa-solid ${message.kind==='ok'?'fa-circle-check':'fa-circle-exclamation'} mr-2`}/>{message.text}</div>}
   <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Stat icon="fa-building" label="Active Houses" value={activeHouses.length}/>
    <Stat icon="fa-door-open" label="Active Rooms" value={rooms.filter(r=>r.is_active).length}/>
    <Stat icon="fa-bed" label="Total Bed Capacity" value={totalCapacity}/>
    <Stat icon="fa-user-check" label="Occupied / Available" value={`${activeOccupied} / ${Math.max(0,totalCapacity-activeOccupied)}`}/>
   </section>

   <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="grid gap-4 md:grid-cols-3">
     <Field label="Academic Year"><select className={input} value={yearId} onChange={e=>setYearId(e.target.value)}>{years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select></Field>
     <Field label="Semester">{yearTerms.length?<select className={input} value={termId} onChange={e=>{setTermId(e.target.value);setTermText(yearTerms.find(t=>t.id===e.target.value)?.name||'')}}>{yearTerms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>:<select className={input} value={termText} onChange={e=>setTermText(e.target.value)}><option>Semester 1</option><option>Semester 2</option></select>}</Field>
     <div className="rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><i className="fa-solid fa-shield-halved mr-2 text-slate-700"/>Capacity and duplicate-allocation checks are enforced in the database when you allocate a student.</div>
    </div>
   </section>

   <div className="grid gap-6 xl:grid-cols-2">
    <form onSubmit={addHouse} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><Title icon="fa-building" title="Houses / Dormitories" text="Create the residential houses used by the school."/><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="House Name"><input required className={input} value={houseName} onChange={e=>setHouseName(e.target.value)} placeholder="e.g. Unity House"/></Field><Field label="House Type"><select className={input} value={houseGender} onChange={e=>setHouseGender(e.target.value)}><option>Male</option><option>Female</option><option>Mixed</option></select></Field><div className="sm:col-span-2"><Field label="Description"><input className={input} value={houseDescription} onChange={e=>setHouseDescription(e.target.value)} placeholder="Optional description"/></Field></div></div><button disabled={busy} className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"><i className="fa-solid fa-plus mr-2"/>Add House</button>
     <div className="mt-5 flex flex-wrap gap-2">{activeHouses.length?activeHouses.map(h=><button type="button" key={h.id} onClick={()=>{setHouseId(h.id);setRoomId('')}} className={`rounded-xl border px-3 py-2 text-xs font-bold ${houseId===h.id?'border-slate-900 bg-slate-900 text-white':'border-slate-200 bg-slate-50 text-slate-700'}`}>{h.name} · {h.gender||'Mixed'}</button>):<Empty text="No houses have been created yet."/ >}</div>
    </form>

    <form onSubmit={addRoom} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><Title icon="fa-door-open" title="Rooms" text="Add rooms and define their maximum capacity."/><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="House"><select required className={input} value={houseId} onChange={e=>{setHouseId(e.target.value);setRoomId('')}}><option value="">Select house</option>{activeHouses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field><Field label="Room Number / Name"><input required className={input} value={roomNumber} onChange={e=>setRoomNumber(e.target.value)} placeholder="e.g. Room 12"/></Field><Field label="Location"><input className={input} value={roomLocation} onChange={e=>setRoomLocation(e.target.value)} placeholder="Block / floor"/></Field><Field label="Capacity"><input required min="1" type="number" className={input} value={roomCapacity} onChange={e=>setRoomCapacity(e.target.value)}/></Field></div><button disabled={busy||!houseId} className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"><i className="fa-solid fa-plus mr-2"/>Add Room</button>
    </form>
   </div>

   <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><Title icon="fa-user-plus" title="Allocate a Boarder" text="Only students already marked as Boarders appear here."/>
    <form onSubmit={allocate} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
     <Field label="House"><select required className={input} value={houseId} onChange={e=>{setHouseId(e.target.value);setRoomId('');setStudentId('')}}><option value="">Select house</option>{activeHouses.map(h=><option key={h.id} value={h.id}>{h.name} · {h.gender||'Mixed'}</option>)}</select></Field>
     <Field label="Room"><select required className={input} value={roomId} onChange={e=>setRoomId(e.target.value)}><option value="">Select room</option>{houseRooms.map(r=><option key={r.id} disabled={occupied(r.id)>=r.capacity} value={r.id}>{r.room_number} — {occupied(r.id)}/{r.capacity} occupied</option>)}</select></Field>
     <Field label="Search Boarder"><input className={input} value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} placeholder="Name or admission no."/></Field>
     <Field label="Student"><select required className={input} value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Select unallocated Boarder</option>{eligible.slice(0,150).map(s=><option key={s.id} value={s.id}>{s.full_name} — {s.admission_number||'No admission no.'}</option>)}</select></Field>
     <Field label="Bed Space"><input className={input} value={bedSpace} onChange={e=>setBedSpace(e.target.value)} placeholder="Optional e.g. Bed A"/></Field>
     <Field label="Room Availability"><div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">{selectedRoom?`${available} of ${selectedRoom.capacity} spaces available`:'Select a room'}</div></Field>
     <div className="md:col-span-2 xl:col-span-3"><Field label="Notes"><textarea rows={3} className={`${input} h-auto py-3`} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional allocation notes"/></Field></div>
     <button disabled={busy||!studentId||!roomId||available<1} className="h-12 rounded-xl bg-slate-900 px-6 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"><i className={`fa-solid ${busy?'fa-spinner animate-spin':'fa-bed'} mr-2`}/>{busy?'Saving...':'Allocate Student'}</button>
    </form>
   </section>

   <section className="rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><Title icon="fa-chart-pie" title="Room Occupancy" text="Live occupancy for the selected academic year and semester."/></div>
    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{activeHouses.length?activeHouses.map(h=><div key={h.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div><h3 className="font-black text-slate-900">{h.name}</h3><p className="text-xs font-semibold text-slate-500">{h.gender||'Mixed'} house</p></div><i className="fa-solid fa-building text-slate-300"/></div><div className="mt-4 space-y-3">{rooms.filter(r=>r.house_id===h.id&&r.is_active).map(r=>{const n=occupied(r.id),pct=Math.min(100,Math.round(n/r.capacity*100));return <div key={r.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between text-xs font-bold text-slate-700"><span>{r.room_number}</span><span>{n}/{r.capacity}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-slate-800 transition-all" style={{width:`${pct}%`}}/></div><p className="mt-1 text-[10px] text-slate-500">{r.location||'Location not specified'} · {Math.max(0,r.capacity-n)} available</p></div>})}{!rooms.some(r=>r.house_id===h.id&&r.is_active)&&<Empty text="No active rooms."/ >}</div></div>):<div className="sm:col-span-2 xl:col-span-3"><Empty text="Create a house and room to begin allocations."/></div>}</div>
   </section>

   <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><Title icon="fa-clock-rotate-left" title="Current Allocations" text="Ending an allocation preserves the student's residential history."/></div>
    <div className="divide-y divide-slate-100">{scopedAlloc.length?scopedAlloc.map(a=>{const s=students.find(x=>x.id===a.student_id),h=houses.find(x=>x.id===a.house_id),r=rooms.find(x=>x.id===a.room_id);return <div key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 font-black text-slate-600">{s?.full_name?.split(' ').map(x=>x[0]).slice(0,2).join('')||'?'}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-slate-900">{s?.full_name||'Student'}</p><p className="mt-1 text-xs text-slate-500">{s?.admission_number||'No admission no.'} · {h?.name||'House'} · {r?.room_number||'Room'}{a.bed_space?` · ${a.bed_space}`:''}</p></div><button disabled={busy} onClick={()=>endAllocation(a.id)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><i className="fa-solid fa-right-from-bracket mr-2"/>End Allocation</button></div>}):<div className="p-8"><Empty text="No active allocations for this academic year / semester."/></div>}</div>
   </section>
  </div>
 </main>
}
function Stat({icon,label,value}:{icon:string;label:string;value:string|number}){return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><i className={`fa-solid ${icon}`}/></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p></div></div></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>{children}</label>}
function Title({icon,title,text}:{icon:string;title:string;text:string}){return <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><i className={`fa-solid ${icon}`}/></span><div><h2 className="font-black text-slate-900">{title}</h2><p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p></div></div>}
function Empty({text}:{text:string}){return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs font-semibold text-slate-500"><i className="fa-solid fa-circle-info mr-2"/>{text}</div>}

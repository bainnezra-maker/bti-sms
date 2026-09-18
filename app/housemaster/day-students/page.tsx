'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Profile={id:string;school_id:string;full_name:string;role:string;is_active:boolean|null};
type Student={id:string;admission_number:string|null;full_name:string;gender:string|null;guardian_name:string|null;guardian_phone:string|null;address:string|null;photo_url:string|null;resident:string|null};
type Year={id:string;name:string;start_date:string;is_current:boolean|null};
type Enrollment={student_id:string;academic_year_id:string;class_id:string;programme_id:string|null;status:string|null};
type ClassRow={id:string;name:string;level:string|null;programme_id:string|null};
type Programme={id:string;name:string;code:string|null};
type Residence={id:string;student_id:string;academic_year_id:string;address:string;location:string|null;landlord_caretaker_name:string|null;landlord_caretaker_phone:string|null;is_current:boolean};

const supabase=createClient();
const input='h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100';

export default function DayStudentsPage(){
 const router=useRouter();
 const [profile,setProfile]=useState<Profile|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState<{kind:'ok'|'err';text:string}|null>(null);
 const [students,setStudents]=useState<Student[]>([]);
 const [years,setYears]=useState<Year[]>([]);
 const [enrollments,setEnrollments]=useState<Enrollment[]>([]);
 const [classes,setClasses]=useState<ClassRow[]>([]);
 const [programmes,setProgrammes]=useState<Programme[]>([]);
 const [residences,setResidences]=useState<Residence[]>([]);
 const [yearId,setYearId]=useState('');
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState<Student|null>(null);
 const [address,setAddress]=useState('');
 const [location,setLocation]=useState('');
 const [caretaker,setCaretaker]=useState('');
 const [caretakerPhone,setCaretakerPhone]=useState('');

 async function load(schoolId:string){
  const [y,s,c,p]=await Promise.all([
   supabase.from('academic_years').select('id,name,start_date,is_current').eq('school_id',schoolId).order('start_date',{ascending:false}),
   supabase.from('students').select('id,admission_number,full_name,gender,guardian_name,guardian_phone,address,photo_url,resident').eq('school_id',schoolId).eq('resident','Day').eq('status','active').order('full_name'),
   supabase.from('classes').select('id,name,level,programme_id').eq('school_id',schoolId),
   supabase.from('programmes').select('id,name,code').eq('school_id',schoolId).order('name')
  ]);
  if(y.error||s.error||c.error||p.error)throw new Error(y.error?.message||s.error?.message||c.error?.message||p.error?.message);
  setYears((y.data||[]) as Year[]);setStudents((s.data||[]) as Student[]);setClasses((c.data||[]) as ClassRow[]);setProgrammes((p.data||[]) as Programme[]);
  const cy=(y.data||[]).find((x:any)=>x.is_current)||(y.data||[])[0];const target=yearId||cy?.id||'';setYearId(target);
  if(target)await loadYearData(schoolId,target,(s.data||[]) as Student[]);
 }
 async function loadYearData(schoolId:string,yid:string,studentRows=students){
  const ids=studentRows.map(s=>s.id);
  if(!ids.length){setEnrollments([]);setResidences([]);return;}
  const [e,r]=await Promise.all([
   supabase.from('enrollments').select('student_id,academic_year_id,class_id,programme_id,status').eq('academic_year_id',yid).eq('status','active').in('student_id',ids),
   supabase.from('day_student_residences').select('id,student_id,academic_year_id,address,location,landlord_caretaker_name,landlord_caretaker_phone,is_current').eq('school_id',schoolId).eq('academic_year_id',yid).eq('is_current',true).in('student_id',ids)
  ]);
  if(e.error||r.error)throw new Error(e.error?.message||r.error?.message);
  setEnrollments((e.data||[]) as Enrollment[]);setResidences((r.data||[]) as Residence[]);
 }
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace('/login');return}
  const {data:p}=await supabase.from('users').select('id,school_id,full_name,role,is_active').eq('id',user.id).maybeSingle();
  if(!p||p.is_active===false||!['housemaster','admin'].includes(p.role)){router.replace('/login');return}
  setProfile(p as Profile);try{await load(p.school_id)}catch(e){setMessage({kind:'err',text:e instanceof Error?e.message:'Unable to load Day Students.'})}finally{setLoading(false)}
 })()},[router]);

 async function changeYear(id:string){if(!profile)return;setYearId(id);setSelected(null);setLoading(true);try{await loadYearData(profile.school_id,id)}catch(e){setMessage({kind:'err',text:e instanceof Error?e.message:'Unable to load academic year.'})}finally{setLoading(false)}}
 const classMap=useMemo(()=>new Map(classes.map(c=>[c.id,c])),[classes]);
 const programmeMap=useMemo(()=>new Map(programmes.map(p=>[p.id,p])),[programmes]);
 const enrollmentMap=useMemo(()=>new Map(enrollments.map(e=>[e.student_id,e])),[enrollments]);
 const residenceMap=useMemo(()=>new Map(residences.map(r=>[r.student_id,r])),[residences]);
 function academic(s:Student){const e=enrollmentMap.get(s.id);const c=e?classMap.get(e.class_id):undefined;const pid=e?.programme_id||c?.programme_id;return {c,p:pid?programmeMap.get(pid):undefined}}
 function complete(s:Student){const r=residenceMap.get(s.id);return !!(r?.address&&r?.location&&r?.landlord_caretaker_name&&r?.landlord_caretaker_phone)}
 const filtered=students.filter(s=>{const a=academic(s);return `${s.full_name} ${s.admission_number||''} ${a.p?.name||''} ${a.p?.code||''} ${a.c?.level||''} ${a.c?.name||''} ${residenceMap.get(s.id)?.location||''}`.toLowerCase().includes(search.toLowerCase())});
 const completeCount=students.filter(complete).length;

 function open(s:Student){setSelected(s);const r=residenceMap.get(s.id);setAddress(r?.address||s.address||'');setLocation(r?.location||'');setCaretaker(r?.landlord_caretaker_name||'');setCaretakerPhone(r?.landlord_caretaker_phone||'');setMessage(null)}
 async function save(e:FormEvent){e.preventDefault();if(!profile||!selected||!yearId||!address.trim())return;setBusy(true);setMessage(null);
  const existing=residenceMap.get(selected.id);const payload={school_id:profile.school_id,student_id:selected.id,academic_year_id:yearId,address:address.trim(),location:location.trim()||null,landlord_caretaker_name:caretaker.trim()||null,landlord_caretaker_phone:caretakerPhone.trim()||null,is_current:true,recorded_by:profile.id,updated_at:new Date().toISOString()};
  const q=existing?supabase.from('day_student_residences').update(payload).eq('id',existing.id).eq('school_id',profile.school_id):supabase.from('day_student_residences').insert(payload);
  const {error}=await q;if(error)setMessage({kind:'err',text:error.message});else{setMessage({kind:'ok',text:'Day Student residence updated successfully.'});await loadYearData(profile.school_id,yearId);setSelected(null)}setBusy(false)
 }
 if(loading&&!profile)return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-7xl animate-pulse"><div className="h-40 rounded-3xl bg-slate-900"/><div className="mt-6 h-96 rounded-3xl bg-white"/></div></main>;

 return <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"/><div className="mx-auto max-w-7xl space-y-6">
  <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8"><div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><span className="inline-flex rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><i className="fa-solid fa-house mr-2"/>Residential Management</span><h1 className="mt-4 text-2xl font-black sm:text-3xl">Day Students</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">View Day Students and maintain their off-campus residence, landlord/caretaker and contact information.</p></div><div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold"><i className="fa-solid fa-user-shield mr-2"/>{profile?.full_name}</div></div></header>
  {message&&<div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${message.kind==='ok'?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-red-200 bg-red-50 text-red-700'}`}><i className={`fa-solid ${message.kind==='ok'?'fa-circle-check':'fa-circle-exclamation'} mr-2`}/>{message.text}</div>}
  <section className="grid gap-3 sm:grid-cols-3"><Stat icon="fa-users" label="Day Students" value={students.length}/><Stat icon="fa-circle-check" label="Complete Residence Profiles" value={completeCount}/><Stat icon="fa-triangle-exclamation" label="Profiles Needing Attention" value={students.length-completeCount}/></section>
  <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-[220px_1fr]"><select className={input} value={yearId} onChange={e=>changeYear(e.target.value)}>{years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select><div className="relative"><i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/><input className={`${input} pl-11`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, admission no., programme, form, class or location..."/></div></div></section>
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
   <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-black text-slate-900">Day Student Directory</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} student(s) shown</p></div>
    <div className="divide-y divide-slate-100">{filtered.length?filtered.map(s=>{const a=academic(s),r=residenceMap.get(s.id),ok=complete(s);return <button key={s.id} onClick={()=>open(s)} className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center">
     <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 font-black text-slate-600">{s.photo_url?<img src={s.photo_url} alt="" className="h-full w-full object-cover"/>:s.full_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
     <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-slate-900">{s.full_name}</p><p className="mt-1 text-xs text-slate-500">{s.admission_number||'No admission no.'} · {a.p?.code||a.p?.name||'No programme'} · {a.c?.level||'No form'} · {a.c?.name||'No class'}</p><p className="mt-1 truncate text-xs text-slate-500"><i className="fa-solid fa-location-dot mr-1"/>{r?.location||r?.address||s.address||'Residence not recorded'}</p></div>
     <span className={`self-start rounded-full px-2.5 py-1 text-[10px] font-bold ${ok?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{ok?'Complete':'Needs attention'}</span>
    </button>}):<Empty text="No Day Students match this search."/ >}</div>
   </section>
   <aside className="xl:sticky xl:top-5 xl:self-start">{selected?<form onSubmit={save} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-black text-slate-900">Residence Details</h2><p className="mt-1 text-xs font-semibold text-slate-500">{selected.full_name}</p></div><button type="button" onClick={()=>setSelected(null)} className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500"><i className="fa-solid fa-xmark"/></button></div>
    <div className="mt-5 space-y-4"><Field label="Residential Address *"><textarea required rows={3} className={`${input} h-auto py-3`} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Full residential address"/></Field><Field label="Location / Area"><input className={input} value={location} onChange={e=>setLocation(e.target.value)} placeholder="Community / area"/></Field><Field label="Landlord / Caretaker Name"><input className={input} value={caretaker} onChange={e=>setCaretaker(e.target.value)} placeholder="Name"/></Field><Field label="Landlord / Caretaker Phone"><input type="tel" className={input} value={caretakerPhone} onChange={e=>setCaretakerPhone(e.target.value)} placeholder="Phone number"/></Field></div>
    <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><p><b>Guardian:</b> {selected.guardian_name||'—'}</p><p><b>Guardian phone:</b> {selected.guardian_phone||'—'}</p></div>
    <button disabled={busy} className="mt-5 h-12 w-full rounded-xl bg-slate-900 text-sm font-extrabold text-white shadow-lg disabled:opacity-50"><i className={`fa-solid ${busy?'fa-spinner animate-spin':'fa-floppy-disk'} mr-2`}/>{busy?'Saving...':'Save Residence Details'}</button>
   </form>:<div className="flex min-h-72 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><div><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white"><i className="fa-solid fa-address-card"/></span><h2 className="mt-4 font-black text-slate-900">Select a Day Student</h2><p className="mt-2 text-sm leading-6 text-slate-500">Choose a student to review or update their off-campus residence information.</p></div></div>}</aside>
  </div>
 </div></main>
}
function Stat({icon,label,value}:{icon:string;label:string;value:number}){return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><i className={`fa-solid ${icon}`}/></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p></div></div></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>{children}</label>}
function Empty({text}:{text:string}){return <div className="p-10 text-center text-sm font-semibold text-slate-500"><i className="fa-solid fa-circle-info mr-2"/>{text}</div>}

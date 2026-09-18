'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';

const supabase=createClient();
const input='h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100';

type Profile={id:string;school_id:string;full_name:string;role:string;is_active:boolean|null};
type Student={id:string;full_name:string;admission_number:string|null;gender:string|null;guardian_name:string|null;guardian_phone:string|null;photo_url:string|null;resident:string|null};
type Year={id:string;name:string;start_date:string;is_current:boolean|null};
type Term={id:string;academic_year_id:string;name:string;is_current:boolean|null};
type Programme={id:string;name:string;code:string|null};
type ClassRow={id:string;name:string;level:string|null;programme_id:string|null;academic_year_id:string};
type Enrollment={student_id:string;class_id:string;academic_year_id:string;programme_id:string|null;status:string};
type House={id:string;name:string;gender:string|null;is_active:boolean};
type Room={id:string;house_id:string;room_number:string;location:string|null;capacity:number;is_active:boolean};
type Allocation={id:string;student_id:string;academic_year_id:string;term_id:string|null;term:string|null;house_id:string;room_id:string;bed_space:string|null;status:string;allocated_at:string};
type Residential={id:string;health_insurance_number:string|null;home_location:string|null;emergency_contact_name:string|null;emergency_contact_phone:string|null;notes:string|null};

function Field({label,icon,children}:{label:string;icon:string;children:React.ReactNode}){return <label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-600"><i className={`fa-solid ${icon} text-slate-400`}/>{label}</span>{children}</label>}
function Info({label,value,icon}:{label:string;value:string;icon:string}){return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400"><i className={`fa-solid ${icon} mr-2`}/>{label}</p><p className="mt-2 break-words text-sm font-extrabold text-slate-800">{value}</p></div>}

export default function BoarderAdmission(){
 const router=useRouter();const [profile,setProfile]=useState<Profile|null>(null);const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [students,setStudents]=useState<Student[]>([]),[years,setYears]=useState<Year[]>([]),[terms,setTerms]=useState<Term[]>([]),[programmes,setProgrammes]=useState<Programme[]>([]),[classes,setClasses]=useState<ClassRow[]>([]),[enrol,setEnrol]=useState<Enrollment[]>([]),[houses,setHouses]=useState<House[]>([]),[rooms,setRooms]=useState<Room[]>([]),[alloc,setAlloc]=useState<Allocation[]>([]);
 const [search,setSearch]=useState(''),[studentId,setStudentId]=useState(''),[yearId,setYearId]=useState(''),[termId,setTermId]=useState(''),[termText,setTermText]=useState('Semester 1');
 const [health,setHealth]=useState(''),[home,setHome]=useState(''),[emergencyName,setEmergencyName]=useState(''),[emergencyPhone,setEmergencyPhone]=useState(''),[notes,setNotes]=useState('');
 const [houseId,setHouseId]=useState(''),[roomId,setRoomId]=useState(''),[bed,setBed]=useState('');const [message,setMessage]=useState<{ok:boolean;text:string}|null>(null);

 async function load(school:string){
  const q=await Promise.all([
   supabase.from('students').select('id,full_name,admission_number,gender,guardian_name,guardian_phone,photo_url,resident').eq('school_id',school).eq('resident','Boarding').eq('status','active').order('full_name'),
   supabase.from('academic_years').select('id,name,start_date,is_current').eq('school_id',school).order('start_date',{ascending:false}),
   supabase.from('terms').select('id,academic_year_id,name,is_current'),
   supabase.from('programmes').select('id,name,code').eq('school_id',school),
   supabase.from('classes').select('id,name,level,programme_id,academic_year_id').eq('school_id',school),
   supabase.from('enrollments').select('student_id,class_id,academic_year_id,programme_id,status').eq('status','active'),
   supabase.from('residential_houses').select('id,name,gender,is_active').eq('school_id',school).eq('is_active',true).order('name'),
   supabase.from('residential_rooms').select('id,house_id,room_number,location,capacity,is_active').eq('school_id',school).eq('is_active',true).order('room_number'),
   supabase.from('boarding_allocations').select('id,student_id,academic_year_id,term_id,term,house_id,room_id,bed_space,status,allocated_at').eq('school_id',school).eq('status','Active')
  ]);const er=q.find(x=>x.error)?.error;if(er)throw er;
  setStudents((q[0].data||[])as Student[]);setYears((q[1].data||[])as Year[]);setTerms((q[2].data||[])as Term[]);setProgrammes((q[3].data||[])as Programme[]);setClasses((q[4].data||[])as ClassRow[]);setEnrol((q[5].data||[])as Enrollment[]);setHouses((q[6].data||[])as House[]);setRooms((q[7].data||[])as Room[]);setAlloc((q[8].data||[])as Allocation[]);
  const cy=(q[1].data||[]).find((x:any)=>x.is_current)||(q[1].data||[])[0];if(cy&&!yearId)setYearId(cy.id);
 }
 useEffect(()=>{(async()=>{const{data:{user}}=await supabase.auth.getUser();if(!user){router.replace('/login');return}const{data:p}=await supabase.from('users').select('id,school_id,full_name,role,is_active').eq('id',user.id).maybeSingle();if(!p||p.is_active===false||!['housemaster','admin'].includes(p.role)){router.replace('/login');return}setProfile(p as Profile);try{await load(p.school_id)}catch(e){setMessage({ok:false,text:e instanceof Error?e.message:'Unable to load Boarders.'})}finally{setLoading(false)}})()},[router]);

 const yearTerms=useMemo(()=>terms.filter(t=>t.academic_year_id===yearId),[terms,yearId]);
 useEffect(()=>{const t=yearTerms.find(x=>x.is_current)||yearTerms[0];setTermId(t?.id||'');if(t)setTermText(t.name)},[yearId,yearTerms.length]);
 const student=students.find(s=>s.id===studentId);
 const enrollment=student?enrol.find(e=>e.student_id===student.id&&e.academic_year_id===yearId)||enrol.find(e=>e.student_id===student.id):undefined;
 const cls=enrollment?classes.find(c=>c.id===enrollment.class_id):undefined;const programme=programmes.find(p=>p.id===(enrollment?.programme_id||cls?.programme_id));
 const scoped=alloc.filter(a=>a.academic_year_id===yearId&&(termId?a.term_id===termId:!a.term_id));const current=student?scoped.find(a=>a.student_id===student.id):undefined;
 const houseRooms=rooms.filter(r=>r.house_id===houseId);const selectedRoom=rooms.find(r=>r.id===roomId);
 const occupied=(rid:string)=>scoped.filter(a=>a.room_id===rid).length;
 const used=new Set(scoped.filter(a=>a.room_id===roomId&&a.bed_space).map(a=>a.bed_space!.trim().toLowerCase()));
 const visible=students.filter(s=>{const e=enrol.find(x=>x.student_id===s.id&&x.academic_year_id===yearId)||enrol.find(x=>x.student_id===s.id);const c=e?classes.find(x=>x.id===e.class_id):undefined;const p=programmes.find(x=>x.id===(e?.programme_id||c?.programme_id));return `${s.full_name} ${s.admission_number||''} ${p?.name||''} ${p?.code||''}`.toLowerCase().includes(search.toLowerCase())});

 async function choose(id:string){
  setStudentId(id);setMessage(null);setHealth('');setHome('');setEmergencyName('');setEmergencyPhone('');setNotes('');setHouseId('');setRoomId('');setBed('');
  if(!profile)return;
  const {data:r}=await supabase.from('student_residential_profiles').select('id,health_insurance_number,home_location,emergency_contact_name,emergency_contact_phone,notes').eq('school_id',profile.school_id).eq('student_id',id).order('updated_at',{ascending:false}).limit(1).maybeSingle();
  if(r){const x=r as Residential;setHealth(x.health_insurance_number||'');setHome(x.home_location||'');setEmergencyName(x.emergency_contact_name||'');setEmergencyPhone(x.emergency_contact_phone||'');setNotes(x.notes||'')}
  const a=alloc.find(x=>x.student_id===id&&x.academic_year_id===yearId&&(termId?x.term_id===termId:!x.term_id));if(a){setHouseId(a.house_id);setRoomId(a.room_id);setBed(a.bed_space||'')}
 }

 async function save(e:FormEvent){e.preventDefault();if(!profile||!student||saving)return;setSaving(true);setMessage(null);
  try{
   const {data:existing,error:lookup}=await supabase.from('student_residential_profiles').select('id').eq('school_id',profile.school_id).eq('student_id',student.id).order('updated_at',{ascending:false}).limit(1).maybeSingle();if(lookup)throw lookup;
   const payload={school_id:profile.school_id,student_id:student.id,health_insurance_number:health.trim()||null,home_location:home.trim()||null,emergency_contact_name:emergencyName.trim()||null,emergency_contact_phone:emergencyPhone.trim()||null,notes:notes.trim()||null,updated_by:profile.id,updated_at:new Date().toISOString()};
   const pr=existing?.id?await supabase.from('student_residential_profiles').update(payload).eq('id',existing.id).eq('school_id',profile.school_id):await supabase.from('student_residential_profiles').insert({...payload,created_by:profile.id});if(pr.error)throw pr.error;
   if(!current){
    if(!yearId)throw new Error('Select an academic year.');if(!houseId||!roomId||!bed.trim())throw new Error('House, Room and Bed Number are required.');
    if(selectedRoom&&occupied(selectedRoom.id)>=selectedRoom.capacity)throw new Error('The selected room is already full.');
    if(used.has(bed.trim().toLowerCase()))throw new Error('That bed number is already occupied in this room for the selected academic period.');
    const {error}=await supabase.rpc('allocate_boarding_student',{p_student_id:student.id,p_academic_year_id:yearId,p_term_id:termId||null,p_term:termText,p_house_id:houseId,p_room_id:roomId,p_bed_space:bed.trim(),p_notes:notes.trim()||null});if(error)throw error;
   }
   setMessage({ok:true,text:current?'Residential information updated. Current room/bed allocation was preserved.':'Boarder residential information and room/bed allocation saved successfully.'});await load(profile.school_id);
  }catch(err){setMessage({ok:false,text:err instanceof Error?err.message:'Unable to save Boarder.'})}finally{setSaving(false)}
 }

 if(loading)return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-7xl animate-pulse"><div className="h-44 rounded-3xl bg-slate-900"/><div className="mt-6 h-96 rounded-3xl bg-white"/></div></main>;
 return <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"/><div className="mx-auto max-w-7xl space-y-6">
 <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8"><div className="absolute -right-20 -top-20 h-56 w-56 animate-pulse rounded-full bg-indigo-400/10 blur-xl"/><div className="relative"><span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-black"><i className="fa-solid fa-user-plus mr-2 animate-pulse"/>Boarders Only</span><h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">Boarder Admission & Residential Record</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Administration creates the master student record. Here the Housemaster/Housemistress enriches the Boarder's residential information and assigns House, Room and Bed for the selected academic period.</p></div></header>
 {message&&<div className={`animate-[fadeInUp_.3s_ease-out] rounded-2xl border px-4 py-3 text-sm font-bold ${message.ok?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-red-200 bg-red-50 text-red-700'}`}><i className={`fa-solid ${message.ok?'fa-circle-check':'fa-circle-exclamation'} mr-2`}/>{message.text}</div>}
 <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-4"><h2 className="font-black"><i className="fa-solid fa-magnifying-glass mr-2 text-slate-400"/>Find Boarder</h2><input className={`${input} mt-3`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, admission no. or programme"/></div><div className="max-h-[720px] divide-y overflow-y-auto">{visible.slice(0,250).map(s=>{const e=enrol.find(x=>x.student_id===s.id&&x.academic_year_id===yearId)||enrol.find(x=>x.student_id===s.id);const c=e?classes.find(x=>x.id===e.class_id):undefined;const p=programmes.find(x=>x.id===(e?.programme_id||c?.programme_id));return <button type="button" key={s.id} onClick={()=>choose(s.id)} className={`group w-full p-4 text-left transition hover:bg-slate-50 ${studentId===s.id?'bg-slate-100':''}`}><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition-transform group-hover:scale-105"><i className="fa-solid fa-user-graduate"/></span><div className="min-w-0"><p className="truncate text-sm font-black">{s.full_name}</p><p className="mt-1 truncate text-xs text-slate-500">{s.admission_number||'No admission no.'} · {p?.code||p?.name||'No programme'} · {c?.level||'No form'}</p></div></div></button>})}{!visible.length&&<p className="p-10 text-center text-sm text-slate-500">No Boarders found.</p>}</div></section>
  {!student?<section className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><div><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-lg"><i className="fa-solid fa-bed text-2xl animate-pulse"/></span><h2 className="mt-5 text-xl font-black">Select a Boarder</h2><p className="mt-2 text-sm text-slate-500">Only active students marked Boarding by Administration are available here.</p></div></section>:
  <form onSubmit={save} className="space-y-5 animate-[fadeInUp_.35s_ease-out]">
   <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-4"><span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white shadow-lg"><i className="fa-solid fa-user-graduate"/></span><div><h2 className="text-xl font-black">{student.full_name}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{student.admission_number||'No admission number'}</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Info icon="fa-layer-group" label="Programme" value={programme?`${programme.name}${programme.code?` (${programme.code})`:''}`:'—'}/><Info icon="fa-graduation-cap" label="Form / Class" value={`${cls?.level||'—'} · ${cls?.name||'—'}`}/><Info icon="fa-bed" label="Residence" value="Boarder"/></div></section>
   <section className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="font-black"><i className="fa-solid fa-calendar-days mr-2 text-indigo-600"/>Academic Period</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Academic Year" icon="fa-calendar"><select className={input} value={yearId} onChange={e=>{setYearId(e.target.value);setStudentId('')}}>{years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select></Field><Field label="Semester" icon="fa-clock">{yearTerms.length?<select className={input} value={termId} onChange={e=>{setTermId(e.target.value);setTermText(yearTerms.find(t=>t.id===e.target.value)?.name||'');setStudentId('')}}>{yearTerms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>:<select className={input} value={termText} onChange={e=>setTermText(e.target.value)}><option>Semester 1</option><option>Semester 2</option></select>}</Field></div></section>
   <section className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="font-black"><i className="fa-solid fa-notes-medical mr-2 text-emerald-600"/>Residential & Health Information</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Health Insurance Number" icon="fa-shield-heart"><input className={input} value={health} onChange={e=>setHealth(e.target.value)} placeholder="NHIS / insurance number"/></Field><Field label="Home Location" icon="fa-location-dot"><input className={input} value={home} onChange={e=>setHome(e.target.value)} placeholder="Town / community / district"/></Field><Field label="Emergency Contact Name" icon="fa-user-shield"><input className={input} value={emergencyName} onChange={e=>setEmergencyName(e.target.value)}/></Field><Field label="Emergency Contact Phone" icon="fa-phone-volume"><input className={input} value={emergencyPhone} onChange={e=>setEmergencyPhone(e.target.value)}/></Field><div className="sm:col-span-2"><Field label="Residential Notes" icon="fa-note-sticky"><textarea rows={3} className={`${input} h-auto py-3`} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Important residential information..."/></Field></div></div></section>
   <section className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="font-black"><i className="fa-solid fa-house-circle-check mr-2 text-indigo-600"/>House, Room & Bed Allocation</h3><p className="mt-1 text-xs text-slate-500">Allocation belongs to the selected academic period, so future promotions can receive a different room and bed without losing history.</p>
   {current?<div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><i className="fa-solid fa-circle-check mr-2"/>Already allocated: {houses.find(h=>h.id===current.house_id)?.name||'House'} → {rooms.find(r=>r.id===current.room_id)?.room_number||'Room'} → {current.bed_space||'No bed number'}. Current allocation is protected; use Boarding & Rooms when moving the student.</div>:
   <div className="mt-5 grid gap-4 sm:grid-cols-3"><Field label="House / Dormitory" icon="fa-building"><select required className={input} value={houseId} onChange={e=>{setHouseId(e.target.value);setRoomId('');setBed('')}}><option value="">Select house</option>{houses.filter(h=>!h.gender||!student.gender||h.gender.toLowerCase()==='mixed'||h.gender.toLowerCase()===student.gender.toLowerCase()).map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field><Field label="Room Number" icon="fa-door-open"><select required className={input} value={roomId} onChange={e=>{setRoomId(e.target.value);setBed('')}}><option value="">Select room</option>{houseRooms.map(r=><option key={r.id} value={r.id} disabled={occupied(r.id)>=r.capacity}>{r.room_number} — {occupied(r.id)}/{r.capacity} occupied</option>)}</select></Field><Field label="Bed Number" icon="fa-bed"><select required className={input} value={bed} onChange={e=>setBed(e.target.value)} disabled={!selectedRoom}><option value="">Select available bed</option>{selectedRoom&&Array.from({length:selectedRoom.capacity},(_,i)=>`Bed ${i+1}`).filter(label=>!used.has(label.toLowerCase())).map(label=><option key={label} value={label}>{label}</option>)}</select></Field>{selectedRoom&&<div className="sm:col-span-3 rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-600"><i className="fa-solid fa-chart-simple mr-2 text-indigo-500"/>{Math.max(0,selectedRoom.capacity-occupied(selectedRoom.id))} of {selectedRoom.capacity} spaces available. Duplicate active bed numbers are blocked at database level.</div>}</div>}</section>
   <button disabled={saving} className="h-12 w-full rounded-xl bg-slate-900 px-6 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-50"><i className={`fa-solid ${saving?'fa-spinner animate-spin':'fa-floppy-disk'} mr-2`}/>{saving?'Saving...':current?'Update Boarder Information':'Save Boarder & Allocate Room'}</button>
  </form>}
 </div></div></main>
}

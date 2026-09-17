'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

type AcademicYear={id:string;name:string;is_current:boolean};
type Programme={id:string;name:string;code:string|null};
type Subject={id:string;name:string;code:string|null};
type ClassItem={id:string;name:string;level:string|null;programme_id:string|null;academic_year_id:string|null};
type Student={id:string;full_name:string;admission_number:string};
type AttendanceRow={id:string;student_id:string;class_id:string|null;subject_id:string|null;date:string;status:'present'|'absent'|'late'|'excused';recorded_by:string|null;submitted_at:string|null};
type UserRow={id:string;full_name:string|null};
type SemesterRow={id:string;name:string;start_date:string|null;end_date:string|null};

const SEMESTERS=['Semester 1','Semester 2'] as const;
const FORMS=['Form 1','Form 2','Form 3'] as const;

function todayString(){const d=new Date();const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,10)}
function fmtTimestamp(v:string|null){if(!v)return '—';return new Date(v).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function pct(n:number,d:number){return d?`${((n/d)*100).toFixed(1)}%`:'0.0%'}
function statusLabel(v:string){return v.charAt(0).toUpperCase()+v.slice(1)}
function statusClass(v:string){if(v==='present')return 'bg-emerald-50 text-emerald-700';if(v==='absent')return 'bg-rose-50 text-rose-700';if(v==='late')return 'bg-amber-50 text-amber-700';return 'bg-sky-50 text-sky-700'}

export default function AttendanceReportsPage(){
 const supabase=createClient();
 const [schoolId,setSchoolId]=useState('');
 const [years,setYears]=useState<AcademicYear[]>([]);
 const [programmes,setProgrammes]=useState<Programme[]>([]);
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [classes,setClasses]=useState<ClassItem[]>([]);
 const [semesterRows,setSemesterRows]=useState<SemesterRow[]>([]);
 const [students,setStudents]=useState<Student[]>([]);
 const [attendance,setAttendance]=useState<AttendanceRow[]>([]);
 const [teachers,setTeachers]=useState<UserRow[]>([]);
 const [selectedYear,setSelectedYear]=useState('');
 const [selectedSemester,setSelectedSemester]=useState<'Semester 1'|'Semester 2'>('Semester 1');
 const [selectedSubject,setSelectedSubject]=useState('');
 const [selectedProgramme,setSelectedProgramme]=useState('all');
 const [selectedForm,setSelectedForm]=useState('all');
 const [selectedDate,setSelectedDate]=useState(todayString());
 const [search,setSearch]=useState('');
 const [loading,setLoading]=useState(true);
 const [loadingReport,setLoadingReport]=useState(false);
 const [message,setMessage]=useState('');
 const [exporting,setExporting]=useState(false);

 useEffect(()=>{(async()=>{
  try{
   setLoading(true);
   const {data:{user}}=await supabase.auth.getUser();
   if(!user)throw new Error('You are not logged in.');
   const {data:profile,error:pe}=await supabase.from('users').select('school_id').eq('id',user.id).single();
   if(pe||!profile?.school_id)throw new Error(pe?.message||'Could not determine your school.');
   setSchoolId(profile.school_id);
   const [yr,pr,su,cl]=await Promise.all([
    supabase.from('academic_years').select('id,name,is_current').eq('school_id',profile.school_id).order('start_date',{ascending:false}),
    supabase.from('programmes').select('id,name,code').eq('school_id',profile.school_id).order('name'),
    supabase.from('subjects').select('id,name,code').eq('school_id',profile.school_id).order('name'),
    supabase.from('classes').select('id,name,level,programme_id,academic_year_id').eq('school_id',profile.school_id)
   ]);
   if(yr.error)throw yr.error;if(pr.error)throw pr.error;if(su.error)throw su.error;if(cl.error)throw cl.error;
   setYears(yr.data||[]);setProgrammes(pr.data||[]);setSubjects(su.data||[]);setClasses(cl.data||[]);
   const preferred=(yr.data||[]).find((x:any)=>x.is_current)||(yr.data||[])[0];
   if(preferred)setSelectedYear(preferred.id);
   if((su.data||[])[0])setSelectedSubject((su.data||[])[0].id);
  }catch(e:any){setMessage(e.message||'Could not load attendance reports.')}finally{setLoading(false)}
 })()},[]);

 useEffect(()=>{(async()=>{
  if(!selectedYear){setSemesterRows([]);return}
  const {data,error}=await supabase.from('terms').select('id,name,start_date,end_date').eq('academic_year_id',selectedYear).in('name',['Semester 1','Semester 2']).order('start_date');
  if(!error)setSemesterRows((data||[]) as SemesterRow[]);
 })()},[selectedYear]);

 const eligibleClassIds=useMemo(()=>classes.filter(c=>
   c.academic_year_id===selectedYear &&
   (selectedProgramme==='all'||c.programme_id===selectedProgramme) &&
   (selectedForm==='all'||(c.level||'').trim().toLowerCase()===selectedForm.toLowerCase())
 ).map(c=>c.id),[classes,selectedYear,selectedProgramme,selectedForm]);

 useEffect(()=>{(async()=>{
  if(!schoolId||!selectedYear||!selectedSubject||!selectedDate||eligibleClassIds.length===0){setStudents([]);setAttendance([]);setTeachers([]);return}
  setLoadingReport(true);setMessage('');
  try{
   const {data:en,error:ee}=await supabase.from('enrollments').select('student_id,class_id').eq('academic_year_id',selectedYear).eq('status','active').in('class_id',eligibleClassIds);
   if(ee)throw ee;
   const studentIds=Array.from(new Set((en||[]).map((x:any)=>x.student_id)));
   if(!studentIds.length){setStudents([]);setAttendance([]);setTeachers([]);return}
   const {data:st,error:se}=await supabase.from('students').select('id,full_name,admission_number').eq('school_id',schoolId).in('id',studentIds).order('full_name');
   if(se)throw se;
   let q=supabase.from('attendance').select('id,student_id,class_id,subject_id,date,status,recorded_by,submitted_at').eq('school_id',schoolId).eq('subject_id',selectedSubject).eq('date',selectedDate).in('student_id',studentIds).order('submitted_at',{ascending:false});
   const {data:ar,error:ae}=await q;if(ae)throw ae;
   const teacherIds=Array.from(new Set((ar||[]).map((x:any)=>x.recorded_by).filter(Boolean)));
   let userRows:UserRow[]=[];
   if(teacherIds.length){const {data:us,error:ue}=await supabase.from('users').select('id,full_name').in('id',teacherIds);if(ue)throw ue;userRows=(us||[]) as UserRow[]}
   setStudents((st||[]) as Student[]);setAttendance((ar||[]) as AttendanceRow[]);setTeachers(userRows);
  }catch(e:any){setMessage(`Could not load attendance: ${e.message||e}`)}finally{setLoadingReport(false)}
 })()},[schoolId,selectedYear,selectedSubject,selectedDate,eligibleClassIds.join('|')]);

 const studentMap=useMemo(()=>new Map(students.map(s=>[s.id,s])),[students]);
 const teacherMap=useMemo(()=>new Map(teachers.map(t=>[t.id,t.full_name||'Teacher'])),[teachers]);
 const rows=useMemo(()=>attendance.filter(a=>{const s=studentMap.get(a.student_id);const q=search.trim().toLowerCase();return !q||!!s&&(s.full_name.toLowerCase().includes(q)||s.admission_number.toLowerCase().includes(q))}),[attendance,studentMap,search]);
 const summary=useMemo(()=>{const r={total:attendance.length,present:0,absent:0,late:0,excused:0};attendance.forEach(a=>r[a.status]++);return r},[attendance]);
 const selectedSubjectData=subjects.find(s=>s.id===selectedSubject);
 const selectedYearData=years.find(y=>y.id===selectedYear);
 const selectedSemesterData=semesterRows.find(s=>s.name===selectedSemester);

 function exportExcel(){
  if(!attendance.length)return;
  setExporting(true);
  try{
   const data=attendance.map((a,i)=>{const s=studentMap.get(a.student_id);return {No:i+1,Date:a.date,Subject:selectedSubjectData?.name||'',Student:s?.full_name||'',Admission:s?.admission_number||'',Status:statusLabel(a.status),'Submitted By':a.recorded_by?teacherMap.get(a.recorded_by)||'Teacher':'—','Submitted At':fmtTimestamp(a.submitted_at)}});
   const wb=XLSX.utils.book_new();const ws=XLSX.utils.json_to_sheet(data);ws['!cols']=[{wch:6},{wch:14},{wch:28},{wch:30},{wch:20},{wch:12},{wch:28},{wch:24}];XLSX.utils.book_append_sheet(wb,ws,'Attendance');
   XLSX.writeFile(wb,`BTI-Attendance-${selectedSubjectData?.name?.trim().replace(/[^a-z0-9]+/gi,'-')||'Subject'}-${selectedDate}.xlsx`);
  }finally{setExporting(false)}
 }

 if(loading)return <div className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-7xl rounded-3xl bg-white p-12 text-center shadow-sm"><i className="fa-solid fa-spinner fa-spin text-3xl text-blue-600"/><p className="mt-4 font-bold">Loading Attendance Reports...</p></div></div>;

 return <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
  <div className="mx-auto max-w-7xl space-y-6">
   <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl sm:p-8">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
     <div className="flex gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10"><i className="fa-solid fa-chart-line text-2xl text-cyan-300"/></div><div><h1 className="text-2xl font-black sm:text-3xl">Attendance Analytics</h1><p className="mt-2 text-sm text-slate-300">Subject-based live attendance submitted by teachers.</p><div className="mt-3 text-xs text-slate-400"><i className="fa-solid fa-database mr-1 text-blue-300"/>Live school records · teacher and submission timestamp included</div></div></div>
     <button onClick={exportExcel} disabled={!attendance.length||exporting} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold disabled:opacity-40"><i className="fa-solid fa-file-excel mr-2"/>{exporting?'Preparing...':'Excel Export'}</button>
    </div>
   </section>

   <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="mb-5"><h2 className="font-black text-slate-900">Report Filters</h2><p className="mt-1 text-xs text-slate-500">Choose the subject and date to see exactly what a teacher submitted.</p></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
     <Filter label="Academic Year"><select className="bti-select" value={selectedYear} onChange={e=>setSelectedYear(e.target.value)}>{years.map(y=><option key={y.id} value={y.id}>{y.name}{y.is_current?' — Current':''}</option>)}</select></Filter>
     <Filter label="Semester"><select className="bti-select" value={selectedSemester} onChange={e=>setSelectedSemester(e.target.value as any)}>{SEMESTERS.map(s=><option key={s} value={s}>{s}</option>)}</select></Filter>
     <Filter label="Subject"><select className="bti-select" value={selectedSubject} onChange={e=>setSelectedSubject(e.target.value)}><option value="">Select Subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}{s.code?` (${s.code})`:''}</option>)}</select></Filter>
     <Filter label="Programme"><select className="bti-select" value={selectedProgramme} onChange={e=>setSelectedProgramme(e.target.value)}><option value="all">All Programmes</option>{programmes.map(p=><option key={p.id} value={p.id}>{p.name}{p.code?` (${p.code})`:''}</option>)}</select></Filter>
     <Filter label="Form"><select className="bti-select" value={selectedForm} onChange={e=>setSelectedForm(e.target.value)}><option value="all">All Forms</option>{FORMS.map(f=><option key={f} value={f}>{f}</option>)}</select></Filter>
     <Filter label="Date"><input className="bti-select" type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></Filter>
    </div>
    <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-cyan-50 px-3 py-1.5 text-cyan-700">{selectedSubjectData?.name||'Select Subject'}</span><span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-700">{selectedSemester}</span>{selectedSemesterData&&<span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">{selectedSemesterData.start_date||'—'} → {selectedSemesterData.end_date||'—'}</span>}</div>
   </section>

   {message&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{message}</div>}

   <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
    <Card label="Records" value={summary.total} icon="fa-solid fa-users" tone="text-blue-600"/>
    <Card label="Present" value={summary.present} icon="fa-solid fa-circle-check" tone="text-emerald-600"/>
    <Card label="Absent" value={summary.absent} icon="fa-solid fa-circle-xmark" tone="text-rose-600"/>
    <Card label="Late" value={summary.late} icon="fa-solid fa-clock" tone="text-amber-600"/>
    <Card label="Excused" value={summary.excused} icon="fa-solid fa-shield-heart" tone="text-sky-600"/>
    <Card label="Attendance %" value={pct(summary.present+summary.late,summary.total)} icon="fa-solid fa-chart-pie" tone="text-violet-600"/>
   </section>

   <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-slate-900">Teacher Submissions</h2><p className="mt-1 text-xs text-slate-500">{selectedSubjectData?.name||'Subject'} · {selectedDate}</p></div><div className="relative"><i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student..." className="rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"/></div></div>
    {loadingReport?<div className="p-12 text-center text-slate-500"><i className="fa-solid fa-spinner fa-spin mr-2"/>Loading report...</div>:rows.length===0?<div className="p-12 text-center"><i className="fa-solid fa-clipboard-list text-3xl text-slate-300"/><p className="mt-3 font-bold text-slate-700">No attendance submitted for this subject and date.</p></div>:
    <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Admission No.</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Submitted By</th><th className="px-5 py-3">Submitted At</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(a=>{const s=studentMap.get(a.student_id);return <tr key={a.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-bold text-slate-900">{s?.full_name||'Unknown Student'}</td><td className="px-5 py-4 text-slate-600">{s?.admission_number||'—'}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(a.status)}`}>{statusLabel(a.status)}</span></td><td className="px-5 py-4 font-semibold text-slate-700">{a.recorded_by?teacherMap.get(a.recorded_by)||'Teacher':'—'}</td><td className="px-5 py-4 text-slate-600">{fmtTimestamp(a.submitted_at)}</td></tr>})}</tbody></table></div>}
   </section>
  </div>
  <style jsx global>{`.bti-select{width:100%;border-radius:.75rem;border:1px solid rgb(226 232 240);background:rgb(248 250 252);padding:.75rem;font-size:.875rem;font-weight:600;color:rgb(30 41 59);outline:none}.bti-select:focus{border-color:rgb(59 130 246);box-shadow:0 0 0 4px rgb(219 234 254)}`}</style>
 </div>
}

function Filter({label,children}:{label:string;children:React.ReactNode}){return <div><label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</label>{children}</div>}
function Card({label,value,icon,tone}:{label:string;value:string|number;icon:string;tone:string}){return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p></div><i className={`${icon} ${tone}`}/></div></div>}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'admin' | 'teacher';
type Teacher = { id:string; full_name:string; department:string|null; staff_id:string|null };
type Assignment = { id:string; teacher_id:string; class_id:string; subject_id:string; term_id:string|null; academic_year_id:string|null; programme_ids:string[]|null };
type Programme = { id:string; code:string|null; name:string };
type Slot = { teacher_assignment_id:string; day_of_week:number; status:string };
type Attendance = { recorded_by:string|null; class_id:string|null; subject_id:string|null; date:string };
type Assessment = { recorded_by:string|null; class_id:string|null; subject_id:string|null; assessment_type:string; submitted_at:string|null };
type DocumentRow = { staff_id:string; document_type:string };
type AcademicYear = { id:string; name:string; is_current:boolean|null; start_date:string; end_date:string };
type Term = { id:string; academic_year_id:string; name:string; start_date:string; end_date:string; is_current:boolean|null };
type Score = { teacher:Teacher; attendance:number; expected:number; attendancePoints:number; assessmentCount:number; assessmentPoints:number; documentCount:number; documentPoints:number; bonus:number; total:number; stars:number; badges:string[] };

const supabase=createClient();
const DOC_TYPES=['unit_specification','learning_session_plan','particulars_of_work_done'];
const STAR_LEVELS=[0,50,100,175,250,Number.POSITIVE_INFINITY];

function scheduledOccurrences(day:number,start:string,end:string){
  const a=new Date(`${start}T00:00:00Z`), b=new Date(`${end}T00:00:00Z`);let count=0;
  for(let d=new Date(a);d<=b;d.setUTCDate(d.getUTCDate()+1))if(d.getUTCDay()===day%7)count++;
  return count;
}
function pct(a:number,b:number){return b?Math.min(100,Math.round(a/b*100)):0}
function starsFor(points:number){return points>=250?5:points>=175?4:points>=100?3:points>=50?2:1}

export default function StaffPerformanceStars({mode}:{mode:Mode}){
  const [scores,setScores]=useState<Score[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[termName,setTermName]=useState('Current semester'),[viewerId,setViewerId]=useState('');
  useEffect(()=>{(async()=>{try{
    const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in to view Staff Performance Stars.');setViewerId(user.id);
    const {data:profile,error:profileError}=await supabase.from('users').select('school_id,role,is_active').eq('id',user.id).maybeSingle();
    if(profileError||!profile||profile.is_active===false)throw new Error('Your active staff profile could not be loaded.');
    if(mode==='admin'&&!['admin','owner'].includes(profile.role))throw new Error('Only administrators and the system owner can view the school leaderboard.');
    if(mode==='teacher'&&profile.role!=='teacher')throw new Error('Only teachers can view personal performance stars.');
    const {data:years,error:yearError}=await supabase.from('academic_years').select('id,name,is_current,start_date,end_date').eq('school_id',profile.school_id).order('start_date',{ascending:false});
    if(yearError||!years?.length)throw new Error('Set an academic year to calculate staff performance.');
    const academicYears=years as AcademicYear[], preferredYear=academicYears.find(y=>y.is_current)||academicYears[0];
    const {data:terms,error:termError}=await supabase.from('terms').select('id,academic_year_id,name,start_date,end_date,is_current').in('academic_year_id',academicYears.map(y=>y.id)).order('start_date',{ascending:true});
    if(termError)throw new Error(`Semester information could not be loaded: ${termError.message}`);
    const termRows=(terms||[]) as Term[];
    const yearWithTerms=academicYears.find(y=>termRows.some(t=>t.academic_year_id===y.id));
    const current=termRows.find(t=>t.is_current)||termRows.find(t=>t.academic_year_id===preferredYear.id)||termRows.find(t=>t.academic_year_id===yearWithTerms?.id)||null;
    const scoringYear=academicYears.find(y=>y.id===current?.academic_year_id)||preferredYear;
    const periodStart=current?.start_date||scoringYear.start_date;
    const periodEnd=current?.end_date||scoringYear.end_date;
    setTermName(current?`${scoringYear.name} · ${current.name}`:`${scoringYear.name} · Full academic year`);
    const today=new Date().toISOString().slice(0,10), effectiveEnd=today<periodEnd?today:periodEnd;
    const teacherQuery=supabase.from('users').select('id,full_name,department,staff_id').eq('school_id',profile.school_id).eq('role','teacher').eq('is_active',true).order('full_name');
    let assignmentQuery=supabase.from('teacher_assignments').select('id,teacher_id,class_id,subject_id,term_id,academic_year_id,programme_ids').eq('school_id',profile.school_id).eq('academic_year_id',scoringYear.id);
    let assessmentQuery=supabase.from('assessments').select('recorded_by,class_id,subject_id,assessment_type,submitted_at').eq('school_id',profile.school_id).gte('submitted_at',`${periodStart}T00:00:00`).lte('submitted_at',`${effectiveEnd}T23:59:59`);
    let documentQuery=supabase.from('staff_teaching_documents').select('staff_id,document_type').eq('school_id',profile.school_id).eq('academic_year_id',scoringYear.id);
    if(current){assessmentQuery=assessmentQuery.eq('term_id',current.id);documentQuery=documentQuery.eq('semester_id',current.id)}
    const [teachersQ,assignmentsQ,programmesQ,timetableQ,attendanceQ,assessmentQ,documentsQ]=await Promise.all([
      mode==='teacher'?teacherQuery.eq('id',user.id):teacherQuery,
      assignmentQuery,
      supabase.from('programmes').select('id,code,name').eq('school_id',profile.school_id).order('name'),
      supabase.from('timetable').select('teacher_assignment_id,day_of_week,status').eq('school_id',profile.school_id).eq('academic_year_id',scoringYear.id).eq('status','scheduled'),
      supabase.from('attendance').select('recorded_by,class_id,subject_id,date').eq('school_id',profile.school_id).gte('date',periodStart).lte('date',effectiveEnd),
      assessmentQuery,
      documentQuery,
    ]);
    const queryError=[teachersQ,assignmentsQ,programmesQ,timetableQ,attendanceQ,assessmentQ,documentsQ].find(q=>q.error)?.error;if(queryError)throw queryError;
    const teachers=(teachersQ.data||[]) as Teacher[], assignments=(assignmentsQ.data||[]) as Assignment[], programmes=(programmesQ.data||[]) as Programme[], slots=(timetableQ.data||[]) as Slot[], attendance=(attendanceQ.data||[]) as Attendance[], assessments=(assessmentQ.data||[]) as Assessment[], docs=(documentsQ.data||[]) as DocumentRow[];
    const programmeMap=new Map(programmes.map(programme=>[programme.id,programme.code||programme.name]));
    const calculated=teachers.map(teacher=>{
      const mine=assignments.filter(a=>a.teacher_id===teacher.id), mineIds=new Set(mine.map(a=>a.id));
      const assignedProgrammeIds=[...new Set(mine.flatMap(a=>a.programme_ids||[]))];
      const assignmentDepartment=assignedProgrammeIds.length===programmes.length&&programmes.length>0
        ? 'All departments'
        : assignedProgrammeIds.map(id=>programmeMap.get(id)).filter(Boolean).join(', ');
      const displayTeacher={...teacher,department:teacher.department||assignmentDepartment||null};
      const expected=slots.filter(s=>mineIds.has(s.teacher_assignment_id)).reduce((n,s)=>n+scheduledOccurrences(s.day_of_week,periodStart,effectiveEnd),0);
      const sessions=new Set(attendance.filter(a=>a.recorded_by===teacher.id).map(a=>`${a.date}|${a.class_id}|${a.subject_id}`));
      const completed=Math.min(expected,sessions.size), rate=pct(completed,expected);
      const assessmentGroups=new Set(assessments.filter(a=>a.recorded_by===teacher.id).map(a=>`${a.class_id}|${a.subject_id}|${a.assessment_type}`));
      const staffDocs=new Set(docs.filter(d=>d.staff_id===teacher.staff_id&&DOC_TYPES.includes(d.document_type)).map(d=>d.document_type));
      const attendancePoints=completed*5, assessmentPoints=assessmentGroups.size*10, documentPoints=staffDocs.size*10;
      const bonus=rate>=95&&expected>0?25:rate>=80&&expected>0?15:rate>=60&&expected>0?5:0;
      const total=attendancePoints+assessmentPoints+documentPoints+bonus;
      const badges:string[]=[];if(rate>=95&&expected>0)badges.push('Attendance Champion');if(assessmentGroups.size>=3)badges.push('Assessment Star');if(staffDocs.size===3)badges.push('Document Complete');if(bonus>=25)badges.push('Consistency Champion');
      return{teacher:displayTeacher,attendance:completed,expected,attendancePoints,assessmentCount:assessmentGroups.size,assessmentPoints,documentCount:staffDocs.size,documentPoints,bonus,total,stars:starsFor(total),badges};
    }).sort((a,b)=>b.total-a.total||b.attendance-a.attendance||a.teacher.full_name.localeCompare(b.teacher.full_name));
    setScores(calculated);
  }catch(e){setError(e instanceof Error?e.message:'Performance information could not be loaded.')}finally{setLoading(false)}})()},[mode]);
  const mine=useMemo(()=>scores.find(s=>s.teacher.id===viewerId)||scores[0],[scores,viewerId]);
  if(loading)return <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm"><i className="fa-solid fa-star fa-spin mr-2 text-amber-400"/>Calculating Staff Performance Stars...</section>;
  if(error)return <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</section>;
  if(mode==='teacher'&&mine){const next=STAR_LEVELS[mine.stars],base=STAR_LEVELS[mine.stars-1],progress=Number.isFinite(next)?Math.min(100,Math.round((mine.total-base)/(next-base)*100)):100;return <section className="overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-indigo-50 shadow-lg"><div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-700">Staff Performance Stars · {termName}</p><h2 className="mt-2 text-2xl font-black text-slate-950">Your performance score: {mine.total}</h2><div className="mt-2 text-2xl text-amber-400">{'★'.repeat(mine.stars)}<span className="text-slate-200">{'★'.repeat(5-mine.stars)}</span></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{width:`${progress}%`}}/></div><p className="mt-2 text-xs font-bold text-slate-500">{Number.isFinite(next)?`${next-mine.total} points to the next star`:'Outstanding Teacher level achieved'}</p></div><div className="rounded-3xl bg-slate-950 p-5 text-center text-white"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Star level</p><p className="mt-1 text-4xl font-black">{mine.stars}/5</p></div></div><ScoreDetails score={mine}/></section>}
  return <section className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/90 text-white shadow-xl"><div className="flex flex-col gap-4 border-b border-slate-700 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-400">Staff Performance Stars · {termName}</p><h2 className="mt-2 text-2xl font-black">Teacher Performance Leaderboard</h2><p className="mt-1 text-sm text-slate-400">Live points from timetable attendance, assessments and required teaching documents.</p></div><div className="rounded-2xl bg-amber-400/10 px-5 py-3 text-center ring-1 ring-amber-400/20"><p className="text-2xl font-black text-amber-300">{scores.length}</p><p className="text-[10px] font-black text-amber-200">ACTIVE TEACHERS</p></div></div>{scores.length?<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-950/60 text-[10px] font-black uppercase tracking-widest text-slate-500"><tr><th className="px-5 py-3">Rank</th><th className="px-5 py-3">Teacher</th><th className="px-5 py-3">Attendance</th><th className="px-5 py-3">Assessments</th><th className="px-5 py-3">USB/LSP/POWD</th><th className="px-5 py-3">Stars</th><th className="px-5 py-3 text-right">Points</th></tr></thead><tbody className="divide-y divide-slate-800">{scores.slice(0,20).map((s,i)=><tr key={s.teacher.id} className={i<3?'bg-amber-400/[.04]':''}><td className="px-5 py-4 text-xl font-black text-amber-300">#{i+1}</td><td className="px-5 py-4"><p className="font-black">{s.teacher.full_name}</p><p className="text-xs text-slate-500">{s.teacher.department||'No department'}</p>{s.badges.length>0&&<p className="mt-1 text-[10px] font-bold text-emerald-400">{s.badges.join(' · ')}</p>}</td><td className="px-5 py-4"><p className="font-bold">{s.attendance}/{s.expected}</p><p className="text-xs text-slate-500">{pct(s.attendance,s.expected)}% · {s.attendancePoints} pts</p></td><td className="px-5 py-4"><p className="font-bold">{s.assessmentCount} completed</p><p className="text-xs text-slate-500">{s.assessmentPoints} pts</p></td><td className="px-5 py-4"><p className="font-bold">{s.documentCount}/3</p><p className="text-xs text-slate-500">{s.documentPoints} pts</p></td><td className="px-5 py-4 text-amber-400">{'★'.repeat(s.stars)}<span className="text-slate-700">{'★'.repeat(5-s.stars)}</span></td><td className="px-5 py-4 text-right text-xl font-black">{s.total}</td></tr>)}</tbody></table></div>:<p className="p-10 text-center text-slate-400">No active teachers were found.</p>}</section>;
}

function ScoreDetails({score}:{score:Score}){return <div className="grid gap-3 border-t border-slate-200 p-6 sm:grid-cols-2 lg:grid-cols-4">{[[`Attendance ${score.attendance}/${score.expected}`,score.attendancePoints,'fa-calendar-check'],[`${score.assessmentCount} assessments`,score.assessmentPoints,'fa-clipboard-check'],[`${score.documentCount}/3 documents`,score.documentPoints,'fa-folder-open'],['Consistency bonus',score.bonus,'fa-fire']].map(([label,points,icon])=><div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4"><i className={`fa-solid ${icon} text-amber-500`}/><p className="mt-3 text-sm font-black text-slate-900">{label}</p><p className="mt-1 text-xs font-bold text-slate-500">+{points} points</p></div>)}{score.badges.length>0&&<div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-2">{score.badges.map(b=><span key={b} className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700"><i className="fa-solid fa-medal mr-1"/>{b}</span>)}</div>}</div>}

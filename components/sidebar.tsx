'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type UserRole = 'admin' | 'teacher' | 'Student' | 'staff' | 'housemaster' | null;
type MenuItem={name:string;href:string;icon:string};
type MenuSection={title:string;items:MenuItem[]};

const adminMenuSections:MenuSection[]=[
 {title:'MAIN',items:[
  {name:'Dashboard',href:'/',icon:'fa-solid fa-house'},
  {name:'Students',href:'/students',icon:'fa-solid fa-user-graduate'},
  {name:'Transfer & Withdrawal',href:'/student-movements',icon:'fa-solid fa-right-left'},
  {name:'Attendance Reports',href:'/attendance-reports',icon:'fa-solid fa-chart-column'},
  {name:'Assessment Reports',href:'/assessment-reports',icon:'fa-solid fa-clipboard-check'},
  {name:'Timetable',href:'/timetable',icon:'fa-solid fa-calendar-days'},
  {name:'Promotion',href:'/promotion',icon:'fa-solid fa-graduation-cap'}]},
 {title:'ACADEMICS',items:[
  {name:'Classes',href:'/classes',icon:'fa-solid fa-school'},
  {name:'Subjects',href:'/subjects',icon:'fa-solid fa-book-open'},
  {name:'Programmes',href:'/programmes',icon:'fa-solid fa-layer-group'},
  {name:'Academic Years',href:'/academic-years',icon:'fa-solid fa-calendar-days'}]},
 {title:'ADMINISTRATION',items:[
  {name:'Teacher Assignments',href:'/teacher-assignments',icon:'fa-solid fa-chalkboard-user'},
 {name:'Activity Calendar',href:'/activity-calendar',icon:'fa-solid fa-calendar-days'},
  {name:'Boarding Dashboard',href:'/admin/boarding',icon:'fa-solid fa-building-shield'},
  {name:'Announcements',href:'/announcements',icon:'fa-solid fa-bullhorn'},
  {name:'Staff',href:'/staff',icon:'fa-solid fa-users'},
  {name:'Portal Accounts',href:'/portal-accounts',icon:'fa-solid fa-user-shield'},
  {name:'Billing',href:'/fees',icon:'fa-solid fa-file-invoice-dollar'},
  {name:'Reports',href:'/reports',icon:'fa-solid fa-file-lines'}]},
 {title:'SYSTEM',items:[{name:'Settings',href:'/settings',icon:'fa-solid fa-gear'}]}
];
const teacherMenuSections:MenuSection[]=[{title:'TEACHER',items:[
 {name:'Teacher Dashboard',href:'/teacher',icon:'fa-solid fa-chalkboard-user'},
 {name:'Classes',href:'/teacher/classes',icon:'fa-solid fa-school'},
 {name:'Attendance',href:'/attendance',icon:'fa-solid fa-calendar-check'},
 {name:'Assessment',href:'/assessment',icon:'fa-solid fa-clipboard-check'},
 {name:'Results',href:'/results',icon:'fa-solid fa-chart-line'},
 {name:'Announcements',href:'/school-announcements',icon:'fa-solid fa-bullhorn'},
 {name:'My Uploads',href:'/teacher/my-uploads',icon:'fa-solid fa-cloud-arrow-up'}]}];
const studentMenuSections:MenuSection[]=[{title:'STUDENT',items:[{name:'Student Dashboard',href:'/student',icon:'fa-solid fa-user-graduate'}]}];
const housemasterMenuSections:MenuSection[]=[
 {title:'BOARDING',items:[
  {name:'Dashboard',href:'/housemaster',icon:'fa-solid fa-gauge-high'},
  {name:'Boarders / Admission',href:'/housemaster/students',icon:'fa-solid fa-user-plus'},
  {name:'Boarding & Rooms',href:'/housemaster/boarding',icon:'fa-solid fa-bed'},
  {name:'Incident Reports',href:'/housemaster/incidents',icon:'fa-solid fa-triangle-exclamation'},
  {name:'Exeat',href:'/housemaster/exiat',icon:'fa-solid fa-person-walking-arrow-right'},
  {name:'Checkout / Vacation',href:'/housemaster/checkout',icon:'fa-solid fa-suitcase-rolling'}]},
 {title:'INFORMATION',items:[
  {name:'Announcements',href:'/school-announcements',icon:'fa-solid fa-bullhorn'},
  {name:'Student Profiles',href:'/housemaster/student-profiles',icon:'fa-solid fa-id-card'},
  {name:'Reports',href:'/housemaster/reports',icon:'fa-solid fa-chart-pie'}]}
];

const supabase=createClient();

export default function Sidebar(){
 const pathname=usePathname(),router=useRouter(),searchParams=useSearchParams();
 const [mobileOpen,setMobileOpen]=useState(false);
 const [role,setRole]=useState<UserRole>(null);
 const [loading,setLoading]=useState(true);

 useEffect(()=>{let mounted=true;(async()=>{
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){if(mounted){setRole(null);setLoading(false)};return}
  const {data:p}=await supabase.from('users').select('role,is_active').eq('id',user.id).maybeSingle();
  if(!mounted)return;
  if(p&&p.is_active!==false&&['admin','teacher','Student','staff','housemaster'].includes(p.role))setRole(p.role as UserRole);
  else setRole(null);
  setLoading(false);
 })();return()=>{mounted=false}},[pathname]);

 const sections=role==='admin'?adminMenuSections:role==='teacher'?teacherMenuSections:role==='Student'?studentMenuSections:role==='housemaster'?housemasterMenuSections:[];
 const home=role==='admin'?'/':role==='teacher'?'/teacher':role==='housemaster'?'/housemaster':'/student';
 const title=role==='admin'?'Administrator':role==='teacher'?'Teacher Workspace':role==='Student'?'Student Portal':role==='housemaster'?'Housemaster / Housemistress':'BIRITECH SMS';
 const active=(href:string)=>pathname===href||(href!=='/'&&pathname.startsWith(href+'/'));
 const scopedHref=(href:string)=>{const gender=searchParams.get('gender');return role==='housemaster'&&gender?`${href}?gender=${encodeURIComponent(gender)}`:href};
 async function logout(){setMobileOpen(false);await supabase.auth.signOut();router.replace('/login');router.refresh()}
 if(loading)return <><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"/><aside className="fixed bottom-0 left-0 top-0 hidden w-64 animate-pulse bg-slate-900 lg:block"/></>;
 if(!role)return null;

 const Nav=({mobile=false}:{mobile?:boolean})=><nav className="flex-1 px-3 py-5">{sections.map((s,si)=><div key={s.title} className="mb-6 animate-[fadeInUp_.45s_ease-out_both]" style={{animationDelay:`${si*70}ms`}}><p className="mb-2 px-3 text-[10px] font-black tracking-[.18em] text-slate-400">{s.title}</p><div className="space-y-1">{s.items.map((item,ii)=>{const a=active(item.href);return <Link key={item.href} href={scopedHref(item.href)} onClick={()=>mobile&&setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${a?'bg-slate-900 text-white shadow-lg':'text-slate-600 hover:translate-x-1 hover:bg-slate-100 hover:text-slate-950'}`} style={{animationDelay:`${(si*70)+(ii*25)}ms`}}><span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${a?'bg-white/10':'bg-slate-100'}`}><i className={`${item.icon} text-sm`}/></span><span className="flex-1">{item.name}</span>{a&&<i className="fa-solid fa-chevron-right animate-pulse text-[9px]"/>}</Link>})}</div></div>)}</nav>;

 return <><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"/>
 <div className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b bg-white/95 px-4 shadow-sm backdrop-blur lg:hidden">
  <button onClick={()=>setMobileOpen(v=>!v)} className="flex h-10 w-10 items-center justify-center rounded-xl border"><i className={`fa-solid ${mobileOpen?'fa-xmark':'fa-bars'} transition-transform duration-300`}/></button>
  <Link href={home} className="flex items-center gap-2 font-black"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white"><i className="fa-solid fa-school"/></span>BIRITECH SMS</Link>
  <span className="flex h-10 w-10 items-center justify-center text-slate-500"><i className={role==='housemaster'?'fa-solid fa-house-user':'fa-solid fa-user-shield'}/></span>
 </div>
 {mobileOpen&&<button aria-label="Close menu" onClick={()=>setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"/>}
 <aside className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 max-w-[88vw] flex-col bg-white shadow-2xl transition-transform duration-300 lg:hidden ${mobileOpen?'translate-x-0':'-translate-x-full'}`}>
  <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white"><Link href={home} onClick={()=>setMobileOpen(false)} className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><i className="fa-solid fa-school"/></span><div><p className="text-xl font-black">BIRITECH SMS</p><p className="text-[11px] text-slate-300">{title}</p></div></Link></div>
  <Nav mobile/><div className="border-t p-4"><button onClick={logout} className="w-full rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-600 hover:bg-red-50 hover:text-red-600"><i className="fa-solid fa-right-from-bracket mr-3"/>Logout</button></div>
 </aside>
 <aside className="fixed bottom-0 left-0 top-0 z-50 hidden w-64 flex-col overflow-y-auto border-r bg-white shadow-sm lg:flex">
  <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white"><Link href={home} className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 transition-transform hover:scale-110"><i className="fa-solid fa-school"/></span><div><p className="text-xl font-black">BIRITECH SMS</p><p className="text-[11px] text-slate-300">{title}</p></div></Link></div>
  <Nav/><div className="border-t p-4"><button onClick={logout} className="w-full rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-600 hover:bg-red-50 hover:text-red-600"><i className="fa-solid fa-right-from-bracket mr-3"/>Logout</button></div>
 </aside></>
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic='force-dynamic';

export default async function SchoolAnnouncements(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('users').select('school_id,role,is_active').eq('id',user.id).maybeSingle();
  if(!profile||profile.is_active===false||!['teacher','housemaster','staff'].includes(profile.role))redirect('/login');
  const {data,error}=await supabase.from('school_news').select('id,title,content,category,is_urgent,publish_date,audiences,created_at').eq('school_id',profile.school_id).eq('is_published',true).order('is_urgent',{ascending:false}).order('publish_date',{ascending:false});
  if(error)throw error;
  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"/><div className="mx-auto max-w-5xl space-y-6"><header className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-7 text-white shadow-xl"><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black"><i className="fa-solid fa-bullhorn mr-2"/>School Communication</span><h1 className="mt-4 text-3xl font-black">Announcements</h1><p className="mt-2 text-sm text-slate-300">Published information addressed to your staff group.</p></header>{!data?.length?<div className="rounded-3xl border bg-white p-12 text-center text-slate-500"><i className="fa-solid fa-circle-check mb-3 block text-3xl text-emerald-500"/>No announcements are currently addressed to you.</div>:<div className="space-y-4">{data.map(item=><article key={item.id} className={`rounded-3xl border bg-white p-6 shadow-sm ${item.is_urgent?'border-red-200 ring-1 ring-red-100':''}`}><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">{item.category}</span>{item.is_urgent&&<span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black text-red-700">Urgent</span>}<span className="ml-auto text-xs text-slate-400">{new Date(`${item.publish_date}T00:00:00`).toLocaleDateString('en-GH',{day:'2-digit',month:'short',year:'numeric'})}</span></div><h2 className="mt-4 text-xl font-black">{item.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{item.content}</p></article>)}</div>}</div></main>
}

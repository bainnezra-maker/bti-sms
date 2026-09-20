import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const BATCH_SIZE = 20;

type Recipient = { studentId:string; studentName:string; guardianName:string|null; phone:string|null; normalized:string|null; duplicate:boolean };

function normalizeGhanaPhone(value:string){let d=value.replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0')&&d.length===10)d=`233${d.slice(1)}`;if(d.length===9)d=`233${d}`;return /^233\d{9}$/.test(d)?d:null}
function clip(value:string,max=450){const clean=value.replace(/\s+/g,' ').trim();return clean.length<=max?clean:`${clean.slice(0,max-1).trim()}…`}
function reference(payload:unknown){if(!payload||typeof payload!=='object')return null;const x=payload as Record<string,unknown>;const v=x.messageId||x.message_id||x.id||(x.data&&typeof x.data==='object'?((x.data as Record<string,unknown>).messageId||(x.data as Record<string,unknown>).id):null);return typeof v==='string'||typeof v==='number'?String(v):null}

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'You are not signed in.'},{status:401});
  const {data:profile}=await supabase.from('users').select('school_id,role,is_active').eq('id',user.id).maybeSingle();
  if(!profile||!['admin','owner'].includes(profile.role)||profile.is_active===false)return NextResponse.json({error:'Only an active administrator or owner can send guardian announcements.'},{status:403});
  let body:{announcementId?:string;offset?:number};try{body=await request.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
  if(!body.announcementId)return NextResponse.json({error:'Select an announcement.'},{status:400});
  const offset=Math.max(0,Number(body.offset)||0);
  const {data:announcement,error:announcementError}=await supabase.from('school_news').select('id,title,content,target_form,audiences,is_published').eq('id',body.announcementId).eq('school_id',profile.school_id).maybeSingle();
  if(announcementError||!announcement)return NextResponse.json({error:announcementError?.message||'Announcement not found.'},{status:404});
  if(!announcement.is_published)return NextResponse.json({error:'Publish the announcement before sending guardian SMS.'},{status:422});
  if(!(announcement.audiences||[]).some((x:string)=>x==='Guardians'||x==='Everyone'))return NextResponse.json({error:'This announcement is not addressed to guardians.'},{status:422});
  const schoolId=profile.school_id;
  const announcementId=announcement.id;

  const [studentsQ,enrolQ,classesQ]=await Promise.all([
    supabase.from('students').select('id,full_name,guardian_name,guardian_phone').eq('school_id',profile.school_id).eq('status','active').order('full_name'),
    supabase.from('enrollments').select('student_id,class_id').eq('status','active'),
    supabase.from('classes').select('id,level').eq('school_id',profile.school_id),
  ]);
  const loadError=[studentsQ,enrolQ,classesQ].find(q=>q.error)?.error;
  if(loadError)return NextResponse.json({error:loadError.message},{status:500});
  const classMap=new Map((classesQ.data||[]).map(c=>[c.id,(c.level||'').trim().toLowerCase()]));
  const formByStudent=new Map((enrolQ.data||[]).map(e=>[e.student_id,classMap.get(e.class_id)||'']));
  const selected=(studentsQ.data||[]).filter(s=>announcement.target_form==='All'||formByStudent.get(s.id)===announcement.target_form.toLowerCase());
  const seen=new Set<string>();
  const recipients:Recipient[]=selected.map(s=>{const normalized=normalizeGhanaPhone(s.guardian_phone||'');const duplicate=!!normalized&&seen.has(normalized);if(normalized)seen.add(normalized);return{studentId:s.id,studentName:s.full_name,guardianName:s.guardian_name,phone:s.guardian_phone,normalized,duplicate}});
  if(offset===0)await supabase.from('announcement_sms_deliveries').delete().eq('announcement_id',announcement.id).eq('school_id',profile.school_id);
  const batch=recipients.slice(offset,offset+BATCH_SIZE);
  const message=clip(`BTI ANNOUNCEMENT: ${announcement.title}. ${announcement.content}`);
  const clientId=process.env.HUBTEL_SMS_CLIENT_ID,clientSecret=process.env.HUBTEL_SMS_CLIENT_SECRET,sender=process.env.HUBTEL_SMS_SENDER_ID||'BTI',endpoint=process.env.HUBTEL_SMS_API_URL||'https://smsc.hubtel.com/v1/messages/send';

  async function deliver(r:Recipient){
    const base={school_id:schoolId,announcement_id:announcementId,student_id:r.studentId,student_name:r.studentName,guardian_name:r.guardianName,recipient:r.phone,normalized_recipient:r.normalized,updated_at:new Date().toISOString()};
    if(!r.normalized){await supabase.from('announcement_sms_deliveries').upsert({...base,status:'Missing Contact',error:'Guardian phone number is missing or invalid.',attempt_count:0},{onConflict:'announcement_id,student_id'});return}
    if(r.duplicate){await supabase.from('announcement_sms_deliveries').upsert({...base,status:'Duplicate',error:'This guardian number already received the announcement for another ward.',attempt_count:0},{onConflict:'announcement_id,student_id'});return}
    if(!clientId||!clientSecret){await supabase.from('announcement_sms_deliveries').upsert({...base,status:'Failed',error:'Hubtel SMS is not configured in Vercel.',attempt_count:1},{onConflict:'announcement_id,student_id'});return}
    try{const url=new URL(endpoint);url.searchParams.set('clientid',clientId);url.searchParams.set('clientsecret',clientSecret);url.searchParams.set('from',sender);url.searchParams.set('to',r.normalized);url.searchParams.set('content',message);const response=await fetch(url,{method:'POST',headers:{Accept:'application/json'},cache:'no-store'});const raw=await response.text();let payload:unknown=raw;try{payload=raw?JSON.parse(raw):null}catch{}if(!response.ok)throw new Error(typeof payload==='string'&&payload?payload:`Hubtel returned ${response.status}.`);await supabase.from('announcement_sms_deliveries').upsert({...base,status:'Sent',provider_message_id:reference(payload),error:null,attempt_count:1,sent_at:new Date().toISOString()},{onConflict:'announcement_id,student_id'})}catch(error){await supabase.from('announcement_sms_deliveries').upsert({...base,status:'Failed',error:error instanceof Error?error.message.slice(0,500):'SMS sending failed.',attempt_count:1},{onConflict:'announcement_id,student_id'})}
  }
  for(let i=0;i<batch.length;i+=5)await Promise.all(batch.slice(i,i+5).map(deliver));
  const {data:deliveries}=await supabase.from('announcement_sms_deliveries').select('status').eq('announcement_id',announcement.id).eq('school_id',profile.school_id);
  const counts={total:recipients.length,sent:(deliveries||[]).filter(x=>x.status==='Sent').length,failed:(deliveries||[]).filter(x=>x.status==='Failed').length,missing:(deliveries||[]).filter(x=>x.status==='Missing Contact').length,duplicate:(deliveries||[]).filter(x=>x.status==='Duplicate').length};
  await supabase.from('school_news').update({guardian_sms_enabled:true,sms_total:counts.total,sms_sent:counts.sent,sms_failed:counts.failed,sms_missing_contact:counts.missing,sms_last_sent_at:new Date().toISOString()}).eq('id',announcement.id).eq('school_id',profile.school_id);
  const nextOffset=offset+batch.length;
  return NextResponse.json({ok:true,counts,nextOffset,complete:nextOffset>=recipients.length});
}

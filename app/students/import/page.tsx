'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

type AcademicYear = { id: string; name: string; start_date: string | null; is_current?: boolean | null };
type ImportRow = {
  full_name: string; form: string; programme: string; class_name: string;
  gender: string; resident: string; house: string; date_of_birth: string;
  guardian_name: string; guardian_phone: string; address: string;
  admission_date: string; jhs_aggregate: string;
  health_insurance_number: string; health_insurance_expiry_date: string;
};
type Result = { row: number; status: 'success'|'partial'|'skipped'|'failed'; message: string; student_created?: boolean; student_existing?: boolean; assigned?: boolean; student_id?: string };

const headers = [
  'FULL NAME','FORM','PROGRAMME','CLASS','GENDER','RESIDENCE','HOUSE',
  'DATE OF BIRTH','GUARDIAN NAME','GUARDIAN PHONE','ADDRESS','ADMISSION DATE',
  'JHS AGGREGATE','HEALTH INSURANCE NUMBER','HEALTH INSURANCE EXPIRY DATE',
];

const clean = (v: unknown) => String(v ?? '').trim();
const norm = (v: unknown) => clean(v).toLowerCase().replace(/\s+/g,' ');
const normalizeResidence = (v: unknown) => {
  const x = norm(v); return x === 'day' ? 'Day' : x === 'boarding' ? 'Boarding' : '';
};
const normalizeHouse = (v: unknown) => {
  const x = norm(v).replace(/\s+/g,'');
  const m = x.match(/^house([1-4])$/);
  return m ? `House ${m[1]}` : '';
};
function excelDate(v: unknown) {
  if (!v) return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0,10);
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = clean(v);
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0,10);
}
function mapRow(row: Record<string,unknown>): ImportRow {
  const get=(name:string)=>{ const k=Object.keys(row).find(x=>norm(x)===norm(name)); return k ? row[k] : ''; };
  return {
    full_name:clean(get('FULL NAME')), form:clean(get('FORM')), programme:clean(get('PROGRAMME')),
    class_name:clean(get('CLASS')), gender:clean(get('GENDER')), resident:clean(get('RESIDENCE')),
    house:clean(get('HOUSE')), date_of_birth:excelDate(get('DATE OF BIRTH')),
    guardian_name:clean(get('GUARDIAN NAME')), guardian_phone:clean(get('GUARDIAN PHONE')),
    address:clean(get('ADDRESS')), admission_date:excelDate(get('ADMISSION DATE')),
    jhs_aggregate:clean(get('JHS AGGREGATE')), health_insurance_number:clean(get('HEALTH INSURANCE NUMBER')),
    health_insurance_expiry_date:excelDate(get('HEALTH INSURANCE EXPIRY DATE')),
  };
}

export default function StudentImportPage() {
  const supabase=createClient();
  const [rows,setRows]=useState<ImportRow[]>([]);
  const [years,setYears]=useState<AcademicYear[]>([]);
  const [yearId,setYearId]=useState('');
  const [schoolId,setSchoolId]=useState('');
  const [loading,setLoading]=useState(true);
  const [importing,setImporting]=useState(false);
  const [fileName,setFileName]=useState('');
  const [message,setMessage]=useState('');
  const [results,setResults]=useState<Result[]>([]);
  const [progress,setProgress]=useState(0);

  useEffect(()=>{ void load(); },[]);
  async function load(){
    setLoading(true);
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setMessage('You must be logged in.');setLoading(false);return;}
    const {data:profile,error:pe}=await supabase.from('users').select('school_id,role,is_active').eq('id',user.id).single();
    if(pe||!profile?.school_id){setMessage('Your account is not linked to a school.');setLoading(false);return;}
    if(profile.role!=='admin'||profile.is_active===false){setMessage('Only an active Administrator can use student bulk import.');setLoading(false);return;}
    setSchoolId(profile.school_id);
    const {data,error}=await supabase.from('academic_years').select('id,name,start_date,is_current').eq('school_id',profile.school_id).order('start_date',{ascending:false});
    if(error){setMessage(error.message);setLoading(false);return;}
    const list=(data||[]) as AcademicYear[]; setYears(list);
    setYearId(list.find(y=>y.is_current)?.id || list[0]?.id || '');
    setLoading(false);
  }

  function downloadTemplate(){
    const sample=[{
      'FULL NAME':'John Mensah','FORM':'Form 1','PROGRAMME':'Electrical Engineering','CLASS':'A Class',
      'GENDER':'Male','RESIDENCE':'Boarding','HOUSE':'House 1','DATE OF BIRTH':'2010-05-12',
      'GUARDIAN NAME':'Kwame Mensah','GUARDIAN PHONE':'0240000000','ADDRESS':'Accra',
      'ADMISSION DATE':'2026-09-01','JHS AGGREGATE':'18',
      'HEALTH INSURANCE NUMBER':'NHIS123456789','HEALTH INSURANCE EXPIRY DATE':'2027-08-31'
    }];
    const ws=XLSX.utils.json_to_sheet(sample,{header:headers});
    ws['!cols']=headers.map(h=>({wch:Math.max(16,Math.min(32,h.length+4))}));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Students');
    XLSX.writeFile(wb,'BTI-SMS-Student-Import-Template.xlsx');
  }

  async function handleFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file)return;
    setFileName(file.name);setRows([]);setResults([]);setMessage('');setProgress(0);
    try{
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const data=XLSX.utils.sheet_to_json<Record<string,unknown>>(ws,{defval:''}).map(mapRow);
      setRows(data);setMessage(`${data.length} student record(s) loaded and ready for validation.`);
    }catch{setMessage('Unable to read this file. Please use Excel (.xlsx/.xls) or CSV.');}
    e.target.value='';
  }

  async function importStudents(){
    if(importing||!rows.length||!yearId||!schoolId)return;
    setImporting(true);setResults([]);setMessage('');setProgress(5);
    const local:Result[]=[]; const valid:any[]=[];
    rows.forEach((r,i)=>{
      const row=i+2, residence=normalizeResidence(r.resident), house=normalizeHouse(r.house);
      if(!r.full_name.trim()){local.push({row,status:'skipped',message:'FULL NAME is required.'});return;}
      if(r.resident && !residence){local.push({row,status:'skipped',message:'RESIDENCE must be Day or Boarding.'});return;}
      if(residence==='Boarding'&&!house){local.push({row,status:'skipped',message:'HOUSE is required for Boarding students and must be House 1, House 2, House 3 or House 4.'});return;}
      if(r.jhs_aggregate && !Number.isFinite(Number(r.jhs_aggregate.replace(/,/g,'')))){local.push({row,status:'skipped',message:'JHS AGGREGATE must be a valid number.'});return;}
      valid.push({...r,row_number:row,resident:residence,house:residence==='Boarding'?house:'',
        health_insurance_expiry_date:r.health_insurance_expiry_date});
    });
    setResults([...local]);setProgress(20);
    const batchSize=50;
    for(let i=0;i<valid.length;i+=batchSize){
      const batch=valid.slice(i,i+batchSize);
      const {data,error}=await supabase.rpc('bulk_import_students_v2',{p_school_id:schoolId,p_academic_year_id:yearId,p_rows:batch});
      if(error){batch.forEach((r:any)=>local.push({row:r.row_number,status:'failed',message:error.message}));}
      else if(Array.isArray(data)){(data as Result[]).forEach(x=>local.push({...x,row:Number(x.row)}));}
      setResults([...local]); setProgress(20+Math.round(Math.min(i+batch.length,valid.length)/Math.max(valid.length,1)*75));
    }
    setProgress(100);setImporting(false);
    const success=local.filter(x=>x.status==='success').length, partial=local.filter(x=>x.status==='partial').length,
      skipped=local.filter(x=>x.status==='skipped').length, failed=local.filter(x=>x.status==='failed').length;
    setMessage(`Import complete: ${success} successful, ${partial} partial, ${skipped} skipped and ${failed} failed.`);
  }

  const counts=useMemo(()=>({
    success:results.filter(r=>r.status==='success').length, partial:results.filter(r=>r.status==='partial').length,
    skipped:results.filter(r=>r.status==='skipped').length, failed:results.filter(r=>r.status==='failed').length,
  }),[results]);

  return <main className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-sm text-slate-500"><Link href="/students" className="hover:text-blue-600">Students</Link><i className="fa-solid fa-chevron-right text-xs"/><span>Bulk Import</span></div>
          <h1 className="text-2xl font-black text-slate-900">Bulk Student Import</h1>
          <p className="mt-1 text-sm text-slate-500">Import students, residence, House and health insurance information from Excel.</p></div>
        <button onClick={downloadTemplate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700"><i className="fa-solid fa-file-excel"/>Download Template</button>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="mb-2 block text-sm font-black text-slate-700">Academic Year *</label><select value={yearId} onChange={e=>setYearId(e.target.value)} disabled={loading||importing} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="">Select academic year</option>{years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select></div>
          <div><label className="mb-2 block text-sm font-black text-slate-700">Student Excel File *</label><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 px-4 py-3 font-bold text-blue-700 hover:bg-blue-100"><i className="fa-solid fa-cloud-arrow-up"/>{fileName||'Choose Excel / CSV file'}<input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={importing} className="hidden"/></label></div>
        </div>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600"><b>Boarding rule:</b> enter House 1, House 2, House 3 or House 4 in HOUSE. HOUSE may be blank for Day students. Health insurance number and expiry date may be blank if not yet available.</div>
        {message&&<div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">{message}</div>}
        {importing&&<div className="mt-4"><div className="mb-1 flex justify-between text-xs font-bold text-slate-600"><span>Importing...</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600 transition-all" style={{width:`${progress}%`}}/></div></div>}
      </section>

      {rows.length>0&&<section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-slate-900">Preview</h2><p className="text-sm text-slate-500">{rows.length} record(s). Showing first 50.</p></div>
          <button onClick={importStudents} disabled={importing||!yearId} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"><i className={`fa-solid ${importing?'fa-spinner fa-spin':'fa-users-gear'} mr-2`}/>{importing?'Importing...':'Import & Assign Students'}</button></div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-[1700px] text-left text-xs"><thead className="bg-slate-100"><tr>{headers.map(h=><th key={h} className="whitespace-nowrap px-3 py-3 font-black text-slate-700">{h}</th>)}</tr></thead><tbody>{rows.slice(0,50).map((r,i)=><tr key={i} className="border-t border-slate-200 hover:bg-blue-50/40">
          <td className="px-3 py-3 font-bold">{r.full_name}</td><td className="px-3 py-3">{r.form}</td><td className="px-3 py-3">{r.programme}</td><td className="px-3 py-3">{r.class_name}</td><td className="px-3 py-3">{r.gender}</td><td className="px-3 py-3">{normalizeResidence(r.resident)||r.resident||'—'}</td><td className="px-3 py-3 font-bold text-purple-700">{normalizeHouse(r.house)||r.house||'—'}</td><td className="px-3 py-3">{r.date_of_birth||'—'}</td><td className="px-3 py-3">{r.guardian_name||'—'}</td><td className="px-3 py-3">{r.guardian_phone||'—'}</td><td className="px-3 py-3">{r.address||'—'}</td><td className="px-3 py-3">{r.admission_date||'—'}</td><td className="px-3 py-3">{r.jhs_aggregate||'—'}</td><td className="px-3 py-3">{r.health_insurance_number||'—'}</td><td className="px-3 py-3">{r.health_insurance_expiry_date||'—'}</td>
        </tr>)}</tbody></table></div>
      </section>}

      {results.length>0&&<section className="mt-6">
        <div className="grid gap-3 sm:grid-cols-4">{(['success','partial','skipped','failed'] as const).map(s=><div key={s} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">{s}</p><p className="text-2xl font-black text-slate-900">{counts[s]}</p></div>)}</div>
        <div className="mt-4 max-h-[450px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">{results.sort((a,b)=>a.row-b.row).map((r,i)=><div key={`${r.row}-${i}`} className="border-b border-slate-100 p-4 text-sm last:border-0"><span className="mr-2 font-black text-slate-500">Excel Row {r.row}</span><span className="mr-2 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase">{r.status}</span><span className="text-slate-700">{r.message}</span></div>)}</div>
      </section>}
    </div>
  </main>;
}

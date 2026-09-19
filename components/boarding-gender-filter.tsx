'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type BoardingGender = 'all' | 'Male' | 'Female';

export function useBoardingGender(): BoardingGender {
  const value = useSearchParams().get('gender');
  return value === 'Male' || value === 'Female' ? value : 'all';
}

export function matchesBoardingGender(gender: string | null | undefined, scope: BoardingGender) {
  if (scope === 'all') return true;
  return (gender || '').trim().toLowerCase() === scope.toLowerCase();
}

export default function BoardingGenderFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope = useBoardingGender();

  function select(next: BoardingGender) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'all') params.delete('gender');
    else params.set('gender', next);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const options: Array<[BoardingGender, string, string]> = [
    ['all', 'All Boarders', 'fa-users'],
    ['Male', 'Boys', 'fa-person'],
    ['Female', 'Girls', 'fa-person-dress'],
  ];

  return <div className="sticky top-16 z-30 border-b border-slate-200 bg-white/95 px-4 py-2 shadow-sm backdrop-blur lg:top-0 lg:px-6">
    <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto">
      <span className="mr-1 hidden text-[10px] font-black uppercase tracking-widest text-slate-400 sm:inline">Viewing</span>
      {options.map(([value,label,icon])=><button key={value} type="button" onClick={()=>select(value)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black transition ${scope===value?'bg-slate-900 text-white shadow-md':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><i className={`fa-solid ${icon} mr-2`}/>{label}</button>)}
    </div>
  </div>;
}

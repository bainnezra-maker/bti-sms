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

  return (
    <div className="sticky top-16 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-md backdrop-blur lg:top-0 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.2em] text-slate-500 sm:text-left">
          Select boarding view
        </p>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {options.map(([value, label, icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => select(value)}
              aria-pressed={scope === value}
              className={`flex min-h-16 items-center justify-center rounded-2xl border-2 px-3 py-4 text-sm font-black shadow-sm transition sm:min-h-20 sm:px-6 sm:text-lg ${
                scope === value
                  ? 'border-indigo-700 bg-indigo-700 text-white shadow-lg ring-4 ring-indigo-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50'
              }`}
            >
              <i className={`fa-solid ${icon} mr-2 text-base sm:mr-3 sm:text-xl`} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

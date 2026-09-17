import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function HousemasterDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('school_id, full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.is_active === false ||
    profile.role !== 'housemaster' ||
    !profile.school_id
  ) {
    redirect('/login');
  }

  const schoolId = profile.school_id;

  const [
    studentsResult,
    boardersResult,
    dayResult,
    unclassifiedResult,
    housesResult,
    roomsResult,
    capacityResult,
    allocationsResult,
    checkedOutResult,
    openIncidentsResult,
    recentIncidentsResult,
  ] = await Promise.all([
    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId),

    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('resident', 'Boarding'),

    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('resident', 'Day'),

    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .is('resident', null),

    supabase
      .from('residential_houses')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),

    supabase
      .from('residential_rooms')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),

    supabase
      .from('residential_rooms')
      .select('capacity')
      .eq('school_id', schoolId)
      .eq('is_active', true),

    supabase
      .from('boarding_allocations')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'active'),

    supabase
      .from('student_checkouts')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'checked_out'),

    supabase
      .from('student_incidents')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .neq('status', 'Resolved'),

    supabase
      .from('student_incidents')
      .select('id, student_id, incident_at, category, severity, status, location')
      .eq('school_id', schoolId)
      .order('incident_at', { ascending: false })
      .limit(5),
  ]);

  const recentIncidents = recentIncidentsResult.data || [];
  const incidentStudentIds = [
    ...new Set(recentIncidents.map((item) => item.student_id).filter(Boolean)),
  ];

  const { data: incidentStudents } = incidentStudentIds.length
    ? await supabase
        .from('students')
        .select('id, full_name, admission_number')
        .in('id', incidentStudentIds)
    : { data: [] as { id: string; full_name: string; admission_number: string | null }[] };

  const studentMap = new Map(
    (incidentStudents || []).map((student) => [student.id, student])
  );

  const totalStudents = studentsResult.count || 0;
  const boarders = boardersResult.count || 0;
  const dayStudents = dayResult.count || 0;
  const unclassified = unclassifiedResult.count || 0;
  const houses = housesResult.count || 0;
  const rooms = roomsResult.count || 0;
  const activeAllocations = allocationsResult.count || 0;
  const checkedOut = checkedOutResult.count || 0;
  const openIncidents = openIncidentsResult.count || 0;
  const totalCapacity = (capacityResult.data || []).reduce(
    (sum, room) => sum + (room.capacity || 0),
    0
  );
  const availableSpaces = Math.max(totalCapacity - activeAllocations, 0);
  const onCampusBoarders = Math.max(activeAllocations - checkedOut, 0);
  const occupancy =
    totalCapacity > 0
      ? Math.min(Math.round((activeAllocations / totalCapacity) * 100), 100)
      : 0;

  const stats = [
    {
      label: 'Total Students',
      value: totalStudents,
      detail: 'Registered student records',
      icon: 'fa-solid fa-users',
      iconClass: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Boarders',
      value: boarders,
      detail: `${activeAllocations.toLocaleString()} currently allocated`,
      icon: 'fa-solid fa-bed',
      iconClass: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Day Students',
      value: dayStudents,
      detail: 'Recorded as Day students',
      icon: 'fa-solid fa-house-user',
      iconClass: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Open Incidents',
      value: openIncidents,
      detail: 'Require attention or follow-up',
      icon: 'fa-solid fa-triangle-exclamation',
      iconClass: 'bg-amber-100 text-amber-600',
    },
  ];

  const quickActions = [
    {
      title: 'Students / Admission',
      description: 'Search students and manage residential admission details.',
      href: '/housemaster/students',
      icon: 'fa-solid fa-user-plus',
      className: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Boarding & Rooms',
      description: 'Manage houses, rooms and student allocations.',
      href: '/housemaster/boarding',
      icon: 'fa-solid fa-bed',
      className: 'bg-indigo-100 text-indigo-600',
    },
    {
      title: 'Day Students',
      description: 'Manage residence and caretaker information.',
      href: '/housemaster/day-students',
      icon: 'fa-solid fa-house-user',
      className: 'bg-emerald-100 text-emerald-600',
    },
    {
      title: 'Incident Report',
      description: 'Record and follow up student incidents.',
      href: '/housemaster/incidents',
      icon: 'fa-solid fa-file-circle-exclamation',
      className: 'bg-rose-100 text-rose-600',
    },
    {
      title: 'Checkout / Vacation',
      description: 'Record departures, expected returns and arrivals.',
      href: '/housemaster/checkout',
      icon: 'fa-solid fa-suitcase-rolling',
      className: 'bg-cyan-100 text-cyan-600',
    },
    {
      title: 'Student Profiles',
      description: 'Open the residential 360° student profile.',
      href: '/housemaster/student-profiles',
      icon: 'fa-solid fa-id-card',
      className: 'bg-violet-100 text-violet-600',
    },
  ];

  function severityClass(severity: string | null) {
    const value = (severity || '').toLowerCase();
    if (value === 'critical' || value === 'high') return 'bg-red-50 text-red-700 ring-red-600/10';
    if (value === 'medium') return 'bg-amber-50 text-amber-700 ring-amber-600/10';
    return 'bg-slate-100 text-slate-600 ring-slate-500/10';
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      />

      <div className="min-h-screen bg-slate-50">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-4 pb-20 pt-20 text-white sm:px-6 lg:px-10 lg:pt-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 animate-pulse rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 animate-pulse rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="relative mx-auto max-w-7xl">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="animate-[fadeInDown_0.7s_ease-out]">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/20 backdrop-blur">
                    <i className="fa-solid fa-house-user animate-[iconFloat_3s_ease-in-out_infinite] text-xl text-cyan-300" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-200">
                      Residential Management
                    </p>
                    <p className="text-sm text-blue-100">BTI School Management System</p>
                  </div>
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Housemaster / Housemistress
                  <span className="block bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                    Dashboard
                  </span>
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100/80 sm:text-base">
                  Welcome, {profile.full_name}. Monitor student residence, room
                  allocation, incidents and campus movement from one workspace.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-blue-100 backdrop-blur">
                  <i className="fa-solid fa-building-user mr-2 text-cyan-300" />
                  {houses} Active Houses
                </span>
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-blue-100 backdrop-blur">
                  <i className="fa-solid fa-door-open mr-2 text-cyan-300" />
                  {rooms} Rooms
                </span>
              </div>
            </div>
          </div>
        </section>

        <main className="relative z-10 -mt-10 px-4 pb-12 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-6"
                  style={{ animation: `fadeInUp .65s ease-out ${index * 80}ms both` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconClass} transition-transform duration-300 group-hover:scale-110`}>
                      <i className={stat.icon} />
                    </span>
                    <span className="text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {stat.label}
                    </span>
                  </div>
                  <p className="mt-5 text-3xl font-black text-slate-900">
                    {stat.value.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{stat.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Boarding</p>
                    <h2 className="mt-1 text-xl font-black text-slate-900">Occupancy Overview</h2>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <i className="fa-solid fa-building-circle-check" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Capacity', totalCapacity, 'fa-solid fa-bed'],
                    ['Allocated', activeAllocations, 'fa-solid fa-user-check'],
                    ['Available', availableSpaces, 'fa-solid fa-door-open'],
                    ['On Campus', onCampusBoarders, 'fa-solid fa-location-dot'],
                  ].map(([label, value, icon]) => (
                    <div key={String(label)} className="rounded-xl bg-slate-50 p-4">
                      <i className={`${icon} text-sm text-slate-400`} />
                      <p className="mt-3 text-2xl font-black text-slate-900">{Number(value).toLocaleString()}</p>
                      <p className="text-xs font-medium text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500">
                    <span>Room occupancy</span>
                    <span>{occupancy}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-700"
                      style={{ width: `${occupancy}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Campus Status</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Movement Snapshot</h2>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4">
                    <span className="text-sm font-semibold text-emerald-800">On Campus</span>
                    <span className="text-xl font-black text-emerald-700">{onCampusBoarders}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-cyan-50 p-4">
                    <span className="text-sm font-semibold text-cyan-800">Checked Out</span>
                    <span className="text-xl font-black text-cyan-700">{checkedOut}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4">
                    <span className="text-sm font-semibold text-amber-800">Residence Missing</span>
                    <span className="text-xl font-black text-amber-700">{unclassified}</span>
                  </div>
                </div>
              </div>
            </div>

            <section className="mt-9">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Quick Access</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">Residential Operations</h2>
                <p className="mt-1 text-sm text-slate-500">Open the most frequently used Housemaster / Housemistress tools.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {quickActions.map((action) => (
                  <Link key={action.href} href={action.href} className="group">
                    <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">
                      <div className="flex items-start justify-between">
                        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.className} transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
                          <i className={`${action.icon} text-lg`} />
                        </span>
                        <i className="fa-solid fa-arrow-right text-xs text-slate-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-blue-600" />
                      </div>
                      <h3 className="mt-5 font-bold text-slate-900">{action.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{action.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-9 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-rose-600">Student Welfare</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">Recent Incidents</h2>
                </div>
                <Link href="/housemaster/incidents" className="text-sm font-bold text-blue-600 hover:text-blue-700">
                  View all <i className="fa-solid fa-arrow-right ml-1 text-xs" />
                </Link>
              </div>

              {recentIncidents.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <i className="fa-solid fa-shield-heart text-xl" />
                  </div>
                  <h3 className="mt-4 font-bold text-slate-900">No incidents recorded</h3>
                  <p className="mt-1 text-sm text-slate-500">Recent incident activity will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentIncidents.map((incident) => {
                    const student = studentMap.get(incident.student_id);
                    return (
                      <div key={incident.id} className="flex flex-col gap-3 p-5 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                            <i className="fa-solid fa-triangle-exclamation" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900">{student?.full_name || 'Student'}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {student?.admission_number || 'No admission number'} · {incident.category}
                              {incident.location ? ` · ${incident.location}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pl-13 sm:pl-0">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${severityClass(incident.severity)}`}>
                            {incident.severity || 'Not set'}
                          </span>
                          <span className="text-xs font-medium text-slate-400">
                            {new Date(incident.incident_at).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-800">
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-circle-info mt-0.5 text-blue-600" />
                <div>
                  <p className="font-bold">Exiat module</p>
                  <p className="mt-1 leading-6 text-blue-700">
                    The Exiat menu is reserved, but its operational workflow has not been activated yet.
                    This prevents us from storing the wrong information before BTI&apos;s exact Exiat process is defined.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(18px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeInDown {
              from { opacity: 0; transform: translateY(-18px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes iconFloat {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-4px); }
            }
            @media (prefers-reduced-motion: reduce) {
              * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
            }
          `,
        }}
      />
    </>
  );
}

"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { matchesBoardingGender, useBoardingGender } from "@/components/boarding-gender-filter";

type Profile = {
  id: string;
  school_id: string;
  full_name: string;
  role: string;
  is_active: boolean | null;
};
type Student = {
  id: string;
  admission_number: string | null;
  full_name: string;
  resident: string | null;
  gender: string | null;
};
type Incident = {
  id: string;
  student_id: string;
  incident_at: string;
  category: string;
  location: string | null;
  description: string;
  immediate_action: string | null;
  follow_up_action: string | null;
  severity: string;
  status: string;
  is_confidential: boolean;
  reported_by: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

const supabase = createClient();
const field =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100";
const categories = [
  "Discipline",
  "Bullying",
  "Fighting",
  "Theft",
  "Property Damage",
  "Health / Safety",
  "Unauthorized Absence",
  "Substance Concern",
  "Residential Misconduct",
  "Other",
];

export default function IncidentsPage() {
  const router = useRouter();
  const genderScope = useBoardingGender();
  const [p, setP] = useState<Profile | null>(null),
    [students, setStudents] = useState<Student[]>([]),
    [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState("All");
  const [studentId, setStudentId] = useState(""),
    [studentSearch, setStudentSearch] = useState(""),
    [date, setDate] = useState(() => new Date().toISOString().slice(0, 16)),
    [category, setCategory] = useState("Discipline"),
    [location, setLocation] = useState(""),
    [description, setDescription] = useState(""),
    [immediate, setImmediate] = useState(""),
    [followup, setFollowup] = useState(""),
    [severity, setSeverity] = useState("Normal"),
    [confidential, setConfidential] = useState(false);

  async function load(school: string) {
    const [s, i] = await Promise.all([
      supabase
        .from("students")
      .select("id,admission_number,full_name,resident,gender")
        .eq("school_id", school)
        .eq("resident", "Boarding")
        .eq("status", "active")
        .order("full_name"),
      supabase
        .from("student_incidents")
        .select(
          "id,student_id,incident_at,category,location,description,immediate_action,follow_up_action,severity,status,is_confidential,reported_by,resolved_by,resolved_at,created_at,updated_at",
        )
        .eq("school_id", school)
        .order("incident_at", { ascending: false })
        .limit(400),
    ]);
    if (s.error || i.error)
      throw new Error(s.error?.message || i.error?.message);
    const boarders = (s.data || []) as Student[];
    const ids = new Set(boarders.map((x) => x.id));
    setStudents(boarders);
    setItems(
      ((i.data || []) as Incident[]).filter((x) => ids.has(x.student_id)),
    );
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: u } = await supabase
        .from("users")
        .select("id,school_id,full_name,role,is_active")
        .eq("id", user.id)
        .maybeSingle();
      if (
        !u ||
        u.is_active === false ||
        u.role !== "housemaster"
      ) {
        router.replace("/login");
        return;
      }
      setP(u as Profile);
      try {
        await load(u.school_id);
      } catch (e) {
        setMsg({
          ok: false,
          text:
            e instanceof Error
              ? e.message
              : "Unable to load Boarder incidents.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const scopedStudents = students.filter((student) => matchesBoardingGender(student.gender, genderScope));
  const scopedIds = new Set(scopedStudents.map((student) => student.id));
  const scopedItems = items.filter((item) => scopedIds.has(item.student_id));
  const sm = useMemo(() => new Map(scopedStudents.map((s) => [s.id, s])), [scopedStudents]);
  const candidates = scopedStudents
    .filter((s) =>
      `${s.full_name} ${s.admission_number || ""}`
        .toLowerCase()
        .includes(studentSearch.toLowerCase()),
    )
    .slice(0, 100);
  const filtered = scopedItems.filter((i) => {
    const s = sm.get(i.student_id);
    return (
      (statusFilter === "All" || i.status === statusFilter) &&
      `${s?.full_name || ""} ${s?.admission_number || ""} ${i.category} ${i.description} ${i.location || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  const open = scopedItems.filter((i) => i.status === "Open").length,
    review = scopedItems.filter((i) => i.status === "Under Review").length,
    critical = scopedItems.filter(
      (i) =>
        i.severity === "Critical" && !["Resolved", "Closed"].includes(i.status),
    ).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!p || !studentId || !description.trim()) return;
    setBusy(true);
    setMsg(null);
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      setMsg({ ok: false, text: "Enter a valid incident date and time." });
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("student_incidents")
      .insert({
        school_id: p.school_id,
        student_id: studentId,
        incident_at: d.toISOString(),
        category,
        location: location.trim() || null,
        description: description.trim(),
        immediate_action: immediate.trim() || null,
        follow_up_action: followup.trim() || null,
        severity,
        status: "Open",
        is_confidential: confidential,
        reported_by: p.id,
      });
    if (error) setMsg({ ok: false, text: error.message });
    else {
      setMsg({ ok: true, text: "Boarder incident recorded successfully." });
      setStudentId("");
      setStudentSearch("");
      setLocation("");
      setDescription("");
      setImmediate("");
      setFollowup("");
      setSeverity("Normal");
      setConfidential(false);
      await load(p.school_id);
    }
    setBusy(false);
  }
  async function changeStatus(i: Incident, status: string) {
    if (!p) return;
    setBusy(true);
    const resolved = status === "Resolved" || status === "Closed";
    const { error } = await supabase
      .from("student_incidents")
      .update({
        status,
        resolved_by: resolved ? p.id : null,
        resolved_at: resolved ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", i.id)
      .eq("school_id", p.school_id);
    if (error) setMsg({ ok: false, text: error.message });
    else {
      setMsg({ ok: true, text: `Incident marked ${status}.` });
      await load(p.school_id);
    }
    setBusy(false);
  }

  if (loading)
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto h-40 max-w-7xl animate-pulse rounded-3xl bg-slate-900" />
      </main>
    );
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      />
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
          <div className="absolute -right-20 -top-20 h-56 w-56 animate-pulse rounded-full bg-rose-500/10" />
          <div className="relative">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">
              <i className="fa-solid fa-triangle-exclamation mr-2 animate-pulse" />
              Boarder Welfare & Accountability
            </span>
            <h1 className="mt-4 text-2xl font-black sm:text-3xl">
              Incident Reports
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Record and follow up residential incidents for active Boarders
              only.
            </p>
          </div>
        </header>
        {msg && (
          <div
            className={`animate-[fadeInUp_.3s_ease-out] rounded-2xl border px-4 py-3 text-sm font-semibold ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}
          >
            <i
              className={`fa-solid ${msg.ok ? "fa-circle-check" : "fa-circle-exclamation"} mr-2`}
            />
            {msg.text}
          </div>
        )}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon="fa-clipboard-list"
            label="Boarder Incidents"
          value={scopedItems.length}
          />
          <Stat icon="fa-folder-open" label="Open" value={open} />
          <Stat
            icon="fa-magnifying-glass"
            label="Under Review"
            value={review}
          />
          <Stat icon="fa-bell" label="Critical Unresolved" value={critical} />
        </section>
        <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <form
            onSubmit={submit}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-5 xl:self-start"
          >
            <h2 className="font-black">
              <i className="fa-solid fa-file-circle-plus mr-2" />
              New Boarder Incident
            </h2>
            <div className="mt-5 space-y-4">
              <F label="Find Boarder">
                <input
                  className={field}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Name or admission number"
                />
              </F>
              <F label="Boarder *">
                <select
                  required
                  className={field}
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">Select Boarder</option>
                  {candidates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} — {s.admission_number || "No admission no."}
                    </option>
                  ))}
                </select>
              </F>
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Date & Time *">
                  <input
                    required
                    type="datetime-local"
                    className={field}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </F>
                <F label="Severity">
                  <select
                    className={field}
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                  >
                    {["Low", "Normal", "High", "Critical"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </F>
              </div>
              <F label="Category">
                <select
                  className={field}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </F>
              <F label="Location">
                <input
                  className={field}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Where did it occur?"
                />
              </F>
              <F label="Description *">
                <textarea
                  required
                  rows={4}
                  className={`${field} h-auto py-3`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </F>
              <F label="Immediate Action">
                <textarea
                  rows={3}
                  className={`${field} h-auto py-3`}
                  value={immediate}
                  onChange={(e) => setImmediate(e.target.value)}
                />
              </F>
              <F label="Follow-up">
                <textarea
                  rows={3}
                  className={`${field} h-auto py-3`}
                  value={followup}
                  onChange={(e) => setFollowup(e.target.value)}
                />
              </F>
              <label className="flex gap-3 rounded-xl border bg-slate-50 p-3 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={confidential}
                  onChange={(e) => setConfidential(e.target.checked)}
                />
                Confidential incident
              </label>
              <button
                disabled={busy}
                className="h-12 w-full rounded-xl bg-slate-900 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                <i
                  className={`fa-solid ${busy ? "fa-spinner animate-spin" : "fa-floppy-disk"} mr-2`}
                />
                {busy ? "Saving..." : "Record Incident"}
              </button>
            </div>
          </form>
          <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <div className="grid gap-3 md:grid-cols-[1fr_170px]">
                <input
                  className={field}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Boarder incident history..."
                />
                <select
                  className={field}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option>All</option>
                  <option>Open</option>
                  <option>Under Review</option>
                  <option>Resolved</option>
                  <option>Closed</option>
                </select>
              </div>
            </div>
            <div className="divide-y">
              {filtered.length ? (
                filtered.map((i) => {
                  const s = sm.get(i.student_id);
                  return (
                    <article
                      key={i.id}
                      className="p-5 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black">
                              {s?.full_name || "Boarder"}
                            </h3>
                            <Badge text={i.severity} />
                            <Badge text={i.status} />
                            {i.is_confidential && <Badge text="Confidential" />}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {s?.admission_number || "No ID"} ·{" "}
                            {new Date(i.incident_at).toLocaleString("en-GB")} ·{" "}
                            {i.category}
                          </p>
                        </div>
                        <select
                          disabled={busy}
                          value={i.status}
                          onChange={(e) => changeStatus(i, e.target.value)}
                          className="h-9 rounded-xl border bg-slate-50 px-2 text-xs font-bold"
                        >
                          <option>Open</option>
                          <option>Under Review</option>
                          <option>Resolved</option>
                          <option>Closed</option>
                        </select>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {i.description}
                      </p>
                    </article>
                  );
                })
              ) : (
                <div className="p-12 text-center text-sm text-slate-500">
                  <i className="fa-solid fa-circle-check mr-2 text-emerald-500" />
                  No Boarder incidents match this view.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
function Stat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="group rounded-2xl border bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 transition-transform group-hover:scale-110">
        <i className={`fa-solid ${icon}`} />
      </span>
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}
function Badge({ text }: { text: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
      {text}
    </span>
  );
}

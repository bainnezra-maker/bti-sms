"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { matchesBoardingGender, useBoardingGender } from "@/components/boarding-gender-filter";
type P = {
  id: string;
  school_id: string;
  full_name: string;
  role: string;
  is_active: boolean | null;
};
type S = {
  id: string;
  admission_number: string | null;
  full_name: string;
  guardian_phone: string | null;
  gender: string | null;
};
type Y = {
  id: string;
  name: string;
  start_date: string;
  is_current: boolean | null;
};
type T = {
  id: string;
  academic_year_id: string;
  name: string;
  is_current: boolean | null;
};
type X = {
  id: string;
  student_id: string;
  academic_year_id: string;
  term_id: string | null;
  term: string | null;
  reason: string;
  destination: string | null;
  departure_at: string;
  expected_return_at: string;
  returned_at: string | null;
  guardian_contact: string | null;
  status: string;
  authorized_by: string | null;
  processed_by: string;
  remarks: string | null;
};
const sb = createClient(),
  f =
    "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none transition focus:bg-white focus:ring-4 focus:ring-slate-100";
export default function Exiat() {
  const router = useRouter();
  const genderScope = useBoardingGender();
  const [p, setP] = useState<P | null>(null),
    [ss, setSs] = useState<S[]>([]),
    [ys, setYs] = useState<Y[]>([]),
    [ts, setTs] = useState<T[]>([]),
    [xs, setXs] = useState<X[]>([]),
    [year, setYear] = useState(""),
    [termId, setTermId] = useState(""),
    [term, setTerm] = useState("Semester 1"),
    [student, setStudent] = useState(""),
    [find, setFind] = useState(""),
    [reason, setReason] = useState(""),
    [dest, setDest] = useState(""),
    [depart, setDepart] = useState(() => new Date().toISOString().slice(0, 16)),
    [expected, setExpected] = useState(""),
    [guardian, setGuardian] = useState(""),
    [remarks, setRemarks] = useState(""),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function load(school: string) {
    const [a, b, c, d] = await Promise.all([
      sb
        .from("students")
        .select("id,admission_number,full_name,guardian_phone,gender")
        .eq("school_id", school)
        .eq("resident", "Boarding")
        .eq("status", "active")
        .order("full_name"),
      sb
        .from("academic_years")
        .select("id,name,start_date,is_current")
        .eq("school_id", school)
        .order("start_date", { ascending: false }),
      sb.from("terms").select("id,academic_year_id,name,is_current"),
      sb
        .from("student_exiats")
        .select("*")
        .eq("school_id", school)
        .order("departure_at", { ascending: false })
        .limit(500),
    ]);
    if (a.error || b.error || c.error || d.error)
      throw new Error(
        a.error?.message ||
          b.error?.message ||
          c.error?.message ||
          d.error?.message,
      );
    const boarders = (a.data || []) as S[];
    const ids = new Set(boarders.map((x) => x.id));
    setSs(boarders);
    setYs((b.data || []) as Y[]);
    setTs((c.data || []) as T[]);
    setXs(((d.data || []) as X[]).filter((x) => ids.has(x.student_id)));
    const cy =
      (b.data || []).find((x: any) => x.is_current) || (b.data || [])[0];
    if (cy && !year) setYear(cy.id);
  }
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: u } = await sb
        .from("users")
        .select("id,school_id,full_name,role,is_active")
        .eq("id", user.id)
        .maybeSingle();
      if (
        !u ||
        u.is_active === false ||
        !["housemaster", "admin"].includes(u.role)
      ) {
        router.replace("/login");
        return;
      }
      setP(u as P);
      try {
        await load(u.school_id);
      } catch (e) {
        setMsg({
          ok: false,
          text: e instanceof Error ? e.message : "Unable to load Exiat.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);
  const yt = useMemo(
    () => ts.filter((t) => t.academic_year_id === year),
    [ts, year],
  );
  useEffect(() => {
    const x = yt.find((t) => t.is_current) || yt[0];
    setTermId(x?.id || "");
    if (x) setTerm(x.name);
  }, [year, yt.length]);
  const scopedStudents = ss.filter((student) => matchesBoardingGender(student.gender, genderScope));
  const scopedIds = new Set(scopedStudents.map((student) => student.id));
  const scopedExiats = xs.filter((item) => scopedIds.has(item.student_id));
  const sm = useMemo(() => new Map(scopedStudents.map((s) => [s.id, s])), [scopedStudents]),
    outIds = new Set(
      scopedExiats.filter((x) => x.status === "Out").map((x) => x.student_id),
    ),
    candidates = scopedStudents
      .filter(
        (s) =>
          !outIds.has(s.id) &&
          `${s.full_name} ${s.admission_number || ""}`
            .toLowerCase()
            .includes(find.toLowerCase()),
      )
      .slice(0, 100),
    out = scopedExiats.filter((x) => x.status === "Out"),
    overdue = out.filter((x) => new Date(x.expected_return_at) < new Date()),
    rows = scopedExiats.filter((x) => {
      const s = sm.get(x.student_id);
      return `${s?.full_name || ""} ${s?.admission_number || ""} ${x.reason} ${x.destination || ""} ${x.status}`
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  function choose(id: string) {
    setStudent(id);
    setGuardian(sm.get(id)?.guardian_phone || "");
  }
  async function issue(e: FormEvent) {
    e.preventDefault();
    if (!p || !student || !year || !reason.trim() || !expected) return;
    setBusy(true);
    setMsg(null);
    const a = new Date(depart),
      b = new Date(expected);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) {
      setMsg({
        ok: false,
        text: "Expected return must be after departure time.",
      });
      setBusy(false);
      return;
    }
    const { error } = await sb
      .from("student_exiats")
      .insert({
        school_id: p.school_id,
        student_id: student,
        academic_year_id: year,
        term_id: termId || null,
        term,
        reason: reason.trim(),
        destination: dest.trim() || null,
        departure_at: a.toISOString(),
        expected_return_at: b.toISOString(),
        guardian_contact: guardian.trim() || null,
        status: "Out",
        authorized_by: p.id,
        processed_by: p.id,
        remarks: remarks.trim() || null,
      });
    if (error) setMsg({ ok: false, text: error.message });
    else {
      setMsg({
        ok: true,
        text: "Boarder Exiat issued and departure recorded.",
      });
      setStudent("");
      setFind("");
      setReason("");
      setDest("");
      setExpected("");
      setGuardian("");
      setRemarks("");
      await load(p.school_id);
    }
    setBusy(false);
  }
  async function returned(x: X) {
    if (!p || !confirm("Confirm this Boarder has returned to campus?")) return;
    setBusy(true);
    const { error } = await sb
      .from("student_exiats")
      .update({
        status: "Returned",
        returned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", x.id)
      .eq("school_id", p.school_id);
    if (error) setMsg({ ok: false, text: error.message });
    else {
      setMsg({ ok: true, text: "Boarder return recorded. Exiat closed." });
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
          <div className="absolute -right-20 -top-20 h-56 w-56 animate-pulse rounded-full bg-amber-400/10" />
          <span className="relative rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">
            <i className="fa-solid fa-person-walking-arrow-right mr-2 animate-pulse" />
            Boarders Only · Temporary Leave
          </span>
          <h1 className="relative mt-4 text-2xl font-black sm:text-3xl">
            Exiat
          </h1>
          <p className="relative mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Authorize temporary leave, track expected return and record return
            to campus for active Boarders only.
          </p>
        </header>
        {msg && (
          <div
            className={`animate-[fadeInUp_.3s_ease-out] rounded-2xl border p-3 text-sm font-semibold ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}
          >
            <i
              className={`fa-solid ${msg.ok ? "fa-circle-check" : "fa-circle-exclamation"} mr-2`}
            />
            {msg.text}
          </div>
        )}
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat
            i="fa-person-walking-arrow-right"
            l="Currently on Exiat"
            n={out.length}
          />
          <Stat i="fa-clock" l="Overdue Returns" n={overdue.length} />
          <Stat
            i="fa-clock-rotate-left"
            l="Boarder Exiat Records"
            n={scopedExiats.length}
          />
        </section>
        <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <form
            onSubmit={issue}
            className="rounded-3xl border bg-white p-5 shadow-sm xl:sticky xl:top-5 xl:self-start"
          >
            <h2 className="font-black">
              <i className="fa-solid fa-file-signature mr-2" />
              Issue Boarder Exiat
            </h2>
            <div className="mt-5 space-y-4">
              <F l="Academic Year">
                <select
                  className={f}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  {ys.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </F>
              <F l="Semester">
                {yt.length ? (
                  <select
                    className={f}
                    value={termId}
                    onChange={(e) => {
                      setTermId(e.target.value);
                      setTerm(
                        yt.find((t) => t.id === e.target.value)?.name || "",
                      );
                    }}
                  >
                    {yt.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    className={f}
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  >
                    <option>Semester 1</option>
                    <option>Semester 2</option>
                  </select>
                )}
              </F>
              <F l="Find Boarder">
                <input
                  className={f}
                  value={find}
                  onChange={(e) => setFind(e.target.value)}
                  placeholder="Name or admission number"
                />
              </F>
              <F l="Boarder *">
                <select
                  required
                  className={f}
                  value={student}
                  onChange={(e) => choose(e.target.value)}
                >
                  <option value="">Select Boarder</option>
                  {candidates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} — {s.admission_number || "No ID"}
                    </option>
                  ))}
                </select>
              </F>
              <F l="Reason *">
                <textarea
                  required
                  rows={3}
                  className={`${f} h-auto py-3`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </F>
              <F l="Destination">
                <input
                  className={f}
                  value={dest}
                  onChange={(e) => setDest(e.target.value)}
                />
              </F>
              <div className="grid gap-3 sm:grid-cols-2">
                <F l="Departure *">
                  <input
                    required
                    type="datetime-local"
                    className={f}
                    value={depart}
                    onChange={(e) => setDepart(e.target.value)}
                  />
                </F>
                <F l="Expected Return *">
                  <input
                    required
                    type="datetime-local"
                    className={f}
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                  />
                </F>
              </div>
              <F l="Guardian Contact">
                <input
                  className={f}
                  value={guardian}
                  onChange={(e) => setGuardian(e.target.value)}
                />
              </F>
              <F l="Remarks">
                <textarea
                  rows={2}
                  className={`${f} h-auto py-3`}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </F>
              <button
                disabled={busy}
                className="h-12 w-full rounded-xl bg-slate-900 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                <i
                  className={`fa-solid ${busy ? "fa-spinner animate-spin" : "fa-stamp"} mr-2`}
                />
                {busy ? "Processing..." : "Authorize & Record Departure"}
              </button>
            </div>
          </form>
          <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="font-black">Boarder Exiat Register</h2>
              <input
                className={`${f} mt-3`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Boarder Exiat records..."
              />
            </div>
            <div className="divide-y">
              {rows.length ? (
                rows.map((x) => {
                  const s = sm.get(x.student_id),
                    late =
                      x.status === "Out" &&
                      new Date(x.expected_return_at) < new Date();
                  return (
                    <article
                      key={x.id}
                      className="p-5 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black">
                              {s?.full_name || "Boarder"}
                            </h3>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">
                              {x.status}
                            </span>
                            {late && (
                              <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">
                                Overdue
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {s?.admission_number || "No ID"} · Boarder
                          </p>
                          <p className="mt-3 text-sm font-semibold">
                            {x.reason}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            {x.destination
                              ? `Destination: ${x.destination} · `
                              : ""}
                            Left:{" "}
                            {new Date(x.departure_at).toLocaleString("en-GB")} ·
                            Expected:{" "}
                            {new Date(x.expected_return_at).toLocaleString(
                              "en-GB",
                            )}
                            {x.returned_at
                              ? ` · Returned: ${new Date(x.returned_at).toLocaleString("en-GB")}`
                              : ""}
                          </p>
                        </div>
                        {x.status === "Out" && (
                          <button
                            disabled={busy}
                            onClick={() => returned(x)}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white transition hover:-translate-y-0.5"
                          >
                            <i className="fa-solid fa-person-circle-check mr-2" />
                            Record Return
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="p-12 text-center text-sm text-slate-500">
                  <i className="fa-solid fa-circle-check mr-2 text-emerald-500" />
                  No Boarder Exiat records found.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
function Stat({ i, l, n }: { i: string; l: string; n: number }) {
  return (
    <div className="group rounded-2xl border bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <i
        className={`fa-solid ${i} text-slate-400 transition-transform group-hover:scale-125`}
      />
      <div className="mt-2 text-2xl font-black">{n}</div>
      <span className="text-xs font-bold text-slate-500">{l}</span>
    </div>
  );
}
function F({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{l}</span>
      {children}
    </label>
  );
}

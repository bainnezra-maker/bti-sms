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
  photo_url: string | null;
  resident: string | null;
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
type C = {
  id: string;
  student_id: string;
  academic_year_id: string;
  term_id: string | null;
  term: string | null;
  checkout_type: string;
  checkout_at: string;
  destination: string | null;
  expected_return_at: string | null;
  returned_at: string | null;
  status: string;
  authorized_by: string | null;
  processed_by: string;
  remarks: string | null;
};
const sb = createClient(),
  cls =
    "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100";
export default function CheckoutPage() {
  const router = useRouter();
  const genderScope = useBoardingGender();
  const [p, setP] = useState<P | null>(null),
    [ss, setSs] = useState<S[]>([]),
    [ys, setYs] = useState<Y[]>([]),
    [ts, setTs] = useState<T[]>([]),
    [cs, setCs] = useState<C[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null),
    [year, setYear] = useState(""),
    [termId, setTermId] = useState(""),
    [term, setTerm] = useState("Semester 1"),
    [search, setSearch] = useState("");
  const [student, setStudent] = useState(""),
    [studentSearch, setStudentSearch] = useState(""),
    [type, setType] = useState("Vacation"),
    [outAt, setOutAt] = useState(() => new Date().toISOString().slice(0, 16)),
    [destination, setDestination] = useState(""),
    [expected, setExpected] = useState(""),
    [remarks, setRemarks] = useState("");
  async function load(school: string) {
    const [a, b, c, d] = await Promise.all([
      sb
        .from("students")
        .select("id,admission_number,full_name,photo_url,resident,gender")
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
        .from("student_checkouts")
        .select(
          "id,student_id,academic_year_id,term_id,term,checkout_type,checkout_at,destination,expected_return_at,returned_at,status,authorized_by,processed_by,remarks",
        )
        .eq("school_id", school)
        .order("checkout_at", { ascending: false })
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
    setCs(((d.data || []) as C[]).filter((x) => ids.has(x.student_id)));
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
          text:
            e instanceof Error ? e.message : "Unable to load checkout records.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);
  const yearTerms = useMemo(
    () => ts.filter((t) => t.academic_year_id === year),
    [ts, year],
  );
  useEffect(() => {
    const x = yearTerms.find((t) => t.is_current) || yearTerms[0];
    setTermId(x?.id || "");
    if (x) setTerm(x.name);
  }, [year, yearTerms.length]);
  const scopedStudents = ss.filter((student) => matchesBoardingGender(student.gender, genderScope));
  const scopedIds = new Set(scopedStudents.map((student) => student.id));
  const scopedCheckouts = cs.filter((item) => scopedIds.has(item.student_id));
  const sm = useMemo(() => new Map(scopedStudents.map((s) => [s.id, s])), [scopedStudents]),
    away = scopedCheckouts.filter((c) => c.status === "Checked Out"),
    awayIds = new Set(away.map((c) => c.student_id)),
    candidates = scopedStudents
      .filter(
        (s) =>
          !awayIds.has(s.id) &&
          `${s.full_name} ${s.admission_number || ""}`
            .toLowerCase()
            .includes(studentSearch.toLowerCase()),
      )
      .slice(0, 120);
  const overdue = away.filter(
      (c) =>
        c.expected_return_at && new Date(c.expected_return_at) < new Date(),
    ).length,
    history = scopedCheckouts.filter((c) => {
      const s = sm.get(c.student_id);
      return `${s?.full_name || ""} ${s?.admission_number || ""} ${c.destination || ""} ${c.checkout_type} ${c.status}`
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  async function checkout(e: FormEvent) {
    e.preventDefault();
    if (!p || !student || !year) return;
    setBusy(true);
    setMsg(null);
    if (awayIds.has(student)) {
      setMsg({ ok: false, text: "This Boarder is already checked out." });
      setBusy(false);
      return;
    }
    const o = new Date(outAt),
      er = expected ? new Date(expected) : null;
    if (
      Number.isNaN(o.getTime()) ||
      (er && Number.isNaN(er.getTime())) ||
      (er && er <= o)
    ) {
      setMsg({
        ok: false,
        text: "Enter valid dates. Expected return must be after checkout.",
      });
      setBusy(false);
      return;
    }
    const { error } = await sb
      .from("student_checkouts")
      .insert({
        school_id: p.school_id,
        student_id: student,
        academic_year_id: year,
        term_id: termId || null,
        term,
        checkout_type: type,
        checkout_at: o.toISOString(),
        destination: destination.trim() || null,
        expected_return_at: er?.toISOString() || null,
        status: "Checked Out",
        authorized_by: p.id,
        processed_by: p.id,
        remarks: remarks.trim() || null,
      });
    if (error) setMsg({ ok: false, text: error.message });
    else {
      setMsg({ ok: true, text: "Boarder checked out successfully." });
      setStudent("");
      setStudentSearch("");
      setDestination("");
      setExpected("");
      setRemarks("");
      await load(p.school_id);
    }
    setBusy(false);
  }
  async function checkin(c: C) {
    if (!p || !confirm("Confirm that this Boarder has returned to campus?"))
      return;
    setBusy(true);
    const { error } = await sb
      .from("student_checkouts")
      .update({
        status: "Returned",
        returned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.id)
      .eq("school_id", p.school_id);
    if (error) setMsg({ ok: false, text: error.message });
    else {
      setMsg({ ok: true, text: "Boarder return recorded successfully." });
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
          <div className="absolute -right-20 -top-20 h-56 w-56 animate-pulse rounded-full bg-cyan-400/10" />
          <span className="relative rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">
            <i className="fa-solid fa-suitcase-rolling mr-2" />
            Boarder Movement
          </span>
          <h1 className="relative mt-4 text-2xl font-black sm:text-3xl">
            Checkout / Vacation
          </h1>
          <p className="relative mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Track Boarders leaving campus, their destinations, expected returns
            and actual returns.
          </p>
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
          <Stat icon="fa-users" label="Boarders" n={scopedStudents.length} />
          <Stat
            icon="fa-person-walking-arrow-right"
            label="Currently Away"
            n={away.length}
          />
          <Stat
            icon="fa-house-circle-check"
            label="On Campus"
            n={Math.max(0, scopedStudents.length - away.length)}
          />
          <Stat icon="fa-clock" label="Overdue Returns" n={overdue} />
        </section>
        <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <form
            onSubmit={checkout}
            className="rounded-3xl border bg-white p-5 shadow-sm xl:sticky xl:top-5 xl:self-start"
          >
            <h2 className="font-black">
              <i className="fa-solid fa-right-from-bracket mr-2" />
              Process Boarder Checkout
            </h2>
            <div className="mt-5 space-y-4">
              <F l="Academic Year">
                <select
                  className={cls}
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
                {yearTerms.length ? (
                  <select
                    className={cls}
                    value={termId}
                    onChange={(e) => {
                      setTermId(e.target.value);
                      setTerm(
                        yearTerms.find((t) => t.id === e.target.value)?.name ||
                          "",
                      );
                    }}
                  >
                    {yearTerms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    className={cls}
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
                  className={cls}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Name or admission no."
                />
              </F>
              <F l="Boarder *">
                <select
                  required
                  className={cls}
                  value={student}
                  onChange={(e) => setStudent(e.target.value)}
                >
                  <option value="">Select Boarder</option>
                  {candidates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} — {s.admission_number || "No admission no."}
                    </option>
                  ))}
                </select>
              </F>
              <F l="Checkout Type">
                <select
                  className={cls}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {[
                    "Vacation",
                    "Weekend",
                    "Medical",
                    "Family",
                    "Official",
                    "Other",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </F>
              <F l="Checkout Date & Time">
                <input
                  required
                  type="datetime-local"
                  className={cls}
                  value={outAt}
                  onChange={(e) => setOutAt(e.target.value)}
                />
              </F>
              <F l="Destination">
                <input
                  className={cls}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </F>
              <F l="Expected Return">
                <input
                  type="datetime-local"
                  className={cls}
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                />
              </F>
              <F l="Remarks">
                <textarea
                  rows={3}
                  className={`${cls} h-auto py-3`}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </F>
              <button
                disabled={busy}
                className="h-12 w-full rounded-xl bg-slate-900 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                <i
                  className={`fa-solid ${busy ? "fa-spinner animate-spin" : "fa-right-from-bracket"} mr-2`}
                />
                {busy ? "Processing..." : "Check Boarder Out"}
              </button>
            </div>
          </form>
          <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="font-black">Boarder Movement Register</h2>
              <input
                className={`${cls} mt-3`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Boarder, destination, type or status..."
              />
            </div>
            <div className="divide-y">
              {history.length ? (
                history.map((c) => {
                  const s = sm.get(c.student_id),
                    late =
                      c.status === "Checked Out" &&
                      !!c.expected_return_at &&
                      new Date(c.expected_return_at) < new Date();
                  return (
                    <article
                      key={c.id}
                      className="p-5 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-2">
                            <h3 className="font-black">
                              {s?.full_name || "Boarder"}
                            </h3>
                            <B t={c.status} />
                            {late && <B t="Overdue" />}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {s?.admission_number || "No ID"} · {c.checkout_type}{" "}
                            · {new Date(c.checkout_at).toLocaleString("en-GB")}
                          </p>
                          <p className="mt-2 text-xs text-slate-600">
                            {c.destination || "Destination not recorded"}
                            {c.expected_return_at
                              ? ` · Expected: ${new Date(c.expected_return_at).toLocaleString("en-GB")}`
                              : ""}
                            {c.returned_at
                              ? ` · Returned: ${new Date(c.returned_at).toLocaleString("en-GB")}`
                              : ""}
                          </p>
                        </div>
                        {c.status === "Checked Out" && (
                          <button
                            disabled={busy}
                            onClick={() => checkin(c)}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white transition hover:-translate-y-0.5"
                          >
                            <i className="fa-solid fa-house-circle-check mr-2" />
                            Record Return
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="p-12 text-center text-sm text-slate-500">
                  No Boarder checkout records match this view.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
function Stat({ icon, label, n }: { icon: string; label: string; n: number }) {
  return (
    <div className="group rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 transition-transform group-hover:scale-110">
        <i className={`fa-solid ${icon}`} />
      </span>
      <p className="mt-3 text-xl font-black">{n}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
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
function B({ t }: { t: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
      {t}
    </span>
  );
}

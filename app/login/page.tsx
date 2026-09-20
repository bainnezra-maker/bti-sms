'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type LoginMode = 'admin' | 'teacher' | 'student' | 'housemaster';

export default function LoginPage() {
  const [loginMode, setLoginMode] = useState<LoginMode>('admin');

  const [email, setEmail] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  function changeLoginMode(mode: LoginMode) {
    if (loading) return;

    setLoginMode(mode);
    setError('');
    setEmail('');
    setAdmissionNumber('');
    setPassword('');
    setShowPassword(false);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();

    setError('');

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (loginMode === 'student' && !admissionNumber.trim()) {
      setError('Please enter your admission number.');
      return;
    }

    if (loginMode !== 'student' && !email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);

    /*
     * ============================================================
     * STUDENT LOGIN
     * ============================================================
     *
     * Students do not enter their email address.
     *
     * The server securely converts the admission number into
     * the linked Supabase Auth account and verifies the password.
     */
    if (loginMode === 'student') {
      try {
        const response = await fetch('/api/student-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            admissionNumber: admissionNumber.trim().toUpperCase(),
            password,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setLoading(false);
          setError(
            result?.error ||
              'Unable to sign in. Please check your admission number and password.'
          );
          return;
        }

        if (!result?.access_token || !result?.refresh_token) {
          setLoading(false);
          setError(
            'Unable to establish your student session. Please try again.'
          );
          return;
        }

        const { error: sessionError } =
          await supabase.auth.setSession({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
          });

        if (sessionError) {
          setLoading(false);
          setError(
            'Your account was verified, but we could not establish your session. Please try again.'
          );
          return;
        }

        /*
         * Confirm the authenticated user is actually a Student
         * account linked to a student record.
         */
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select(
            'id, full_name, email, role, is_active, school_id, student_id'
          )
          .eq('id', result.user_id)
          .maybeSingle();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          setLoading(false);
          setError(
            'We could not load your student profile. Please contact the administrator.'
          );
          return;
        }

        if (
          profile.role !== 'Student' ||
          profile.is_active === false ||
          !profile.student_id
        ) {
          await supabase.auth.signOut();
          setLoading(false);
          setError(
            'Your account is not configured as an active student account.'
          );
          return;
        }

        router.replace('/student');
        return;
      } catch (studentLoginError) {
        console.error('Student login error:', studentLoginError);

        setLoading(false);
        setError(
          'Unable to connect to the student login service. Please try again.'
        );
        return;
      }
    }

    /*
     * ============================================================
     * ADMINISTRATOR / TEACHER LOGIN
     * ============================================================
     *
     * These accounts continue using normal Supabase email/password
     * authentication.
     */
    const { data: authData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (signInError) {
      setLoading(false);
      setError('Invalid email or password.');
      return;
    }

    if (!authData.user) {
      setLoading(false);
      setError('Unable to identify your account. Please try again.');
      return;
    }

    /*
     * Load the user's BTI-SMS profile.
     */
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(
        'id, full_name, email, role, is_active, school_id, student_id'
      )
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        'We could not load your school profile. Please contact the administrator.'
      );
      return;
    }

    if (!profile) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        'Your account has not been registered in BIRITECH SMS.'
      );
      return;
    }

    /*
     * Inactive accounts are not allowed into the system.
     */
    if (profile.is_active === false) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        'Your account is currently inactive. Please contact the administrator.'
      );
      return;
    }

    /*
     * Administrator.
     */
    if (profile.role === 'admin' || profile.role === 'owner') {
      if (loginMode !== 'admin') { await supabase.auth.signOut(); setLoading(false); setError('Please use the Administrator login option.'); return; }
      router.replace('/'); return;
    }

    /*
     * Teacher.
     */
    if (profile.role === 'teacher') {
      if (loginMode !== 'teacher') { await supabase.auth.signOut(); setLoading(false); setError('Please use the Teacher login option.'); return; }
      router.replace('/teacher'); return;
    }

    if (profile.role === 'housemaster') {
      if (loginMode !== 'housemaster') { await supabase.auth.signOut(); setLoading(false); setError('Please use the Housemaster / Housemistress login option.'); return; }
      router.replace('/housemaster'); return;
    }

    /*
     * Student accounts should use the Student login option.
     */
    if (profile.role === 'Student') {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        'Please use the Student login option with your admission number.'
      );
      return;
    }

    /*
     * Staff and all other roles are denied access.
     */
    await supabase.auth.signOut();

    setLoading(false);

    setError(
      'Your account does not have a valid BIRITECH SMS login role. Please contact the administrator.'
    );
  }

  const isStudent = loginMode === 'student';
  const isHousemaster = loginMode === 'housemaster';

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* ========================================================= */}
      {/* FONT AWESOME */}
      {/* ========================================================= */}

      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      />

      {/* ========================================================= */}
      {/* ANIMATED BACKGROUND */}
      {/* ========================================================= */}

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />

        <div className="absolute -left-32 -top-32 h-96 w-96 animate-[float_8s_ease-in-out_infinite] rounded-full bg-blue-500/10 blur-3xl" />

        <div className="absolute -bottom-40 -right-40 h-[30rem] w-[30rem] animate-[floatReverse_10s_ease-in-out_infinite] rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-slate-500/5 blur-3xl" />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        <div className="absolute left-[10%] top-[18%] h-3 w-3 animate-[pulse_4s_ease-in-out_infinite] rounded-full bg-white/20" />

        <div className="absolute right-[15%] top-[25%] h-2 w-2 animate-[pulse_3s_ease-in-out_infinite] rounded-full bg-white/30" />

        <div className="absolute bottom-[20%] left-[18%] h-2 w-2 animate-[pulse_5s_ease-in-out_infinite] rounded-full bg-white/20" />

        <div className="absolute bottom-[15%] right-[25%] h-3 w-3 animate-[pulse_4s_ease-in-out_infinite] rounded-full bg-white/20" />
      </div>

      {/* ========================================================= */}
      {/* PAGE CONTENT */}
      {/* ========================================================= */}

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md animate-[loginEnter_0.7s_ease-out]">

          {/* ===================================================== */}
          {/* BRAND */}
          {/* ===================================================== */}

          <div className="mb-7 text-center">
            <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-amber-400 bg-white shadow-2xl shadow-black/30">
              <img
                src="/biritech-logo.png"
                alt="Biriwa Technical Institute crest"
                className="bti-brand-icon h-full w-full scale-[1.08] object-cover"
              />
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Biriwa Technical Institute
            </h1>

            <p className="mt-2 text-sm font-medium text-slate-400">
              BIRITECH SMS
            </p>
          </div>

          {/* ===================================================== */}
          {/* LOGIN CARD */}
          {/* ===================================================== */}

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.97] shadow-2xl shadow-black/30">

            {/* Card Header */}
            <div className="border-b border-slate-100 px-6 pb-5 pt-7 sm:px-8">
              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
                  <i
                    className={`bti-header-icon ${
                      isStudent
                        ? 'fa-solid fa-graduation-cap'
                        : loginMode === 'teacher'
                          ? 'fa-solid fa-chalkboard-user'
                          : isHousemaster
                            ? 'fa-solid fa-house-user'
                            : 'fa-solid fa-user-shield'
                    }`}
                  />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {isStudent
                      ? 'Student Portal'
                      : loginMode === 'teacher'
                        ? 'Teacher Portal'
                        : isHousemaster
                          ? 'Housemaster / Housemistress Portal'
                          : 'Administrator Portal'}
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Sign in to continue to your account
                  </p>
                </div>

              </div>
            </div>

            {/* ================================================= */}
            {/* PORTAL SELECTOR */}
            {/* ================================================= */}

            <div className="border-b border-slate-100 px-6 pt-5 sm:px-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                Select your portal
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => changeLoginMode('admin')}
                  aria-pressed={loginMode === 'admin'}
                  disabled={loading}
                  className={`bti-portal-button flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-bold transition-all duration-300 hover:-translate-y-0.5 ${
                    loginMode === 'admin'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-user-shield text-base" />
                  <span>Administrator</span>
                </button>

                <button
                  type="button"
                  onClick={() => changeLoginMode('teacher')}
                  aria-pressed={loginMode === 'teacher'}
                  disabled={loading}
                  className={`bti-portal-button flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-bold transition-all duration-300 hover:-translate-y-0.5 ${
                    loginMode === 'teacher'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-chalkboard-user text-base" />
                  <span>Teacher</span>
                </button>

                <button
                  type="button"
                  onClick={() => changeLoginMode('student')}
                  aria-pressed={loginMode === 'student'}
                  disabled={loading}
                  className={`bti-portal-button flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-bold transition-all duration-300 hover:-translate-y-0.5 ${
                    loginMode === 'student'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-graduation-cap text-base" />
                  <span>Student</span>
                </button>

                <button
                  type="button"
                  onClick={() => changeLoginMode('housemaster')}
                  aria-pressed={loginMode === 'housemaster'}
                  disabled={loading}
                  className={`bti-portal-button flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-bold transition-all duration-300 hover:-translate-y-0.5 ${
                    loginMode === 'housemaster'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-house-user text-base" />
                  <span className="text-center leading-4">Housemaster / Housemistress</span>
                </button>
              </div>
            </div>

            {/* ================================================= */}
            {/* FORM */}
            {/* ================================================= */}

            <form
              onSubmit={handleSignIn}
              className="space-y-5 px-6 py-6 sm:px-8 sm:py-7"
            >

              {/* ================================================= */}
              {/* ADMIN / TEACHER EMAIL */}
              {/* ================================================= */}

              {!isStudent && (
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Email Address
                  </label>

                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400 transition-colors duration-200 group-focus-within:text-slate-900">
                      <i className="fa-solid fa-envelope text-sm" />
                    </div>

                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder={
                        loginMode === 'teacher'
                          ? 'teacher@bti.edu.gh'
                          : loginMode === 'housemaster'
                            ? 'housemaster@bti.edu.gh'
                            : 'admin@bti.edu.gh'
                      }
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      disabled={loading}
                      className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-medium text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/5 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>
              )}

              {/* ================================================= */}
              {/* STUDENT ADMISSION NUMBER */}
              {/* ================================================= */}

              {isStudent && (
                <div>
                  <label
                    htmlFor="admissionNumber"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Admission Number
                  </label>

                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400 transition-colors duration-200 group-focus-within:text-slate-900">
                      <i className="fa-solid fa-id-card text-sm" />
                    </div>

                    <input
                      id="admissionNumber"
                      type="text"
                      autoComplete="username"
                      placeholder="e.g. BTI/2026/0002"
                      value={admissionNumber}
                      onChange={(e) => {
                        setAdmissionNumber(e.target.value.toUpperCase());
                        setError('');
                      }}
                      disabled={loading}
                      className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-medium uppercase tracking-wide text-slate-900 outline-none transition-all duration-200 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/5 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    Use the admission number issued by Biriwa Technical Institute.
                  </p>
                </div>
              )}

              {/* ================================================= */}
              {/* PASSWORD */}
              {/* ================================================= */}

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>

                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400 transition-colors duration-200 group-focus-within:text-slate-900">
                    <i className="fa-solid fa-lock text-sm" />
                  </div>

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    disabled={loading}
                    className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-12 text-sm font-medium text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-900 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((visible) => !visible)
                    }
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <i
                      className={
                        showPassword
                          ? 'fa-solid fa-eye-slash'
                          : 'fa-solid fa-eye'
                      }
                    />
                  </button>
                </div>
              </div>

              {/* ================================================= */}
              {/* ERROR */}
              {/* ================================================= */}

              {error && (
                <div className="flex animate-[errorShake_0.35s_ease-out] items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100">
                    <i className="fa-solid fa-circle-exclamation text-xs" />
                  </div>

                  <p className="leading-6">
                    {error}
                  </p>
                </div>
              )}

              {/* ================================================= */}
              {/* SIGN IN BUTTON */}
              {/* ================================================= */}

              <button
                type="submit"
                disabled={loading}
                className="group relative flex h-13 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/25 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                {loading ? (
                  <span className="relative flex items-center gap-3">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <span className="relative flex items-center gap-3">
                    <span>Sign In</span>
                    <i className="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                )}
              </button>

              {/* ================================================= */}
              {/* LOGIN HELP */}
              {/* ================================================= */}

              <div className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-400">
                <i className="fa-solid fa-shield-halved text-slate-400" />

                <span>
                  {isStudent
                    ? 'Secure access to your BTI student portal'
                    : 'Secure access to the BTI management portal'}
                </span>
              </div>
            </form>
          </div>

          {/* ===================================================== */}
          {/* FOOTER */}
          {/* ===================================================== */}

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} Biriwa Technical Institute
            </p>

            <p className="mt-1 text-[11px] text-slate-600">
              BIRITECH SMS
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ANIMATION STYLES */}
      {/* ========================================================= */}

      <style jsx global>{`
        @keyframes loginEnter {
          from {
            opacity: 0;
            transform: translateY(25px) scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translate(0, 0);
          }

          50% {
            transform: translate(25px, 20px);
          }
        }

        @keyframes floatReverse {
          0%,
          100% {
            transform: translate(0, 0);
          }

          50% {
            transform: translate(-25px, -20px);
          }
        }

        @keyframes iconFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(2deg); }
        }

        @keyframes iconGlow {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(15, 23, 42, 0)); }
          50% { filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.22)); }
        }

        @keyframes portalPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        .bti-brand-icon {
          animation: iconFloat 3.6s ease-in-out infinite, iconGlow 3.6s ease-in-out infinite;
        }

        .bti-header-icon {
          animation: iconFloat 3s ease-in-out infinite;
        }

        .bti-portal-button i {
          transition: transform 300ms ease, filter 300ms ease;
        }

        .bti-portal-button:hover i {
          transform: translateY(-2px) scale(1.16);
          filter: drop-shadow(0 3px 5px rgba(15, 23, 42, 0.22));
        }

        .bti-portal-button[aria-pressed="true"] i {
          animation: portalPulse 2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .bti-brand-icon,
          .bti-header-icon,
          .bti-portal-button[aria-pressed="true"] i {
            animation: none !important;
          }
        }

        @keyframes errorShake {
          0% {
            transform: translateX(0);
          }

          25% {
            transform: translateX(-5px);
          }

          50% {
            transform: translateX(5px);
          }

          75% {
            transform: translateX(-3px);
          }

          100% {
            transform: translateX(0);
          }
        }
      `}</style>
    </main>
  );
}

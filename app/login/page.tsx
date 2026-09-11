'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();

    setError('');

    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/');
  }

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

        {/* Main gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />

        {/* Animated glow - top left */}
        <div className="absolute -left-32 -top-32 h-96 w-96 animate-[float_8s_ease-in-out_infinite] rounded-full bg-blue-500/10 blur-3xl" />

        {/* Animated glow - bottom right */}
        <div className="absolute -bottom-40 -right-40 h-[30rem] w-[30rem] animate-[floatReverse_10s_ease-in-out_infinite] rounded-full bg-indigo-500/10 blur-3xl" />

        {/* Middle glow */}
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-slate-500/5 blur-3xl" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Floating circles */}
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

            {/* Logo Placeholder */}
            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur-xl">

              {/* Temporary school icon.
                  Replace this later with the official BTI logo. */}
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-lg">
                <i className="fa-solid fa-school text-3xl" />
              </div>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Biriwa Technical Institute
            </h1>

            <p className="mt-2 text-sm font-medium text-slate-400">
              BTI School Management System
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
                  <i className="fa-solid fa-right-to-bracket" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Welcome back
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Sign in to continue to your account
                  </p>
                </div>

              </div>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSignIn}
              className="space-y-5 px-6 py-6 sm:px-8 sm:py-7"
            >

              {/* ================================================= */}
              {/* EMAIL */}
              {/* ================================================= */}

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
                    placeholder="name@bti.edu.gh"
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
                    className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-12 text-sm font-medium text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/5 disabled:cursor-not-allowed disabled:opacity-60"
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

                {/* Button shine animation */}
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
              {/* SECURITY NOTE */}
              {/* ================================================= */}

              <div className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-400">
                <i className="fa-solid fa-shield-halved text-slate-400" />

                <span>
                  Secure access to the BTI management portal
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
              BTI School Management System
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

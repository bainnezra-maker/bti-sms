'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

export default function StudentAccountPage() {
  const [admissionNumber, setAdmissionNumber] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState('');

  const [error, setError] =
    useState('');

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError('');
    setSuccess('');

    const normalizedAdmission =
      admissionNumber.trim().toUpperCase();

    if (!normalizedAdmission) {
      setError(
        'Please enter the student admission number.'
      );
      return;
    }

    if (password.length < 8) {
      setError(
        'Password must contain at least 8 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        'The two passwords do not match.'
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        '/api/admin/student-account',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            admissionNumber:
              normalizedAdmission,
            password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result?.error ||
            'Unable to create the student account.'
        );
        return;
      }

      setSuccess(
        `${result.student.full_name} can now sign in using ${result.student.admission_number} and the password you created.`
      );

      setAdmissionNumber('');
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError(
        'Unable to connect to the server. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 lg:p-10 lg:pt-10">
      <div className="mx-auto max-w-2xl">

        <div className="mb-6">
          <Link
            href="/students"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to Students
          </Link>

          <p className="mt-5 text-sm font-semibold text-blue-600">
            Student Portal Access
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Create Student Login
          </h1>

          <p className="mt-2 text-slate-500">
            Give an existing active student access to
            the BIRITECH SMS Student Portal.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-bold text-blue-900">
            Student Login Method
          </h2>

          <p className="mt-2 text-sm leading-6 text-blue-800">
            Students will sign in with their
            <strong> admission number + password</strong>.
            Their internal email account is managed
            automatically by BIRITECH SMS and is not used as
            their visible login credential.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
        >
          <div className="space-y-5">

            <div>
              <label
                htmlFor="admissionNumber"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Student Admission Number
              </label>

              <input
                id="admissionNumber"
                type="text"
                value={admissionNumber}
                onChange={(event) =>
                  setAdmissionNumber(
                    event.target.value
                  )
                }
                placeholder="e.g. BTI/2026/0001"
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-1 text-xs text-slate-400">
                Enter the admission number exactly as
                shown on the student's record.
              </p>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Student Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                placeholder="Enter the password again"
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-700">
              {success}
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">

            <Link
              href="/students"
              className="rounded-xl border border-slate-300 px-6 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Creating Account...'
                : 'Create Student Login'}
            </button>

          </div>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          <p className="font-semibold text-slate-700">
            Important
          </p>

          <p className="mt-2 leading-6">
            Keep the password you give the student
            secure. The password is never stored in
            the BIRITECH SMS database as plain text.
          </p>
        </div>

      </div>
    </div>
  );
}

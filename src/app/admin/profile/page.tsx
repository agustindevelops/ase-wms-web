"use client";

import { useAuthContext } from "@/context/AuthContext";
import { changePassword } from "@/firebase/auth/changePassword";
import {
  isStrongPassword,
  passwordRuleResults,
  passwordStrength,
} from "@/lib/auth/passwordStrength";
import { FormEvent, useId, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200";

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4" />
      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-4.1 4.8" />
      <path d="M6.1 6.1C3.7 7.9 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.1-.8" />
    </svg>
  );
}

function roleLabel(code: string): string {
  if (code === "ADMIN") return "Admin";
  return code
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-brown-700"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-brown-500 hover:text-brown-800"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const rules = passwordRuleResults(password);
  const strength = passwordStrength(password);
  const labelId = useId();
  const barClass =
    strength.label === "Strong"
      ? "bg-green-500"
      : strength.label === "Fair"
        ? "bg-brown-400"
        : "bg-peach-500";
  const labelClass =
    strength.label === "Strong"
      ? "text-green-700"
      : strength.label === "Fair"
        ? "text-brown-600"
        : "text-peach-700";

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p id={labelId} className="text-sm font-medium text-brown-700">
          Password strength
        </p>
        {strength.label ? (
          <p className={`text-sm font-medium ${labelClass}`}>{strength.label}</p>
        ) : null}
      </div>
      <div
        className="flex gap-1"
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={strength.total}
        aria-valuenow={strength.score}
        aria-valuetext={strength.label || "Empty"}
      >
        {rules.map((rule, index) => (
          <span
            key={rule.id}
            className={`h-1.5 flex-1 rounded-full ${
              index < strength.score ? barClass : "bg-brown-100"
            }`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={`text-sm ${rule.met ? "text-green-700" : "text-brown-500"}`}
          >
            {rule.met ? "✓" : "○"} {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProfilePage() {
  const { user, roles } = useAuthContext();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return null;
  }

  const confirmationMismatch =
    confirmPassword.length > 0 && confirmPassword !== nextPassword;
  const sameAsCurrent =
    currentPassword.length > 0 && nextPassword === currentPassword;
  const canSubmit =
    !busy &&
    currentPassword.length > 0 &&
    isStrongPassword(nextPassword) &&
    nextPassword === confirmPassword &&
    nextPassword !== currentPassword;

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setSuccess("Password updated.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update password.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h2 className="font-nickainley text-3xl text-coral">Profile</h2>
      <p className="mt-1 text-sm text-brown-600">
        Your account details and password.
      </p>

      <div className="mt-8 rounded-2xl border border-brown-200 bg-white/60 p-6">
        <h3 className="font-nickainley text-2xl text-coral">Account</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-brown-700">Email</dt>
            <dd className="mt-1 break-all text-sm text-brown-800">
              {user.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-brown-700">Role</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {roles.length > 0 ? (
                roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
                  >
                    {roleLabel(role)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-brown-500">Not assigned</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <form
        onSubmit={(event) => void updatePassword(event)}
        className="mt-6 rounded-2xl border border-brown-200 bg-white/60 p-6"
      >
        <h3 className="font-nickainley text-2xl text-coral">Password</h3>
        <p className="mt-1 text-sm text-brown-600">
          Enter your current password, then choose a strong new one.
        </p>

        <div className="mt-5 space-y-4">
          <PasswordField
            id="current-password"
            label="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <div>
            <PasswordField
              id="new-password"
              label="New password"
              autoComplete="new-password"
              value={nextPassword}
              onChange={setNextPassword}
            />
            <PasswordStrength password={nextPassword} />
          </div>
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
        </div>

        {sameAsCurrent ? (
          <p className="mt-4 text-sm text-peach-700" role="alert">
            Choose a password that is different from your current one.
          </p>
        ) : null}
        {confirmationMismatch ? (
          <p className="mt-4 text-sm text-peach-700" role="alert">
            New password and confirmation do not match.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-peach-700" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-4 text-sm font-medium text-green-700" role="status">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-6 rounded-full bg-green-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </section>
  );
}

"use client";

import { allowPublicSignup } from "@/constant/env";
import { isFirebaseConfigured } from "@/firebase/config";
import signIn from "@/firebase/auth/signIn";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const configured = isFirebaseConfigured();

  const handleForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured) {
      setErrorMessage(
        "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* keys to .env.local.",
      );
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    const { error } = await signIn(email, password);

    setSubmitting(false);

    if (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not sign in. Check your email and password.",
      );
      console.error(error);
      return;
    }

    router.push("/admin");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-15"
        style={{
          backgroundImage: "url('/images/aniah-social-events-flowers.jpg')",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-cream/85" />

      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/">
            <Image
              src="/images/aniah-social-events-logo.png"
              alt="Aniah Social Events Logo"
              width={96}
              height={96}
              priority
            />
          </Link>
          <h1 className="font-nickainley mt-3 text-4xl text-peach-500">
            Sign In
          </h1>
          <p className="mt-2 text-sm text-brown-600">
            ASE WMS Admin access
          </p>
        </div>

        <form
          onSubmit={handleForm}
          className="rounded-2xl border border-brown-200 bg-cream/95 px-8 py-8 shadow-sm"
        >
          {!configured ? (
            <p className="mb-4 rounded-lg border border-peach-200 bg-peach-50 px-3 py-2 text-sm text-peach-800">
              Firebase keys missing. Copy{" "}
              <code className="font-mono text-xs">.env.example</code> to{" "}
              <code className="font-mono text-xs">.env.local</code> and fill in
              your project values.
            </p>
          ) : null}
          <div className="mb-4">
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-brown-700"
            >
              Email
            </label>
            <input
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              name="email"
              id="email"
              autoComplete="email"
              placeholder="you@aniahsocialevents.com"
              className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-brown-700"
            >
              Password
            </label>
            <input
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              name="password"
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
            />
          </div>

          {errorMessage ? (
            <p className="mb-4 text-sm text-peach-700" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-green-500 py-3 font-medium text-white transition duration-300 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* Keep for Staff / employee onboarding later */}
        {allowPublicSignup ? (
          <p className="mt-6 text-center text-sm text-brown-600">
            Need an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-green-700 underline-offset-2 hover:underline"
            >
              Create one
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}

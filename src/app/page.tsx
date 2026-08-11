"use client";

import { useAuthContext } from "@/context/AuthContext";
import type { User } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { user } = useAuthContext() as { user: User | null };
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/admin");
    }
  }, [user, router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-cream">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-25 animate-soft-pulse"
        style={{
          backgroundImage: "url('/images/aniah-social-events-flowers.jpg')",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cream/70 via-cream/90 to-cream" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
        <Image
          src="/images/aniah-social-events-logo.png"
          alt="Aniah Social Events Logo"
          width={160}
          height={160}
          priority
          className="animate-fade-up"
        />

        <p className="animate-fade-up mt-4 text-sm font-medium tracking-[0.2em] text-brown-500 uppercase">
          Warehouse Management
        </p>

        <h1 className="font-nickainley animate-fade-up-delay mt-3 text-4xl text-peach-500 sm:text-5xl">
          ASE WMS Admin
        </h1>

        <p className="animate-fade-up-delay mt-4 max-w-md text-base text-brown-600">
          Sign in to manage inventory, labels, and day-to-day warehouse
          operations for Aniah Social Events.
        </p>

        <div className="animate-fade-up-delay mt-10 flex w-full max-w-xs flex-col gap-3">
          <Link
            href="/signin"
            className="rounded-full bg-green-500 px-8 py-3 text-lg font-medium text-white shadow-sm transition duration-300 hover:bg-green-700"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-full border-2 border-brown-300 bg-cream px-8 py-3 text-lg font-medium text-brown-700 transition duration-300 hover:border-brown-500 hover:bg-brown-50"
          >
            Create Admin Account
          </Link>
        </div>

        <a
          href="https://aniahsocialevents.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="animate-fade-up-delay mt-12 text-sm text-brown-500 underline-offset-4 transition hover:text-brown-700 hover:underline"
        >
          aniahsocialevents.com
        </a>
      </div>
    </main>
  );
}

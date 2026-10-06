"use client";

import { useAuthContext } from "@/context/AuthContext";
import LoadingOverlay from "@/components/LoadingOverlay";
import { getFirebaseAuth } from "@/firebase/config";
import { prefetchLookups } from "@/lib/query/lookups";
import { useQueryClient } from "@tanstack/react-query";
import { signOut, type User } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function navClass(active: boolean) {
  return active
    ? "rounded-full bg-green-700 px-4 py-2 text-sm font-medium text-white"
    : "rounded-full px-4 py-2 text-sm font-medium text-brown-700 transition hover:bg-brown-100";
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuthContext() as { user: User | null };
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user == null) {
      router.replace("/signin");
    }
  }, [user, router]);

  useEffect(() => {
    if (user?.uid) {
      prefetchLookups(queryClient);
    }
  }, [user?.uid, queryClient]);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!user) {
    return <LoadingOverlay />;
  }

  const handleSignOut = async () => {
    await signOut(getFirebaseAuth());
    router.push("/signin");
  };

  const initial = (user.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-brown-200 bg-cream">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Image
                src="/images/aniah-social-events-logo.png"
                alt="Aniah Social Events Logo"
                width={48}
                height={48}
                priority
              />
            </Link>
            <div>
              <p className="text-xs tracking-[0.18em] text-brown-500 uppercase">
                Aniah Social Events
              </p>
              <h1 className="font-nickainley text-2xl text-coral">
                WIS Admin
              </h1>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/admin"
              className={navClass(pathname === "/admin")}
            >
              Dashboard
            </Link>
            <Link
              href="/admin/orders"
              className={navClass(pathname.startsWith("/admin/orders"))}
            >
              Orders
            </Link>
            <Link
              href="/admin/packages"
              className={navClass(pathname.startsWith("/admin/packages"))}
            >
              Packages
            </Link>
            <Link
              href="/admin/inventory"
              className={navClass(pathname.startsWith("/admin/inventory"))}
            >
              Inventory
            </Link>
            <Link
              href="/admin/reports"
              className={navClass(pathname.startsWith("/admin/reports"))}
            >
              Reports
            </Link>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white transition hover:bg-green-800"
                aria-label="Profile menu"
              >
                {initial}
              </button>
              {menuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-brown-200 bg-cream p-3 shadow-lg">
                  <p className="mb-2 truncate px-1 text-xs text-brown-500">
                    {user.email}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="w-full rounded-full bg-peach-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-peach-600"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

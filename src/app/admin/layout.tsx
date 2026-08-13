"use client";

import { useAuthContext } from "@/context/AuthContext";
import LoadingOverlay from "@/components/LoadingOverlay";
import { getFirebaseAuth } from "@/firebase/config";
import { signOut, type User } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

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

  useEffect(() => {
    if (user == null) {
      router.replace("/signin");
    }
  }, [user, router]);

  if (!user) {
    return <LoadingOverlay />;
  }

  const handleSignOut = async () => {
    await signOut(getFirebaseAuth());
    router.push("/signin");
  };

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
              <h1 className="font-nickainley text-2xl text-peach-500">
                WMS Admin
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
              href="/admin/inventory"
              className={navClass(pathname.startsWith("/admin/inventory"))}
            >
              Inventory
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-brown-300 px-4 py-2 text-sm font-medium text-brown-700 transition hover:bg-brown-100"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

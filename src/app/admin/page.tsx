"use client";

import { useAuthContext } from "@/context/AuthContext";
import LoadingOverlay from "@/components/LoadingOverlay";
import { getFirebaseAuth } from "@/firebase/config";
import { signOut, type User } from "firebase/auth";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPage() {
  const { user } = useAuthContext() as { user: User | null };
  const router = useRouter();

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
    <main className="min-h-screen bg-cream">
      <header className="border-b border-brown-200 bg-cream">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Image
              src="/images/aniah-social-events-logo.png"
              alt="Aniah Social Events Logo"
              width={48}
              height={48}
              priority
            />
            <div>
              <p className="text-xs tracking-[0.18em] text-brown-500 uppercase">
                Aniah Social Events
              </p>
              <h1 className="font-nickainley text-2xl text-peach-500">
                WMS Admin
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full border border-brown-300 px-4 py-2 text-sm font-medium text-brown-700 transition hover:bg-brown-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-brown-500">Signed in as</p>
        <p className="mt-1 text-lg font-medium text-brown-800">{user.email}</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-brown-200 bg-white/60 p-6">
            <h2 className="font-nickainley text-2xl text-brown-800">
              Inventory
            </h2>
            <p className="mt-2 text-sm text-brown-600">
              Asset tracking and stock views will live here. Wire to Firestore
              or your WMS API when ready.
            </p>
          </div>
          <div className="rounded-2xl border border-brown-200 bg-white/60 p-6">
            <h2 className="font-nickainley text-2xl text-brown-800">
              Labels
            </h2>
            <p className="mt-2 text-sm text-brown-600">
              Pair with ase-wms-app barcode printing. Use the same Firebase
              Auth ID token for cross-app API calls.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

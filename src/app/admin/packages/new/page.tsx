"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wisJson } from "@/lib/api/wisFetch";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PackageForm from "../PackageForm";
import type { PackageDetail, PackagePayload } from "../packageTypes";

export default function NewPackagePage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const handleSubmit = async (payload: PackagePayload) => {
    setBusy(true);
    setError(null);
    try {
      const json = await wisJson<{ package: PackageDetail }>("/api/package", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await queryClient.invalidateQueries({ queryKey: ["packages"] });
      router.push(`/admin/packages/${json.package.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm">
        <Link
          href="/admin/packages"
          className="text-green-800 underline-offset-2 hover:underline"
        >
          ← Packages
        </Link>
      </p>
      <h2 className="mt-4 font-nickainley text-3xl text-coral">New package</h2>
      <PackageForm
        submitLabel="Create package"
        busy={busy}
        error={error}
        onSubmit={(payload) => void handleSubmit(payload)}
      />
    </section>
  );
}

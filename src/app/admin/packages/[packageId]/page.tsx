"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wisJson } from "@/lib/api/wisFetch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import PackageForm from "../PackageForm";
import type { PackageDetail, PackagePayload } from "../packageTypes";

export default function PackageDetailPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams<{ packageId: string }>();
  const packageId = params.packageId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const packageQuery = useQuery({
    queryKey: ["package", packageId],
    queryFn: () =>
      wisJson<{ package: PackageDetail }>(`/api/package/${packageId}`),
    enabled: Boolean(user && packageId),
  });

  if (!user) {
    return null;
  }

  const pkg = packageQuery.data?.package;

  const handleSubmit = async (payload: PackagePayload) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const json = await wisJson<{ package: PackageDetail }>(
        `/api/package/${packageId}`,
        { method: "PUT", body: JSON.stringify(payload) },
      );
      queryClient.setQueryData(["package", packageId], json);
      await queryClient.invalidateQueries({ queryKey: ["packages"] });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (
      !pkg ||
      !window.confirm(
        `Delete "${pkg.name}"? Orders already placed keep their items.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await wisJson(`/api/package/${packageId}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["packages"] });
      router.push("/admin/packages");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Delete failed");
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
      {packageQuery.isLoading ? (
        <p className="mt-6 text-sm text-brown-500">Loading…</p>
      ) : !pkg ? (
        <p className="mt-6 text-sm text-peach-700" role="alert">
          {packageQuery.error instanceof Error
            ? packageQuery.error.message
            : "Package not found"}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-nickainley text-3xl text-coral">{pkg.name}</h2>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy}
              className="rounded-full bg-peach-500 px-4 py-2 text-sm font-medium text-white hover:bg-peach-600 disabled:opacity-60"
            >
              Delete package
            </button>
          </div>
          {saved ? (
            <p className="mt-2 text-sm text-green-800">Saved.</p>
          ) : null}
          <PackageForm
            key={pkg.id}
            initial={pkg}
            submitLabel="Save package"
            busy={busy}
            error={error}
            onSubmit={(payload) => void handleSubmit(payload)}
          />
        </>
      )}
    </section>
  );
}

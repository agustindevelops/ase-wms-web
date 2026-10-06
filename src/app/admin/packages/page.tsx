"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wisJson } from "@/lib/api/wisFetch";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatCents, type PackageDetail } from "./packageTypes";

export default function PackagesPage() {
  const { user } = useAuthContext();
  const packagesQuery = useQuery({
    queryKey: ["packages"],
    queryFn: () => wisJson<{ packages: PackageDetail[] }>("/api/package"),
    enabled: Boolean(user),
  });

  if (!user) {
    return null;
  }

  const packages = packagesQuery.data?.packages ?? [];
  const error =
    packagesQuery.error instanceof Error ? packagesQuery.error.message : null;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-nickainley text-3xl text-coral">Packages</h2>
          <p className="mt-1 text-sm text-brown-600">
            Grouped offerings shown on the customer site. Ordering a package
            adds its items to the order.
          </p>
        </div>
        <Link
          href="/admin/packages/new"
          className="rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
        >
          Create package
        </Link>
      </div>

      {error ? (
        <p className="mt-6 text-sm text-peach-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-brown-200 bg-white/60">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-brown-200 text-brown-500">
            <tr>
              <th className="px-4 py-3 font-medium" />
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Base price</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Media</th>
            </tr>
          </thead>
          <tbody>
            {packagesQuery.isLoading ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : packages.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={5}>
                  No packages yet.
                </td>
              </tr>
            ) : (
              packages.map((pkg) => {
                const cover = pkg.media.find(
                  (row) => row.type === "image" && row.url,
                );
                return (
                  <tr key={pkg.id} className="border-t border-brown-100">
                    <td className="px-4 py-3">
                      {cover?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover.url}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-brown-100" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/packages/${pkg.id}`}
                        className="font-medium text-green-800 underline-offset-2 hover:underline"
                      >
                        {pkg.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {formatCents(pkg.basePriceCents)}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {pkg.items.length}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {pkg.media.length}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

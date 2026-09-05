"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wisJson } from "@/lib/api/wisFetch";
import {
  ISSUE_TYPE_BROKEN,
  ISSUE_TYPE_MISSING,
  type IssueType,
} from "@/lib/db/defaults";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

type ReportListItem = {
  id: string;
  type: IssueType;
  quantity: number;
  notes: string | null;
  createdAt: string;
  item: {
    id: string;
    name: string;
    files: Array<{ id: string; readUrl: string | null }>;
  };
  createdBy: { id: string; email: string };
  order: { id: string; name: string } | null;
};

const typeFilters: { code: IssueType; label: string }[] = [
  { code: ISSUE_TYPE_MISSING, label: "Missing" },
  { code: ISSUE_TYPE_BROKEN, label: "Broken" },
];

function typeLabel(type: IssueType) {
  return type === ISSUE_TYPE_MISSING ? "Missing" : "Broken";
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ReportsPage() {
  const { user } = useAuthContext();
  const userId = user?.uid;
  const [selectedTypes, setSelectedTypes] = useState<IssueType[]>([]);

  const reportsQuery = useQuery({
    queryKey: ["issues", selectedTypes],
    queryFn: () => {
      const params = new URLSearchParams();
      for (const type of selectedTypes) {
        params.append("type", type);
      }
      const query = params.toString();
      return wisJson<{ issues: ReportListItem[] }>(
        query ? `/api/issue?${query}` : "/api/issue",
      );
    },
    enabled: Boolean(userId),
  });

  const reports = reportsQuery.data?.issues ?? [];
  const loading = reportsQuery.isLoading;
  const error =
    reportsQuery.error instanceof Error
      ? reportsQuery.error.message
      : reportsQuery.error
        ? "Failed to load reports"
        : null;

  const toggleType = (code: IssueType) => {
    setSelectedTypes((current) =>
      current.includes(code)
        ? current.filter((value) => value !== code)
        : [...current, code],
    );
  };

  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <div>
        <h2 className="font-nickainley text-3xl text-brown-800">Reports</h2>
        <p className="mt-1 text-sm text-brown-600">
          Missing and broken items recorded from the warehouse or an order
          return.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {typeFilters.map((filter) => {
          const active = selectedTypes.includes(filter.code);
          return (
            <button
              key={filter.code}
              type="button"
              onClick={() => toggleType(filter.code)}
              className={
                active
                  ? "rounded-full bg-green-700 px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-full border border-brown-300 px-3 py-1.5 text-sm font-medium text-brown-700 hover:bg-brown-100"
              }
            >
              {filter.label}
            </button>
          );
        })}
        {selectedTypes.length > 0 ? (
          <button
            type="button"
            onClick={() => setSelectedTypes([])}
            className="rounded-full px-3 py-1.5 text-sm text-brown-500 underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        ) : null}
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
              <th className="px-4 py-3 font-medium">Photo</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 font-medium">Reported by</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={8}>
                  Loading…
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={8}>
                  No reports yet.
                </td>
              </tr>
            ) : (
              reports.map((report) => {
                const thumb =
                  report.item.files.find((file) => file.readUrl)?.readUrl ??
                  null;
                return (
                  <tr key={report.id} className="border-t border-brown-100">
                    <td className="px-4 py-3">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-brown-100" />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-brown-700">
                      {formatWhen(report.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/inventory/${report.item.id}`}
                        className="font-medium text-green-800 underline-offset-2 hover:underline"
                      >
                        {report.item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {typeLabel(report.type)}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {report.quantity}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {report.order ? (
                        <Link
                          href={`/admin/orders/${report.order.id}`}
                          className="text-green-800 underline-offset-2 hover:underline"
                        >
                          {report.order.name}
                        </Link>
                      ) : (
                        "Warehouse"
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-brown-700">
                      {report.notes || "—"}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {report.createdBy.email}
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

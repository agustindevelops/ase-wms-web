"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wmsFetch, wmsJson } from "@/lib/api/wmsFetch";
import {
  useOrderStatuses,
  type OrderStatusOption,
} from "@/lib/query/lookups";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { FormEvent, Fragment, useEffect, useState } from "react";

type IssueType = "MISSING" | "BROKEN";

type OrderIssue = {
  id: string;
  type: IssueType;
  quantity: number;
  notes: string | null;
  createdAt: string;
};

type OrderLine = {
  id: string;
  itemId: string;
  qtyRequested: number;
  qtyPicked: number;
  qtyReturned: number;
  item: { id: string; name: string; warehouseId: string | null };
  issues: OrderIssue[];
};

type OrderDetail = {
  id: string;
  name: string;
  eventDate: string | null;
  statusId: string;
  status: OrderStatusOption;
  lines: OrderLine[];
};

type CatalogItem = {
  id: string;
  name: string;
  warehouse?: { id: string; name: string } | null;
};

type LineQtyEdits = {
  qtyRequested: string;
  qtyPicked: string;
  qtyReturned: string;
};

type IssueDraft = {
  type: IssueType;
  quantity: string;
  notes: string;
};

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function emptyIssueDraft(): IssueDraft {
  return { type: "MISSING", quantity: "1", notes: "" };
}

function qtyIssued(line: OrderLine) {
  return (line.issues ?? []).reduce((sum, issue) => sum + issue.quantity, 0);
}

function issueLabel(type: IssueType) {
  return type === "MISSING" ? "Missing" : "Broken";
}

const qtyInputClass =
  "w-20 rounded-lg border border-brown-200 bg-white px-2 py-1 text-brown-800";

export default function OrderDetailPage() {
  const { user } = useAuthContext();
  const userId = user?.uid;
  const { data: statuses = [], error: statusesError } = useOrderStatuses();
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [statusId, setStatusId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qtyRequested, setQtyRequested] = useState("1");
  const [lineEdits, setLineEdits] = useState<Record<string, LineQtyEdits>>({});
  const [issueDrafts, setIssueDrafts] = useState<Record<string, IssueDraft>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applyOrder = (next: OrderDetail) => {
    setOrder(next);
    setName(next.name);
    setEventDate(dateInputValue(next.eventDate));
    setStatusId(next.statusId);
    setLineEdits(
      Object.fromEntries(
        next.lines.map((line) => [
          line.id,
          {
            qtyRequested: String(line.qtyRequested),
            qtyPicked: String(line.qtyPicked),
            qtyReturned: String(line.qtyReturned),
          },
        ]),
      ),
    );
    setIssueDrafts((current) => {
      const nextDrafts: Record<string, IssueDraft> = {};
      for (const line of next.lines) {
        nextDrafts[line.id] = current[line.id] ?? emptyIssueDraft();
      }
      return nextDrafts;
    });
  };

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => wmsJson<{ order: OrderDetail }>(`/api/order/${orderId}`),
    enabled: Boolean(userId && orderId),
  });
  const catalogQuery = useQuery({
    queryKey: ["inventory", { archived: "0" }],
    queryFn: () =>
      wmsJson<{ items: CatalogItem[] }>("/api/item?archived=0"),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (orderQuery.data?.order) {
      applyOrder(orderQuery.data.order);
    }
  }, [orderQuery.data]);

  useEffect(() => {
    const nextItems = catalogQuery.data?.items ?? [];
    setItemId((current) => current || nextItems[0]?.id || "");
  }, [catalogQuery.data]);

  const items = catalogQuery.data?.items ?? [];
  const loading = orderQuery.isLoading || catalogQuery.isLoading;

  const authedJson = async (path: string, init: RequestInit) => {
    const response = await wmsFetch(path, init);
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message ?? "Request failed");
    }
    return json;
  };

  const patchLineEdit = (
    lineId: string,
    field: keyof LineQtyEdits,
    value: string,
  ) => {
    setLineEdits((current) => ({
      ...current,
      [lineId]: {
        qtyRequested: current[lineId]?.qtyRequested ?? "1",
        qtyPicked: current[lineId]?.qtyPicked ?? "0",
        qtyReturned: current[lineId]?.qtyReturned ?? "0",
        [field]: value,
      },
    }));
  };

  const patchIssueDraft = (
    lineId: string,
    field: keyof IssueDraft,
    value: string,
  ) => {
    setIssueDrafts((current) => ({
      ...current,
      [lineId]: {
        ...(current[lineId] ?? emptyIssueDraft()),
        [field]: value,
      },
    }));
  };

  const saveHeader = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const json = await authedJson(`/api/order/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          eventDate: eventDate || null,
          statusId,
        }),
      });
      applyOrder(json.order);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const addLine = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const json = await authedJson(`/api/order/${orderId}/line`, {
        method: "POST",
        body: JSON.stringify({
          itemId,
          qtyRequested: Number(qtyRequested),
        }),
      });
      applyOrder(json.order);
      setQtyRequested("1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add line");
    } finally {
      setBusy(false);
    }
  };

  const saveLineQty = async (lineId: string) => {
    const edits = lineEdits[lineId];
    if (!edits) return;
    setBusy(true);
    setError(null);
    try {
      const json = await authedJson(`/api/order/${orderId}/line/${lineId}`, {
        method: "PATCH",
        body: JSON.stringify({
          qtyRequested: Number(edits.qtyRequested),
          qtyPicked: Number(edits.qtyPicked),
          qtyReturned: Number(edits.qtyReturned),
        }),
      });
      applyOrder(json.order);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update qty");
    } finally {
      setBusy(false);
    }
  };

  const reportIssue = async (line: OrderLine) => {
    const draft = issueDrafts[line.id] ?? emptyIssueDraft();
    setBusy(true);
    setError(null);
    try {
      const json = await authedJson(`/api/order/${orderId}/issue`, {
        method: "POST",
        body: JSON.stringify({
          itemId: line.item.id,
          type: draft.type,
          quantity: Number(draft.quantity),
          notes: draft.notes.trim() || null,
        }),
      });
      applyOrder(json.order);
      setIssueDrafts((current) => ({
        ...current,
        [line.id]: emptyIssueDraft(),
      }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not report issue",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeLine = async (line: OrderLine) => {
    const issued = qtyIssued(line);
    if (line.qtyPicked > 0 || line.qtyReturned > 0 || issued > 0) {
      const ok = window.confirm(
        `Remove ${line.item.name}? Outstanding picked quantity will return to available. Missing/broken already recorded stays off owned quantity.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const json = await authedJson(`/api/order/${orderId}/line/${line.id}`, {
        method: "DELETE",
      });
      applyOrder(json.order);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove line");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-brown-500">Loading…</p>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-peach-700">
          {error ??
            (orderQuery.error instanceof Error
              ? orderQuery.error.message
              : "Order not found")}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <h2 className="font-nickainley text-3xl text-brown-800">{order.name}</h2>
      <p className="mt-1 text-sm text-brown-600">{order.status.name}</p>

      {error || orderQuery.error || statusesError ? (
        <p className="mt-4 text-sm text-peach-700" role="alert">
          {error ??
            (orderQuery.error instanceof Error
              ? orderQuery.error.message
              : statusesError instanceof Error
                ? statusesError.message
                : "Could not load order")}
        </p>
      ) : null}

      <form
        onSubmit={saveHeader}
        className="mt-8 grid gap-4 rounded-2xl border border-brown-200 bg-white/60 p-6 sm:grid-cols-3"
      >
        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium text-brown-700"
          >
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
        </div>
        <div>
          <label
            htmlFor="eventDate"
            className="mb-2 block text-sm font-medium text-brown-700"
          >
            Event date
          </label>
          <input
            id="eventDate"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
        </div>
        <div>
          <label
            htmlFor="statusId"
            className="mb-2 block text-sm font-medium text-brown-700"
          >
            Status
          </label>
          <select
            id="statusId"
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
            className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
          >
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
          >
            Save order
          </button>
        </div>
      </form>

      <div className="mt-10">
        <h3 className="font-nickainley text-2xl text-brown-800">Items</h3>
        <p className="mt-1 text-sm text-brown-600">
          Edit requested, picked, and returned quantities. Reporting missing or
          broken reduces owned quantity and does not restore available.
        </p>
        <form
          onSubmit={addLine}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-brown-200 bg-white/60 p-4"
        >
          <div className="min-w-56 flex-1">
            <label
              htmlFor="itemId"
              className="mb-2 block text-sm font-medium text-brown-700"
            >
              Item
            </label>
            <select
              id="itemId"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800"
            >
              {items.length === 0 ? (
                <option value="">No catalog items</option>
              ) : (
                items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.warehouse?.name ? ` (${item.warehouse.name})` : ""}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="w-28">
            <label
              htmlFor="qtyRequested"
              className="mb-2 block text-sm font-medium text-brown-700"
            >
              Qty
            </label>
            <input
              id="qtyRequested"
              type="number"
              min={1}
              step={1}
              value={qtyRequested}
              onChange={(e) => setQtyRequested(e.target.value)}
              className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !itemId}
            className="rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            Add item
          </button>
        </form>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-brown-200 bg-white/60">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brown-200 text-brown-500">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Requested</th>
                <th className="px-4 py-3 font-medium">Picked</th>
                <th className="px-4 py-3 font-medium">Returned</th>
                <th className="px-4 py-3 font-medium">Issued</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {order.lines.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-brown-500" colSpan={6}>
                    No items yet.
                  </td>
                </tr>
              ) : (
                order.lines.map((line) => {
                  const edits = lineEdits[line.id] ?? {
                    qtyRequested: String(line.qtyRequested),
                    qtyPicked: String(line.qtyPicked),
                    qtyReturned: String(line.qtyReturned),
                  };
                  const draft = issueDrafts[line.id] ?? emptyIssueDraft();
                  const issued = qtyIssued(line);
                  return (
                    <Fragment key={line.id}>
                      <tr className="border-t border-brown-100">
                        <td className="px-4 py-3 text-brown-800">
                          {line.item.name}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={edits.qtyRequested}
                            onChange={(e) =>
                              patchLineEdit(
                                line.id,
                                "qtyRequested",
                                e.target.value,
                              )
                            }
                            className={qtyInputClass}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={edits.qtyPicked}
                            onChange={(e) =>
                              patchLineEdit(line.id, "qtyPicked", e.target.value)
                            }
                            className={qtyInputClass}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={edits.qtyReturned}
                            onChange={(e) =>
                              patchLineEdit(
                                line.id,
                                "qtyReturned",
                                e.target.value,
                              )
                            }
                            className={qtyInputClass}
                          />
                        </td>
                        <td className="px-4 py-3 text-brown-700">{issued}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void saveLineQty(line.id)}
                              className="text-sm font-medium text-green-800 underline-offset-2 hover:underline disabled:opacity-60"
                            >
                              Update
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void removeLine(line)}
                              className="text-sm font-medium text-peach-700 underline-offset-2 hover:underline disabled:opacity-60"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-t border-brown-50">
                        <td className="px-4 pb-4 pt-0" colSpan={6}>
                          {(line.issues ?? []).length > 0 ? (
                            <ul className="mb-3 space-y-1 text-sm text-brown-600">
                              {(line.issues ?? []).map((issue) => (
                                <li key={issue.id}>
                                  {issueLabel(issue.type)} · {issue.quantity}
                                  {issue.notes ? ` · ${issue.notes}` : ""}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="flex flex-wrap items-end gap-2">
                            <div>
                              <label
                                htmlFor={`issue-type-${line.id}`}
                                className="mb-1 block text-xs font-medium text-brown-600"
                              >
                                Issue
                              </label>
                              <select
                                id={`issue-type-${line.id}`}
                                value={draft.type}
                                onChange={(e) =>
                                  patchIssueDraft(
                                    line.id,
                                    "type",
                                    e.target.value,
                                  )
                                }
                                className="rounded-lg border border-brown-200 bg-white px-2 py-1 text-brown-800"
                              >
                                <option value="MISSING">Missing</option>
                                <option value="BROKEN">Broken</option>
                              </select>
                            </div>
                            <div>
                              <label
                                htmlFor={`issue-qty-${line.id}`}
                                className="mb-1 block text-xs font-medium text-brown-600"
                              >
                                Qty
                              </label>
                              <input
                                id={`issue-qty-${line.id}`}
                                type="number"
                                min={1}
                                step={1}
                                value={draft.quantity}
                                onChange={(e) =>
                                  patchIssueDraft(
                                    line.id,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                                className={qtyInputClass}
                              />
                            </div>
                            <div className="min-w-40 flex-1">
                              <label
                                htmlFor={`issue-notes-${line.id}`}
                                className="mb-1 block text-xs font-medium text-brown-600"
                              >
                                Notes
                              </label>
                              <input
                                id={`issue-notes-${line.id}`}
                                value={draft.notes}
                                onChange={(e) =>
                                  patchIssueDraft(
                                    line.id,
                                    "notes",
                                    e.target.value,
                                  )
                                }
                                placeholder="Optional"
                                className="w-full rounded-lg border border-brown-200 bg-white px-2 py-1 text-brown-800"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void reportIssue(line)}
                              className="rounded-full bg-peach-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-peach-700 disabled:opacity-60"
                            >
                              Report issue
                            </button>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

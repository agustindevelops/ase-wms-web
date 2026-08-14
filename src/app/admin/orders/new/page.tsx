"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wmsFetch } from "@/lib/api/wmsFetch";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function NewOrderPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await wmsFetch("/api/order", {
        method: "POST",
        body: JSON.stringify({
          name,
          eventDate: eventDate || null,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "Could not create order");
      }
      router.push(`/admin/orders/${json.order.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl px-4 py-12">
      <h2 className="font-nickainley text-3xl text-brown-800">Create order</h2>
      <p className="mt-1 text-sm text-brown-600">
        Starts as Paid. Add items on the next screen.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 rounded-2xl border border-brown-200 bg-white/60 px-8 py-8"
      >
        <div className="mb-4">
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium text-brown-700"
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spring gala"
            className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
        </div>
        <div className="mb-6">
          <label
            htmlFor="eventDate"
            className="mb-2 block text-sm font-medium text-brown-700"
          >
            Event date (optional)
          </label>
          <input
            id="eventDate"
            name="eventDate"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
        </div>

        {error ? (
          <p className="mb-4 text-sm text-peach-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-green-500 py-3 font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create order"}
        </button>
      </form>
    </section>
  );
}

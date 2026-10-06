"use client";

import type { OrderStatusOption } from "@/lib/query/lookups";
import { FormEvent, useState } from "react";
import { fieldClass } from "../../inventory/inventoryTypes";
import { centsToInput, inputToCents } from "../../packages/packageTypes";
import {
  isoToLocalInput,
  localInputToIso,
  type OrderDetail,
  type OrderUpload,
} from "./orderTypes";

const ACCESS_TYPES = [
  { code: "STANDARD", name: "Standard" },
  { code: "SPECIAL", name: "Special" },
];

const TABLE_SHAPES = [
  { code: "RECTANGULAR", name: "Rectangular" },
  { code: "ROUND", name: "Round" },
  { code: "SQUARE", name: "Square" },
  { code: "OTHER", name: "Other" },
];

const UPLOAD_TYPES = [
  { code: "SETUP_SPACE", name: "Setup space" },
  { code: "CLIENT_FURNITURE", name: "Client furniture" },
];

const labelClass = "mb-2 block text-sm font-medium text-brown-700";
const sectionTitleClass = "font-nickainley text-xl text-coral sm:col-span-2";

type Draft = {
  name: string;
  statusId: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  guestCount: string;
  quote: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  setupStartsAt: string;
  setupEndsAt: string;
  pickupStartsAt: string;
  pickupEndsAt: string;
  isPrivateHome: boolean;
  outletsAvailable: boolean;
  allowMarketingPhotos: boolean;
  accessType: string;
  accessNotes: string;
  specialNotes: string;
  clientSuppliesTables: boolean;
  tableShape: string;
  tableDimensions: string;
  numberOfTables: string;
  numberOfChairs: string;
  uploads: OrderUpload[];
};

function toDraft(order: OrderDetail): Draft {
  const details = order.details;
  const tables = order.clientTableDetails;
  return {
    name: order.name,
    statusId: order.statusId,
    eventDate: order.eventDate ? order.eventDate.slice(0, 10) : "",
    eventStartTime: order.eventStartTime ?? "",
    eventEndTime: order.eventEndTime ?? "",
    guestCount: order.guestCount == null ? "" : String(order.guestCount),
    quote: centsToInput(order.quote),
    firstName: order.contact?.firstName ?? "",
    lastName: order.contact?.lastName ?? "",
    email: order.contact?.email ?? "",
    phone: order.contact?.phone ?? "",
    addressLine1: order.address?.addressLine1 ?? "",
    addressLine2: order.address?.addressLine2 ?? "",
    city: order.address?.city ?? "",
    state: order.address?.state ?? "",
    zipcode: order.address?.zipcode ?? "",
    country: order.address?.country ?? "",
    setupStartsAt: isoToLocalInput(details?.setupStartsAt ?? null),
    setupEndsAt: isoToLocalInput(details?.setupEndsAt ?? null),
    pickupStartsAt: isoToLocalInput(details?.pickupStartsAt ?? null),
    pickupEndsAt: isoToLocalInput(details?.pickupEndsAt ?? null),
    isPrivateHome: details?.isPrivateHome ?? false,
    outletsAvailable: details?.outletsAvailable ?? false,
    allowMarketingPhotos: details?.allowMarketingPhotos ?? false,
    accessType: details?.accessType ?? "STANDARD",
    accessNotes: details?.accessNotes ?? "",
    specialNotes: details?.specialNotes ?? "",
    clientSuppliesTables: Boolean(tables),
    tableShape: tables?.tableShape ?? "RECTANGULAR",
    tableDimensions: tables?.tableDimensions ?? "",
    numberOfTables: tables ? String(tables.numberOfTables) : "",
    numberOfChairs: tables ? String(tables.numberOfChairs) : "",
    uploads: order.uploads.map((upload) => ({
      uploadType: upload.uploadType,
      fileUrl: upload.fileUrl,
    })),
  };
}

function allBlank(...values: string[]) {
  return values.every((value) => !value.trim());
}

function toPayload(draft: Draft, hadDetails: boolean) {
  const quote = inputToCents(draft.quote);
  if (Number.isNaN(quote)) {
    throw new Error("Quote must be a dollar amount like 1250 or 1250.00");
  }

  const contact = allBlank(draft.firstName, draft.lastName, draft.email, draft.phone)
    ? null
    : {
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        phone: draft.phone,
      };

  const address = allBlank(
    draft.addressLine1,
    draft.addressLine2,
    draft.city,
    draft.state,
    draft.zipcode,
    draft.country,
  )
    ? null
    : {
        addressLine1: draft.addressLine1,
        addressLine2: draft.addressLine2 || null,
        city: draft.city,
        state: draft.state,
        zipcode: draft.zipcode,
        country: draft.country || null,
      };

  const detailsEmpty =
    allBlank(
      draft.setupStartsAt,
      draft.setupEndsAt,
      draft.pickupStartsAt,
      draft.pickupEndsAt,
      draft.accessNotes,
      draft.specialNotes,
    ) &&
    !draft.isPrivateHome &&
    !draft.outletsAvailable &&
    !draft.allowMarketingPhotos &&
    draft.accessType === "STANDARD";

  const details =
    detailsEmpty && !hadDetails
      ? null
      : {
          setupStartsAt: localInputToIso(draft.setupStartsAt),
          setupEndsAt: localInputToIso(draft.setupEndsAt),
          pickupStartsAt: localInputToIso(draft.pickupStartsAt),
          pickupEndsAt: localInputToIso(draft.pickupEndsAt),
          isPrivateHome: draft.isPrivateHome,
          outletsAvailable: draft.outletsAvailable,
          accessType: draft.accessType,
          accessNotes: draft.accessNotes || null,
          allowMarketingPhotos: draft.allowMarketingPhotos,
          specialNotes: draft.specialNotes || null,
        };

  return {
    name: draft.name,
    statusId: draft.statusId,
    eventDate: draft.eventDate || null,
    eventStartTime: draft.eventStartTime || null,
    eventEndTime: draft.eventEndTime || null,
    guestCount: draft.guestCount.trim() ? Number(draft.guestCount) : null,
    quote,
    contact,
    address,
    details,
    clientTableDetails: draft.clientSuppliesTables
      ? {
          tableShape: draft.tableShape,
          tableDimensions: draft.tableDimensions,
          numberOfTables: Number(draft.numberOfTables),
          numberOfChairs: Number(draft.numberOfChairs),
        }
      : null,
    uploads: draft.uploads.filter((upload) => upload.fileUrl.trim()),
  };
}

type Props = {
  order: OrderDetail;
  statuses: OrderStatusOption[];
  busy: boolean;
  onSave: (payload: ReturnType<typeof toPayload>) => Promise<void>;
};

export default function OrderInfoForm({ order, statuses, busy, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(order));
  const [localError, setLocalError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const text = (key: keyof Draft, label: string, type = "text") => (
    <div>
      <label htmlFor={key} className={labelClass}>
        {label}
      </label>
      <input
        id={key}
        type={type}
        value={draft[key] as string}
        onChange={(e) => set(key, e.target.value as never)}
        className={fieldClass}
      />
    </div>
  );

  const check = (key: keyof Draft, label: string) => (
    <label className="flex items-center gap-2 text-sm text-brown-700">
      <input
        type="checkbox"
        checked={draft[key] as boolean}
        onChange={(e) => set(key, e.target.checked as never)}
        className="h-4 w-4 accent-green-700"
      />
      {label}
    </label>
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    let payload: ReturnType<typeof toPayload>;
    try {
      payload = toPayload(draft, Boolean(order.details));
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Invalid form");
      return;
    }
    await onSave(payload);
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mt-8 grid gap-4 rounded-2xl border border-brown-200 bg-white/60 p-6 sm:grid-cols-2"
    >
      <h3 className={sectionTitleClass}>Event</h3>
      {text("name", "Name")}
      <div>
        <label htmlFor="statusId" className={labelClass}>
          Status
        </label>
        <select
          id="statusId"
          value={draft.statusId}
          onChange={(e) => set("statusId", e.target.value)}
          className={fieldClass}
        >
          {statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
            </option>
          ))}
        </select>
      </div>
      {text("eventDate", "Event date", "date")}
      <div className="grid grid-cols-2 gap-4">
        {text("eventStartTime", "Start time", "time")}
        {text("eventEndTime", "End time", "time")}
      </div>
      {text("guestCount", "Guest count", "number")}
      <div>
        <label htmlFor="quote" className={labelClass}>
          Quote (USD)
        </label>
        <input
          id="quote"
          inputMode="decimal"
          value={draft.quote}
          onChange={(e) => set("quote", e.target.value)}
          placeholder="0.00"
          className={fieldClass}
        />
        {order.stripeCheckoutSessionId ? (
          <p className="mt-1 text-xs text-brown-500">
            Stripe session {order.stripeCheckoutSessionId}
          </p>
        ) : null}
      </div>

      <h3 className={`${sectionTitleClass} mt-4`}>Contact</h3>
      {text("firstName", "First name")}
      {text("lastName", "Last name")}
      {text("email", "Email", "email")}
      {text("phone", "Phone", "tel")}

      <h3 className={`${sectionTitleClass} mt-4`}>Venue address</h3>
      {text("addressLine1", "Address line 1")}
      {text("addressLine2", "Address line 2")}
      {text("city", "City")}
      {text("state", "State")}
      {text("zipcode", "ZIP code")}
      {text("country", "Country")}

      <h3 className={`${sectionTitleClass} mt-4`}>Setup and pickup</h3>
      {text("setupStartsAt", "Setup starts", "datetime-local")}
      {text("setupEndsAt", "Setup ends", "datetime-local")}
      {text("pickupStartsAt", "Pickup starts", "datetime-local")}
      {text("pickupEndsAt", "Pickup ends", "datetime-local")}

      <h3 className={`${sectionTitleClass} mt-4`}>Site</h3>
      <div className="flex flex-col gap-2 sm:col-span-2">
        {check("isPrivateHome", "Private home")}
        {check("outletsAvailable", "Outlets available")}
        {check("allowMarketingPhotos", "Client allows marketing photos")}
      </div>
      <div>
        <label htmlFor="accessType" className={labelClass}>
          Access
        </label>
        <select
          id="accessType"
          value={draft.accessType}
          onChange={(e) => set("accessType", e.target.value)}
          className={fieldClass}
        >
          {ACCESS_TYPES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
      {text("accessNotes", "Access notes")}
      <div className="sm:col-span-2">
        <label htmlFor="specialNotes" className={labelClass}>
          Notes from client
        </label>
        <textarea
          id="specialNotes"
          rows={4}
          value={draft.specialNotes}
          onChange={(e) => set("specialNotes", e.target.value)}
          className={fieldClass}
        />
      </div>

      <h3 className={`${sectionTitleClass} mt-4`}>Tables and chairs</h3>
      <div className="sm:col-span-2">
        {check("clientSuppliesTables", "Client supplies their own tables and chairs")}
      </div>
      {draft.clientSuppliesTables ? (
        <>
          <div>
            <label htmlFor="tableShape" className={labelClass}>
              Table shape
            </label>
            <select
              id="tableShape"
              value={draft.tableShape}
              onChange={(e) => set("tableShape", e.target.value)}
              className={fieldClass}
            >
              {TABLE_SHAPES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          {text("tableDimensions", "Table dimensions")}
          {text("numberOfTables", "Number of tables", "number")}
          {text("numberOfChairs", "Number of chairs", "number")}
        </>
      ) : null}

      <h3 className={`${sectionTitleClass} mt-4`}>Client uploads</h3>
      <div className="space-y-2 sm:col-span-2">
        {draft.uploads.length === 0 ? (
          <p className="text-sm text-brown-500">No uploads.</p>
        ) : null}
        {draft.uploads.map((upload, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Upload type"
              value={upload.uploadType}
              onChange={(e) =>
                set(
                  "uploads",
                  draft.uploads.map((row, i) =>
                    i === index ? { ...row, uploadType: e.target.value } : row,
                  ),
                )
              }
              className="rounded-lg border border-brown-200 bg-white px-2 py-2 text-sm text-brown-800"
            >
              {UPLOAD_TYPES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Upload URL"
              value={upload.fileUrl}
              onChange={(e) =>
                set(
                  "uploads",
                  draft.uploads.map((row, i) =>
                    i === index ? { ...row, fileUrl: e.target.value } : row,
                  ),
                )
              }
              placeholder="https://"
              className="min-w-64 flex-1 rounded-lg border border-brown-200 bg-white px-3 py-2 text-sm text-brown-800"
            />
            {upload.fileUrl.trim() ? (
              <a
                href={upload.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-green-800 hover:underline"
              >
                Open
              </a>
            ) : null}
            <button
              type="button"
              onClick={() =>
                set(
                  "uploads",
                  draft.uploads.filter((_, i) => i !== index),
                )
              }
              className="text-sm font-medium text-peach-700 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            set("uploads", [
              ...draft.uploads,
              { uploadType: "SETUP_SPACE", fileUrl: "" },
            ])
          }
          className="rounded-full border border-brown-300 px-4 py-2 text-sm font-medium text-brown-700 hover:bg-brown-100"
        >
          Add upload link
        </button>
      </div>

      {localError ? (
        <p className="text-sm text-peach-700 sm:col-span-2" role="alert">
          {localError}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
        >
          Save order
        </button>
      </div>
    </form>
  );
}

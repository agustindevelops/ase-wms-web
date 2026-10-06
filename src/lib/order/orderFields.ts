import "server-only";

import {
  ORDER_ACCESS_TYPES,
  ORDER_UPLOAD_TYPES,
  TABLE_SHAPES,
} from "@/lib/db/defaults";
import { OrderServiceError } from "@/lib/order/errors";

export type ContactInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type AddressInput = {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zipcode: string;
  country: string | null;
};

export type OrderDetailsInput = {
  setupStartsAt: Date | null;
  setupEndsAt: Date | null;
  pickupStartsAt: Date | null;
  pickupEndsAt: Date | null;
  isPrivateHome: boolean;
  outletsAvailable: boolean;
  accessType: string;
  accessNotes: string | null;
  allowMarketingPhotos: boolean;
  specialNotes: string | null;
};

export type ClientTableDetailsInput = {
  tableShape: string;
  tableDimensions: string;
  numberOfTables: number;
  numberOfChairs: number;
};

export type OrderUploadInput = {
  uploadType: string;
  fileUrl: string;
};

function badRequest(message: string): never {
  throw new OrderServiceError("Bad Request", message);
}

export function asObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    badRequest(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function asRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    badRequest(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    badRequest(`${field} is required`);
  }
  return trimmed;
}

export function asOptionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    badRequest(`${field} must be a string`);
  }
  return value.trim() || null;
}

function asCode(
  value: unknown,
  field: string,
  options: readonly { code: string }[],
): string {
  const code = asRequiredString(value, field);
  if (!options.some((option) => option.code === code)) {
    badRequest(
      `${field} must be one of: ${options.map((option) => option.code).join(", ")}`,
    );
  }
  return code;
}

function asBoolean(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    badRequest(`${field} must be true or false`);
  }
  return value;
}

export function asNonNegativeInt(value: unknown, field: string): number {
  const qty =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isInteger(qty) || qty < 0) {
    badRequest(`${field} must be an integer of 0 or more`);
  }
  return qty;
}

export function asPositiveInt(value: unknown, field: string): number {
  const qty = asNonNegativeInt(value, field);
  if (qty <= 0) {
    badRequest(`${field} must be an integer greater than 0`);
  }
  return qty;
}

export function asOptionalNonNegativeInt(
  value: unknown,
  field: string,
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return asNonNegativeInt(value, field);
}

export function asOptionalEventDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    badRequest("eventDate must be a date string");
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    badRequest("eventDate must be YYYY-MM-DD");
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    badRequest("eventDate is invalid");
  }
  return parsed;
}

/** "HH:mm" (or "HH:mm:ss") → Date on 1970-01-01 UTC for a Postgres TIME column. */
export function asOptionalTime(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    badRequest(`${field} must be a time string`);
  }
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim());
  if (!match) {
    badRequest(`${field} must be HH:mm`);
  }
  const [, hh, mm, ss = "00"] = match;
  return new Date(`1970-01-01T${hh}:${mm}:${ss}.000Z`);
}

export function formatTime(value: Date | null): string | null {
  return value ? value.toISOString().slice(11, 16) : null;
}

/** ISO 8601 datetime with an explicit offset or Z, so the instant is unambiguous. */
export function asOptionalDateTime(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    badRequest(`${field} must be an ISO datetime string`);
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T.+(Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    badRequest(`${field} must be an ISO datetime with a timezone offset`);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    badRequest(`${field} is invalid`);
  }
  return parsed;
}

function assertWindow(
  start: Date | null,
  end: Date | null,
  label: string,
) {
  if (start && end && end.getTime() < start.getTime()) {
    badRequest(`${label} end must be after its start`);
  }
}

export function parseContact(value: unknown): ContactInput {
  const body = asObject(value, "contact");
  const email = asRequiredString(body.email, "contact.email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    badRequest("contact.email is invalid");
  }
  return {
    firstName: asRequiredString(body.firstName, "contact.firstName"),
    lastName: asRequiredString(body.lastName, "contact.lastName"),
    email,
    phone: asRequiredString(body.phone, "contact.phone"),
  };
}

export function parseAddress(value: unknown): AddressInput {
  const body = asObject(value, "address");
  return {
    addressLine1: asRequiredString(body.addressLine1, "address.addressLine1"),
    addressLine2: asOptionalString(body.addressLine2, "address.addressLine2"),
    city: asRequiredString(body.city, "address.city"),
    state: asRequiredString(body.state, "address.state"),
    zipcode: asRequiredString(body.zipcode, "address.zipcode"),
    country: asOptionalString(body.country, "address.country"),
  };
}

export function parseOrderDetails(
  value: unknown,
  options: { requireWindows: boolean },
): OrderDetailsInput {
  const body = asObject(value, "details");
  const read = (key: string) => {
    const parsed = asOptionalDateTime(body[key], `details.${key}`);
    if (options.requireWindows && !parsed) {
      badRequest(`details.${key} is required`);
    }
    return parsed;
  };
  const setupStartsAt = read("setupStartsAt");
  const setupEndsAt = read("setupEndsAt");
  const pickupStartsAt = read("pickupStartsAt");
  const pickupEndsAt = read("pickupEndsAt");
  assertWindow(setupStartsAt, setupEndsAt, "Setup");
  assertWindow(pickupStartsAt, pickupEndsAt, "Pickup");

  return {
    setupStartsAt,
    setupEndsAt,
    pickupStartsAt,
    pickupEndsAt,
    isPrivateHome: asBoolean(body.isPrivateHome, "details.isPrivateHome", false),
    outletsAvailable: asBoolean(
      body.outletsAvailable,
      "details.outletsAvailable",
      false,
    ),
    accessType:
      body.accessType === undefined || body.accessType === null
        ? "STANDARD"
        : asCode(body.accessType, "details.accessType", ORDER_ACCESS_TYPES),
    accessNotes: asOptionalString(body.accessNotes, "details.accessNotes"),
    allowMarketingPhotos: asBoolean(
      body.allowMarketingPhotos,
      "details.allowMarketingPhotos",
      false,
    ),
    specialNotes: asOptionalString(body.specialNotes, "details.specialNotes"),
  };
}

export function parseClientTableDetails(value: unknown): ClientTableDetailsInput {
  const body = asObject(value, "clientTableDetails");
  return {
    tableShape: asCode(
      body.tableShape,
      "clientTableDetails.tableShape",
      TABLE_SHAPES,
    ),
    tableDimensions: asRequiredString(
      body.tableDimensions,
      "clientTableDetails.tableDimensions",
    ),
    numberOfTables: asNonNegativeInt(
      body.numberOfTables,
      "clientTableDetails.numberOfTables",
    ),
    numberOfChairs: asNonNegativeInt(
      body.numberOfChairs,
      "clientTableDetails.numberOfChairs",
    ),
  };
}

export function parseUploads(value: unknown): OrderUploadInput[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    badRequest("uploads must be an array");
  }
  return value.map((entry, index) => {
    const body = asObject(entry, `uploads[${index}]`);
    const fileUrl = asRequiredString(body.fileUrl, `uploads[${index}].fileUrl`);
    let url: URL;
    try {
      url = new URL(fileUrl);
    } catch {
      badRequest(`uploads[${index}].fileUrl must be a URL`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      badRequest(`uploads[${index}].fileUrl must be http(s)`);
    }
    return {
      uploadType: asCode(
        body.uploadType,
        `uploads[${index}].uploadType`,
        ORDER_UPLOAD_TYPES,
      ),
      fileUrl,
    };
  });
}

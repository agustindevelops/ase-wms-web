import { PICKUP_OPTIONS, type PickupOption } from "@/lib/order/atHomeExperience";
import { OrderServiceError } from "@/lib/order/errors";
import {
  parseClientTableDetails,
  parseUploads,
  type ClientTableDetailsInput,
  type OrderUploadInput,
} from "@/lib/order/orderFields";

export function badRequest(message: string): never {
  throw new OrderServiceError("Bad Request", message);
}

export function required<T>(value: T | null, field: string): T {
  if (value === null) {
    badRequest(`${field} is required`);
  }
  return value;
}

export function asPickupOption(value: unknown): PickupOption {
  if (
    typeof value !== "string" ||
    !(PICKUP_OPTIONS as readonly string[]).includes(value)
  ) {
    badRequest(`pickupOption must be one of: ${PICKUP_OPTIONS.join(", ")}`);
  }
  return value as PickupOption;
}

/** Optional client tables; requiredness is decided from the variant's forms. */
export function parseClientFurniture(
  value: unknown,
): ClientTableDetailsInput | null {
  if (value === undefined || value === null) return null;
  const details = parseClientTableDetails(value);
  if (details.numberOfTables < 1 || details.numberOfChairs < 1) {
    badRequest("Number of tables and chairs must be at least 1");
  }
  return details;
}

/** Parses uploads; requiredness is decided from the variant's forms in intake. */
export function parseBookingPhotos(value: unknown): OrderUploadInput[] {
  const uploads = parseUploads(value);
  if (
    uploads.some((upload) => upload.uploadType !== "CLIENT_FURNITURE")
  ) {
    badRequest("Photos must be classified as CLIENT_FURNITURE");
  }
  return uploads;
}

/**
 * YOUR_TABLES requires table details and at least one photo. Variants without
 * that form must send neither.
 */
export function assertYourTablesPayload(
  requiresYourTables: boolean,
  clientTableDetails: ClientTableDetailsInput | null,
  uploads: OrderUploadInput[],
): void {
  if (requiresYourTables) {
    if (!clientTableDetails) {
      badRequest("Table details are required for this style");
    }
    if (uploads.length === 0) {
      badRequest("At least one photo of your tables is required");
    }
    return;
  }
  if (clientTableDetails) {
    badRequest("Table details are only accepted for styles that use your tables");
  }
  if (uploads.length > 0) {
    badRequest("Photos are only accepted for styles that use your tables");
  }
}

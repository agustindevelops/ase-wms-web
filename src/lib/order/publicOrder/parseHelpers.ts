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

/** Present only when the customer supplies furniture; that presence drives pricing. */
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

/**
 * Photos are only collected when the customer supplies their own tables and
 * chairs: at least one, all CLIENT_FURNITURE. Otherwise there must be none.
 */
export function parseBookingPhotos(
  value: unknown,
  usesClientFurniture: boolean,
): OrderUploadInput[] {
  const uploads = parseUploads(value);
  if (!usesClientFurniture) {
    if (uploads.length > 0) {
      badRequest("Photos are only accepted when you provide your own tables");
    }
    return [];
  }
  if (uploads.length === 0) {
    badRequest("At least one photo of your tables is required");
  }
  if (uploads.some((upload) => upload.uploadType !== "CLIENT_FURNITURE")) {
    badRequest("Photos must be classified as CLIENT_FURNITURE");
  }
  return uploads;
}

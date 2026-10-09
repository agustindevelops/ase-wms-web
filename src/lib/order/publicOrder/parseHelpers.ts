import { PICKUP_OPTIONS, type PickupOption } from "@/lib/order/dinnerExperience";
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

/** At least one photo, all classified for the furniture choice. */
export function parseBookingPhotos(
  value: unknown,
  usesClientFurniture: boolean,
): OrderUploadInput[] {
  const uploads = parseUploads(value);
  const uploadType = usesClientFurniture ? "CLIENT_FURNITURE" : "SETUP_SPACE";
  if (uploads.length === 0) {
    badRequest("At least one photo is required");
  }
  if (uploads.some((upload) => upload.uploadType !== uploadType)) {
    badRequest(`Photos must be classified as ${uploadType}`);
  }
  return uploads;
}

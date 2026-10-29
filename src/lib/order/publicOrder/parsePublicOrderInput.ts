import {
  asNonNegativeInt,
  asOptionalEventDate,
  asOptionalString,
  asOptionalTime,
  asRequiredString,
  parseAddress,
  parseContact,
  parseOrderDetails,
} from "@/lib/order/orderFields";

import { buildSchedule } from "./buildSchedule";
import {
  asPickupOption,
  parseBookingPhotos,
  parseClientFurniture,
  required,
} from "./parseHelpers";
import type { PublicOrderInput } from "./types";

/**
 * Customer-site booking body: facts only. Setup/pickup windows and the quote
 * are built in intake from the selected package variant; any total sent by the
 * browser is ignored.
 */
export function parsePublicOrderInput(
  body: Record<string, unknown>,
): PublicOrderInput {
  const eventDate = asRequiredString(body.eventDate, "eventDate");
  const eventStartTime = asRequiredString(body.eventStartTime, "eventStartTime");
  const eventEndTime = asRequiredString(body.eventEndTime, "eventEndTime");
  const guestCount = asNonNegativeInt(body.guestCount, "guestCount");
  const pickupOption = asPickupOption(body.pickupOption);
  const address = parseAddress(body.address);
  const details = parseOrderDetails(body.details, { requireWindows: false });
  const clientTableDetails = parseClientFurniture(body.clientTableDetails);
  const uploads = parseBookingPhotos(body.uploads);

  const schedule = buildSchedule({
    guestCount,
    eventDate,
    eventStartTime,
    eventEndTime,
    pickupOption,
    morningPickupTime: asOptionalString(
      body.morningPickupTime,
      "morningPickupTime",
    ),
  });

  return {
    packageId: asRequiredString(body.packageId, "packageId"),
    variantId: asRequiredString(body.variantId, "variantId"),
    contact: parseContact(body.contact),
    address,
    guestCount,
    eventDate: required(asOptionalEventDate(eventDate), "eventDate"),
    eventStartTime: required(
      asOptionalTime(eventStartTime, "eventStartTime"),
      "eventStartTime",
    ),
    eventEndTime: required(
      asOptionalTime(eventEndTime, "eventEndTime"),
      "eventEndTime",
    ),
    pickupOption,
    details: {
      ...details,
      ...schedule,
      accessNotes: details.accessType === "SPECIAL" ? details.accessNotes : null,
    },
    clientTableDetails,
    uploads,
  };
}

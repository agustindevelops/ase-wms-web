import {
  calculateDinnerExperienceQuote,
  experienceLabel,
  isOutsideServiceArea,
  type AccessType,
} from "@/lib/order/dinnerExperience";
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
 * are built here; any total sent by the browser is ignored.
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
  const usesClientFurniture = clientTableDetails !== null;

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
  const quote = calculateDinnerExperienceQuote({
    guestCount,
    usesClientFurniture,
    accessType: details.accessType as AccessType,
    isLateNightPickup: pickupOption === "LATE_NIGHT",
    isOutsideServiceArea: isOutsideServiceArea(address),
  });

  return {
    packageId: asRequiredString(body.packageId, "packageId"),
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
    quote: quote.quotedTotalCents,
    experienceLabel: `${experienceLabel(usesClientFurniture)} · ${guestCount} guests`,
    details: {
      ...details,
      ...schedule,
      accessNotes: details.accessType === "SPECIAL" ? details.accessNotes : null,
    },
    clientTableDetails,
    uploads: parseBookingPhotos(body.uploads, usesClientFurniture),
  };
}

import { type AccessType, AT_HOME_EXPERIENCE_PRICING } from "./constants";
import { AtHomeExperienceError } from "./errors";

export type AtHomeExperienceQuoteInput = {
  guestCount: number;
  /** Persisted as the presence of ClientTableDetails, not a column. */
  usesClientFurniture: boolean;
  accessType: AccessType;
  isLateNightPickup: boolean;
  isOutsideServiceArea?: boolean;
};

export type AtHomeExperienceQuote = {
  basePriceCents: number;
  guestAdjustmentCents: number;
  accessFeeCents: number;
  pickupFeeCents: number;
  travelFeeCents: number;
  quotedTotalCents: number;
};

export function isValidGuestCount(guestCount: number): boolean {
  return (
    Number.isInteger(guestCount) &&
    guestCount >= AT_HOME_EXPERIENCE_PRICING.baseGuestCount &&
    guestCount <= AT_HOME_EXPERIENCE_PRICING.maxGuestCount
  );
}

export function calculateAtHomeExperienceQuote(
  input: AtHomeExperienceQuoteInput,
): AtHomeExperienceQuote {
  const pricing = AT_HOME_EXPERIENCE_PRICING;
  if (!isValidGuestCount(input.guestCount)) {
    throw new AtHomeExperienceError(
      `Guest count must be between ${pricing.baseGuestCount} and ${pricing.maxGuestCount}.`,
    );
  }

  const basePriceCents = input.usesClientFurniture
    ? pricing.clientFurnitureBaseCents
    : pricing.ourFurnitureBaseCents;
  const guestAdjustmentCents =
    (input.guestCount - pricing.baseGuestCount) * pricing.additionalGuestCents;
  const accessFeeCents =
    input.accessType === "SPECIAL" ? pricing.specialAccessCents : 0;
  const pickupFeeCents = input.isLateNightPickup
    ? pricing.lateNightPickupCents
    : 0;
  const travelFeeCents = input.isOutsideServiceArea
    ? pricing.outsideServiceAreaCents
    : 0;

  return {
    basePriceCents,
    guestAdjustmentCents,
    accessFeeCents,
    pickupFeeCents,
    travelFeeCents,
    quotedTotalCents:
      basePriceCents +
      guestAdjustmentCents +
      accessFeeCents +
      pickupFeeCents +
      travelFeeCents,
  };
}

/** Distance-based service area is not automated yet; every address is inside. */
export function isOutsideServiceArea(_address: {
  zipcode: string;
  city: string;
  state: string;
}): boolean {
  return false;
}

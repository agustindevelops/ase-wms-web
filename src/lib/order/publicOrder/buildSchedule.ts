import {
  assertEventTimes,
  calculatePickupWindow,
  calculateSetupWindow,
  AT_HOME_EXPERIENCE_PRICING,
  AtHomeExperienceError,
  earliestBookableDate,
  isValidGuestCount,
  type PickupOption,
} from "@/lib/order/atHomeExperience";

import { badRequest } from "./parseHelpers";

export type ScheduleInput = {
  guestCount: number;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  pickupOption: PickupOption;
  morningPickupTime: string | null;
};

function assertBookable(input: ScheduleInput, setupStartsAt: Date) {
  if (!isValidGuestCount(input.guestCount)) {
    const { baseGuestCount, maxGuestCount } = AT_HOME_EXPERIENCE_PRICING;
    throw new AtHomeExperienceError(
      `Guest count must be between ${baseGuestCount} and ${maxGuestCount}.`,
    );
  }
  if (setupStartsAt.getTime() <= Date.now()) {
    throw new AtHomeExperienceError("Event must be scheduled in the future.");
  }
  const earliest = earliestBookableDate();
  if (input.eventDate < earliest) {
    throw new AtHomeExperienceError(
      `Event date must be ${earliest} or later.`,
    );
  }
}

/** Setup and pickup windows for OrderDetails; booking-rule failures become 400s. */
export function buildSchedule(input: ScheduleInput) {
  try {
    assertEventTimes(input.eventDate, input.eventStartTime, input.eventEndTime);
    const setup = calculateSetupWindow(input.eventDate, input.eventStartTime);
    assertBookable(input, setup.setupStartsAt);
    return { ...setup, ...calculatePickupWindow(input) };
  } catch (error) {
    if (error instanceof AtHomeExperienceError) {
      badRequest(error.message);
    }
    throw error;
  }
}

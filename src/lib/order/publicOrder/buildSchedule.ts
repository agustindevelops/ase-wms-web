import {
  assertEventTimes,
  calculatePickupWindow,
  calculateSetupWindow,
  DINNER_EXPERIENCE_PRICING,
  DinnerExperienceError,
  isValidGuestCount,
  type PickupOption,
} from "@/lib/order/dinnerExperience";

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
    const { baseGuestCount, maxGuestCount } = DINNER_EXPERIENCE_PRICING;
    throw new DinnerExperienceError(
      `Guest count must be between ${baseGuestCount} and ${maxGuestCount}.`,
    );
  }
  if (setupStartsAt.getTime() <= Date.now()) {
    throw new DinnerExperienceError("Event must be scheduled in the future.");
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
    if (error instanceof DinnerExperienceError) {
      badRequest(error.message);
    }
    throw error;
  }
}

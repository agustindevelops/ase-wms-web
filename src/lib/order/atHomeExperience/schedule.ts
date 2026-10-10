import {
  NEXT_MORNING_PICKUP_TIMES,
  PICKUP_RULES,
  type PickupOption,
} from "./constants";
import {
  addDays,
  isValidDateString,
  isValidTimeString,
  timeToMinutes,
  zonedDateTime,
} from "./dateTime";
import { AtHomeExperienceError } from "./errors";
import { pickupLabel } from "./labels";

const MINUTE_MS = 60 * 1000;

export function assertEventTimes(
  eventDate: string,
  eventStartTime: string,
  eventEndTime: string,
) {
  if (!isValidDateString(eventDate)) {
    throw new AtHomeExperienceError("Event date must be YYYY-MM-DD.");
  }
  if (!isValidTimeString(eventStartTime) || !isValidTimeString(eventEndTime)) {
    throw new AtHomeExperienceError("Event times must be HH:mm.");
  }
  if (timeToMinutes(eventEndTime) <= timeToMinutes(eventStartTime)) {
    throw new AtHomeExperienceError(
      "Event end time must be after the start time on the same day.",
    );
  }
}

/** Setup is the two hours immediately before the event starts. */
export function calculateSetupWindow(eventDate: string, eventStartTime: string) {
  const setupEndsAt = zonedDateTime(eventDate, eventStartTime);
  const setupStartsAt = new Date(
    setupEndsAt.getTime() - PICKUP_RULES.setupHours * 60 * MINUTE_MS,
  );
  return { setupStartsAt, setupEndsAt };
}

const endsBeforeSameDayCutoff = (eventEndTime: string) =>
  timeToMinutes(eventEndTime) < PICKUP_RULES.sameDayPickupCutoffHour * 60;

export function getAvailablePickupOptions(eventEndTime: string): PickupOption[] {
  return endsBeforeSameDayCutoff(eventEndTime)
    ? ["SAME_DAY", "NEXT_MORNING"]
    : ["NEXT_MORNING", "LATE_NIGHT"];
}

export function getDefaultPickupOption(eventEndTime: string): PickupOption {
  return endsBeforeSameDayCutoff(eventEndTime) ? "SAME_DAY" : "NEXT_MORNING";
}

/** Events ending at 10 PM or later get a prominent next-morning prompt. */
export function isLateEvent(eventEndTime: string): boolean {
  return timeToMinutes(eventEndTime) >= PICKUP_RULES.lateEventHour * 60;
}

function windowFrom(pickupStartsAt: Date, minutes: number) {
  return {
    pickupStartsAt,
    pickupEndsAt: new Date(pickupStartsAt.getTime() + minutes * MINUTE_MS),
  };
}

export function calculatePickupWindow(input: {
  eventDate: string;
  eventEndTime: string;
  pickupOption: PickupOption;
  morningPickupTime: string | null;
}) {
  if (!getAvailablePickupOptions(input.eventEndTime).includes(input.pickupOption)) {
    throw new AtHomeExperienceError(
      `${pickupLabel(input.pickupOption)} is not available for an event ending at ${input.eventEndTime}.`,
    );
  }

  if (input.pickupOption === "NEXT_MORNING") {
    const time = input.morningPickupTime;
    if (
      !time ||
      !(NEXT_MORNING_PICKUP_TIMES as readonly string[]).includes(time)
    ) {
      throw new AtHomeExperienceError(
        "Choose a next-morning pickup time between 8:00 AM and 11:00 AM.",
      );
    }
    return windowFrom(
      zonedDateTime(addDays(input.eventDate, 1), time),
      PICKUP_RULES.morningPickupMinutes,
    );
  }

  return windowFrom(
    zonedDateTime(input.eventDate, input.eventEndTime),
    PICKUP_RULES.sameDayPickupMinutes,
  );
}

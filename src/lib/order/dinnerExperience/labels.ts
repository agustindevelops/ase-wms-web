import type { PickupOption } from "./constants";

export function experienceLabel(usesClientFurniture: boolean): string {
  return usesClientFurniture ? "Dinner Styling" : "Full Dinner Experience";
}

export function pickupLabel(option: PickupOption): string {
  switch (option) {
    case "SAME_DAY":
      return "Same-day pickup";
    case "NEXT_MORNING":
      return "Next-morning pickup";
    case "LATE_NIGHT":
      return "Late-night same-day pickup";
  }
}

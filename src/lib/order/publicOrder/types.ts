import type { PickupOption } from "@/lib/order/atHomeExperience";
import type {
  AddressInput,
  ClientTableDetailsInput,
  ContactInput,
  OrderDetailsInput,
  OrderUploadInput,
} from "@/lib/order/orderFields";

export type PublicOrderInput = {
  packageId: string;
  variantId: string;
  contact: ContactInput;
  address: AddressInput;
  guestCount: number;
  eventDate: Date;
  eventStartTime: Date;
  eventEndTime: Date;
  details: OrderDetailsInput;
  clientTableDetails: ClientTableDetailsInput | null;
  uploads: OrderUploadInput[];
  pickupOption: PickupOption;
};

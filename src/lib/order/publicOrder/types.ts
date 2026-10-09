import type {
  AddressInput,
  ClientTableDetailsInput,
  ContactInput,
  OrderDetailsInput,
  OrderUploadInput,
} from "@/lib/order/orderFields";

export type PublicOrderInput = {
  packageId: string;
  contact: ContactInput;
  address: AddressInput;
  guestCount: number;
  eventDate: Date;
  eventStartTime: Date;
  eventEndTime: Date;
  /** Cents, calculated on the server from the submitted facts. */
  quote: number;
  experienceLabel: string;
  details: OrderDetailsInput;
  clientTableDetails: ClientTableDetailsInput | null;
  uploads: OrderUploadInput[];
};

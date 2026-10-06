import type { OrderStatusOption } from "@/lib/query/lookups";

export type IssueType = "MISSING" | "BROKEN";

export type OrderIssue = {
  id: string;
  type: IssueType;
  quantity: number;
  notes: string | null;
  createdAt: string;
};

export type OrderItem = {
  id: string;
  itemId: string;
  qtyRequested: number;
  qtyPicked: number;
  qtyReturned: number;
  item: { id: string; name: string; warehouseId: string | null };
  issues: OrderIssue[];
};

export type OrderContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type OrderAddress = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  country: string | null;
};

export type OrderDetailsFields = {
  setupStartsAt: string | null;
  setupEndsAt: string | null;
  pickupStartsAt: string | null;
  pickupEndsAt: string | null;
  isPrivateHome: boolean;
  outletsAvailable: boolean;
  accessType: string;
  accessNotes: string | null;
  allowMarketingPhotos: boolean;
  specialNotes: string | null;
};

export type ClientTableDetails = {
  tableShape: string;
  tableDimensions: string;
  numberOfTables: number;
  numberOfChairs: number;
};

export type OrderUpload = {
  id?: string;
  uploadType: string;
  fileUrl: string;
};

export type OrderDetail = {
  id: string;
  name: string;
  eventDate: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  guestCount: number | null;
  quote: number | null;
  stripeCheckoutSessionId: string | null;
  statusId: string;
  status: OrderStatusOption;
  createdBy: { id: string; email: string } | null;
  contact: OrderContact | null;
  address: OrderAddress | null;
  package: { id: string; name: string; basePriceCents: number } | null;
  details: OrderDetailsFields | null;
  clientTableDetails: ClientTableDetails | null;
  uploads: OrderUpload[];
  items: OrderItem[];
};

/** ISO instant → value for <input type="datetime-local"> in the browser's zone. */
export function isoToLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value (browser zone) → ISO instant. */
export function localInputToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

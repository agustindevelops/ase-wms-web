/** MVP lookup + bootstrap constants. One warehouse until multi-warehouse lands. */

export const ADMIN_ROLE_CODE = "ADMIN";
export const ADMIN_ROLE_NAME = "Admin";
export const ADMIN_ROLE_DESCRIPTION =
  "Organization administrator. Assigned through organization membership.";

export const ANIAH_ORGANIZATION = {
  name: "Aniah Social Events",
  slug: "aniah-social-events",
  contactEmail: "aniahsocialevents@gmail.com",
  websiteUrl: "https://www.aniahsocialevents.com",
} as const;

export const ANIAH_ADMIN_EMAIL = "aniahsocialevents@gmail.com";
export const ANIAH_WAREHOUSE_NAME = "Lemon Tree";

/** QR_CODE_TYPE.code — never pass these as QrCode.typeId; look up the row by code. */
export const QR_CODE_TYPE_ITEM = 0;
export const QR_CODE_TYPE_LOCATION = 1;

export const QR_CODE_TYPE_IDS = {
  ITEM: "qrt_item",
  LOCATION: "qrt_location",
} as const;

export const QR_CODE_TYPES = [
  {
    id: QR_CODE_TYPE_IDS.ITEM,
    code: QR_CODE_TYPE_ITEM,
    name: "Item",
  },
  {
    id: QR_CODE_TYPE_IDS.LOCATION,
    code: QR_CODE_TYPE_LOCATION,
    name: "Warehouse location unit",
  },
] as const;

export const LOCATION_UNIT_TYPE_IDS = {
  WAREHOUSE: "lut_warehouse",
  ZONE: "lut_zone",
  AISLE: "lut_aisle",
  RACK: "lut_rack",
  SHELF: "lut_shelf",
  WALL: "lut_wall",
} as const;

export const LOCATION_UNIT_TYPES = [
  { id: LOCATION_UNIT_TYPE_IDS.WAREHOUSE, code: "WAREHOUSE", name: "Warehouse" },
  { id: LOCATION_UNIT_TYPE_IDS.ZONE, code: "ZONE", name: "Zone" },
  { id: LOCATION_UNIT_TYPE_IDS.AISLE, code: "AISLE", name: "Aisle" },
  { id: LOCATION_UNIT_TYPE_IDS.RACK, code: "RACK", name: "Rack" },
  { id: LOCATION_UNIT_TYPE_IDS.SHELF, code: "SHELF", name: "Shelf" },
  { id: LOCATION_UNIT_TYPE_IDS.WALL, code: "WALL", name: "Wall" },
] as const;

/** Child type from parent type. Root units (no parent) are ZONE. */
export const CHILD_LOCATION_UNIT_TYPE_CODE: Record<string, string> = {
  WAREHOUSE: "ZONE",
  ZONE: "AISLE",
  AISLE: "RACK",
  RACK: "SHELF",
};

/** ITEM_CATEGORY seed — event-rental starters for catalog picker. */
export const ITEM_CATEGORY_IDS = {
  PLATE: "ic_plate",
  CUP: "ic_cup",
  FLATWARE: "ic_flatware",
  GLASSWARE: "ic_glassware",
  CHAIR: "ic_chair",
  TABLE: "ic_table",
  LINEN: "ic_linen",
  DECOR: "ic_decor",
  LIGHTING: "ic_lighting",
  SERVING: "ic_serving",
  OTHER: "ic_other",
} as const;

export const ITEM_CATEGORIES = [
  { id: ITEM_CATEGORY_IDS.PLATE, code: "PLATE", name: "Plate" },
  { id: ITEM_CATEGORY_IDS.CUP, code: "CUP", name: "Cup" },
  { id: ITEM_CATEGORY_IDS.FLATWARE, code: "FLATWARE", name: "Flatware" },
  { id: ITEM_CATEGORY_IDS.GLASSWARE, code: "GLASSWARE", name: "Glassware" },
  { id: ITEM_CATEGORY_IDS.CHAIR, code: "CHAIR", name: "Chair" },
  { id: ITEM_CATEGORY_IDS.TABLE, code: "TABLE", name: "Table" },
  { id: ITEM_CATEGORY_IDS.LINEN, code: "LINEN", name: "Linen" },
  { id: ITEM_CATEGORY_IDS.DECOR, code: "DECOR", name: "Decor" },
  { id: ITEM_CATEGORY_IDS.LIGHTING, code: "LIGHTING", name: "Lighting" },
  { id: ITEM_CATEGORY_IDS.SERVING, code: "SERVING", name: "Serving" },
  { id: ITEM_CATEGORY_IDS.OTHER, code: "OTHER", name: "Other" },
] as const;

export const ISSUE_TYPE_MISSING = "MISSING";
export const ISSUE_TYPE_BROKEN = "BROKEN";
export const ISSUE_TYPES = [ISSUE_TYPE_MISSING, ISSUE_TYPE_BROKEN] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ORDER_STATUS_PAYMENT_PENDING = "PAYMENT_PENDING";
export const ORDER_STATUS_PAYMENT_PROCESSED = "PAYMENT_PROCESSED";
export const ORDER_STATUS_PAID = "PAID";
export const ORDER_STATUS_PICKED_UP = "PICKED_UP";
export const ORDER_STATUS_RETURNED = "RETURNED";

/** Public intake statuses. Not pickable; an admin moves the order to PAID. */
export const PAYMENT_ORDER_STATUS_CODES = [
  ORDER_STATUS_PAYMENT_PENDING,
  ORDER_STATUS_PAYMENT_PROCESSED,
] as const;

export function isPaymentOrderStatus(code: string | null | undefined): boolean {
  return (
    code != null &&
    (PAYMENT_ORDER_STATUS_CODES as readonly string[]).includes(code)
  );
}

/** @deprecated Prefer ORDER_STATUS / helpers in `@/lib/order/orderStatus`. */
export const PICKUP_ORDER_STATUS_CODES = [ORDER_STATUS_PAID] as const;
/** @deprecated Prefer ORDER_STATUS / helpers in `@/lib/order/orderStatus`. */
export const RETURN_ORDER_STATUS_CODES = [ORDER_STATUS_PICKED_UP] as const;

export const ORDER_STATUS_IDS = {
  PAYMENT_PENDING: "os_payment_pending",
  PAYMENT_PROCESSED: "os_payment_processed",
  PAID: "os_paid",
  PICKED_UP: "os_picked_up",
  RETURNED: "os_returned",
} as const;

export const ORDER_STATUSES = [
  {
    id: ORDER_STATUS_IDS.PAYMENT_PENDING,
    code: ORDER_STATUS_PAYMENT_PENDING,
    name: "Payment pending",
  },
  {
    id: ORDER_STATUS_IDS.PAYMENT_PROCESSED,
    code: ORDER_STATUS_PAYMENT_PROCESSED,
    name: "Payment processed",
  },
  { id: ORDER_STATUS_IDS.PAID, code: ORDER_STATUS_PAID, name: "Paid" },
  {
    id: ORDER_STATUS_IDS.PICKED_UP,
    code: ORDER_STATUS_PICKED_UP,
    name: "Picked up",
  },
  {
    id: ORDER_STATUS_IDS.RETURNED,
    code: ORDER_STATUS_RETURNED,
    name: "Returned",
  },
] as const;

/** OrderDetails.accessType values (not a DB lookup table). */
export const ORDER_ACCESS_TYPES = [
  { code: "STANDARD", name: "Standard" },
  { code: "SPECIAL", name: "Special" },
] as const;

/** ClientTableDetails.tableShape values (not a DB lookup table). */
export const TABLE_SHAPES = [
  { code: "RECTANGULAR", name: "Rectangular" },
  { code: "ROUND", name: "Round" },
  { code: "SQUARE", name: "Square" },
  { code: "OTHER", name: "Other" },
] as const;

/** OrderUpload.uploadType values (not a DB lookup table). */
export const ORDER_UPLOAD_TYPES = [
  { code: "SETUP_SPACE", name: "Setup space" },
  { code: "CLIENT_FURNITURE", name: "Client furniture" },
] as const;

/** Item.material picker values for catalog (not a DB lookup table). */
export const ITEM_MATERIALS = [
  { code: "PLASTIC", name: "Plastic" },
  { code: "CERAMIC", name: "Ceramic" },
  { code: "GLASS", name: "Glass" },
  { code: "METAL", name: "Metal" },
  { code: "FABRIC", name: "Fabric" },
  { code: "WOOD", name: "Wood" },
] as const;

/** Item.condition picker values (not a DB lookup table). */
export const ITEM_CONDITIONS = [
  { code: "NEW", name: "New" },
  { code: "GOOD", name: "Good" },
  { code: "FAIR", name: "Fair" },
  { code: "DAMAGED", name: "Damaged" },
] as const;

/** Item.disposition picker values (not a DB lookup table). */
export const ITEM_DISPOSITIONS = [
  { code: "BUSINESS", name: "Business" },
  { code: "PERSONAL", name: "Personal" },
  { code: "SELL", name: "Sell" },
  { code: "DISCARD", name: "Discard" },
  { code: "MISSING", name: "Missing" },
  { code: "BROKEN", name: "Broken" },
] as const;

export const MANUAL_ARCHIVE_DISPOSITION_CODES = ["SELL", "DISCARD"] as const;
export const ISSUE_ARCHIVE_DISPOSITION_CODES = [
  ISSUE_TYPE_MISSING,
  ISSUE_TYPE_BROKEN,
] as const;
export const ARCHIVED_DISPOSITION_CODES = [
  ...MANUAL_ARCHIVE_DISPOSITION_CODES,
  ...ISSUE_ARCHIVE_DISPOSITION_CODES,
] as const;

export function isArchivedDisposition(
  disposition: string | null | undefined,
): boolean {
  return (
    disposition != null &&
    (ARCHIVED_DISPOSITION_CODES as readonly string[]).includes(disposition)
  );
}

export function isIssueArchivedDisposition(
  disposition: string | null | undefined,
): boolean {
  return (
    disposition != null &&
    (ISSUE_ARCHIVE_DISPOSITION_CODES as readonly string[]).includes(disposition)
  );
}

/** UserActivity.action codes for dashboard / activity feed. */
export const USER_ACTIVITY_ACTIONS = {
  ITEM_CREATED: "ITEM_CREATED",
  ITEM_UPDATED: "ITEM_UPDATED",
  ITEM_QR_ATTACHED: "ITEM_QR_ATTACHED",
  ITEM_QR_REMOVED: "ITEM_QR_REMOVED",
  ITEM_LOCATION_SET: "ITEM_LOCATION_SET",
  ITEM_LOCATION_CLEARED: "ITEM_LOCATION_CLEARED",
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_UPDATED: "ORDER_UPDATED",
  ORDER_LINE_ADDED: "ORDER_LINE_ADDED",
  ORDER_LINE_UPDATED: "ORDER_LINE_UPDATED",
  ORDER_LINE_REMOVED: "ORDER_LINE_REMOVED",
  ORDER_PACKAGE_ADDED: "ORDER_PACKAGE_ADDED",
  ORDER_PICKED: "ORDER_PICKED",
  ORDER_RETURNED: "ORDER_RETURNED",
  ISSUE_REPORTED: "ISSUE_REPORTED",
  WAREHOUSE_UPDATED: "WAREHOUSE_UPDATED",
  LOCATION_UNIT_CREATED: "LOCATION_UNIT_CREATED",
  LOCATION_UNIT_UPDATED: "LOCATION_UNIT_UPDATED",
  LOCATION_UNIT_DELETED: "LOCATION_UNIT_DELETED",
  LOCATION_QR_ATTACHED: "LOCATION_QR_ATTACHED",
  LOCATION_QR_REMOVED: "LOCATION_QR_REMOVED",
  FILE_UPLOADED: "FILE_UPLOADED",
  PACKAGE_CREATED: "PACKAGE_CREATED",
  PACKAGE_UPDATED: "PACKAGE_UPDATED",
  PACKAGE_DELETED: "PACKAGE_DELETED",
} as const;

export type UserActivityAction =
  (typeof USER_ACTIVITY_ACTIONS)[keyof typeof USER_ACTIVITY_ACTIONS];

/** UserActivity.entityType codes. */
export const USER_ACTIVITY_ENTITY_TYPES = {
  ITEM: "ITEM",
  EVENT_ORDER: "EVENT_ORDER",
  ISSUE: "ISSUE",
  LOCATION_UNIT: "LOCATION_UNIT",
  QR_CODE: "QR_CODE",
  FILE: "FILE",
  WAREHOUSE: "WAREHOUSE",
  PACKAGE: "PACKAGE",
} as const;

export type UserActivityEntityType =
  (typeof USER_ACTIVITY_ENTITY_TYPES)[keyof typeof USER_ACTIVITY_ENTITY_TYPES];

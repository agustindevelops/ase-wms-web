/** MVP lookup + bootstrap constants. One warehouse until multi-warehouse lands. */

export const ADMIN_ROLE_CODE = "ADMIN";
export const ADMIN_ROLE_NAME = "Admin";
export const ADMIN_ROLE_DESCRIPTION =
  "MVP warehouse administrator role. Assigned through warehouse membership.";

/** Hardcoded default warehouse created on first login if none exists yet. */
export const DEFAULT_WAREHOUSE_ID = "wh_aniah_default";
export const DEFAULT_WAREHOUSE_NAME = "Aniah Social Events";

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

export const ORDER_STATUS_PAID = "PAID";
export const ORDER_STATUS_PICKED_UP = "PICKED_UP";
export const ORDER_STATUS_RETURNED = "RETURNED";

export const PICKUP_ORDER_STATUS_CODES = [ORDER_STATUS_PAID] as const;
export const RETURN_ORDER_STATUS_CODES = [ORDER_STATUS_PICKED_UP] as const;

export const ORDER_STATUS_IDS = {
  PAID: "os_paid",
  PICKED_UP: "os_picked_up",
  RETURNED: "os_returned",
} as const;

export const ORDER_STATUSES = [
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
] as const;

export const ARCHIVED_DISPOSITION_CODES = ["SELL", "DISCARD"] as const;

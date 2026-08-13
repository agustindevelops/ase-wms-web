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

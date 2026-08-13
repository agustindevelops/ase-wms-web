export type LookupOption = { code: string; name: string };

export type CategoryOption = { id: string; code: string; name: string };

export type InventoryFile = {
  id: string;
  publicUrl: string | null;
  status: string;
  sortOrder: number;
  contentType: string;
  readUrl: string | null;
};

export type InventoryItem = {
  id: string;
  warehouseId: string;
  name: string;
  quantityOwned: number;
  quantityAvailable: number;
  categoryId: string | null;
  locationUnitId: string | null;
  description: string | null;
  material: string | null;
  unitRentalPrice: string | number | null;
  purchaseLink: string | null;
  replacementCost: string | number | null;
  condition: string | null;
  disposition: string | null;
  notes: string | null;
  category: CategoryOption | null;
  warehouse: { id: string; name: string } | null;
  locationUnit: { id: string; name: string; label: string | null } | null;
  locationPath: string | null;
  files: InventoryFile[];
};

export type InventoryFormValues = {
  name: string;
  quantity: string;
  categoryId: string;
  material: string;
  description: string;
  unitRentalPrice: string;
  purchaseLink: string;
  replacementCost: string;
  condition: string;
  disposition: string;
  notes: string;
};

export const emptyInventoryForm: InventoryFormValues = {
  name: "",
  quantity: "1",
  categoryId: "",
  material: "",
  description: "",
  unitRentalPrice: "",
  purchaseLink: "",
  replacementCost: "",
  condition: "",
  disposition: "",
  notes: "",
};

export function moneyToInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value);
}

export function itemToForm(item: InventoryItem): InventoryFormValues {
  return {
    name: item.name,
    quantity: String(item.quantityOwned),
    categoryId: item.categoryId ?? "",
    material: item.material ?? "",
    description: item.description ?? "",
    unitRentalPrice: moneyToInput(item.unitRentalPrice),
    purchaseLink: item.purchaseLink ?? "",
    replacementCost: moneyToInput(item.replacementCost),
    condition: item.condition ?? "",
    disposition: item.disposition ?? "",
    notes: item.notes ?? "",
  };
}

export function formToPayload(values: InventoryFormValues) {
  return {
    name: values.name.trim(),
    quantity: Number(values.quantity),
    categoryId: values.categoryId || null,
    material: values.material || null,
    description: values.description.trim() || null,
    unitRentalPrice: values.unitRentalPrice.trim() || null,
    purchaseLink: values.purchaseLink.trim() || null,
    replacementCost: values.replacementCost.trim() || null,
    condition: values.condition || null,
    disposition: values.disposition || null,
    notes: values.notes.trim() || null,
  };
}

const fieldClass =
  "w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200";

export { fieldClass };

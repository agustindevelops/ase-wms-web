import "server-only";

import { ISSUE_TYPES, isArchivedDisposition, type IssueType } from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import { CatalogServiceError } from "@/lib/item/errors";
import { getReadUrl } from "@/lib/storage/s3";

export type CreateItemIssueInput = {
  type: IssueType;
  quantity: number;
  notes: string | null;
};

export type CreatedIssue = {
  id: string;
  type: string;
  itemId: string;
  quantity: number;
  notes: string | null;
  createdAt: Date;
};

function asPositiveQty(value: unknown, field: string): number {
  const qty =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new CatalogServiceError(
      "Bad Request",
      `${field} must be an integer greater than 0`,
    );
  }
  return qty;
}

export type IssueListItem = {
  id: string;
  type: IssueType;
  quantity: number;
  notes: string | null;
  createdAt: Date;
  item: {
    id: string;
    name: string;
    files: Array<{ id: string; readUrl: string | null }>;
  };
  createdBy: { id: string; email: string };
  order: { id: string; name: string } | null;
};

async function fileReadUrl(file: {
  publicUrl: string | null;
  status: string;
  s3Key: string;
}): Promise<string | null> {
  if (file.publicUrl) {
    return file.publicUrl;
  }
  if (file.status !== "uploaded") {
    return null;
  }
  try {
    return await getReadUrl(file.s3Key);
  } catch {
    return null;
  }
}

export function parseIssueTypeFilter(params: URLSearchParams): IssueType[] {
  const raw = params.getAll("type").flatMap((value) => value.split(","));
  const types: IssueType[] = [];
  for (const value of raw) {
    const type = value.trim().toUpperCase();
    if (!type) {
      continue;
    }
    if (!ISSUE_TYPES.includes(type as IssueType)) {
      throw new CatalogServiceError(
        "Bad Request",
        "type must be MISSING or BROKEN",
      );
    }
    if (!types.includes(type as IssueType)) {
      types.push(type as IssueType);
    }
  }
  return types;
}

export async function listIssues(
  organizationId: string,
  types: IssueType[] = [],
): Promise<IssueListItem[]> {
  const rows = await prisma.issue.findMany({
    where: {
      organizationId,
      ...(types.length > 0 ? { type: { in: types } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      quantity: true,
      notes: true,
      createdAt: true,
      item: {
        select: {
          id: true,
          name: true,
          files: {
            where: { status: "uploaded" },
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: {
              id: true,
              publicUrl: true,
              status: true,
              s3Key: true,
            },
          },
        },
      },
      createdBy: { select: { id: true, email: true } },
      orderLine: {
        select: {
          order: { select: { id: true, name: true } },
        },
      },
    },
  });

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      type: row.type as IssueType,
      quantity: row.quantity,
      notes: row.notes,
      createdAt: row.createdAt,
      item: {
        id: row.item.id,
        name: row.item.name,
        files: await Promise.all(
          row.item.files.map(async (file) => ({
            id: file.id,
            readUrl: await fileReadUrl(file),
          })),
        ),
      },
      createdBy: row.createdBy,
      order: row.orderLine?.order ?? null,
    })),
  );
}

export function parseCreateIssueBody(
  body: Record<string, unknown>,
): CreateItemIssueInput {
  if (typeof body.type !== "string" || !body.type.trim()) {
    throw new CatalogServiceError("Bad Request", "type is required");
  }
  const type = body.type.trim();
  if (!ISSUE_TYPES.includes(type as IssueType)) {
    throw new CatalogServiceError(
      "Bad Request",
      "type must be MISSING or BROKEN",
    );
  }

  let notes: string | null = null;
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== "string") {
      throw new CatalogServiceError("Bad Request", "notes must be a string");
    }
    notes = body.notes.trim() || null;
  }

  return {
    type: type as IssueType,
    quantity: asPositiveQty(body.quantity, "quantity"),
    notes,
  };
}

async function decrementStockField(
  tx: Pick<typeof prisma, "inventoryStock">,
  stocks: Array<{
    id: string;
    quantityOwned: number;
    quantityAvailable: number;
  }>,
  quantity: number,
  field: "quantityOwned" | "quantityAvailable",
) {
  let remaining = quantity;
  for (const stock of stocks) {
    if (remaining <= 0) {
      break;
    }
    const available = stock[field];
    const take = Math.min(available, remaining);
    if (take <= 0) {
      continue;
    }
    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: { [field]: { decrement: take } },
    });
    stock[field] -= take;
    remaining -= take;
  }
  if (remaining > 0) {
    throw new CatalogServiceError(
      field === "quantityOwned" ? "INSUFFICIENT_OWNED" : "INSUFFICIENT_AVAILABLE",
      field === "quantityOwned"
        ? "Not enough owned stock to record this issue"
        : "Not enough available stock to record this issue",
    );
  }
}

/**
 * Standalone MISSING/BROKEN against an item (no order line).
 * Caps against total owned inventory. Available is reduced only as far as
 * it exists so items out on events can still be written off.
 */
export async function createItemIssue(
  organizationId: string,
  itemId: string,
  createdByUserId: string,
  input: CreateItemIssueInput,
): Promise<CreatedIssue> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findFirst({
      where: { id: itemId, organizationId },
      select: {
        id: true,
        disposition: true,
        stocks: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            quantityOwned: true,
            quantityAvailable: true,
          },
        },
      },
    });
    if (!item) {
      throw new CatalogServiceError("ITEM_NOT_FOUND", "Item not found", 404);
    }

    const quantityOwned = item.stocks.reduce(
      (sum, stock) => sum + stock.quantityOwned,
      0,
    );
    const quantityAvailable = item.stocks.reduce(
      (sum, stock) => sum + stock.quantityAvailable,
      0,
    );

    if (isArchivedDisposition(item.disposition) || quantityOwned <= 0) {
      throw new CatalogServiceError(
        "ITEM_ARCHIVED",
        "This item is archived (missing, broken, or removed).",
        409,
      );
    }
    if (input.quantity > quantityOwned) {
      throw new CatalogServiceError(
        "INSUFFICIENT_OWNED",
        `Only ${quantityOwned} owned`,
      );
    }

    const issue = await tx.issue.create({
      data: {
        organizationId,
        type: input.type,
        itemId: item.id,
        quantity: input.quantity,
        notes: input.notes,
        createdByUserId,
      },
      select: {
        id: true,
        type: true,
        itemId: true,
        quantity: true,
        notes: true,
        createdAt: true,
      },
    });

    const mutableStocks = item.stocks.map((stock) => ({ ...stock }));
    await decrementStockField(
      tx,
      mutableStocks,
      input.quantity,
      "quantityOwned",
    );
    const availableToRemove = Math.min(input.quantity, quantityAvailable);
    if (availableToRemove > 0) {
      await decrementStockField(
        tx,
        item.stocks.map((stock) => ({ ...stock })),
        availableToRemove,
        "quantityAvailable",
      );
    }

    const nextOwned = quantityOwned - input.quantity;
    if (nextOwned <= 0) {
      await tx.item.update({
        where: { id: item.id },
        data: { disposition: input.type },
      });
    }

    return issue;
  });
}

import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ARCHIVED_DISPOSITION_CODES } from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";

export type ItemSearchResult = {
  id: string;
  name: string;
  categoryName: string | null;
  quantityOwned: number;
  quantityAvailable: number;
};

/** Lower = more typo tolerant (and noisier). pg_trgm default is 0.6. */
const WORD_SIMILARITY_THRESHOLD = 0.3;
export const ITEM_SEARCH_MAX_LIMIT = 25;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Fuzzy search over active catalog items. Substring matches always qualify;
 * trigram word similarity catches typos ("chiar" → "Gold chair"). Prefix
 * matches rank first, then similarity. Empty query lists items A–Z.
 */
export async function searchItems(
  organizationId: string,
  query: string,
  limit: number,
): Promise<ItemSearchResult[]> {
  const q = query.trim().slice(0, 100);
  const archived = Prisma.join([...ARCHIVED_DISPOSITION_CODES]);
  const contains = `%${escapeLike(q)}%`;
  const prefix = `${escapeLike(q)}%`;

  const match = q
    ? Prisma.sql`AND (
        i."name" ILIKE ${contains}
        OR c."name" ILIKE ${contains}
        OR word_similarity(${q}, i."name") >= ${WORD_SIMILARITY_THRESHOLD}
      )`
    : Prisma.empty;
  const order = q
    ? Prisma.sql`ORDER BY
        (i."name" ILIKE ${prefix}) DESC,
        GREATEST(word_similarity(${q}, i."name"), similarity(${q}, i."name")) DESC,
        i."name" ASC`
    : Prisma.sql`ORDER BY i."name" ASC`;

  return prisma.$queryRaw<ItemSearchResult[]>`
    SELECT
      i."id",
      i."name",
      c."name" AS "categoryName",
      COALESCE(s.owned, 0)::int AS "quantityOwned",
      COALESCE(s.available, 0)::int AS "quantityAvailable"
    FROM "Item" i
    LEFT JOIN "ItemCategory" c ON c."id" = i."categoryId"
    LEFT JOIN LATERAL (
      SELECT SUM(st."quantityOwned") AS owned, SUM(st."quantityAvailable") AS available
      FROM "InventoryStock" st
      WHERE st."itemId" = i."id" AND st."organizationId" = i."organizationId"
    ) s ON true
    WHERE i."organizationId" = ${organizationId}
      AND (i."disposition" IS NULL OR i."disposition" NOT IN (${archived}))
      ${match}
    ${order}
    LIMIT ${Math.min(Math.max(limit, 1), ITEM_SEARCH_MAX_LIMIT)}
  `;
}

-- AlterTable
ALTER TABLE "Package" ADD COLUMN "slug" TEXT;

-- Backfill from the name ("Fantasy Forest" -> "fantasy-forest"). A name with no
-- letters or digits falls back to the id; later duplicates in an organization
-- get an id suffix so the unique index holds.
WITH base AS (
  SELECT
    "id",
    "organizationId",
    "createdAt",
    COALESCE(
      NULLIF(
        trim(both '-' from left(regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'), 72)),
        ''
      ),
      "id"
    ) AS base_slug
  FROM "Package"
),
ranked AS (
  SELECT
    "id",
    base_slug,
    row_number() OVER (
      PARTITION BY "organizationId", base_slug
      ORDER BY "createdAt", "id"
    ) AS n
  FROM base
)
UPDATE "Package" AS p
SET "slug" = CASE
  WHEN r.n = 1 THEN r.base_slug
  ELSE r.base_slug || '-' || right(p."id", 6)
END
FROM ranked AS r
WHERE r."id" = p."id";

ALTER TABLE "Package" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Package_organizationId_slug_key" ON "Package"("organizationId", "slug");

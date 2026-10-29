-- CreateTable
CREATE TABLE "PackageVariant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preview" VARCHAR(512) NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingForm" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "BookingForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageVariantForm" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageVariantForm_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "EventOrder" ADD COLUMN "packageVariantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PackageVariant_id_organizationId_key" ON "PackageVariant"("id", "organizationId");

-- CreateIndex
CREATE INDEX "PackageVariant_organizationId_idx" ON "PackageVariant"("organizationId");

-- CreateIndex
CREATE INDEX "PackageVariant_packageId_idx" ON "PackageVariant"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingForm_code_key" ON "BookingForm"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PackageVariantForm_id_organizationId_key" ON "PackageVariantForm"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageVariantForm_variantId_formId_key" ON "PackageVariantForm"("variantId", "formId");

-- CreateIndex
CREATE INDEX "PackageVariantForm_organizationId_idx" ON "PackageVariantForm"("organizationId");

-- CreateIndex
CREATE INDEX "PackageVariantForm_variantId_idx" ON "PackageVariantForm"("variantId");

-- CreateIndex
CREATE INDEX "PackageVariantForm_formId_idx" ON "PackageVariantForm"("formId");

-- CreateIndex
CREATE INDEX "EventOrder_packageVariantId_idx" ON "EventOrder"("packageVariantId");

-- AddForeignKey
ALTER TABLE "PackageVariant" ADD CONSTRAINT "PackageVariant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageVariant" ADD CONSTRAINT "PackageVariant_packageId_organizationId_fkey" FOREIGN KEY ("packageId", "organizationId") REFERENCES "Package"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageVariantForm" ADD CONSTRAINT "PackageVariantForm_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageVariantForm" ADD CONSTRAINT "PackageVariantForm_variantId_organizationId_fkey" FOREIGN KEY ("variantId", "organizationId") REFERENCES "PackageVariant"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageVariantForm" ADD CONSTRAINT "PackageVariantForm_formId_fkey" FOREIGN KEY ("formId") REFERENCES "BookingForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_packageVariantId_fkey" FOREIGN KEY ("packageVariantId") REFERENCES "PackageVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the YOUR_TABLES booking form.
INSERT INTO "BookingForm" ("id", "code", "name")
VALUES ('bf_your_tables', 'YOUR_TABLES', 'Your tables');

-- Backfill the two current style options onto every existing package.
INSERT INTO "PackageVariant" (
  "id",
  "organizationId",
  "packageId",
  "name",
  "preview",
  "description",
  "priceCents",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'pv_celeb_' || p."id",
  p."organizationId",
  p."id",
  'Intimate Celebration',
  'We bring the tables, chairs, styling and décor, then set up and pick up.',
  NULL,
  65000,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Package" AS p;

INSERT INTO "PackageVariant" (
  "id",
  "organizationId",
  "packageId",
  "name",
  "preview",
  "description",
  "priceCents",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'pv_style_' || p."id",
  p."organizationId",
  p."id",
  'Intimate Styling',
  'We style your own tables and chairs with our décor, then set up and pick up.',
  NULL,
  45000,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Package" AS p;

INSERT INTO "PackageVariantForm" (
  "id",
  "organizationId",
  "variantId",
  "formId",
  "createdAt"
)
SELECT
  'pvf_style_' || p."id",
  p."organizationId",
  'pv_style_' || p."id",
  'bf_your_tables',
  CURRENT_TIMESTAMP
FROM "Package" AS p;

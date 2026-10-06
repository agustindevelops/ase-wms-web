-- Rename OrderLine -> OrderItem and OrderLineAllocation -> OrderItemAllocation.
-- Renamed in place so existing order data, allocations, and issue links are kept.

ALTER TABLE "OrderLine" RENAME TO "OrderItem";
ALTER TABLE "OrderItem" RENAME CONSTRAINT "OrderLine_pkey" TO "OrderItem_pkey";
ALTER TABLE "OrderItem" RENAME CONSTRAINT "OrderLine_organizationId_fkey" TO "OrderItem_organizationId_fkey";
ALTER TABLE "OrderItem" RENAME CONSTRAINT "OrderLine_orderId_organizationId_fkey" TO "OrderItem_orderId_organizationId_fkey";
ALTER TABLE "OrderItem" RENAME CONSTRAINT "OrderLine_itemId_organizationId_fkey" TO "OrderItem_itemId_organizationId_fkey";
ALTER INDEX "OrderLine_organizationId_idx" RENAME TO "OrderItem_organizationId_idx";
ALTER INDEX "OrderLine_orderId_idx" RENAME TO "OrderItem_orderId_idx";
ALTER INDEX "OrderLine_itemId_idx" RENAME TO "OrderItem_itemId_idx";
ALTER INDEX "OrderLine_id_organizationId_key" RENAME TO "OrderItem_id_organizationId_key";
ALTER INDEX "OrderLine_orderId_itemId_key" RENAME TO "OrderItem_orderId_itemId_key";

ALTER TABLE "OrderLineAllocation" RENAME TO "OrderItemAllocation";
ALTER TABLE "OrderItemAllocation" RENAME COLUMN "orderLineId" TO "orderItemId";
ALTER TABLE "OrderItemAllocation" RENAME CONSTRAINT "OrderLineAllocation_pkey" TO "OrderItemAllocation_pkey";
ALTER TABLE "OrderItemAllocation" RENAME CONSTRAINT "OrderLineAllocation_organizationId_fkey" TO "OrderItemAllocation_organizationId_fkey";
ALTER TABLE "OrderItemAllocation" RENAME CONSTRAINT "OrderLineAllocation_orderLineId_organizationId_fkey" TO "OrderItemAllocation_orderItemId_organizationId_fkey";
ALTER TABLE "OrderItemAllocation" RENAME CONSTRAINT "OrderLineAllocation_inventoryStockId_organizationId_fkey" TO "OrderItemAllocation_inventoryStockId_organizationId_fkey";
ALTER INDEX "OrderLineAllocation_organizationId_idx" RENAME TO "OrderItemAllocation_organizationId_idx";
ALTER INDEX "OrderLineAllocation_orderLineId_idx" RENAME TO "OrderItemAllocation_orderItemId_idx";
ALTER INDEX "OrderLineAllocation_inventoryStockId_idx" RENAME TO "OrderItemAllocation_inventoryStockId_idx";
ALTER INDEX "OrderLineAllocation_id_organizationId_key" RENAME TO "OrderItemAllocation_id_organizationId_key";
ALTER INDEX "OrderLineAllocation_orderLineId_inventoryStockId_key" RENAME TO "OrderItemAllocation_orderItemId_inventoryStockId_key";

ALTER TABLE "Issue" RENAME COLUMN "orderLineId" TO "orderItemId";
ALTER TABLE "Issue" RENAME CONSTRAINT "Issue_orderLineId_organizationId_fkey" TO "Issue_orderItemId_organizationId_fkey";
ALTER INDEX "Issue_orderLineId_idx" RENAME TO "Issue_orderItemId_idx";

-- DropForeignKey
ALTER TABLE "EventOrder" DROP CONSTRAINT "EventOrder_createdByUserId_fkey";

-- AlterTable
ALTER TABLE "EventOrder" ADD COLUMN     "addressId" TEXT,
ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "eventEndTime" TIME(0),
ADD COLUMN     "eventStartTime" TIME(0),
ADD COLUMN     "guestCount" INTEGER,
ADD COLUMN     "packageId" TEXT,
ADD COLUMN     "quote" INTEGER,
ADD COLUMN     "stripeCheckoutSessionId" TEXT,
ALTER COLUMN "createdByUserId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePriceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "PackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "fileId" TEXT,
    "videoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "PackageFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDetails" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "setupStartsAt" TIMESTAMP(3),
    "setupEndsAt" TIMESTAMP(3),
    "pickupStartsAt" TIMESTAMP(3),
    "pickupEndsAt" TIMESTAMP(3),
    "isPrivateHome" BOOLEAN NOT NULL DEFAULT false,
    "outletsAvailable" BOOLEAN NOT NULL DEFAULT false,
    "accessType" TEXT NOT NULL DEFAULT 'STANDARD',
    "accessNotes" TEXT,
    "allowMarketingPhotos" BOOLEAN NOT NULL DEFAULT false,
    "specialNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "OrderDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientTableDetails" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tableShape" TEXT NOT NULL,
    "tableDimensions" TEXT NOT NULL,
    "numberOfTables" INTEGER NOT NULL,
    "numberOfChairs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "ClientTableDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderUpload" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "uploadType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "OrderUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Package_organizationId_idx" ON "Package"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Package_id_organizationId_key" ON "Package"("id", "organizationId");

-- CreateIndex
CREATE INDEX "PackageItem_organizationId_idx" ON "PackageItem"("organizationId");

-- CreateIndex
CREATE INDEX "PackageItem_packageId_idx" ON "PackageItem"("packageId");

-- CreateIndex
CREATE INDEX "PackageItem_itemId_idx" ON "PackageItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageItem_id_organizationId_key" ON "PackageItem"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageItem_packageId_itemId_key" ON "PackageItem"("packageId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageFile_fileId_key" ON "PackageFile"("fileId");

-- CreateIndex
CREATE INDEX "PackageFile_organizationId_idx" ON "PackageFile"("organizationId");

-- CreateIndex
CREATE INDEX "PackageFile_packageId_idx" ON "PackageFile"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageFile_id_organizationId_key" ON "PackageFile"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageFile_fileId_organizationId_key" ON "PackageFile"("fileId", "organizationId");

-- CreateIndex
CREATE INDEX "Contact_organizationId_idx" ON "Contact"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_id_organizationId_key" ON "Contact"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDetails_orderId_key" ON "OrderDetails"("orderId");

-- CreateIndex
CREATE INDEX "OrderDetails_organizationId_idx" ON "OrderDetails"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDetails_id_organizationId_key" ON "OrderDetails"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDetails_orderId_organizationId_key" ON "OrderDetails"("orderId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientTableDetails_orderId_key" ON "ClientTableDetails"("orderId");

-- CreateIndex
CREATE INDEX "ClientTableDetails_organizationId_idx" ON "ClientTableDetails"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientTableDetails_id_organizationId_key" ON "ClientTableDetails"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientTableDetails_orderId_organizationId_key" ON "ClientTableDetails"("orderId", "organizationId");

-- CreateIndex
CREATE INDEX "OrderUpload_organizationId_idx" ON "OrderUpload"("organizationId");

-- CreateIndex
CREATE INDEX "OrderUpload_orderId_idx" ON "OrderUpload"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderUpload_id_organizationId_key" ON "OrderUpload"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_contactId_key" ON "EventOrder"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_addressId_key" ON "EventOrder"("addressId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_stripeCheckoutSessionId_key" ON "EventOrder"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "EventOrder_packageId_idx" ON "EventOrder"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_contactId_organizationId_key" ON "EventOrder"("contactId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_addressId_organizationId_key" ON "EventOrder"("addressId", "organizationId");

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_packageId_organizationId_fkey" FOREIGN KEY ("packageId", "organizationId") REFERENCES "Package"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_itemId_organizationId_fkey" FOREIGN KEY ("itemId", "organizationId") REFERENCES "Item"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageFile" ADD CONSTRAINT "PackageFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageFile" ADD CONSTRAINT "PackageFile_packageId_organizationId_fkey" FOREIGN KEY ("packageId", "organizationId") REFERENCES "Package"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageFile" ADD CONSTRAINT "PackageFile_fileId_organizationId_fkey" FOREIGN KEY ("fileId", "organizationId") REFERENCES "File"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_contactId_organizationId_fkey" FOREIGN KEY ("contactId", "organizationId") REFERENCES "Contact"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_addressId_organizationId_fkey" FOREIGN KEY ("addressId", "organizationId") REFERENCES "Address"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDetails" ADD CONSTRAINT "OrderDetails_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDetails" ADD CONSTRAINT "OrderDetails_orderId_organizationId_fkey" FOREIGN KEY ("orderId", "organizationId") REFERENCES "EventOrder"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTableDetails" ADD CONSTRAINT "ClientTableDetails_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTableDetails" ADD CONSTRAINT "ClientTableDetails_orderId_organizationId_fkey" FOREIGN KEY ("orderId", "organizationId") REFERENCES "EventOrder"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderUpload" ADD CONSTRAINT "OrderUpload_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderUpload" ADD CONSTRAINT "OrderUpload_orderId_organizationId_fkey" FOREIGN KEY ("orderId", "organizationId") REFERENCES "EventOrder"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- PackageFile is either a verified upload or a video reference.
ALTER TABLE "PackageFile" ADD CONSTRAINT "PackageFile_media_check" CHECK (("fileId" IS NOT NULL) <> ("videoUrl" IS NOT NULL));

-- Public intake statuses. Not part of the PAID -> PICKED_UP -> RETURNED fulfillment rank.
INSERT INTO "OrderStatus" ("id", "code", "name")
VALUES
  ('os_payment_pending', 'PAYMENT_PENDING', 'Payment pending'),
  ('os_payment_processed', 'PAYMENT_PROCESSED', 'Payment processed')
ON CONFLICT ("code") DO NOTHING;

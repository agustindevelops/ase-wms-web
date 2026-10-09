-- Baseline: full schema as of 2026-10-09. Replaces the earlier migration history.

-- Fuzzy item search: trigram similarity on Item.name.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contactEmail" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipcode" TEXT,
    "country" TEXT,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "qrCodeId" TEXT,
    "description" TEXT,
    "material" TEXT,
    "unitRentalPrice" DECIMAL(12,2),
    "purchaseLink" TEXT,
    "replacementCost" DECIMAL(12,2),
    "condition" TEXT,
    "disposition" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationUnitId" TEXT,
    "quantityOwned" INTEGER NOT NULL DEFAULT 0,
    "quantityAvailable" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER,
    "status" TEXT NOT NULL,
    "signatureExpiration" TIMESTAMP(3),
    "publicUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationUnitType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "LocationUnitType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationUnit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "parentLocationUnitId" TEXT,
    "locationUnitTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "qrCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrCodeType" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "QrCodeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" VARCHAR(512),
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
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "OrderStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" DATE,
    "eventStartTime" TIME(0),
    "eventEndTime" TIME(0),
    "guestCount" INTEGER,
    "quote" INTEGER,
    "statusId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "contactId" TEXT,
    "addressId" TEXT,
    "packageId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOrder_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyRequested" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemAllocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "inventoryStockId" TEXT NOT NULL,
    "qtyAllocated" INTEGER NOT NULL DEFAULT 0,
    "qtyPicked" INTEGER NOT NULL DEFAULT 0,
    "qtyReturned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItemAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_key" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_roleId_idx" ON "OrganizationMembership"("roleId");

-- CreateIndex
CREATE INDEX "Address_organizationId_idx" ON "Address"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Address_id_organizationId_key" ON "Address"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_addressId_key" ON "Warehouse"("addressId");

-- CreateIndex
CREATE INDEX "Warehouse_organizationId_idx" ON "Warehouse"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_id_organizationId_key" ON "Warehouse"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_addressId_organizationId_key" ON "Warehouse"("addressId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_code_key" ON "ItemCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_qrCodeId_key" ON "Item"("qrCodeId");

-- CreateIndex
CREATE INDEX "Item_organizationId_idx" ON "Item"("organizationId");

-- CreateIndex
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");

-- CreateIndex
CREATE INDEX "Item_name_trgm_idx" ON "Item" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "Item_id_organizationId_key" ON "Item"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_qrCodeId_organizationId_key" ON "Item"("qrCodeId", "organizationId");

-- CreateIndex
CREATE INDEX "InventoryStock_organizationId_idx" ON "InventoryStock"("organizationId");

-- CreateIndex
CREATE INDEX "InventoryStock_itemId_idx" ON "InventoryStock"("itemId");

-- CreateIndex
CREATE INDEX "InventoryStock_warehouseId_idx" ON "InventoryStock"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryStock_locationUnitId_idx" ON "InventoryStock"("locationUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStock_id_organizationId_key" ON "InventoryStock"("id", "organizationId");

-- CreateIndex
CREATE INDEX "File_organizationId_idx" ON "File"("organizationId");

-- CreateIndex
CREATE INDEX "File_itemId_idx" ON "File"("itemId");

-- CreateIndex
CREATE INDEX "File_uploadedByUserId_idx" ON "File"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "File_status_idx" ON "File"("status");

-- CreateIndex
CREATE INDEX "File_s3Key_idx" ON "File"("s3Key");

-- CreateIndex
CREATE UNIQUE INDEX "File_id_organizationId_key" ON "File"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationUnitType_code_key" ON "LocationUnitType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LocationUnit_qrCodeId_key" ON "LocationUnit"("qrCodeId");

-- CreateIndex
CREATE INDEX "LocationUnit_organizationId_idx" ON "LocationUnit"("organizationId");

-- CreateIndex
CREATE INDEX "LocationUnit_warehouseId_idx" ON "LocationUnit"("warehouseId");

-- CreateIndex
CREATE INDEX "LocationUnit_warehouseId_parentLocationUnitId_idx" ON "LocationUnit"("warehouseId", "parentLocationUnitId");

-- CreateIndex
CREATE INDEX "LocationUnit_parentLocationUnitId_idx" ON "LocationUnit"("parentLocationUnitId");

-- CreateIndex
CREATE INDEX "LocationUnit_locationUnitTypeId_idx" ON "LocationUnit"("locationUnitTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationUnit_id_organizationId_key" ON "LocationUnit"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationUnit_qrCodeId_organizationId_key" ON "LocationUnit"("qrCodeId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "QrCodeType_code_key" ON "QrCodeType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_payload_key" ON "QrCode"("payload");

-- CreateIndex
CREATE INDEX "QrCode_organizationId_idx" ON "QrCode"("organizationId");

-- CreateIndex
CREATE INDEX "QrCode_typeId_idx" ON "QrCode"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_id_organizationId_key" ON "QrCode"("id", "organizationId");

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
CREATE UNIQUE INDEX "OrderStatus_code_key" ON "OrderStatus"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_contactId_key" ON "EventOrder"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_addressId_key" ON "EventOrder"("addressId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_stripeCheckoutSessionId_key" ON "EventOrder"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "EventOrder_organizationId_idx" ON "EventOrder"("organizationId");

-- CreateIndex
CREATE INDEX "EventOrder_statusId_idx" ON "EventOrder"("statusId");

-- CreateIndex
CREATE INDEX "EventOrder_createdByUserId_idx" ON "EventOrder"("createdByUserId");

-- CreateIndex
CREATE INDEX "EventOrder_packageId_idx" ON "EventOrder"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_id_organizationId_key" ON "EventOrder"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_contactId_organizationId_key" ON "EventOrder"("contactId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_addressId_organizationId_key" ON "EventOrder"("addressId", "organizationId");

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
CREATE INDEX "OrderItem_organizationId_idx" ON "OrderItem"("organizationId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_itemId_idx" ON "OrderItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_id_organizationId_key" ON "OrderItem"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_itemId_key" ON "OrderItem"("orderId", "itemId");

-- CreateIndex
CREATE INDEX "OrderItemAllocation_organizationId_idx" ON "OrderItemAllocation"("organizationId");

-- CreateIndex
CREATE INDEX "OrderItemAllocation_orderItemId_idx" ON "OrderItemAllocation"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemAllocation_inventoryStockId_idx" ON "OrderItemAllocation"("inventoryStockId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemAllocation_id_organizationId_key" ON "OrderItemAllocation"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemAllocation_orderItemId_inventoryStockId_key" ON "OrderItemAllocation"("orderItemId", "inventoryStockId");

-- CreateIndex
CREATE INDEX "Issue_organizationId_idx" ON "Issue"("organizationId");

-- CreateIndex
CREATE INDEX "Issue_itemId_idx" ON "Issue"("itemId");

-- CreateIndex
CREATE INDEX "Issue_orderItemId_idx" ON "Issue"("orderItemId");

-- CreateIndex
CREATE INDEX "Issue_createdByUserId_idx" ON "Issue"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_id_organizationId_key" ON "Issue"("id", "organizationId");

-- CreateIndex
CREATE INDEX "UserActivity_organizationId_createdAt_idx" ON "UserActivity"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_organizationId_actorUserId_idx" ON "UserActivity"("organizationId", "actorUserId");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_addressId_organizationId_fkey" FOREIGN KEY ("addressId", "organizationId") REFERENCES "Address"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_qrCodeId_organizationId_fkey" FOREIGN KEY ("qrCodeId", "organizationId") REFERENCES "QrCode"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_itemId_organizationId_fkey" FOREIGN KEY ("itemId", "organizationId") REFERENCES "Item"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_warehouseId_organizationId_fkey" FOREIGN KEY ("warehouseId", "organizationId") REFERENCES "Warehouse"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_locationUnitId_organizationId_fkey" FOREIGN KEY ("locationUnitId", "organizationId") REFERENCES "LocationUnit"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_itemId_organizationId_fkey" FOREIGN KEY ("itemId", "organizationId") REFERENCES "Item"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationUnit" ADD CONSTRAINT "LocationUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationUnit" ADD CONSTRAINT "LocationUnit_warehouseId_organizationId_fkey" FOREIGN KEY ("warehouseId", "organizationId") REFERENCES "Warehouse"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationUnit" ADD CONSTRAINT "LocationUnit_parentLocationUnitId_organizationId_fkey" FOREIGN KEY ("parentLocationUnitId", "organizationId") REFERENCES "LocationUnit"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationUnit" ADD CONSTRAINT "LocationUnit_locationUnitTypeId_fkey" FOREIGN KEY ("locationUnitTypeId") REFERENCES "LocationUnitType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationUnit" ADD CONSTRAINT "LocationUnit_qrCodeId_organizationId_fkey" FOREIGN KEY ("qrCodeId", "organizationId") REFERENCES "QrCode"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "QrCodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "OrderStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_organizationId_fkey" FOREIGN KEY ("orderId", "organizationId") REFERENCES "EventOrder"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_itemId_organizationId_fkey" FOREIGN KEY ("itemId", "organizationId") REFERENCES "Item"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAllocation" ADD CONSTRAINT "OrderItemAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAllocation" ADD CONSTRAINT "OrderItemAllocation_orderItemId_organizationId_fkey" FOREIGN KEY ("orderItemId", "organizationId") REFERENCES "OrderItem"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAllocation" ADD CONSTRAINT "OrderItemAllocation_inventoryStockId_organizationId_fkey" FOREIGN KEY ("inventoryStockId", "organizationId") REFERENCES "InventoryStock"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_itemId_organizationId_fkey" FOREIGN KEY ("itemId", "organizationId") REFERENCES "Item"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_orderItemId_organizationId_fkey" FOREIGN KEY ("orderItemId", "organizationId") REFERENCES "OrderItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

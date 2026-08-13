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
    "payload" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocationUnitType_code_key" ON "LocationUnitType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LocationUnit_qrCodeId_key" ON "LocationUnit"("qrCodeId");

-- CreateIndex
CREATE INDEX "LocationUnit_warehouseId_idx" ON "LocationUnit"("warehouseId");

-- CreateIndex
CREATE INDEX "LocationUnit_warehouseId_parentLocationUnitId_idx" ON "LocationUnit"("warehouseId", "parentLocationUnitId");

-- CreateIndex
CREATE INDEX "LocationUnit_parentLocationUnitId_idx" ON "LocationUnit"("parentLocationUnitId");

-- CreateIndex
CREATE INDEX "LocationUnit_locationUnitTypeId_idx" ON "LocationUnit"("locationUnitTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "QrCodeType_code_key" ON "QrCodeType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_payload_key" ON "QrCode"("payload");

-- CreateIndex
CREATE INDEX "QrCode_typeId_idx" ON "QrCode"("typeId");

-- AddForeignKey
ALTER TABLE "LocationUnit" ADD CONSTRAINT "LocationUnit_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationUnit" ADD CONSTRAINT "LocationUnit_parentLocationUnitId_fkey" FOREIGN KEY ("parentLocationUnitId") REFERENCES "LocationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationUnit" ADD CONSTRAINT "LocationUnit_locationUnitTypeId_fkey" FOREIGN KEY ("locationUnitTypeId") REFERENCES "LocationUnitType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationUnit" ADD CONSTRAINT "LocationUnit_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "QrCodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

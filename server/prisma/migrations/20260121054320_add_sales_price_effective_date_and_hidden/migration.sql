-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "telegramId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manager" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,

    CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "altName" TEXT,
    "priceListName" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lossNorm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "districtId" TEXT,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "altName" TEXT,
    "phone" TEXT,
    "telegram" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "supplierId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("supplierId","productId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "idn" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "paymentType" TEXT,
    "customerId" INTEGER NOT NULL,
    "expeditorId" INTEGER,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "totalWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "deliveryAddress" TEXT,
    "assignedAt" TIMESTAMP(3),
    "deliveryStatus" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "signatureUrl" TEXT,
    "signedInvoiceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAttachment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "shippedQty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "distributionCoef" DOUBLE PRECISION DEFAULT 0.0,
    "sumWithRevaluation" DECIMAL(65,30) DEFAULT 0.0,
    "weightToDistribute" DOUBLE PRECISION DEFAULT 0.0,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expeditor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expeditor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "productId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "StockTransaction" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "orderId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SummaryOrderJournal" (
    "id" SERIAL NOT NULL,
    "idn" TEXT NOT NULL,
    "shipDate" TIMESTAMP(3) NOT NULL,
    "paymentType" TEXT DEFAULT 'bank',
    "customerId" INTEGER,
    "customerName" TEXT NOT NULL,
    "productId" INTEGER,
    "productCode" TEXT,
    "productFullName" TEXT NOT NULL,
    "category" TEXT,
    "shortNameMorning" TEXT,
    "priceType" TEXT,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "shippedQty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "orderQty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sumWithRevaluation" DECIMAL(65,30) DEFAULT 0.0,
    "distributionCoef" DOUBLE PRECISION DEFAULT 0.0,
    "weightToDistribute" DOUBLE PRECISION DEFAULT 0.0,
    "managerId" TEXT,
    "managerName" TEXT,
    "district" TEXT,
    "pointAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummaryOrderJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SummaryOrdersJournal" (
    "id" SERIAL NOT NULL,
    "summaryDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL,

    CONSTRAINT "SummaryOrdersJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyOrdersJournal" (
    "id" SERIAL NOT NULL,
    "assemblyDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "sourceSummaryId" INTEGER,
    "data" JSONB NOT NULL,

    CONSTRAINT "AssemblyOrdersJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionStaff" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "userId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionJournal" (
    "id" SERIAL NOT NULL,
    "productionDate" TIMESTAMP(3) NOT NULL,
    "staffId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ProductionJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionItem" (
    "id" SERIAL NOT NULL,
    "journalId" INTEGER NOT NULL,
    "productId" INTEGER,
    "productName" TEXT,
    "state" TEXT NOT NULL DEFAULT 'editing',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ProductionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionItemValue" (
    "id" SERIAL NOT NULL,
    "productionItemId" INTEGER NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldValue" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ProductionItemValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePriceList" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PurchasePriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePriceListSupplier" (
    "id" SERIAL NOT NULL,
    "priceListId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasePriceListSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePriceItem" (
    "id" SERIAL NOT NULL,
    "priceListId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchasePriceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPriceList" (
    "id" SERIAL NOT NULL,
    "listType" TEXT NOT NULL,
    "customerId" INTEGER,
    "title" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SalesPriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPriceItem" (
    "id" SERIAL NOT NULL,
    "priceListId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "salePrice" DECIMAL(14,2) NOT NULL,
    "rowDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SalesPriceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Manager_code_key" ON "Manager"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "SummaryOrderJournal_shipDate_idx" ON "SummaryOrderJournal"("shipDate");

-- CreateIndex
CREATE INDEX "SummaryOrderJournal_customerId_idx" ON "SummaryOrderJournal"("customerId");

-- CreateIndex
CREATE INDEX "SummaryOrderJournal_category_idx" ON "SummaryOrderJournal"("category");

-- CreateIndex
CREATE INDEX "SummaryOrderJournal_district_idx" ON "SummaryOrderJournal"("district");

-- CreateIndex
CREATE INDEX "SummaryOrderJournal_managerId_idx" ON "SummaryOrderJournal"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStaff_userId_key" ON "ProductionStaff"("userId");

-- CreateIndex
CREATE INDEX "ProductionJournal_productionDate_idx" ON "ProductionJournal"("productionDate");

-- CreateIndex
CREATE INDEX "ProductionJournal_staffId_productionDate_idx" ON "ProductionJournal"("staffId", "productionDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionJournal_productionDate_staffId_key" ON "ProductionJournal"("productionDate", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionItemValue_productionItemId_fieldKey_key" ON "ProductionItemValue"("productionItemId", "fieldKey");

-- CreateIndex
CREATE INDEX "PurchasePriceList_date_idx" ON "PurchasePriceList"("date");

-- CreateIndex
CREATE INDEX "PurchasePriceList_isActive_date_idx" ON "PurchasePriceList"("isActive", "date");

-- CreateIndex
CREATE INDEX "PurchasePriceListSupplier_supplierId_idx" ON "PurchasePriceListSupplier"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePriceListSupplier_priceListId_supplierId_key" ON "PurchasePriceListSupplier"("priceListId", "supplierId");

-- CreateIndex
CREATE INDEX "PurchasePriceItem_productId_idx" ON "PurchasePriceItem"("productId");

-- CreateIndex
CREATE INDEX "PurchasePriceItem_supplierId_idx" ON "PurchasePriceItem"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePriceItem_priceListId_supplierId_productId_key" ON "PurchasePriceItem"("priceListId", "supplierId", "productId");

-- CreateIndex
CREATE INDEX "SalesPriceList_listType_isCurrent_idx" ON "SalesPriceList"("listType", "isCurrent");

-- CreateIndex
CREATE INDEX "SalesPriceList_customerId_createdAt_idx" ON "SalesPriceList"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesPriceList_effectiveDate_idx" ON "SalesPriceList"("effectiveDate");

-- CreateIndex
CREATE INDEX "SalesPriceList_isHidden_listType_idx" ON "SalesPriceList"("isHidden", "listType");

-- CreateIndex
CREATE INDEX "SalesPriceItem_productId_idx" ON "SalesPriceItem"("productId");

-- CreateIndex
CREATE INDEX "SalesPriceItem_rowDate_idx" ON "SalesPriceItem"("rowDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPriceItem_priceListId_productId_key" ON "SalesPriceItem"("priceListId", "productId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_expeditorId_fkey" FOREIGN KEY ("expeditorId") REFERENCES "Expeditor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAttachment" ADD CONSTRAINT "OrderAttachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummaryOrderJournal" ADD CONSTRAINT "SummaryOrderJournal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummaryOrderJournal" ADD CONSTRAINT "SummaryOrderJournal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStaff" ADD CONSTRAINT "ProductionStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJournal" ADD CONSTRAINT "ProductionJournal_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "ProductionStaff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionItem" ADD CONSTRAINT "ProductionItem_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "ProductionJournal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionItem" ADD CONSTRAINT "ProductionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionItemValue" ADD CONSTRAINT "ProductionItemValue_productionItemId_fkey" FOREIGN KEY ("productionItemId") REFERENCES "ProductionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePriceListSupplier" ADD CONSTRAINT "PurchasePriceListSupplier_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PurchasePriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePriceListSupplier" ADD CONSTRAINT "PurchasePriceListSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePriceItem" ADD CONSTRAINT "PurchasePriceItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PurchasePriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePriceItem" ADD CONSTRAINT "PurchasePriceItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePriceItem" ADD CONSTRAINT "PurchasePriceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPriceList" ADD CONSTRAINT "SalesPriceList_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPriceItem" ADD CONSTRAINT "SalesPriceItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "SalesPriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPriceItem" ADD CONSTRAINT "SalesPriceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

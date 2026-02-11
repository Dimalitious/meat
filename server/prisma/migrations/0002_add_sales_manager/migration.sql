-- Sales Manager Module Migration
-- Creates new tables and adds fields to OrderDraft

-- 1. Add Sales Manager workflow fields to OrderDraft
ALTER TABLE "OrderDraft" ADD COLUMN IF NOT EXISTS "managerDecisionNote" TEXT;
ALTER TABLE "OrderDraft" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "OrderDraft" ADD COLUMN IF NOT EXISTS "rejectedByUserId" INTEGER;
ALTER TABLE "OrderDraft" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "OrderDraft" ADD COLUMN IF NOT EXISTS "acceptedByUserId" INTEGER;

-- FK: OrderDraft.rejectedByUserId -> User
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_rejectedByUserId_fkey"
  FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FK: OrderDraft.acceptedByUserId -> User
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_acceptedByUserId_fkey"
  FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Create CustomerSalesManager table
CREATE TABLE IF NOT EXISTS "CustomerSalesManager" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" INTEGER,
    "unassignedAt" TIMESTAMP(3),
    "unassignedByUserId" INTEGER,

    CONSTRAINT "CustomerSalesManager_pkey" PRIMARY KEY ("id")
);

-- Indexes for CustomerSalesManager
CREATE INDEX IF NOT EXISTS "CustomerSalesManager_userId_unassignedAt_idx"
  ON "CustomerSalesManager"("userId", "unassignedAt");
CREATE INDEX IF NOT EXISTS "CustomerSalesManager_customerId_unassignedAt_idx"
  ON "CustomerSalesManager"("customerId", "unassignedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSalesManager_customerId_userId_assignedAt_key"
  ON "CustomerSalesManager"("customerId", "userId", "assignedAt");

-- FK: CustomerSalesManager -> Customer, User, AssignedBy, UnassignedBy
ALTER TABLE "CustomerSalesManager" ADD CONSTRAINT "CustomerSalesManager_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerSalesManager" ADD CONSTRAINT "CustomerSalesManager_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerSalesManager" ADD CONSTRAINT "CustomerSalesManager_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerSalesManager" ADD CONSTRAINT "CustomerSalesManager_unassignedByUserId_fkey"
  FOREIGN KEY ("unassignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Create CustomerMoneyRefund table
CREATE TABLE IF NOT EXISTS "CustomerMoneyRefund" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14, 2) NOT NULL,
    "paymentTypeId" INTEGER,
    "reference" TEXT,
    "comment" TEXT,
    "proofUrl" TEXT,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMoneyRefund_pkey" PRIMARY KEY ("id")
);

-- Indexes for CustomerMoneyRefund
CREATE INDEX IF NOT EXISTS "CustomerMoneyRefund_customerId_refundDate_idx"
  ON "CustomerMoneyRefund"("customerId", "refundDate");
CREATE INDEX IF NOT EXISTS "CustomerMoneyRefund_deletedAt_idx"
  ON "CustomerMoneyRefund"("deletedAt");

-- FK: CustomerMoneyRefund -> Customer, PaymentType, Users
ALTER TABLE "CustomerMoneyRefund" ADD CONSTRAINT "CustomerMoneyRefund_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerMoneyRefund" ADD CONSTRAINT "CustomerMoneyRefund_paymentTypeId_fkey"
  FOREIGN KEY ("paymentTypeId") REFERENCES "PaymentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerMoneyRefund" ADD CONSTRAINT "CustomerMoneyRefund_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerMoneyRefund" ADD CONSTRAINT "CustomerMoneyRefund_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerMoneyRefund" ADD CONSTRAINT "CustomerMoneyRefund_deletedByUserId_fkey"
  FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

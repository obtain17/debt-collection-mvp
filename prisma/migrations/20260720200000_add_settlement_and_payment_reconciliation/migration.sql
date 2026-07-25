-- CreateEnum
CREATE TYPE "DepositMatchStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'PARTIAL', 'OVERPAID', 'MISENTERED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentScheduleItemStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'WAIVED');

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "virtualAccountNumber" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "allocationBreakdown" JSONB,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedByUserId" TEXT,
ADD COLUMN     "incomingDepositId" TEXT,
ADD COLUMN     "matchStatus" "DepositMatchStatus" NOT NULL DEFAULT 'MATCHED',
ADD COLUMN     "payerName" TEXT,
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedByUserId" TEXT;

-- AlterTable
ALTER TABLE "PaymentPlanProposal" ADD COLUMN     "debtorConsentName" TEXT,
ADD COLUMN     "debtorConsentedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IncomingDeposit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payerName" TEXT,
    "virtualAccountNumber" TEXT,
    "depositedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "matchStatus" "DepositMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomingDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentScheduleItem" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentScheduleItemStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncomingDeposit_organizationId_idx" ON "IncomingDeposit"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentScheduleItem_paymentId_key" ON "PaymentScheduleItem"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentScheduleItem_claimId_idx" ON "PaymentScheduleItem"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_virtualAccountNumber_key" ON "Claim"("virtualAccountNumber");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_incomingDepositId_fkey" FOREIGN KEY ("incomingDepositId") REFERENCES "IncomingDeposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingDeposit" ADD CONSTRAINT "IncomingDeposit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingDeposit" ADD CONSTRAINT "IncomingDeposit_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentScheduleItem" ADD CONSTRAINT "PaymentScheduleItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentScheduleItem" ADD CONSTRAINT "PaymentScheduleItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;


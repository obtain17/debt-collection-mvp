-- CreateEnum
CREATE TYPE "MailClass" AS ENUM ('STANDARD', 'REGISTERED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommunicationStatus" ADD VALUE 'DRAFT_PENDING_REVIEW';
ALTER TYPE "CommunicationStatus" ADD VALUE 'APPROVED';
ALTER TYPE "CommunicationStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "PaymentPlanProposal" ADD COLUMN     "affordableMonthlyAmount" INTEGER,
ADD COLUMN     "bonusMonths" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "dependentsCount" INTEGER,
ADD COLUMN     "desiredPaymentDay" INTEGER,
ADD COLUMN     "firstPaymentDate" TIMESTAMP(3),
ADD COLUMN     "monthlyIncome" INTEGER,
ADD COLUMN     "otherDebtRepayment" INTEGER,
ADD COLUMN     "rent" INTEGER,
ADD COLUMN     "takeHomeIncome" INTEGER;

-- AlterTable
ALTER TABLE "ScheduledCommunication" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "mailClass" "MailClass";

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tone" "Tone" NOT NULL,
    "subjectTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "legalApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "allowPrincipalReduction" BOOLEAN NOT NULL DEFAULT false,
    "allowInterestWaiver" BOOLEAN NOT NULL DEFAULT true,
    "allowLateDamageWaiver" BOOLEAN NOT NULL DEFAULT true,
    "maxDiscountRate" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "maxInstallments" INTEGER NOT NULL DEFAULT 24,
    "minMonthlyAmount" INTEGER NOT NULL DEFAULT 10000,
    "firstPaymentDeadlineDays" INTEGER NOT NULL DEFAULT 30,
    "noApprovalMaxDiscountRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "supervisorApprovalMaxDiscountRate" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NegotiationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_organizationId_key_key" ON "MessageTemplate"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "NegotiationRule_organizationId_key" ON "NegotiationRule"("organizationId");

-- AddForeignKey
ALTER TABLE "ScheduledCommunication" ADD CONSTRAINT "ScheduledCommunication_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationRule" ADD CONSTRAINT "NegotiationRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "LegalTitleType" AS ENUM ('JUDGMENT', 'PAYMENT_ORDER', 'NOTARIZED_DEED');

-- CreateEnum
CREATE TYPE "IdentityVerificationStatus" AS ENUM ('UNVERIFIED', 'PARTIAL', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ComplianceFlagType" AS ENUM ('ATTORNEY_INVOLVED', 'BANKRUPTCY_OR_REHAB', 'DEBT_DISPUTE', 'DECEASED', 'INHERITANCE_PENDING', 'IDENTITY_UNVERIFIED', 'COMPLAINT_IN_PROGRESS', 'MISBILLING_SUSPECTED', 'STATUTE_REVIEW', 'PHONE_PROHIBITED', 'MAIL_PROHIBITED', 'SMS_PROHIBITED', 'ALL_AUTOMATION_PROHIBITED');

-- CreateEnum
CREATE TYPE "RecoveryOutcomeType" AS ENUM ('PARTIAL', 'FULL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'COMPLIANCE_FLAG_SET';
ALTER TYPE "ActivityType" ADD VALUE 'COMPLIANCE_FLAG_CLEARED';

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "acquisitionPrice" INTEGER,
ADD COLUMN     "claimAcquiredAt" TIMESTAMP(3),
ADD COLUMN     "contractDate" TIMESTAMP(3),
ADD COLUMN     "guarantorDescription" TEXT,
ADD COLUMN     "hasGuarantor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "interestAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lateDamageAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "legalTitles" "LegalTitleType"[] DEFAULT ARRAY[]::"LegalTitleType"[],
ADD COLUMN     "originalCreditorName" TEXT,
ADD COLUMN     "statuteLimitationDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClaimAnalysis" ADD COLUMN     "confidenceLevel" "ConfidenceLevel",
ADD COLUMN     "contactabilityScore" DOUBLE PRECISION,
ADD COLUMN     "dataInsufficiencyNote" TEXT,
ADD COLUMN     "dataInsufficient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expectedCollectionCost" INTEGER,
ADD COLUMN     "expectedRecoveryAmount" INTEGER,
ADD COLUMN     "expectedRecoveryAmount12m" INTEGER,
ADD COLUMN     "expectedRecoveryType" "RecoveryOutcomeType",
ADD COLUMN     "paymentCapacityScore" DOUBLE PRECISION,
ADD COLUMN     "paymentWillingnessScore" DOUBLE PRECISION,
ADD COLUMN     "recommendedActions" JSONB,
ADD COLUMN     "recoveryWindowDays" INTEGER;

-- AlterTable
ALTER TABLE "Debtor" ADD COLUMN     "employerName" TEXT,
ADD COLUMN     "identityVerificationMethod" TEXT,
ADD COLUMN     "identityVerificationStatus" "IdentityVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "identityVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ComplianceFlag" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "flagType" "ComplianceFlagType" NOT NULL,
    "reason" TEXT,
    "setByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),
    "clearedByUserId" TEXT,

    CONSTRAINT "ComplianceFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceFlag_claimId_idx" ON "ComplianceFlag"("claimId");

-- AddForeignKey
ALTER TABLE "ComplianceFlag" ADD CONSTRAINT "ComplianceFlag_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFlag" ADD CONSTRAINT "ComplianceFlag_setByUserId_fkey" FOREIGN KEY ("setByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFlag" ADD CONSTRAINT "ComplianceFlag_clearedByUserId_fkey" FOREIGN KEY ("clearedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

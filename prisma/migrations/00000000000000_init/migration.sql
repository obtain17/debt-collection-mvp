-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('BANK', 'CREDIT_UNION', 'COMPANY', 'SERVICER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "DebtorType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('ACTIVE', 'IN_NEGOTIATION', 'PLAN_AGREED', 'SETTLED', 'WRITTEN_OFF', 'LEGAL_ESCALATION');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED', 'NOT_ANALYZED');

-- CreateEnum
CREATE TYPE "RiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CollectionApproach" AS ENUM ('FRIENDLY_REMINDER', 'FIRM_NOTICE', 'SETTLEMENT_OFFER', 'INSTALLMENT_PLAN_PROPOSAL', 'LEGAL_ESCALATION_RECOMMENDED', 'MONITOR_ONLY');

-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('EMPATHETIC', 'NEUTRAL_FIRM', 'FORMAL_FINAL_NOTICE');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'SMS', 'PHONE', 'LETTER', 'PORTAL_MESSAGE');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ProposerType" AS ENUM ('DEBTOR', 'STAFF');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'COUNTERED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('STATUS_CHANGE', 'COMMUNICATION_SENT', 'NOTE_ADDED', 'PROPOSAL_SUBMITTED', 'PROPOSAL_REVIEWED', 'AI_ANALYSIS_RUN', 'PORTAL_ACCESSED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debtor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "DebtorType" NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressLine" TEXT,
    "ageBracket" TEXT,
    "occupation" TEXT,
    "industry" TEXT,
    "employeeCountBracket" TEXT,
    "yearsInBusiness" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Debtor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "debtorId" TEXT NOT NULL,
    "assignedAgentId" TEXT,
    "claimType" TEXT NOT NULL,
    "principalAmount" INTEGER NOT NULL,
    "currentBalance" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JPY',
    "originalDueDate" TIMESTAMP(3) NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'ACTIVE',
    "hasCollateral" BOOLEAN NOT NULL DEFAULT false,
    "collateralDescription" TEXT,
    "priorDefaultCount" INTEGER NOT NULL DEFAULT 0,
    "latestAnalysisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dunningRuleId" TEXT,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimAnalysis" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "riskTier" "RiskTier",
    "recoveryProbability" DOUBLE PRECISION,
    "recoveryProbabilityRationale" TEXT,
    "recommendedApproach" "CollectionApproach",
    "suggestedTone" "Tone",
    "suggestedChannel" "Channel",
    "reasoning" TEXT,
    "keyRiskFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestedNextActionDays" INTEGER,
    "rawModelResponse" JSONB,
    "errorMessage" TEXT,
    "modelUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DunningRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DunningRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DunningStep" (
    "id" TEXT NOT NULL,
    "dunningRuleId" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "channel" "Channel" NOT NULL,
    "tone" "Tone" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "DunningStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledCommunication" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "dunningStepId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "subject" TEXT,
    "body" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationAccessToken" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPlanProposal" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "proposedBy" "ProposerType" NOT NULL,
    "installments" JSONB NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "settlementOffer" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentPlanProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "ActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Debtor_organizationId_idx" ON "Debtor"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_latestAnalysisId_key" ON "Claim"("latestAnalysisId");

-- CreateIndex
CREATE INDEX "Claim_organizationId_idx" ON "Claim"("organizationId");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "Payment_claimId_idx" ON "Payment"("claimId");

-- CreateIndex
CREATE INDEX "ClaimAnalysis_claimId_idx" ON "ClaimAnalysis"("claimId");

-- CreateIndex
CREATE INDEX "DunningRule_organizationId_idx" ON "DunningRule"("organizationId");

-- CreateIndex
CREATE INDEX "DunningStep_dunningRuleId_idx" ON "DunningStep"("dunningRuleId");

-- CreateIndex
CREATE INDEX "ScheduledCommunication_claimId_idx" ON "ScheduledCommunication"("claimId");

-- CreateIndex
CREATE INDEX "ScheduledCommunication_scheduledFor_status_idx" ON "ScheduledCommunication"("scheduledFor", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NegotiationAccessToken_token_key" ON "NegotiationAccessToken"("token");

-- CreateIndex
CREATE INDEX "NegotiationAccessToken_claimId_idx" ON "NegotiationAccessToken"("claimId");

-- CreateIndex
CREATE INDEX "PaymentPlanProposal_claimId_idx" ON "PaymentPlanProposal"("claimId");

-- CreateIndex
CREATE INDEX "ActivityLog_claimId_idx" ON "ActivityLog"("claimId");

-- CreateIndex
CREATE INDEX "Note_claimId_idx" ON "Note"("claimId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debtor" ADD CONSTRAINT "Debtor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "Debtor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_latestAnalysisId_fkey" FOREIGN KEY ("latestAnalysisId") REFERENCES "ClaimAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_dunningRuleId_fkey" FOREIGN KEY ("dunningRuleId") REFERENCES "DunningRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimAnalysis" ADD CONSTRAINT "ClaimAnalysis_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DunningRule" ADD CONSTRAINT "DunningRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DunningStep" ADD CONSTRAINT "DunningStep_dunningRuleId_fkey" FOREIGN KEY ("dunningRuleId") REFERENCES "DunningRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledCommunication" ADD CONSTRAINT "ScheduledCommunication_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledCommunication" ADD CONSTRAINT "ScheduledCommunication_dunningStepId_fkey" FOREIGN KEY ("dunningStepId") REFERENCES "DunningStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationAccessToken" ADD CONSTRAINT "NegotiationAccessToken_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlanProposal" ADD CONSTRAINT "PaymentPlanProposal_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlanProposal" ADD CONSTRAINT "PaymentPlanProposal_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


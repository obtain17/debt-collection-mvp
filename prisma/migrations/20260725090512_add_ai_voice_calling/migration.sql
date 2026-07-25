-- CreateEnum
CREATE TYPE "AiVoiceCallOutcome" AS ENUM ('CONNECTED_DEBTOR', 'CONNECTED_OTHER', 'NO_ANSWER', 'VOICEMAIL_LEFT');

-- CreateEnum
CREATE TYPE "VoiceTelephonyProvider" AS ENUM ('TWILIO', 'AMAZON_CONNECT');

-- CreateEnum
CREATE TYPE "VoiceSpeechProvider" AS ENUM ('OPENAI_REALTIME', 'AZURE_AI_SPEECH');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'CALL_VOICEMAIL_LEFT';

-- CreateTable
CREATE TABLE "AiVoiceSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "telephonyProvider" "VoiceTelephonyProvider" NOT NULL DEFAULT 'TWILIO',
    "speechProvider" "VoiceSpeechProvider" NOT NULL DEFAULT 'OPENAI_REALTIME',
    "callerName" TEXT NOT NULL DEFAULT '債権管理部',
    "callWindowStartHour" INTEGER NOT NULL DEFAULT 9,
    "callWindowEndHour" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiVoiceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiVoiceCallLog" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "scheduledCommunicationId" TEXT,
    "outcome" "AiVoiceCallOutcome" NOT NULL,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "transcript" JSONB,
    "summary" TEXT,
    "detectedComplianceFlag" "ComplianceFlagType",
    "transferredToHuman" BOOLEAN NOT NULL DEFAULT false,
    "paymentPromiseDate" TIMESTAMP(3),
    "paymentPromiseAmount" INTEGER,
    "modelUsed" TEXT,
    "durationSeconds" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiVoiceCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiVoiceSettings_organizationId_key" ON "AiVoiceSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AiVoiceCallLog_scheduledCommunicationId_key" ON "AiVoiceCallLog"("scheduledCommunicationId");

-- CreateIndex
CREATE INDEX "AiVoiceCallLog_claimId_idx" ON "AiVoiceCallLog"("claimId");

-- AddForeignKey
ALTER TABLE "AiVoiceSettings" ADD CONSTRAINT "AiVoiceSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiVoiceCallLog" ADD CONSTRAINT "AiVoiceCallLog_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiVoiceCallLog" ADD CONSTRAINT "AiVoiceCallLog_scheduledCommunicationId_fkey" FOREIGN KEY ("scheduledCommunicationId") REFERENCES "ScheduledCommunication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

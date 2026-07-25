-- CreateEnum
CREATE TYPE "IdentityVerificationMethod" AS ENUM ('PHONE_LAST4', 'DATE_OF_BIRTH', 'CLAIM_REFERENCE', 'SECRET_QUESTION', 'OTP');

-- AlterTable
ALTER TABLE "Debtor" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "secretAnswer" TEXT,
ADD COLUMN     "secretQuestion" TEXT,
DROP COLUMN "identityVerificationMethod",
ADD COLUMN     "identityVerificationMethod" "IdentityVerificationMethod";

-- AlterTable
ALTER TABLE "NegotiationAccessToken" ADD COLUMN     "identityVerificationMethod" "IdentityVerificationMethod",
ADD COLUMN     "identityVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "otpCode" TEXT,
ADD COLUMN     "otpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "verificationAttempts" INTEGER NOT NULL DEFAULT 0;


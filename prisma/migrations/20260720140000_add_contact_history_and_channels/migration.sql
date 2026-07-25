-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'CALL_PLACED';
ALTER TYPE "ActivityType" ADD VALUE 'CALL_NO_ANSWER';
ALTER TYPE "ActivityType" ADD VALUE 'CALL_CONNECTED_DEBTOR';
ALTER TYPE "ActivityType" ADD VALUE 'CALL_CONNECTED_FAMILY';
ALTER TYPE "ActivityType" ADD VALUE 'DEBTOR_CALLBACK';
ALTER TYPE "ActivityType" ADD VALUE 'PAYMENT_PROMISE_MADE';
ALTER TYPE "ActivityType" ADD VALUE 'PAYMENT_PROMISE_BROKEN';
ALTER TYPE "ActivityType" ADD VALUE 'PAYMENT_RECEIVED';
ALTER TYPE "ActivityType" ADD VALUE 'SMS_DELIVERED';
ALTER TYPE "ActivityType" ADD VALUE 'SMS_UNDELIVERED';
ALTER TYPE "ActivityType" ADD VALUE 'MAIL_DELIVERED';
ALTER TYPE "ActivityType" ADD VALUE 'MAIL_RETURNED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Channel" ADD VALUE 'AI_VOICE_CALL';
ALTER TYPE "Channel" ADD VALUE 'OPERATOR_CALL';

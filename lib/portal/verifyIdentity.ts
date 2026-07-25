import nodemailer from "nodemailer";
import { prisma } from "@/lib/db/prisma";

export const MAX_VERIFICATION_ATTEMPTS = 5;
const OTP_TTL_MS = 10 * 60 * 1000;

/**
 * A short reference code derived from the claim id (no extra column needed)
 * that staff can read out to a debtor as one of the identity factors.
 */
export function getClaimReferenceCode(claimId: string): string {
  return claimId.slice(-8).toUpperCase();
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function checkPhoneLast4(debtor: { phone: string | null }, input: string): boolean {
  if (!debtor.phone) return false;
  const last4 = normalizeDigits(debtor.phone).slice(-4);
  return last4.length === 4 && normalizeDigits(input) === last4;
}

export function checkDateOfBirth(debtor: { dateOfBirth: Date | null }, input: string): boolean {
  if (!debtor.dateOfBirth) return false;
  const inputDate = new Date(input);
  if (Number.isNaN(inputDate.getTime())) return false;
  return (
    inputDate.getUTCFullYear() === debtor.dateOfBirth.getUTCFullYear() &&
    inputDate.getUTCMonth() === debtor.dateOfBirth.getUTCMonth() &&
    inputDate.getUTCDate() === debtor.dateOfBirth.getUTCDate()
  );
}

export function checkClaimReference(claimId: string, input: string): boolean {
  return normalizeText(input).toUpperCase() === getClaimReferenceCode(claimId);
}

export function checkSecretQuestion(debtor: { secretAnswer: string | null }, input: string): boolean {
  if (!debtor.secretAnswer) return false;
  return normalizeText(input) === normalizeText(debtor.secretAnswer);
}

export function checkOtp(
  accessToken: { otpCode: string | null; otpExpiresAt: Date | null },
  input: string,
): boolean {
  if (!accessToken.otpCode || !accessToken.otpExpiresAt) return false;
  if (accessToken.otpExpiresAt < new Date()) return false;
  return normalizeDigits(input) === accessToken.otpCode;
}

/**
 * Issues a fresh one-time code for a portal session and "sends" it: a real
 * email if the debtor has one on file, otherwise a simulated record — the
 * same real-email/simulated-otherwise split used elsewhere in this app.
 */
export async function generateOtp(accessTokenId: string, claimId: string): Promise<void> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.negotiationAccessToken.update({
    where: { id: accessTokenId },
    data: { otpCode: code, otpExpiresAt },
  });

  const claim = await prisma.claim.findUniqueOrThrow({
    where: { id: claimId },
    include: { debtor: true, organization: true },
  });

  let sentByEmail = false;
  if (claim.debtor.email) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "localhost",
        port: Number(process.env.SMTP_PORT || 1025),
        secure: false,
      });
      await transporter.sendMail({
        from: `"${claim.organization.name}" <no-reply@example.com>`,
        to: claim.debtor.email,
        subject: `【${claim.organization.name}】本人確認コード`,
        text: `本人確認コードは ${code} です(有効期限10分)。`,
      });
      sentByEmail = true;
    } catch {
      sentByEmail = false;
    }
  }

  await prisma.activityLog.create({
    data: {
      claimId,
      type: "COMMUNICATION_SENT",
      description: sentByEmail
        ? "本人確認コードをメールで送信しました"
        : "本人確認コード(シミュレート)を記録しました",
      metadata: { channel: sentByEmail ? "EMAIL" : "SMS", simulated: !sentByEmail },
    },
  });
}

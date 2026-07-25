import { randomBytes } from "node:crypto";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";

const TOKEN_TTL_DAYS = 14;

/**
 * Returns a valid negotiation portal token for the claim, creating one if
 * none exists or the existing one has expired/been revoked. Used both by the
 * dunning worker (embedding a link in outgoing reminders) and by the manual
 * "交渉リンクを発行" action in the staff UI.
 */
export async function ensureAccessToken(claimId: string): Promise<string> {
  const existing = await prisma.negotiationAccessToken.findFirst({
    where: { claimId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing.token;

  const token = randomBytes(32).toString("base64url");
  const created = await prisma.negotiationAccessToken.create({
    data: { claimId, token, expiresAt: addDays(new Date(), TOKEN_TTL_DAYS) },
  });
  return created.token;
}

export function buildPortalUrl(token: string): string {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base}/portal/${token}`;
}

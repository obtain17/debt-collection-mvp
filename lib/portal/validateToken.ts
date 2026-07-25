import { prisma } from "@/lib/db/prisma";

async function getValidAccessToken(token: string) {
  const accessToken = await prisma.negotiationAccessToken.findUnique({ where: { token } });
  if (!accessToken || accessToken.revokedAt || accessToken.expiresAt < new Date()) {
    return null;
  }
  return accessToken;
}

export async function getClaimByPortalToken(token: string) {
  const accessToken = await getValidAccessToken(token);
  if (!accessToken) return null;

  const claim = await prisma.claim.findUnique({
    where: { id: accessToken.claimId },
    include: {
      debtor: true,
      organization: true,
      proposals: { orderBy: { createdAt: "desc" } },
    },
  });

  return claim;
}

/**
 * Like getClaimByPortalToken, but also returns the access token row itself
 * (identityVerifiedAt/otpCode/etc.) so the page can gate content on it.
 */
export async function getPortalSession(token: string) {
  const accessToken = await getValidAccessToken(token);
  if (!accessToken) return null;

  const claim = await prisma.claim.findUnique({
    where: { id: accessToken.claimId },
    include: {
      debtor: true,
      organization: true,
      proposals: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!claim) return null;

  return { accessToken, claim };
}

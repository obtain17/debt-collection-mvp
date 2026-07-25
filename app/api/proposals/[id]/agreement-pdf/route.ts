import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/getSession";
import { getClaimByPortalToken } from "@/lib/portal/validateToken";
import { generateAgreementPdf } from "@/lib/settlement/generateAgreementPdf";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");

  const proposal = await prisma.paymentPlanProposal.findUnique({
    where: { id },
    include: {
      claim: { include: { debtor: true, organization: true } },
      reviewedByUser: true,
    },
  });
  if (!proposal) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  if (!proposal.debtorConsentedAt) {
    return NextResponse.json({ error: "まだ合意が成立していません" }, { status: 400 });
  }

  const session = await getSession();
  const authorizedByStaff = Boolean(session && session.organizationId === proposal.claim.organizationId);

  let authorizedByToken = false;
  if (!authorizedByStaff && token) {
    const tokenClaim = await getClaimByPortalToken(token);
    authorizedByToken = tokenClaim?.id === proposal.claimId;
  }

  if (!authorizedByStaff && !authorizedByToken) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const pdfBytes = await generateAgreementPdf({
    proposal,
    claim: proposal.claim,
    debtor: proposal.claim.debtor,
    organization: proposal.claim.organization,
    staffApproverName: proposal.reviewedByUser?.name ?? null,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="agreement-${proposal.id}.pdf"`,
    },
  });
}

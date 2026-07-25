import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiSession, AuthError } from "@/lib/auth/getSession";
import { generateCompletionCertificatePdf } from "@/lib/settlement/generateCompletionCertificatePdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const { id } = await params;

    const claim = await prisma.claim.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { debtor: true, organization: true },
    });
    if (!claim) {
      return NextResponse.json({ error: "ケースが見つかりません" }, { status: 404 });
    }
    if (claim.status !== "SETTLED") {
      return NextResponse.json({ error: "まだ完済していません" }, { status: 400 });
    }

    const pdfBytes = await generateCompletionCertificatePdf({
      claim,
      debtor: claim.debtor,
      organization: claim.organization,
      settledAt: claim.updatedAt,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="completion-certificate-${claim.id}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "証明書の生成に失敗しました" }, { status: 500 });
  }
}

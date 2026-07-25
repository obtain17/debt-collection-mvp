import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiSession, AuthError } from "@/lib/auth/getSession";
import { runClaimAnalysis } from "@/lib/ai/runClaimAnalysis";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const { id } = await params;

    const claim = await prisma.claim.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!claim) {
      return NextResponse.json({ error: "ケースが見つかりません" }, { status: 404 });
    }

    await runClaimAnalysis(claim.id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "AI分析に失敗しました" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireApiSession, AuthError } from "@/lib/auth/getSession";
import { getReportSummary } from "@/lib/reports/getSummary";

export async function GET() {
  try {
    const session = await requireApiSession();
    const summary = await getReportSummary(session.organizationId);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "レポートの取得に失敗しました" }, { status: 500 });
  }
}

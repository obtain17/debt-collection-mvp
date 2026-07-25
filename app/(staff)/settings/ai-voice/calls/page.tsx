import Link from "next/link";
import { requireSession, requireRole } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db/prisma";
import {
  COMPLIANCE_FLAG_LABEL,
  VOICE_CALL_OUTCOME_COLOR,
  VOICE_CALL_OUTCOME_LABEL,
  formatDateTime,
  formatYen,
} from "@/lib/format";

const PAGE_SIZE = 30;

function buildQuery(page: number) {
  return page > 1 ? `?page=${page}` : "";
}

export default async function AiVoiceCallsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  const where = { claim: { organizationId: session.organizationId } };

  const [total, calls] = await Promise.all([
    prisma.aiVoiceCallLog.count({ where }),
    prisma.aiVoiceCallLog.findMany({
      where,
      include: { claim: { include: { debtor: true } } },
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings/ai-voice" className="text-sm text-slate-500 hover:underline">
          ← AI音声自動督促の設定に戻る
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-slate-900">通話録音・文字起こし・要約</h1>
      <p className="text-sm text-slate-500">
        シミュレーションされたAI音声通話の一覧です(全{total.toLocaleString()}件)。実際の音声録音は保存していません
        (テキストのトランスクリプトのみ)。
      </p>

      <div className="space-y-3">
        {calls.map((call) => (
          <details key={call.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-3">
                <Link href={`/cases/${call.claimId}`} className="font-medium text-slate-900 hover:underline">
                  {call.claim.debtor.name}
                </Link>
                <span className="text-slate-500">{formatDateTime(call.startedAt)}</span>
              </span>
              <span className="flex items-center gap-2">
                {call.transferredToHuman && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">人間へ引き継ぎ</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs ${VOICE_CALL_OUTCOME_COLOR[call.outcome]}`}>
                  {VOICE_CALL_OUTCOME_LABEL[call.outcome]}
                </span>
              </span>
            </summary>

            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <p className="text-slate-500">
                本人確認: {call.identityVerified ? "成功" : "未成功(債権内容は開示していません)"}
                {call.detectedComplianceFlag && (
                  <> / 検知: {COMPLIANCE_FLAG_LABEL[call.detectedComplianceFlag]}</>
                )}
                {call.paymentPromiseDate && call.paymentPromiseAmount && (
                  <>
                    {" "}
                    / 支払約束: {formatDateTime(call.paymentPromiseDate)} / {formatYen(call.paymentPromiseAmount)}
                  </>
                )}
              </p>
              {call.summary && <p className="rounded bg-slate-50 p-2 text-slate-800">{call.summary}</p>}
              {Array.isArray(call.transcript) && call.transcript.length > 0 && (
                <ul className="space-y-1 rounded bg-slate-50 p-2">
                  {(call.transcript as Array<{ speaker: string; text: string }>).map((turn, i) => (
                    <li key={i}>
                      <span className="font-medium text-slate-700">
                        {turn.speaker === "AI" ? "AI: " : "債務者: "}
                      </span>
                      <span className="text-slate-600">{turn.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}
        {calls.length === 0 && <p className="text-sm text-slate-400">通話記録はまだありません</p>}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} / {total}件(
          {page} / {totalPages}ページ)
        </span>
        <div className="flex gap-2">
          <Link
            href={`/settings/ai-voice/calls${buildQuery(Math.max(1, page - 1))}`}
            aria-disabled={page <= 1}
            className={`rounded px-3 py-1 ${page <= 1 ? "pointer-events-none bg-slate-50 text-slate-300" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            前へ
          </Link>
          <Link
            href={`/settings/ai-voice/calls${buildQuery(Math.min(totalPages, page + 1))}`}
            aria-disabled={page >= totalPages}
            className={`rounded px-3 py-1 ${page >= totalPages ? "pointer-events-none bg-slate-50 text-slate-300" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            次へ
          </Link>
        </div>
      </div>
    </div>
  );
}

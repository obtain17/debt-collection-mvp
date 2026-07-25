import Link from "next/link";
import { requireSession, requireRole } from "@/lib/auth/getSession";
import { getCallTargets } from "@/lib/voice/getCallTargets";
import { formatYen } from "@/lib/format";

export default async function AiVoiceTargetsPage() {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const { settingsEnabled, totalOpenClaims, targets } = await getCallTargets(session.organizationId);
  const eligibleCount = targets.filter((t) => t.eligible).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings/ai-voice" className="text-sm text-slate-500 hover:underline">
          ← AI音声自動督促の設定に戻る
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-slate-900">発信対象・除外対象確認</h1>
      <p className="text-sm text-slate-500">
        対応中・交渉中の案件のうち、AI音声自動督促が「今実行したら」発信対象になるか(除外対象ならその理由)を、
        実際の発信時に使われる判定ロジックと同じ基準で表示します(残高上位{targets.length}件 / 全{totalOpenClaims}件)。
      </p>

      {!settingsEnabled && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          AI音声自動督促は現在この組織で無効になっているため、すべての案件が除外対象です。
          <Link href="/settings/ai-voice" className="ml-1 underline">
            設定画面で有効化
          </Link>
          してください。
        </p>
      )}

      <div className="flex gap-4 text-sm">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">発信対象: {eligibleCount}件</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          除外対象: {targets.length - eligibleCount}件
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">債務者</th>
              <th className="px-4 py-2 font-medium">電話番号</th>
              <th className="px-4 py-2 font-medium">残高</th>
              <th className="px-4 py-2 font-medium">延滞日数</th>
              <th className="px-4 py-2 font-medium">判定</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t.claimId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/cases/${t.claimId}`} className="font-medium text-slate-900 hover:underline">
                    {t.debtorName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{t.phone ?? "未登録"}</td>
                <td className="px-4 py-2 text-slate-900">{formatYen(t.currentBalance)}</td>
                <td className="px-4 py-2 text-slate-600">{t.daysOverdue}日</td>
                <td className="px-4 py-2">
                  {t.eligible ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">発信対象</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700" title={t.exclusionReason ?? ""}>
                      除外: {t.exclusionReason}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {targets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  対象となる案件がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

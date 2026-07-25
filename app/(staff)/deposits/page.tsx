import Link from "next/link";
import { requireSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db/prisma";
import { DEPOSIT_MATCH_STATUS_COLOR, DEPOSIT_MATCH_STATUS_LABEL, formatDate, formatDateTime, formatYen } from "@/lib/format";
import {
  importDepositsFromImageAction,
  importManualDepositAction,
  resolveDepositAction,
  reversePaymentAction,
} from "./actions";

export default async function DepositsPage() {
  const session = await requireSession();

  const [unmatchedDeposits, recentPayments, openClaims] = await Promise.all([
    prisma.incomingDeposit.findMany({
      where: { organizationId: session.organizationId, matchStatus: "UNMATCHED" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { claim: { organizationId: session.organizationId } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { claim: { include: { debtor: true } } },
    }),
    prisma.claim.findMany({
      where: { organizationId: session.organizationId, status: { notIn: ["SETTLED", "WRITTEN_OFF"] } },
      include: { debtor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">入金管理</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">入金の取込</h2>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <form action={importDepositsFromImageAction} className="space-y-2">
            <p className="text-xs text-slate-500">
              通帳・銀行明細のスクリーンショットや写真から、AIが入金行(日付・金額・振込人名義)を自動抽出します。
            </p>
            <input type="file" name="image" accept="image/*" className="w-full text-xs" />
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
              画像から取込む
            </button>
          </form>

          <form action={importManualDepositAction} className="space-y-2">
            <p className="text-xs text-slate-500">1件ずつ手動で入力する場合はこちら。</p>
            <div className="grid grid-cols-2 gap-2">
              <input name="amount" type="number" min="1" placeholder="金額(円)" className="rounded-md border border-slate-300 px-2 py-1" />
              <input name="depositedAt" type="date" className="rounded-md border border-slate-300 px-2 py-1" />
              <input name="payerName" placeholder="振込人名義" className="rounded-md border border-slate-300 px-2 py-1" />
              <input
                name="virtualAccountNumber"
                placeholder="仮想口座番号(任意)"
                className="rounded-md border border-slate-300 px-2 py-1"
              />
            </div>
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
              入金を追加
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">未処理入金(自動マッチ不可)</h2>
        <div className="space-y-2 text-sm">
          {unmatchedDeposits.map((d) => (
            <div key={d.id} className="rounded-md border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span>
                  {formatDate(d.depositedAt)} / {formatYen(d.amount)} / 振込人: {d.payerName ?? "不明"}
                  {d.virtualAccountNumber && ` / 口座: ${d.virtualAccountNumber}`}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${DEPOSIT_MATCH_STATUS_COLOR[d.matchStatus]}`}>
                  {DEPOSIT_MATCH_STATUS_LABEL[d.matchStatus]}
                </span>
              </div>
              <form action={resolveDepositAction} className="flex gap-2">
                <input type="hidden" name="depositId" value={d.id} />
                <select name="claimId" className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs">
                  {openClaims.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.debtor.name}({c.claimType} / {formatYen(c.currentBalance)})
                    </option>
                  ))}
                </select>
                <button className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">
                  この案件に割り当てる
                </button>
              </form>
            </div>
          ))}
          {unmatchedDeposits.length === 0 && <p className="text-slate-400">未処理の入金はありません</p>}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">入金履歴</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-medium">日時</th>
              <th className="py-1 pr-3 font-medium">案件</th>
              <th className="py-1 pr-3 font-medium">金額</th>
              <th className="py-1 pr-3 font-medium">振込人</th>
              <th className="py-1 pr-3 font-medium">判定</th>
              <th className="py-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {recentPayments.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="py-1 pr-3">{formatDateTime(p.paidAt)}</td>
                <td className="py-1 pr-3">
                  <Link href={`/cases/${p.claimId}`} className="text-slate-700 hover:underline">
                    {p.claim.debtor.name}
                  </Link>
                </td>
                <td className="py-1 pr-3">{formatYen(p.amount)}</td>
                <td className="py-1 pr-3 text-slate-500">{p.payerName ?? "-"}</td>
                <td className="py-1 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${DEPOSIT_MATCH_STATUS_COLOR[p.matchStatus]}`}>
                    {DEPOSIT_MATCH_STATUS_LABEL[p.matchStatus]}
                  </span>
                </td>
                <td className="py-1">
                  {!p.reversedAt && (
                    <form action={reversePaymentAction}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <input type="hidden" name="reason" value="スタッフによる取消" />
                      <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                        取消
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {recentPayments.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  入金履歴はありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

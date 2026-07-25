import Link from "next/link";
import { requireSession, requireRole } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db/prisma";
import { ACTIVITY_TYPE_LABEL, formatDateTime } from "@/lib/format";
import type { $Enums } from "@/generated/prisma/client";

const PAGE_SIZE = 50;
const TYPE_OPTIONS = Object.keys(ACTIVITY_TYPE_LABEL) as Array<$Enums.ActivityType>;

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const { type, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  const where = {
    claim: { organizationId: session.organizationId },
    ...(type ? { type: type as $Enums.ActivityType } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      include: { claim: { include: { debtor: true } }, user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">監査ログ</h1>
        <p className="mt-1 text-sm text-slate-500">
          自組織内の全ケースを横断して、督促送信・AI分析実行・ポータルアクセス・承認等の操作履歴を確認できます(全{total.toLocaleString()}件)。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-500">種別:</span>
        <div className="flex flex-wrap gap-1">
          <Link
            href={`/settings/audit-log${buildQuery({ type: undefined })}`}
            className={`rounded px-2 py-1 ${!type ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            すべて
          </Link>
          {TYPE_OPTIONS.map((t) => (
            <Link
              key={t}
              href={`/settings/audit-log${buildQuery({ type: t })}`}
              className={`rounded px-2 py-1 ${type === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {ACTIVITY_TYPE_LABEL[t]}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">日時</th>
              <th className="px-4 py-2 font-medium">種別</th>
              <th className="px-4 py-2 font-medium">内容</th>
              <th className="px-4 py-2 font-medium">ケース</th>
              <th className="px-4 py-2 font-medium">担当者</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{formatDateTime(log.createdAt)}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {ACTIVITY_TYPE_LABEL[log.type] ?? log.type}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-900">{log.description}</td>
                <td className="px-4 py-2">
                  <Link href={`/cases/${log.claim.id}`} className="text-slate-600 hover:underline">
                    {log.claim.debtor.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{log.user?.name ?? "-"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  条件に一致するログがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} / {total}件(
          {page} / {totalPages}ページ)
        </span>
        <div className="flex gap-2">
          <Link
            href={`/settings/audit-log${buildQuery({ type, page: String(Math.max(1, page - 1)) })}`}
            aria-disabled={page <= 1}
            className={`rounded px-3 py-1 ${page <= 1 ? "pointer-events-none bg-slate-50 text-slate-300" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            前へ
          </Link>
          <Link
            href={`/settings/audit-log${buildQuery({ type, page: String(Math.min(totalPages, page + 1)) })}`}
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

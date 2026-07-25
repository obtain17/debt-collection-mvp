import Link from "next/link";
import { requireSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db/prisma";
import {
  CLAIM_STATUS_COLOR,
  CLAIM_STATUS_LABEL,
  RISK_TIER_COLOR,
  RISK_TIER_LABEL,
  formatDate,
  formatYen,
} from "@/lib/format";

const STATUS_OPTIONS = [
  "ACTIVE",
  "IN_NEGOTIATION",
  "PLAN_AGREED",
  "SETTLED",
  "WRITTEN_OFF",
  "LEGAL_ESCALATION",
] as const;
const RISK_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const SORT_OPTIONS = {
  balance_desc: "金額(高い順)",
  balance_asc: "金額(低い順)",
  overdue_desc: "延滞日数(長い順)",
} as const;

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; risk?: string; sort?: string }>;
}) {
  const session = await requireSession();
  const { status, risk, sort = "balance_desc" } = await searchParams;

  const where = {
    organizationId: session.organizationId,
    ...(status ? { status: status as (typeof STATUS_OPTIONS)[number] } : {}),
    ...(risk ? { latestAnalysis: { riskTier: risk as (typeof RISK_OPTIONS)[number] } } : {}),
  };

  const orderBy =
    sort === "balance_asc"
      ? { currentBalance: "asc" as const }
      : sort === "overdue_desc"
        ? { originalDueDate: "asc" as const }
        : { currentBalance: "desc" as const };

  const claims = await prisma.claim.findMany({
    where,
    orderBy,
    include: { debtor: true, latestAnalysis: true, assignedAgent: true },
    take: 200,
  });

  const [totalCount, activeCount, criticalCount] = await Promise.all([
    prisma.claim.count({ where: { organizationId: session.organizationId } }),
    prisma.claim.count({ where: { organizationId: session.organizationId, status: "ACTIVE" } }),
    prisma.claim.count({
      where: { organizationId: session.organizationId, latestAnalysis: { riskTier: "CRITICAL" } },
    }),
  ]);

  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="全ケース数" value={`${totalCount}件`} />
        <StatCard label="対応中" value={`${activeCount}件`} />
        <StatCard label="最重要リスク" value={`${criticalCount}件`} tone="text-red-600" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-500">絞り込み:</span>
        <FilterSelect
          label="ステータス"
          name="status"
          value={status}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: CLAIM_STATUS_LABEL[s] }))}
          current={{ status, risk, sort }}
        />
        <FilterSelect
          label="リスク"
          name="risk"
          value={risk}
          options={RISK_OPTIONS.map((r) => ({ value: r, label: RISK_TIER_LABEL[r] }))}
          current={{ status, risk, sort }}
        />
        <FilterSelect
          label="並び替え"
          name="sort"
          value={sort}
          options={Object.entries(SORT_OPTIONS).map(([value, label]) => ({ value, label }))}
          current={{ status, risk, sort }}
          allowEmpty={false}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">債務者</th>
              <th className="px-4 py-2 font-medium">種別</th>
              <th className="px-4 py-2 font-medium">残高</th>
              <th className="px-4 py-2 font-medium">期日</th>
              <th className="px-4 py-2 font-medium">ステータス</th>
              <th className="px-4 py-2 font-medium">AIリスク</th>
              <th className="px-4 py-2 font-medium">担当者</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/cases/${claim.id}`} className="font-medium text-slate-900 hover:underline">
                    {claim.debtor.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{claim.claimType}</td>
                <td className="px-4 py-2 text-slate-900">{formatYen(claim.currentBalance)}</td>
                <td className="px-4 py-2 text-slate-600">{formatDate(claim.originalDueDate)}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${CLAIM_STATUS_COLOR[claim.status]}`}>
                    {CLAIM_STATUS_LABEL[claim.status]}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {claim.latestAnalysis?.riskTier ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${RISK_TIER_COLOR[claim.latestAnalysis.riskTier]}`}
                    >
                      {RISK_TIER_LABEL[claim.latestAnalysis.riskTier]}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">未分析</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">{claim.assignedAgent?.name ?? "-"}</td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  条件に一致するケースがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
  current,
  allowEmpty = true,
}: {
  label: string;
  name: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
  current: Record<string, string | undefined>;
  allowEmpty?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-slate-500">{label}:</span>
      <div className="flex gap-1">
        {allowEmpty && (
          <Link
            href={`/dashboard${buildQuery({ ...current, [name]: undefined })}`}
            className={`rounded px-2 py-1 ${!value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            すべて
          </Link>
        )}
        {options.map((opt) => (
          <Link
            key={opt.value}
            href={`/dashboard${buildQuery({ ...current, [name]: opt.value })}`}
            className={`rounded px-2 py-1 ${value === opt.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {opt.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

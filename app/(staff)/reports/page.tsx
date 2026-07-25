import { requireSession } from "@/lib/auth/getSession";
import { getReportSummary } from "@/lib/reports/getSummary";
import { formatYen } from "@/lib/format";
import { RiskDistributionChart, StatusFunnelChart } from "./ReportCharts";

export default async function ReportsPage() {
  const session = await requireSession();
  const summary = await getReportSummary(session.organizationId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">レポート</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="回収率" value={`${(summary.recoveryRate * 100).toFixed(1)}%`} />
        <StatCard label="元本合計" value={formatYen(summary.totalPrincipal)} />
        <StatCard label="回収済み合計" value={formatYen(summary.totalRecovered)} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-slate-900">ステータス別ケース数(ファネル)</h2>
          <StatusFunnelChart data={summary.statusFunnel} />
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-slate-900">AIリスク分布</h2>
          <RiskDistributionChart data={summary.riskDistribution} />
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

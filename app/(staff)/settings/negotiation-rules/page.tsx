import { requireSession, requireRole } from "@/lib/auth/getSession";
import { getNegotiationRule } from "@/lib/negotiation/getNegotiationRule";
import { updateNegotiationRule } from "./actions";

export default async function NegotiationRulesSettingsPage() {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const rule = await getNegotiationRule(session.organizationId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">交渉条件ルール</h1>
      <p className="text-sm text-slate-500">
        返済提案の評価(社内ルール内/上長承認必要/法務承認必要/提示不可)に使われるしきい値です。この評価は
        ケース詳細画面に表示のみされ、承認・却下の最終判断はスタッフに委ねられます。
      </p>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <form action={updateNegotiationRule} className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="allowPrincipalReduction" defaultChecked={rule.allowPrincipalReduction} />
              元本減額を許可
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="allowInterestWaiver" defaultChecked={rule.allowInterestWaiver} />
              利息免除を許可
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="allowLateDamageWaiver" defaultChecked={rule.allowLateDamageWaiver} />
              遅延損害金免除を許可
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">承認不要の減額率上限(%)</span>
              <input
                name="noApprovalMaxDiscountRate"
                type="number"
                step="0.1"
                defaultValue={rule.noApprovalMaxDiscountRate * 100}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">上長承認の減額率上限(%、これを超えると法務承認)</span>
              <input
                name="supervisorApprovalMaxDiscountRate"
                type="number"
                step="0.1"
                defaultValue={rule.supervisorApprovalMaxDiscountRate * 100}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">最大減額率(%、これを超えると提示不可)</span>
              <input
                name="maxDiscountRate"
                type="number"
                step="0.1"
                defaultValue={rule.maxDiscountRate * 100}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">最大分割回数</span>
              <input
                name="maxInstallments"
                type="number"
                defaultValue={rule.maxInstallments}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">最低月額(円)</span>
              <input
                name="minMonthlyAmount"
                type="number"
                defaultValue={rule.minMonthlyAmount}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">初回入金期限(日)</span>
              <input
                name="firstPaymentDeadlineDays"
                type="number"
                defaultValue={rule.firstPaymentDeadlineDays}
                className="w-full rounded-md border border-slate-300 px-2 py-1"
              />
            </label>
          </div>

          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
            保存
          </button>
        </form>
      </section>
    </div>
  );
}

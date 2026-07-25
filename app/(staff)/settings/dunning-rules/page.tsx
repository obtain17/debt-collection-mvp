import { requireSession, requireRole } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db/prisma";
import { CHANNEL_LABEL, TONE_LABEL } from "@/lib/format";
import { addDunningStep, removeDunningStep } from "./actions";
import type { $Enums } from "@/generated/prisma/client";

const CHANNEL_OPTIONS: $Enums.Channel[] = [
  "EMAIL",
  "SMS",
  "PHONE",
  "LETTER",
  "PORTAL_MESSAGE",
  "AI_VOICE_CALL",
  "OPERATOR_CALL",
];
const TONE_OPTIONS: $Enums.Tone[] = ["EMPATHETIC", "NEUTRAL_FIRM", "FORMAL_FINAL_NOTICE"];
const TEMPLATE_OPTIONS: Record<string, string> = {
  FRIENDLY_REMINDER: "やわらかい督促",
  FIRM_NOTICE: "強めの督促",
  FINAL_NOTICE: "最終通告",
};

export default async function DunningRulesSettingsPage() {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const rule = await prisma.dunningRule.findFirst({
    where: { organizationId: session.organizationId, isDefault: true },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">自動督促の設定</h1>
      <p className="text-sm text-slate-500">
        自動停止条件(弁護士介入・破産・苦情等)は、各ケース詳細画面の「コンプライアンスフラグ」で全案件共通に
        管理されます。ここでは、期日からの経過日数に応じたチャネル・トーンのシナリオ(線形ステップ)のみを
        設定します。条件分岐(未開封なら再送、等)は対象外です。
      </p>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">{rule?.name ?? "デフォルトルール"}のステップ</h2>
        <table className="mb-4 w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-medium">順序</th>
              <th className="py-1 pr-3 font-medium">経過日数</th>
              <th className="py-1 pr-3 font-medium">チャネル</th>
              <th className="py-1 pr-3 font-medium">トーン</th>
              <th className="py-1 pr-3 font-medium">テンプレート</th>
              <th className="py-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rule?.steps.map((step) => (
              <tr key={step.id} className="border-b border-slate-100 last:border-0">
                <td className="py-1 pr-3">{step.order}</td>
                <td className="py-1 pr-3">{step.dayOffset}日目</td>
                <td className="py-1 pr-3">{CHANNEL_LABEL[step.channel]}</td>
                <td className="py-1 pr-3">{TONE_LABEL[step.tone]}</td>
                <td className="py-1 pr-3">{TEMPLATE_OPTIONS[step.templateKey] ?? step.templateKey}</td>
                <td className="py-1">
                  <form
                    action={async () => {
                      "use server";
                      await removeDunningStep(step.id);
                    }}
                  >
                    <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                      削除
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(!rule || rule.steps.length === 0) && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  ステップがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form action={addDunningStep} className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            順序
            <input name="order" type="number" min="1" defaultValue={(rule?.steps.length ?? 0) + 1} className="w-16 rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            経過日数
            <input name="dayOffset" type="number" min="0" defaultValue={0} className="w-20 rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            チャネル
            <select name="channel" className="rounded-md border border-slate-300 px-2 py-1">
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            トーン
            <select name="tone" className="rounded-md border border-slate-300 px-2 py-1">
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TONE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            テンプレート
            <select name="templateKey" className="rounded-md border border-slate-300 px-2 py-1">
              {Object.entries(TEMPLATE_OPTIONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
            ステップを追加
          </button>
        </form>
      </section>
    </div>
  );
}

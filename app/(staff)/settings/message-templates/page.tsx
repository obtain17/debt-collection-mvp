import { requireSession, requireRole } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db/prisma";
import { TONE_LABEL, formatDateTime } from "@/lib/format";
import { createMessageTemplate, deleteMessageTemplate, toggleLegalApproved } from "./actions";
import type { $Enums } from "@/generated/prisma/client";

const TONE_OPTIONS: $Enums.Tone[] = ["EMPATHETIC", "NEUTRAL_FIRM", "FORMAL_FINAL_NOTICE"];

export default async function MessageTemplatesSettingsPage() {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const templates = await prisma.messageTemplate.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">文面テンプレート管理</h1>
      <p className="text-sm text-slate-500">
        既存の督促ステップの「テンプレート」欄に入力するキー(例: FRIENDLY_REMINDER)と同じキーで作成すると、
        そのステップの文面がここで作成した内容に置き換わります。件名・本文には
        <code className="mx-1 rounded bg-slate-100 px-1">{"{{debtorName}}"}</code>
        <code className="mx-1 rounded bg-slate-100 px-1">{"{{organizationName}}"}</code>
        <code className="mx-1 rounded bg-slate-100 px-1">{"{{claimType}}"}</code>
        <code className="mx-1 rounded bg-slate-100 px-1">{"{{currentBalance}}"}</code>
        <code className="mx-1 rounded bg-slate-100 px-1">{"{{originalDueDate}}"}</code>
        <code className="mx-1 rounded bg-slate-100 px-1">{"{{daysOverdue}}"}</code>
        <code className="mx-1 rounded bg-slate-100 px-1">{"{{portalUrl}}"}</code>
        が使えます。
      </p>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">テンプレート一覧</h2>
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-slate-800">
                  {t.label}(key: {t.key} / トーン: {TONE_LABEL[t.tone]})
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    t.legalApproved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {t.legalApproved ? "法務確認済み" : "未確認"}
                </span>
              </div>
              <p className="mb-1 text-xs text-slate-500">件名: {t.subjectTemplate}</p>
              <pre className="mb-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600">
                {t.bodyTemplate}
              </pre>
              <p className="mb-2 text-xs text-slate-400">作成日: {formatDateTime(t.createdAt)}</p>
              <div className="flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    await toggleLegalApproved(t.id);
                  }}
                >
                  <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                    {t.legalApproved ? "確認済みを解除" : "法務確認済みにする"}
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await deleteMessageTemplate(t.id);
                  }}
                >
                  <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                    削除
                  </button>
                </form>
              </div>
            </div>
          ))}
          {templates.length === 0 && <p className="text-slate-400">テンプレートはまだありません</p>}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">新規テンプレート作成</h2>
        <form action={createMessageTemplate} className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">キー(例: FRIENDLY_REMINDER)</span>
              <input name="key" className="w-full rounded-md border border-slate-300 px-2 py-1" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">表示名</span>
              <input name="label" className="w-full rounded-md border border-slate-300 px-2 py-1" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">トーン</span>
            <select name="tone" className="rounded-md border border-slate-300 px-2 py-1">
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TONE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">件名テンプレート</span>
            <input name="subjectTemplate" className="w-full rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">本文テンプレート</span>
            <textarea name="bodyTemplate" rows={5} className="w-full rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
            作成
          </button>
        </form>
      </section>
    </div>
  );
}

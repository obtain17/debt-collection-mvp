"use client";

import { useState, useTransition } from "react";
import { submitProposal } from "./actions";
import { formatYen } from "@/lib/format";

export function ProposalForm({ token, currentBalance }: { token: string; currentBalance: number }) {
  const [kind, setKind] = useState<"installment" | "settlement">("installment");
  const [installmentCount, setInstallmentCount] = useState(6);
  const [settlementAmount, setSettlementAmount] = useState(Math.round(currentBalance * 0.8));
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await submitProposal(token, formData);
      setDone(true);
    });
  }

  if (done) {
    return (
      <p className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800">
        ご提案を受け付けました。担当者が確認のうえご連絡いたします。
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="kind"
            value="installment"
            checked={kind === "installment"}
            onChange={() => setKind("installment")}
          />
          分割払いを提案する
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="kind"
            value="settlement"
            checked={kind === "settlement"}
            onChange={() => setKind("settlement")}
          />
          一括和解を提案する
        </label>
      </div>

      {kind === "installment" ? (
        <div className="text-sm">
          <label className="mb-1 block text-slate-600">分割回数(月)</label>
          <select
            name="installmentCount"
            value={installmentCount}
            onChange={(e) => setInstallmentCount(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {[3, 6, 12, 24].map((n) => (
              <option key={n} value={n}>
                {n}回
              </option>
            ))}
          </select>
          <p className="mt-1 text-slate-500">
            1回あたり約 {formatYen(Math.floor(currentBalance / installmentCount))}
          </p>
        </div>
      ) : (
        <div className="text-sm">
          <label className="mb-1 block text-slate-600">一括でお支払い可能な金額</label>
          <input
            type="number"
            name="settlementAmount"
            value={settlementAmount}
            onChange={(e) => setSettlementAmount(Number(e.target.value))}
            min={0}
            max={currentBalance}
            className="w-48 rounded-md border border-slate-300 px-3 py-2"
          />
          <p className="mt-1 text-slate-500">現在の残高: {formatYen(currentBalance)}</p>
        </div>
      )}

      <details className="rounded-md border border-slate-200 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">ご返済状況について(任意)</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">月収(円)</span>
            <input name="monthlyIncome" type="number" min={0} className="w-full rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">手取り収入(円)</span>
            <input name="takeHomeIncome" type="number" min={0} className="w-full rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">家賃(円)</span>
            <input name="rent" type="number" min={0} className="w-full rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">扶養人数</span>
            <input name="dependentsCount" type="number" min={0} className="w-full rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">他社への返済額(円/月)</span>
            <input name="otherDebtRepayment" type="number" min={0} className="w-full rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">返済可能月額(円)</span>
            <input name="affordableMonthlyAmount" type="number" min={0} className="w-full rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">希望支払日(毎月)</span>
            <input name="desiredPaymentDay" type="number" min={1} max={28} className="w-full rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">初回入金可能日</span>
            <input name="firstPaymentDate" type="date" className="w-full rounded-md border border-slate-300 px-2 py-1" />
          </label>
        </div>
        <div className="mt-3">
          <span className="mb-1 block text-xs text-slate-500">ボーナス月(該当する月を選択)</span>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <label key={month} className="flex items-center gap-1 text-xs">
                <input type="checkbox" name="bonusMonths" value={month} />
                {month}月
              </label>
            ))}
          </div>
        </div>
      </details>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? "送信中..." : "この内容で提案する"}
      </button>
    </form>
  );
}

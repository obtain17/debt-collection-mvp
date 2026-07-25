"use client";

import { useState, useTransition } from "react";
import { sendOtpAction, verifyIdentity } from "./actions";

type Method = "PHONE_LAST4" | "DATE_OF_BIRTH" | "CLAIM_REFERENCE" | "SECRET_QUESTION" | "OTP";

const METHOD_LABEL: Record<Method, string> = {
  PHONE_LAST4: "電話番号(下4桁)",
  DATE_OF_BIRTH: "生年月日",
  CLAIM_REFERENCE: "照会番号",
  SECRET_QUESTION: "秘密の質問",
  OTP: "ワンタイムコード",
};

export function IdentityVerificationForm({
  token,
  organizationName,
  hasSecretQuestion,
  secretQuestionText,
  attemptsRemaining,
}: {
  token: string;
  organizationName: string;
  hasSecretQuestion: boolean;
  secretQuestionText: string | null;
  attemptsRemaining: number;
}) {
  const methods: Method[] = ["PHONE_LAST4", "DATE_OF_BIRTH", "CLAIM_REFERENCE", ...(hasSecretQuestion ? (["SECRET_QUESTION"] as Method[]) : []), "OTP"];
  const [method, setMethod] = useState<Method>(methods[0]);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function selectMethod(next: Method) {
    setMethod(next);
    setOtpSent(false);
    setError(null);
  }

  function handleSendOtp() {
    setError(null);
    startTransition(async () => {
      try {
        await sendOtpAction(token);
        setOtpSent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "送信に失敗しました");
      }
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await verifyIdentity(token, formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "確認に失敗しました");
      }
    });
  }

  if (attemptsRemaining <= 0) {
    return (
      <p className="rounded-md bg-red-50 p-4 text-sm text-red-800">
        試行回数の上限に達しました。お手数ですが{organizationName}の担当者までお問い合わせください。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        第三者への情報開示を防ぐため、お手続きの前に本人確認をお願いしております。以下のいずれかの方法で
        確認してください。
      </p>

      <div className="flex flex-wrap gap-2 text-xs">
        {methods.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => selectMethod(m)}
            className={`rounded-full px-3 py-1 ${
              method === m ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {METHOD_LABEL[m]}
          </button>
        ))}
      </div>

      {method === "OTP" ? (
        !otpSent ? (
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? "送信中..." : "コードを送信"}
          </button>
        ) : (
          <form action={handleSubmit} className="flex gap-2">
            <input type="hidden" name="method" value="OTP" />
            <input
              name="value"
              placeholder="6桁のコード"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
            >
              確認
            </button>
          </form>
        )
      ) : (
        <form action={handleSubmit} className="space-y-2">
          <input type="hidden" name="method" value={method} />
          {method === "SECRET_QUESTION" && secretQuestionText && (
            <p className="text-xs text-slate-500">質問: {secretQuestionText}</p>
          )}
          <input
            name="value"
            type={method === "DATE_OF_BIRTH" ? "date" : "text"}
            placeholder={
              method === "PHONE_LAST4"
                ? "電話番号の下4桁"
                : method === "CLAIM_REFERENCE"
                  ? "照会番号"
                  : method === "SECRET_QUESTION"
                    ? "回答"
                    : ""
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? "確認中..." : "確認する"}
          </button>
        </form>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

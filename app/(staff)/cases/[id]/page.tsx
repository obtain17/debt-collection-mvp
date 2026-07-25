import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db/prisma";
import { buildPortalUrl } from "@/lib/portal/ensureAccessToken";
import { ALL_COMPLIANCE_FLAG_TYPES } from "@/lib/compliance/rules";
import { getContactStats } from "@/lib/compliance/contactFrequency";
import { checkProhibitedExpressions } from "@/lib/dunning/prohibitedExpressions";
import { isTemplateLegalApproved } from "@/lib/dunning/renderContent";
import { getNegotiationRule } from "@/lib/negotiation/getNegotiationRule";
import { evaluateProposal } from "@/lib/negotiation/evaluateProposal";
import { getScheduleSummary } from "@/lib/schedule/getScheduleSummary";
import { getClaimReferenceCode } from "@/lib/portal/verifyIdentity";
import { getAiVoiceSettings } from "@/lib/voice/getAiVoiceSettings";
import {
  APPROACH_LABEL,
  CHANNEL_LABEL,
  CLAIM_STATUS_COLOR,
  CLAIM_STATUS_LABEL,
  COMMUNICATION_STATUS_LABEL,
  COMPLIANCE_FLAG_LABEL,
  CONFIDENCE_LABEL,
  CONTACT_EVENT_LABEL,
  DEPOSIT_MATCH_STATUS_COLOR,
  DEPOSIT_MATCH_STATUS_LABEL,
  IDENTITY_VERIFICATION_LABEL,
  IDENTITY_VERIFICATION_METHOD_LABEL,
  LEGAL_TITLE_LABEL,
  MAIL_CLASS_LABEL,
  NEGOTIATION_VERDICT_COLOR,
  NEGOTIATION_VERDICT_LABEL,
  RECOVERY_OUTCOME_LABEL,
  RISK_TIER_COLOR,
  RISK_TIER_LABEL,
  TONE_LABEL,
  VOICE_CALL_OUTCOME_COLOR,
  VOICE_CALL_OUTCOME_LABEL,
  formatDate,
  formatDateTime,
  formatYen,
} from "@/lib/format";
import {
  addNote,
  approveCommunication,
  clearComplianceFlag,
  editCommunicationContent,
  issuePortalLink,
  logContactEvent,
  placeAdHocAiVoiceCall,
  reanalyzeClaimAction,
  recordPayment,
  rejectCommunication,
  reviewProposal,
  setComplianceFlag,
  updateVerificationSettings,
} from "./actions";
import { StatusSelect } from "./StatusSelect";
import { SubmitButton } from "./SubmitButton";
import type { $Enums } from "@/generated/prisma/client";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const claim = await prisma.claim.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      debtor: true,
      organization: true,
      assignedAgent: true,
      latestAnalysis: true,
      analyses: { orderBy: { createdAt: "desc" }, take: 2 },
      payments: { orderBy: { paidAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { user: true } },
      activityLogs: { orderBy: { createdAt: "desc" }, include: { user: true }, take: 50 },
      proposals: { orderBy: { createdAt: "desc" } },
      scheduledCommunications: {
        orderBy: { scheduledFor: "asc" },
        include: { dunningStep: true, approvedByUser: true },
      },
      complianceFlags: {
        orderBy: { createdAt: "desc" },
        include: { setByUser: true, clearedByUser: true },
      },
      aiVoiceCallLogs: { orderBy: { startedAt: "desc" } },
    },
  });

  if (!claim) notFound();

  const aiVoiceSettings = await getAiVoiceSettings(session.organizationId);

  const activeToken = await prisma.negotiationAccessToken.findFirst({
    where: { claimId: claim.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  const contactStats = await getContactStats(claim.id);
  const scheduleSummary = await getScheduleSummary(claim.id);

  const analysis = claim.latestAnalysis;
  const previousAnalysis = claim.analyses[1];
  const scoreDelta =
    analysis?.status === "COMPLETE" &&
    analysis.recoveryProbability != null &&
    previousAnalysis?.status === "COMPLETE" &&
    previousAnalysis.recoveryProbability != null
      ? Math.round((analysis.recoveryProbability - previousAnalysis.recoveryProbability) * 1000) / 10
      : null;
  const recommendedActions = Array.isArray(analysis?.recommendedActions)
    ? (analysis.recommendedActions as Array<{ order: number; action: string }>).sort((a, b) => a.order - b.order)
    : [];
  const activeComplianceFlags = claim.complianceFlags.filter((f) => !f.clearedAt);
  const clearedComplianceFlags = claim.complianceFlags.filter((f) => f.clearedAt);
  const lastPaymentDate = claim.payments[0]?.paidAt;
  const defaultStartDate = new Date(claim.originalDueDate.getTime() + 24 * 60 * 60 * 1000);

  const legalApprovedMap: Record<string, boolean> = {};
  for (const sc of claim.scheduledCommunications) {
    if (sc.status !== "DRAFT_PENDING_REVIEW") continue;
    const templateKey = sc.dunningStep?.templateKey ?? "FRIENDLY_REMINDER";
    legalApprovedMap[sc.id] = await isTemplateLegalApproved(claim.organizationId, templateKey);
  }

  const negotiationRule = await getNegotiationRule(claim.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{claim.debtor.name}</h1>
          <p className="text-sm text-slate-500">
            {claim.claimType} / {formatYen(claim.currentBalance)}(元本 {formatYen(claim.principalAmount)})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm ${CLAIM_STATUS_COLOR[claim.status]}`}>
            {CLAIM_STATUS_LABEL[claim.status]}
          </span>
          {session.role === "ADMIN" && <StatusSelect claimId={claim.id} currentStatus={claim.status} />}
        </div>
      </div>

      {activeComplianceFlags.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="mb-2 font-semibold">自動督促停止中</p>
          <ul className="space-y-1">
            {activeComplianceFlags.map((flag) => (
              <li key={flag.id}>
                理由: {COMPLIANCE_FLAG_LABEL[flag.flagType]}
                {flag.reason ? `(${flag.reason})` : ""} / 停止日: {formatDate(flag.createdAt)}
                {flag.setByUser ? ` / 設定者: ${flag.setByUser.name}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-700">解除は管理者(ADMIN)のみ可能です。</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* AI Analysis */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">AI分析</h2>
              <form
                action={async () => {
                  "use server";
                  await reanalyzeClaimAction(claim.id);
                }}
              >
                <SubmitButton
                  pendingLabel="分析中..."
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                >
                  AI分析を再実行
                </SubmitButton>
              </form>
            </div>

            {!analysis || analysis.status === "NOT_ANALYZED" ? (
              <p className="text-sm text-slate-400">
                未分析です(ANTHROPIC_API_KEY が設定されていないか、まだ分析が実行されていません)。
              </p>
            ) : analysis.status === "FAILED" ? (
              <p className="text-sm text-red-600">分析に失敗しました: {analysis.errorMessage}</p>
            ) : analysis.status === "PENDING" ? (
              <p className="text-sm text-slate-400">分析中です...</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>算定日: {formatDate(analysis.createdAt)}</span>
                  <span>モデル: {analysis.modelUsed ?? "-"}</span>
                  {analysis.confidenceLevel && <span>信頼度: {CONFIDENCE_LABEL[analysis.confidenceLevel]}</span>}
                  {scoreDelta !== null && (
                    <span className={scoreDelta >= 0 ? "text-emerald-600" : "text-red-600"}>
                      前回比: {scoreDelta >= 0 ? "+" : ""}
                      {scoreDelta}ポイント
                    </span>
                  )}
                </div>

                {analysis.dataInsufficient && (
                  <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                    データ不足: {analysis.dataInsufficiencyNote ?? "分析に十分なデータがありません"}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  <span className={`rounded-full px-3 py-1 ${RISK_TIER_COLOR[analysis.riskTier!]}`}>
                    リスク: {RISK_TIER_LABEL[analysis.riskTier!]}
                  </span>
                  <span className="text-slate-600">
                    {analysis.recoveryWindowDays ?? "?"}日以内に1円以上入金される確率:{" "}
                    {Math.round((analysis.recoveryProbability ?? 0) * 100)}%
                  </span>
                  <span className="text-slate-500">次アクション推奨: {analysis.suggestedNextActionDays}日以内</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-slate-600">
                  {analysis.expectedRecoveryType && (
                    <span>想定回収: {RECOVERY_OUTCOME_LABEL[analysis.expectedRecoveryType]}</span>
                  )}
                  {analysis.expectedRecoveryAmount12m != null && (
                    <span>12か月以内の予想回収額: {formatYen(analysis.expectedRecoveryAmount12m)}</span>
                  )}
                </div>
                <p className="text-slate-600">{analysis.recoveryProbabilityRationale}</p>

                {(analysis.contactabilityScore != null ||
                  analysis.paymentWillingnessScore != null ||
                  analysis.paymentCapacityScore != null) && (
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      <Metric label="本人接触可能性" value={pct(analysis.contactabilityScore)} />
                      <Metric label="支払意思" value={pct(analysis.paymentWillingnessScore)} />
                      <Metric label="支払能力" value={pct(analysis.paymentCapacityScore)} />
                      <Metric label="期待回収額" value={yenOrDash(analysis.expectedRecoveryAmount)} />
                      <Metric label="今後の予想回収コスト" value={yenOrDash(analysis.expectedCollectionCost)} />
                      <Metric
                        label="期待利益"
                        value={
                          analysis.expectedRecoveryAmount != null && analysis.expectedCollectionCost != null
                            ? formatYen(analysis.expectedRecoveryAmount - analysis.expectedCollectionCost)
                            : "-"
                        }
                      />
                    </tbody>
                  </table>
                )}

                <div className="rounded-md bg-slate-50 p-3">
                  <p className="mb-1 font-medium text-slate-800">
                    推奨アプローチ: {APPROACH_LABEL[analysis.recommendedApproach!]}
                    (トーン: {TONE_LABEL[analysis.suggestedTone!]} / チャネル: {CHANNEL_LABEL[analysis.suggestedChannel!]})
                  </p>
                  <p className="text-slate-600">{analysis.reasoning}</p>
                </div>

                {recommendedActions.length > 0 && (
                  <div>
                    <p className="mb-1 font-medium text-slate-800">AI推奨行動</p>
                    <ol className="list-inside list-decimal text-slate-600">
                      {recommendedActions.map((a) => (
                        <li key={a.order}>{a.action}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {analysis.keyRiskFactors.length > 0 && (
                  <div>
                    <p className="mb-1 font-medium text-slate-800">主なリスク要因</p>
                    <ul className="list-inside list-disc text-slate-600">
                      {analysis.keyRiskFactors.map((factor, i) => (
                        <li key={i}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Compliance flags */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-slate-900">コンプライアンスフラグ</h2>
            <form
              action={async (formData: FormData) => {
                "use server";
                await setComplianceFlag(
                  claim.id,
                  formData.get("flagType") as $Enums.ComplianceFlagType,
                  String(formData.get("reason") ?? ""),
                );
              }}
              className="mb-4 flex flex-wrap gap-2"
            >
              <select name="flagType" className="rounded-md border border-slate-300 px-2 py-2 text-sm">
                {ALL_COMPLIANCE_FLAG_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {COMPLIANCE_FLAG_LABEL[type]}
                  </option>
                ))}
              </select>
              <input
                name="reason"
                placeholder="理由(任意)"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">
                フラグを設定
              </button>
            </form>
            <ul className="space-y-2 text-sm">
              {activeComplianceFlags.map((flag) => (
                <li key={flag.id} className="flex items-center justify-between rounded-md bg-red-50 p-2">
                  <span>
                    {COMPLIANCE_FLAG_LABEL[flag.flagType]}
                    {flag.reason ? `: ${flag.reason}` : ""}({formatDate(flag.createdAt)})
                  </span>
                  {session.role === "ADMIN" && (
                    <form
                      action={async () => {
                        "use server";
                        await clearComplianceFlag(claim.id, flag.id);
                      }}
                    >
                      <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                        解除
                      </button>
                    </form>
                  )}
                </li>
              ))}
              {clearedComplianceFlags.map((flag) => (
                <li key={flag.id} className="text-slate-400">
                  {COMPLIANCE_FLAG_LABEL[flag.flagType]}(解除済み: {formatDate(flag.clearedAt!)}
                  {flag.clearedByUser ? ` / ${flag.clearedByUser.name}` : ""})
                </li>
              ))}
              {claim.complianceFlags.length === 0 && <li className="text-slate-400">フラグはありません</li>}
            </ul>
          </section>

          {/* AI voice auto-dunning (項目1) */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">AI音声自動督促</h2>
              {claim.status !== "SETTLED" && claim.status !== "WRITTEN_OFF" && (
                <form
                  action={async () => {
                    "use server";
                    await placeAdHocAiVoiceCall(claim.id);
                  }}
                >
                  <SubmitButton
                    pendingLabel="架電中..."
                    className="rounded-md bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-800"
                  >
                    今すぐ架電(デモ)
                  </SubmitButton>
                </form>
              )}
            </div>

            {!aiVoiceSettings.enabled && (
              <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                この組織ではAI音声自動督促が無効です。
                <Link href="/settings/ai-voice" className="ml-1 underline">
                  設定画面で有効化
                </Link>
                すると実行できます(実行しても発信対象外として記録されます)。
              </p>
            )}

            <ul className="space-y-2 text-sm">
              {claim.aiVoiceCallLogs.map((call) => (
                <li key={call.id} className="rounded-md border border-slate-200 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{formatDateTime(call.startedAt)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${VOICE_CALL_OUTCOME_COLOR[call.outcome]}`}>
                      {VOICE_CALL_OUTCOME_LABEL[call.outcome]}
                    </span>
                  </div>
                  {call.summary && <p className="mt-1 text-slate-700">{call.summary}</p>}
                  {Array.isArray(call.transcript) && call.transcript.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-slate-500">文字起こしを表示</summary>
                      <ul className="mt-1 space-y-1 rounded bg-slate-50 p-2 text-xs">
                        {(call.transcript as Array<{ speaker: string; text: string }>).map((turn, i) => (
                          <li key={i}>
                            <span className="font-medium text-slate-700">
                              {turn.speaker === "AI" ? "AI: " : "債務者: "}
                            </span>
                            {turn.text}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
              {claim.aiVoiceCallLogs.length === 0 && <li className="text-slate-400">通話記録はまだありません</li>}
            </ul>
          </section>

          {/* Manual contact / payment logging */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-slate-900">接触記録を追加</h2>
            <form
              action={async (formData: FormData) => {
                "use server";
                await logContactEvent(claim.id, formData);
              }}
              className="flex flex-wrap gap-2"
            >
              <select name="type" className="rounded-md border border-slate-300 px-2 py-2 text-sm">
                {Object.entries(CONTACT_EVENT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                name="note"
                placeholder="メモ(任意)"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
                記録
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-slate-900">入金を記録</h2>
            <form
              action={async (formData: FormData) => {
                "use server";
                await recordPayment(claim.id, formData);
              }}
              className="flex flex-wrap gap-2"
            >
              <input
                name="amount"
                type="number"
                min="1"
                placeholder="金額(円)"
                className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input name="paidAt" type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
                記録
              </button>
            </form>
          </section>

          {/* Payment plan proposals */}
          {claim.proposals.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-3 font-semibold text-slate-900">返済提案</h2>
              <div className="space-y-3">
                {claim.proposals.map((proposal) => {
                  const evaluation = evaluateProposal(proposal, claim, negotiationRule);
                  const hasFinancialInfo =
                    proposal.monthlyIncome != null ||
                    proposal.takeHomeIncome != null ||
                    proposal.rent != null ||
                    proposal.dependentsCount != null ||
                    proposal.otherDebtRepayment != null ||
                    proposal.affordableMonthlyAmount != null ||
                    proposal.desiredPaymentDay != null ||
                    proposal.bonusMonths.length > 0 ||
                    proposal.firstPaymentDate != null;

                  return (
                  <div key={proposal.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-slate-800">
                        {proposal.settlementOffer ? "一括和解案" : "分割払い案"}: {formatYen(proposal.totalAmount)}
                      </span>
                      <span className="text-xs text-slate-500">{proposal.status}</span>
                    </div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${NEGOTIATION_VERDICT_COLOR[evaluation.verdict]}`}>
                        {NEGOTIATION_VERDICT_LABEL[evaluation.verdict]}
                      </span>
                      <span className="text-xs text-slate-500">
                        減額率 {Math.round(evaluation.discountRate * 1000) / 10}%
                      </span>
                    </div>
                    {evaluation.reasons.length > 0 && (
                      <ul className="mb-2 list-inside list-disc text-xs text-slate-500">
                        {evaluation.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                    <pre className="mb-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600">
                      {JSON.stringify(proposal.installments, null, 2)}
                    </pre>
                    {hasFinancialInfo && (
                      <dl className="mb-2 space-y-1 rounded bg-slate-50 p-2 text-xs">
                        {proposal.monthlyIncome != null && <Row label="月収" value={formatYen(proposal.monthlyIncome)} />}
                        {proposal.takeHomeIncome != null && (
                          <Row label="手取り収入" value={formatYen(proposal.takeHomeIncome)} />
                        )}
                        {proposal.rent != null && <Row label="家賃" value={formatYen(proposal.rent)} />}
                        {proposal.dependentsCount != null && (
                          <Row label="扶養人数" value={`${proposal.dependentsCount}人`} />
                        )}
                        {proposal.otherDebtRepayment != null && (
                          <Row label="他社返済額" value={formatYen(proposal.otherDebtRepayment)} />
                        )}
                        {proposal.affordableMonthlyAmount != null && (
                          <Row label="返済可能月額" value={formatYen(proposal.affordableMonthlyAmount)} />
                        )}
                        {proposal.desiredPaymentDay != null && (
                          <Row label="希望支払日" value={`毎月${proposal.desiredPaymentDay}日`} />
                        )}
                        {proposal.bonusMonths.length > 0 && (
                          <Row label="ボーナス月" value={proposal.bonusMonths.map((m) => `${m}月`).join("・")} />
                        )}
                        {proposal.firstPaymentDate != null && (
                          <Row label="初回入金可能日" value={formatDate(proposal.firstPaymentDate)} />
                        )}
                      </dl>
                    )}
                    {proposal.status === "PENDING_REVIEW" && (
                      <div className="flex gap-2">
                        <form
                          action={async () => {
                            "use server";
                            await reviewProposal(claim.id, proposal.id, "APPROVED", "");
                          }}
                        >
                          <button className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700">
                            承認
                          </button>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await reviewProposal(claim.id, proposal.id, "REJECTED", "");
                          }}
                        >
                          <button className="rounded-md bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700">
                            却下
                          </button>
                        </form>
                      </div>
                    )}
                    {proposal.reviewNote && (
                      <p className="mt-1 text-xs text-slate-500">レビューメモ: {proposal.reviewNote}</p>
                    )}
                    {proposal.debtorConsentedAt && (
                      <div className="mt-2 text-xs text-slate-500">
                        <p>
                          {formatDate(proposal.debtorConsentedAt)}に{proposal.debtorConsentName}様が電子同意しました
                        </p>
                        <a
                          href={`/api/proposals/${proposal.id}/agreement-pdf`}
                          className="text-slate-700 underline"
                        >
                          合意書(PDF)をダウンロード
                        </a>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Activity timeline */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-slate-900">タイムライン</h2>
            <ul className="space-y-2 text-sm">
              {claim.activityLogs.map((log) => (
                <li key={log.id} className="border-b border-slate-100 pb-2 last:border-0">
                  <div className="flex justify-between text-slate-500">
                    <span>{log.user?.name ?? "システム"}</span>
                    <span>{formatDateTime(log.createdAt)}</span>
                  </div>
                  <p className="text-slate-800">{log.description}</p>
                </li>
              ))}
              {claim.activityLogs.length === 0 && <li className="text-slate-400">履歴はまだありません</li>}
            </ul>
          </section>

          {/* Notes */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-slate-900">メモ</h2>
            <form
              action={async (formData: FormData) => {
                "use server";
                await addNote(claim.id, formData);
              }}
              className="mb-4 flex gap-2"
            >
              <input
                name="body"
                placeholder="メモを入力..."
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
                追加
              </button>
            </form>
            <ul className="space-y-2 text-sm">
              {claim.notes.map((note) => (
                <li key={note.id} className="border-b border-slate-100 pb-2 last:border-0">
                  <div className="flex justify-between text-slate-500">
                    <span>{note.user.name}</span>
                    <span>{formatDateTime(note.createdAt)}</span>
                  </div>
                  <p className="text-slate-800">{note.body}</p>
                </li>
              ))}
              {claim.notes.length === 0 && <li className="text-slate-400">メモはまだありません</li>}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          {/* Debtor info */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-900">債務者情報</h2>
            <dl className="space-y-1">
              <Row label="種別" value={claim.debtor.type === "INDIVIDUAL" ? "個人" : "法人"} />
              <Row label="連絡先" value={`${claim.debtor.email ?? "-"} / ${claim.debtor.phone ?? "-"}`} />
              <Row label="住所" value={claim.debtor.addressLine ?? "-"} />
              {claim.debtor.type === "INDIVIDUAL" ? (
                <>
                  <Row label="年代" value={claim.debtor.ageBracket ?? "-"} />
                  <Row label="職業" value={claim.debtor.occupation ?? "-"} />
                  <Row label="勤務先" value={claim.debtor.employerName ?? "-"} />
                </>
              ) : (
                <>
                  <Row label="業種" value={claim.debtor.industry ?? "-"} />
                  <Row label="従業員数" value={claim.debtor.employeeCountBracket ?? "-"} />
                  <Row label="設立からの年数" value={claim.debtor.yearsInBusiness ? `${claim.debtor.yearsInBusiness}年` : "-"} />
                </>
              )}
              <Row
                label="本人確認状況"
                value={IDENTITY_VERIFICATION_LABEL[claim.debtor.identityVerificationStatus]}
              />
              {claim.debtor.identityVerifiedAt && (
                <Row label="本人確認日時" value={formatDateTime(claim.debtor.identityVerifiedAt)} />
              )}
              {claim.debtor.identityVerificationMethod && (
                <Row
                  label="本人確認方法"
                  value={IDENTITY_VERIFICATION_METHOD_LABEL[claim.debtor.identityVerificationMethod]}
                />
              )}
              <Row label="照会番号" value={getClaimReferenceCode(claim.id)} />
            </dl>
          </section>

          {/* Identity verification settings (項目17) */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-900">本人確認情報の設定</h2>
            <p className="mb-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
              架電時の本人確認のヒント: 照会番号「{getClaimReferenceCode(claim.id)}
              」・登録電話番号の下4桁
              {claim.debtor.secretQuestion ? "・秘密の質問" : ""}
              {claim.debtor.dateOfBirth ? "・生年月日" : ""}
              を確認してから、債権額等の詳細をお伝えください。
            </p>
            <form
              action={async (formData: FormData) => {
                "use server";
                await updateVerificationSettings(claim.id, formData);
              }}
              className="space-y-2"
            >
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">生年月日</span>
                <input
                  name="dateOfBirth"
                  type="date"
                  defaultValue={
                    claim.debtor.dateOfBirth ? claim.debtor.dateOfBirth.toISOString().slice(0, 10) : ""
                  }
                  className="rounded-md border border-slate-300 px-2 py-1"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">秘密の質問</span>
                <input
                  name="secretQuestion"
                  defaultValue={claim.debtor.secretQuestion ?? ""}
                  placeholder="例: 出身地は?"
                  className="w-full rounded-md border border-slate-300 px-2 py-1"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">秘密の質問の回答</span>
                <input
                  name="secretAnswer"
                  defaultValue={claim.debtor.secretAnswer ?? ""}
                  className="w-full rounded-md border border-slate-300 px-2 py-1"
                />
              </label>
              <button className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">
                保存
              </button>
            </form>
          </section>

          {/* Claim info */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-900">債権情報</h2>
            <dl className="space-y-1">
              <Row label="原債権者" value={claim.originalCreditorName ?? claim.organization.name} />
              <Row label="現在の債権者" value={claim.organization.name} />
              <Row
                label="債権譲渡日 / 取得価格"
                value={
                  claim.claimAcquiredAt
                    ? `${formatDate(claim.claimAcquiredAt)} / ${claim.acquisitionPrice != null ? formatYen(claim.acquisitionPrice) : "-"}`
                    : "譲渡なし"
                }
              />
              <Row label="契約日" value={claim.contractDate ? formatDate(claim.contractDate) : "-"} />
              <Row label="期日" value={formatDate(claim.originalDueDate)} />
              <Row label="延滞開始日(算出)" value={formatDate(defaultStartDate)} />
              <Row label="最終入金日(算出)" value={lastPaymentDate ? formatDate(lastPaymentDate) : "入金なし"} />
              <Row label="元本" value={formatYen(claim.principalAmount)} />
              <Row label="利息" value={formatYen(claim.interestAmount)} />
              <Row label="遅延損害金" value={formatYen(claim.lateDamageAmount)} />
              <Row label="現在残高" value={formatYen(claim.currentBalance)} />
              <Row label="消滅時効管理日" value={claim.statuteLimitationDate ? formatDate(claim.statuteLimitationDate) : "-"} />
              <Row
                label="判決・支払督促・公正証書"
                value={claim.legalTitles.length > 0 ? claim.legalTitles.map((t) => LEGAL_TITLE_LABEL[t]).join(" / ") : "なし"}
              />
              <Row
                label="保証人"
                value={claim.hasGuarantor ? claim.guarantorDescription ?? "あり" : "なし"}
              />
              <Row label="担保" value={claim.hasCollateral ? claim.collateralDescription ?? "あり" : "なし"} />
              <Row label="過去のデフォルト回数" value={`${claim.priorDefaultCount}回`} />
              <Row label="担当者" value={claim.assignedAgent?.name ?? "-"} />
            </dl>
          </section>

          {/* Payments */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-900">入金履歴</h2>
            <ul className="space-y-1">
              {claim.payments.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>
                    {formatDate(p.paidAt)}
                    {p.payerName ? `(${p.payerName})` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${DEPOSIT_MATCH_STATUS_COLOR[p.matchStatus]}`}>
                      {DEPOSIT_MATCH_STATUS_LABEL[p.matchStatus]}
                    </span>
                    {formatYen(p.amount)}
                  </span>
                </li>
              ))}
              {claim.payments.length === 0 && <li className="text-slate-400">入金履歴はありません</li>}
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              入金の取消は<Link href="/deposits" className="underline">入金管理画面</Link>から行えます。
            </p>
          </section>

          {/* Payment schedule (項目13) */}
          {scheduleSummary && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
              <h2 className="mb-3 font-semibold text-slate-900">返済予定</h2>
              <dl className="space-y-1">
                <Row label="今月の予定額" value={formatYen(scheduleSummary.thisMonthDue)} />
                <Row label="今月の入金額" value={formatYen(scheduleSummary.thisMonthPaid)} />
                <Row label="未入金額" value={formatYen(scheduleSummary.unpaidAmount)} />
                <Row
                  label="次回支払日"
                  value={scheduleSummary.nextDueDate ? formatDate(scheduleSummary.nextDueDate) : "完済済み"}
                />
                <Row label="遅延日数" value={`${scheduleSummary.daysOverdue}日`} />
                <Row
                  label="約束履行率"
                  value={scheduleSummary.fulfillmentRate != null ? `${Math.round(scheduleSummary.fulfillmentRate * 100)}%` : "-"}
                />
                <Row label="連続支払回数" value={`${scheduleSummary.consecutivePayments}回`} />
                <Row label="延滞回数" value={`${scheduleSummary.missedCount}回`} />
                <Row
                  label="完済予定日"
                  value={scheduleSummary.payoffDate ? formatDate(scheduleSummary.payoffDate) : "-"}
                />
              </dl>
            </section>
          )}

          {claim.status === "SETTLED" && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
              <h2 className="mb-3 font-semibold text-slate-900">完済証明書</h2>
              <a href={`/api/claims/${claim.id}/completion-certificate`} className="text-slate-700 underline">
                完済証明書(PDF)をダウンロード
              </a>
            </section>
          )}

          {/* Negotiation portal */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-900">交渉ポータル</h2>
            {activeToken ? (
              <p className="mb-2 break-all rounded bg-slate-50 p-2 text-xs text-slate-600">
                {buildPortalUrl(activeToken.token)}
              </p>
            ) : (
              <p className="mb-2 text-slate-400">有効なリンクはありません</p>
            )}
            <form
              action={async () => {
                "use server";
                await issuePortalLink(claim.id);
              }}
            >
              <button className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">
                {activeToken ? "リンクを再発行" : "リンクを発行"}
              </button>
            </form>
          </section>

          {/* Scheduled communications */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-900">督促スケジュール</h2>
            <ul className="space-y-3">
              {claim.scheduledCommunications.map((sc) => {
                const violations = sc.body ? checkProhibitedExpressions(sc.body) : [];
                return (
                  <li key={sc.id} className="rounded-md border border-slate-200 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span>
                        {formatDate(sc.scheduledFor)} / {CHANNEL_LABEL[sc.channel]}
                      </span>
                      <span className="text-slate-500">{COMMUNICATION_STATUS_LABEL[sc.status] ?? sc.status}</span>
                    </div>

                    {sc.status === "DRAFT_PENDING_REVIEW" && (
                      <div className="mt-2 space-y-2">
                        <p
                          className={`rounded px-2 py-1 text-xs ${
                            legalApprovedMap[sc.id]
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {legalApprovedMap[sc.id] ? "法務確認済みテンプレート使用" : "未確認テンプレート使用"}
                        </p>
                        {violations.length > 0 && (
                          <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-800">
                            禁止表現の可能性: {violations.join("、")}
                          </p>
                        )}
                        <form
                          action={async (formData: FormData) => {
                            "use server";
                            await editCommunicationContent(claim.id, sc.id, formData);
                          }}
                          className="space-y-2"
                        >
                          <input
                            name="subject"
                            defaultValue={sc.subject ?? ""}
                            placeholder="件名"
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                          />
                          <textarea
                            name="body"
                            defaultValue={sc.body ?? ""}
                            rows={4}
                            placeholder="本文"
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                          />
                          {sc.channel === "LETTER" && (
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <span>
                                宛先: {claim.debtor.name} 様 / {claim.debtor.addressLine ?? "住所未登録"}
                              </span>
                              <select
                                name="mailClass"
                                defaultValue={sc.mailClass ?? "STANDARD"}
                                className="rounded-md border border-slate-300 px-2 py-1"
                              >
                                {Object.entries(MAIL_CLASS_LABEL).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <button className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">
                            内容を保存
                          </button>
                        </form>
                        {session.role === "ADMIN" && (
                          <div className="flex gap-2">
                            <form
                              action={async () => {
                                "use server";
                                await approveCommunication(claim.id, sc.id);
                              }}
                            >
                              <button className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700">
                                承認
                              </button>
                            </form>
                            <form
                              action={async () => {
                                "use server";
                                await rejectCommunication(claim.id, sc.id, "");
                              }}
                            >
                              <button className="rounded-md bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700">
                                却下
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    )}

                    {sc.status === "APPROVED" && (
                      <p className="mt-1 text-xs text-slate-500">
                        承認者: {sc.approvedByUser?.name ?? "-"} / 承認日時:{" "}
                        {sc.approvedAt ? formatDateTime(sc.approvedAt) : "-"}
                      </p>
                    )}
                  </li>
                );
              })}
              {claim.scheduledCommunications.length === 0 && (
                <li className="text-slate-400">スケジュールされた督促はありません</li>
              )}
            </ul>
          </section>

          {/* Contact frequency / quiet hours */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-900">接触回数・時間帯</h2>
            <dl className="space-y-1">
              <Row label="本日の架電回数" value={`${contactStats.callsToday}回`} />
              <Row label="今週の架電回数" value={`${contactStats.callsThisWeek}回`} />
              <Row label="本日のSMS送信回数" value={`${contactStats.smsToday}回`} />
              <Row label="今週の郵便送付回数" value={`${contactStats.mailThisWeek}回`} />
              <Row
                label="最終接触日時"
                value={contactStats.lastContactAt ? formatDateTime(contactStats.lastContactAt) : "-"}
              />
              <Row
                label="次回連絡可能日時"
                value={contactStats.nextAllowedAt ? formatDateTime(contactStats.nextAllowedAt) : "制限なし"}
              />
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1 pr-3 text-slate-500">{label}</td>
      <td className="py-1 text-right font-medium text-slate-800">{value}</td>
    </tr>
  );
}

function pct(value: number | null | undefined): string {
  return value != null ? `${Math.round(value * 100)}%` : "-";
}

function yenOrDash(value: number | null | undefined): string {
  return value != null ? formatYen(value) : "-";
}

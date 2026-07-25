import { prisma } from "@/lib/db/prisma";
import { getPortalSession } from "@/lib/portal/validateToken";
import { MAX_VERIFICATION_ATTEMPTS } from "@/lib/portal/verifyIdentity";
import { formatDate, formatYen, CLAIM_STATUS_LABEL } from "@/lib/format";
import { ProposalForm } from "./ProposalForm";
import { IdentityVerificationForm } from "./IdentityVerificationForm";
import { consentToSettlement } from "./actions";

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getPortalSession(token);

  if (!session) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <h1 className="mb-2 text-lg font-semibold text-slate-900">リンクが無効です</h1>
        <p className="text-sm text-slate-500">
          このリンクは有効期限が切れているか、無効化されています。お心当たりの金融機関・企業までお問い合わせください。
        </p>
      </div>
    );
  }

  const { accessToken, claim } = session;

  await prisma.activityLog.create({
    data: {
      claimId: claim.id,
      type: "PORTAL_ACCESSED",
      description: "債務者が交渉ポータルを開きました",
    },
  });

  if (!accessToken.identityVerifiedAt) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-xs text-slate-400">{claim.organization.name}からのご案内</p>
        <h1 className="mt-1 mb-4 text-xl font-semibold text-slate-900">本人確認のお願い</h1>
        <IdentityVerificationForm
          token={token}
          organizationName={claim.organization.name}
          hasSecretQuestion={Boolean(claim.debtor.secretQuestion)}
          secretQuestionText={claim.debtor.secretQuestion}
          attemptsRemaining={Math.max(0, MAX_VERIFICATION_ATTEMPTS - accessToken.verificationAttempts)}
        />
      </div>
    );
  }

  const canPropose = !["SETTLED", "WRITTEN_OFF"].includes(claim.status);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-xs text-slate-400">{claim.organization.name}からのご案内</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{claim.debtor.name} 様</h1>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">お支払い内容</dt>
            <dd className="text-slate-800">{claim.claimType}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">現在の残高</dt>
            <dd className="text-lg font-semibold text-slate-900">{formatYen(claim.currentBalance)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">お支払期日</dt>
            <dd className="text-slate-800">{formatDate(claim.originalDueDate)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">状況</dt>
            <dd className="text-slate-800">{CLAIM_STATUS_LABEL[claim.status]}</dd>
          </div>
        </dl>
      </div>

      {claim.proposals.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">これまでのご提案</h2>
          <ul className="space-y-3 text-sm">
            {claim.proposals.map((p) => (
              <li key={p.id} className="border-b border-slate-100 pb-3 last:border-0">
                <div className="flex justify-between">
                  <span>{p.settlementOffer ? "一括和解案" : "分割払い案"}({formatYen(p.totalAmount)})</span>
                  <span className="text-slate-500">
                    {p.status === "PENDING_REVIEW"
                      ? "確認中"
                      : p.status === "APPROVED"
                        ? "承認済み"
                        : p.status === "REJECTED"
                          ? "却下"
                          : "再提案"}
                  </span>
                </div>

                {p.status === "APPROVED" && !p.debtorConsentedAt && (
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      await consentToSettlement(token, p.id, formData);
                    }}
                    className="mt-3 space-y-2 rounded-md bg-slate-50 p-3"
                  >
                    <p className="text-xs text-slate-600">
                      内容にご同意いただける場合、お名前(ご本人確認のため、ご登録のお名前と同じ表記)を入力し
                      同意にチェックしてください。
                    </p>
                    <input
                      name="consentName"
                      placeholder="お名前"
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" name="agreed" />
                      内容に同意します(電子的な合意として記録されます)
                    </label>
                    <button
                      type="submit"
                      className="rounded-md bg-slate-900 px-4 py-2 text-xs text-white hover:bg-slate-800"
                    >
                      同意して合意を確定する
                    </button>
                  </form>
                )}

                {p.debtorConsentedAt && (
                  <div className="mt-2 text-xs text-slate-500">
                    <p>
                      {formatDate(p.debtorConsentedAt)}に{p.debtorConsentName}様のご同意により合意が成立しました。
                    </p>
                    <a
                      href={`/api/proposals/${p.id}/agreement-pdf?token=${token}`}
                      className="text-slate-700 underline"
                    >
                      合意書(PDF)をダウンロード
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canPropose ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">お支払い方法のご相談</h2>
          <ProposalForm token={token} currentBalance={claim.currentBalance} />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          このお取引は完了しています。ご不明な点は{claim.organization.name}までお問い合わせください。
        </div>
      )}
    </div>
  );
}

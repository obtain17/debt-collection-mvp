import Link from "next/link";
import { requireSession, requireRole } from "@/lib/auth/getSession";

export default async function SettingsIndexPage() {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const links = [
    { href: "/settings/dunning-rules", label: "自動督促の設定", description: "督促シナリオのステップ(日数・チャネル・トーン)を管理します。" },
    { href: "/settings/message-templates", label: "文面テンプレート", description: "督促文面のテンプレートを作成・法務確認済みフラグを管理します。" },
    { href: "/settings/negotiation-rules", label: "交渉条件ルール", description: "減額率・分割回数・承認しきい値等の交渉ポリシーを設定します。" },
    { href: "/settings/ai-voice", label: "AI音声自動督促", description: "AI音声通話の有効化・プロバイダ選択・発信対象確認・通話記録の確認を行います。" },
    { href: "/settings/audit-log", label: "監査ログ", description: "督促送信・AI分析・ポータルアクセス・承認等の操作履歴を横断的に確認します。" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">設定</h1>
      <div className="grid grid-cols-3 gap-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-400"
          >
            <h2 className="mb-1 font-semibold text-slate-900">{l.label}</h2>
            <p className="text-sm text-slate-500">{l.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { requireSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db/prisma";
import { LogoutButton } from "./LogoutButton";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const organization = await prisma.organization.findUnique({ where: { id: session.organizationId } });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold text-slate-900">
              債権管理支援プラットフォーム
            </Link>
            <nav className="flex gap-4 text-sm text-slate-600">
              <Link href="/dashboard" className="hover:text-slate-900">
                ダッシュボード
              </Link>
              <Link href="/todo" className="hover:text-slate-900">
                TODO
              </Link>
              <Link href="/deposits" className="hover:text-slate-900">
                入金
              </Link>
              <Link href="/reports" className="hover:text-slate-900">
                レポート
              </Link>
              {session.role === "ADMIN" && (
                <Link href="/settings" className="hover:text-slate-900">
                  設定
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{organization?.name}</span>
            <span className="text-slate-300">|</span>
            <span>
              {session.name}({session.role === "ADMIN" ? "管理者" : "担当者"})
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

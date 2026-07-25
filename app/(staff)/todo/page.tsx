import Link from "next/link";
import { requireSession } from "@/lib/auth/getSession";
import { getTodoItems } from "@/lib/todo/getTodoItems";

export default async function TodoPage() {
  const session = await requireSession();
  const buckets = await getTodoItems(session.organizationId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">本日のTODO</h1>
      <div className="grid grid-cols-2 gap-4">
        {buckets.map((bucket) => (
          <section key={bucket.key} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 flex items-center justify-between font-semibold text-slate-900">
              <span>{bucket.label}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {bucket.claims.length}件
              </span>
            </h2>
            <ul className="space-y-1 text-sm">
              {bucket.claims.map((c) => (
                <li key={c.id}>
                  <Link href={`/cases/${c.id}`} className="text-slate-700 hover:underline">
                    {c.debtorName}
                  </Link>
                </li>
              ))}
              {bucket.claims.length === 0 && <li className="text-slate-400">該当案件はありません</li>}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

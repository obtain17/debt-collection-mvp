"use client";

import { useRouter } from "next/navigation";
import { CLAIM_STATUS_LABEL } from "@/lib/format";
import { updateClaimStatus } from "./actions";
import type { $Enums } from "@/generated/prisma/client";

export function StatusSelect({ claimId, currentStatus }: { claimId: string; currentStatus: string }) {
  const router = useRouter();

  return (
    <select
      key={currentStatus}
      defaultValue={currentStatus}
      onChange={async (e) => {
        await updateClaimStatus(claimId, e.target.value as $Enums.ClaimStatus);
        router.refresh();
      }}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
    >
      {Object.entries(CLAIM_STATUS_LABEL).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

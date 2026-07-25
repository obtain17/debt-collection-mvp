export interface AllocationBreakdown {
  lateDamage: number;
  interest: number;
  principal: number;
  [key: string]: number;
}

/**
 * Splits an incoming payment across late-damages, interest, then principal
 * (in that order), using the claim's total accrued amounts in each bucket as
 * a display/audit snapshot. This does not maintain a running per-bucket
 * remaining balance across multiple payments (out of scope for this MVP) —
 * each payment's breakdown is computed independently against the claim's
 * full accrued totals.
 */
export function allocatePayment(
  amount: number,
  claim: { lateDamageAmount: number; interestAmount: number },
): AllocationBreakdown {
  let remaining = amount;

  const lateDamage = Math.min(remaining, claim.lateDamageAmount);
  remaining -= lateDamage;

  const interest = Math.min(remaining, claim.interestAmount);
  remaining -= interest;

  const principal = remaining;

  return { lateDamage, interest, principal };
}

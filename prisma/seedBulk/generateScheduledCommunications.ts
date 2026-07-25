import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { addDays } from "date-fns";
import type { $Enums } from "../../generated/prisma/client";

export interface UpcomingCommClaim {
  id: string;
  status: $Enums.ClaimStatus;
}

export interface ScheduledCommunicationSeedRow {
  id: string;
  claimId: string;
  scheduledFor: Date;
  channel: "EMAIL";
  status: "PENDING";
}

/**
 * Samples a bounded subset of ACTIVE/IN_NEGOTIATION claims and gives each a
 * single future-dated PENDING send, instead of running scheduleForClaim()
 * (5 steps each) across all bulk claims. The worker only processes 50 due
 * items per tick, so scheduling all of them would flood mail sending and
 * take ~100 minutes to drain on first boot.
 */
export function pickSampleForUpcoming(claims: UpcomingCommClaim[], sampleSize: number): ScheduledCommunicationSeedRow[] {
  const eligible = claims.filter((c) => c.status === "ACTIVE" || c.status === "IN_NEGOTIATION");
  const sample = faker.helpers.arrayElements(eligible, Math.min(sampleSize, eligible.length));
  return sample.map((c) => ({
    id: randomUUID(),
    claimId: c.id,
    scheduledFor: addDays(new Date(), faker.number.int({ min: 1, max: 10 })),
    channel: "EMAIL",
    status: "PENDING",
  }));
}

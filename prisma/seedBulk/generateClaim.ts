import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { subDays } from "date-fns";
import type { $Enums } from "../../generated/prisma/client";

export interface ClaimSeedRow {
  id: string;
  organizationId: string;
  debtorId: string;
  assignedAgentId: string | null;
  claimType: string;
  principalAmount: number;
  currentBalance: number;
  originalDueDate: Date;
  status: $Enums.ClaimStatus;
  hasCollateral: boolean;
  priorDefaultCount: number;
  dunningRuleId: string;
  virtualAccountNumber: string;
}

const CLAIM_TYPES_INDIVIDUAL = ["カードローン", "証書貸付", "事業性ローン"];
const CLAIM_TYPES_COMPANY = ["売掛金", "手形貸付"];

const STATUS_WEIGHTS: Array<{ value: $Enums.ClaimStatus; weight: number }> = [
  { value: "ACTIVE", weight: 50 },
  { value: "IN_NEGOTIATION", weight: 15 },
  { value: "PLAN_AGREED", weight: 10 },
  { value: "SETTLED", weight: 13 },
  { value: "WRITTEN_OFF", weight: 5 },
  { value: "LEGAL_ESCALATION", weight: 7 },
];

function daysOverdueForStatus(status: $Enums.ClaimStatus): number {
  switch (status) {
    case "ACTIVE":
      return faker.number.int({ min: 1, max: 100 }) <= 15
        ? faker.number.int({ min: -30, max: -1 })
        : faker.number.int({ min: 1, max: 90 });
    case "IN_NEGOTIATION":
      return faker.number.int({ min: 10, max: 60 });
    case "PLAN_AGREED":
      return faker.number.int({ min: 5, max: 45 });
    case "SETTLED":
      return faker.number.int({ min: 20, max: 90 });
    case "WRITTEN_OFF":
      return faker.number.int({ min: 60, max: 200 });
    case "LEGAL_ESCALATION":
      return faker.number.int({ min: 60, max: 150 });
  }
}

function balanceRatioForStatus(status: $Enums.ClaimStatus, daysOverdue: number): number {
  switch (status) {
    case "ACTIVE":
      return daysOverdue < 0 ? 1 : faker.number.float({ min: 0.6, max: 1, fractionDigits: 2 });
    case "IN_NEGOTIATION":
      return faker.number.float({ min: 0.4, max: 0.9, fractionDigits: 2 });
    case "PLAN_AGREED":
      return faker.number.float({ min: 0.2, max: 0.7, fractionDigits: 2 });
    case "SETTLED":
      return 0;
    case "WRITTEN_OFF":
      return faker.number.float({ min: 0.3, max: 1, fractionDigits: 2 });
    case "LEGAL_ESCALATION":
      return faker.number.float({ min: 0.7, max: 1, fractionDigits: 2 });
  }
}

export function generateClaim(params: {
  debtorId: string;
  debtorType: $Enums.DebtorType;
  organizationId: string;
  assignedAgentId: string | null;
  dunningRuleId: string;
  virtualAccountNumber: number;
}): ClaimSeedRow {
  const claimType =
    params.debtorType === "COMPANY"
      ? faker.helpers.arrayElement(CLAIM_TYPES_COMPANY)
      : faker.helpers.arrayElement(CLAIM_TYPES_INDIVIDUAL);

  const principalAmount =
    params.debtorType === "COMPANY"
      ? faker.number.int({ min: 500_000, max: 25_000_000 })
      : faker.number.int({ min: 300_000, max: 15_000_000 });

  const status = faker.helpers.weightedArrayElement(STATUS_WEIGHTS);
  const daysOverdue = daysOverdueForStatus(status);
  const balanceRatio = balanceRatioForStatus(status, daysOverdue);
  const currentBalance = Math.round(principalAmount * balanceRatio);

  const collateralChance = claimType === "事業性ローン" || claimType === "手形貸付" ? 40 : 15;
  const hasCollateral = faker.number.int({ min: 1, max: 100 }) <= collateralChance;

  const priorDefaultCount = faker.helpers.weightedArrayElement([
    { value: 0, weight: 70 },
    { value: 1, weight: 20 },
    { value: 2, weight: 8 },
    { value: 3, weight: 2 },
  ]);

  return {
    id: randomUUID(),
    organizationId: params.organizationId,
    debtorId: params.debtorId,
    assignedAgentId: params.assignedAgentId,
    claimType,
    principalAmount,
    currentBalance,
    originalDueDate: subDays(new Date(), daysOverdue),
    status,
    hasCollateral,
    priorDefaultCount,
    dunningRuleId: params.dunningRuleId,
    virtualAccountNumber: String(params.virtualAccountNumber),
  };
}

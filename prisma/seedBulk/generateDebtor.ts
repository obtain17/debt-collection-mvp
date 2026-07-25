import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { generateIndividualName } from "./pools/names";
import { generateCompanyName } from "./pools/companies";
import { pickAddress } from "./pools/locations";
import type { $Enums } from "../../generated/prisma/client";

const pickIndex = (max: number) => faker.number.int({ min: 0, max: max - 1 });

export interface DebtorSeedRow {
  id: string;
  organizationId: string;
  type: $Enums.DebtorType;
  name: string;
  nameKana: string;
  email: string;
  phone: string;
  addressLine: string;
  ageBracket: string | null;
  occupation: string | null;
  industry: string | null;
  employeeCountBracket: string | null;
  yearsInBusiness: number | null;
  identityVerificationStatus: $Enums.IdentityVerificationStatus;
}

const AGE_BRACKETS = ["20代", "30代", "40代", "50代", "60代"];
const INDIVIDUAL_OCCUPATIONS = ["会社員", "パート", "自営業", "会社員(共働き)", "自営業(小売)"];
const EMPLOYEE_COUNT_BRACKETS = ["10-30名", "30-50名", "50-100名"];

/** `skew` controls how likely a debtor is to be a company vs. an individual, matching each demo org's real-world mix. */
export function generateDebtor(seq: number, organizationId: string, skew: "individual" | "company"): DebtorSeedRow {
  const companyChance = skew === "company" ? 85 : 10;
  const isCompany = faker.number.int({ min: 1, max: 100 }) <= companyChance;

  const id = randomUUID();
  const phone = isCompany
    ? `03-${faker.string.numeric(4)}-${faker.string.numeric(4)}`
    : `0${faker.helpers.arrayElement([80, 90])}-${faker.string.numeric(4)}-${faker.string.numeric(4)}`;
  const addressLine = pickAddress(
    pickIndex,
    faker.number.int({ min: 1, max: 15 }),
    faker.number.int({ min: 1, max: 15 }),
    faker.number.int({ min: 1, max: 15 }),
  );
  const identityVerificationStatus: $Enums.IdentityVerificationStatus = faker.helpers.weightedArrayElement([
    { value: "UNVERIFIED", weight: 7 },
    { value: "PARTIAL", weight: 1 },
    { value: "VERIFIED", weight: 2 },
  ]);

  if (isCompany) {
    const company = generateCompanyName(pickIndex);
    return {
      id,
      organizationId,
      type: "COMPANY",
      name: company.kanji,
      nameKana: company.kana,
      email: `${company.emailLocalPart}.${seq}@bulk-demo.example.com`,
      phone,
      addressLine,
      ageBracket: null,
      occupation: null,
      industry: company.industry,
      employeeCountBracket: faker.helpers.arrayElement(EMPLOYEE_COUNT_BRACKETS),
      yearsInBusiness: faker.number.int({ min: 3, max: 45 }),
      identityVerificationStatus,
    };
  }

  const person = generateIndividualName(pickIndex);
  return {
    id,
    organizationId,
    type: "INDIVIDUAL",
    name: person.kanji,
    nameKana: person.kana,
    email: `${person.emailLocalPart}.${seq}@bulk-demo.example.com`,
    phone,
    addressLine,
    ageBracket: faker.helpers.arrayElement(AGE_BRACKETS),
    occupation: faker.helpers.arrayElement(INDIVIDUAL_OCCUPATIONS),
    industry: null,
    employeeCountBracket: null,
    yearsInBusiness: null,
    identityVerificationStatus,
  };
}

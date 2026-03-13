// ── Types ─────────────────────────────────────────────────────────────────────

export interface W2Data {
  employerEIN: string;
  employerName: string;
  employerAddress?: string;
  wages: number;
  federalWithholding: number;
  socialSecurityWages: number;
  socialSecurityWithholding: number;
  medicareWages: number;
  medicareWithholding: number;
  stateWages: Record<string, number>;
  stateWithholding: Record<string, number>;
  box12Codes: Array<{ code: string; amount: number }>;
  box14Items: Array<{ description: string; amount: number }>;
}

export interface Form1099Data {
  payerTIN: string;
  payerName: string;
  recipientTIN?: string;
  amount: number;
  federalWithholding: number;
  stateWithholding?: number;
  state?: string;
  type: string;
  additionalFields?: Record<string, unknown>;
}

export interface K1Data {
  partnershipEIN: string;
  partnershipName: string;
  partnerType: "general" | "limited" | "llc";
  ordinaryIncome: number;
  rentalIncome: number;
  interestIncome: number;
  dividendIncome: number;
  capitalGains: Record<string, number>;
  deductions: Record<string, number>;
  credits: Record<string, number>;
  taxYear: number;
}

export interface NormalizedIncomeDocument {
  sourceType: string;
  sourceId: string;
  grossAmount: number;
  federalWithholding: number;
  stateAllocations: Array<{ state: string; amount: number; withholding: number }>;
  metadata: Record<string, unknown>;
}

// ── Parsers ───────────────────────────────────────────────────────────────────

/**
 * Parse raw W-2 form data into a structured W2Data object.
 */
export function parseW2(data: Record<string, unknown>): W2Data {
  return {
    employerEIN: String(data.employerEIN ?? ""),
    employerName: String(data.employerName ?? ""),
    employerAddress: data.employerAddress ? String(data.employerAddress) : undefined,
    wages: toNumber(data.wages),
    federalWithholding: toNumber(data.federalWithholding),
    socialSecurityWages: toNumber(data.socialSecurityWages),
    socialSecurityWithholding: toNumber(data.socialSecurityWithholding),
    medicareWages: toNumber(data.medicareWages),
    medicareWithholding: toNumber(data.medicareWithholding),
    stateWages: (data.stateWages as Record<string, number>) ?? {},
    stateWithholding: (data.stateWithholding as Record<string, number>) ?? {},
    box12Codes: (data.box12Codes as Array<{ code: string; amount: number }>) ?? [],
    box14Items: (data.box14Items as Array<{ description: string; amount: number }>) ?? [],
  };
}

/**
 * Parse a 1099 variant.
 * type: 'NEC' | 'MISC' | 'INT' | 'DIV' | 'R' | 'G' | 'B' | 'K'
 */
export function parse1099(
  data: Record<string, unknown>,
  type: string
): Form1099Data {
  return {
    payerTIN: String(data.payerTIN ?? ""),
    payerName: String(data.payerName ?? ""),
    recipientTIN: data.recipientTIN ? String(data.recipientTIN) : undefined,
    amount: toNumber(data.amount ?? data.nonemployeeCompensation ?? data.totalOrdinaryDividends),
    federalWithholding: toNumber(data.federalWithholding),
    stateWithholding: data.stateWithholding ? toNumber(data.stateWithholding) : undefined,
    state: data.state ? String(data.state) : undefined,
    type,
    additionalFields: omit(data, [
      "payerTIN",
      "payerName",
      "recipientTIN",
      "amount",
      "federalWithholding",
      "stateWithholding",
      "state",
    ]),
  };
}

/**
 * Parse Schedule K-1 data.
 */
export function parseK1(data: Record<string, unknown>): K1Data {
  return {
    partnershipEIN: String(data.partnershipEIN ?? ""),
    partnershipName: String(data.partnershipName ?? ""),
    partnerType: (data.partnerType as K1Data["partnerType"]) ?? "limited",
    ordinaryIncome: toNumber(data.ordinaryIncome),
    rentalIncome: toNumber(data.rentalIncome),
    interestIncome: toNumber(data.interestIncome),
    dividendIncome: toNumber(data.dividendIncome),
    capitalGains: (data.capitalGains as Record<string, number>) ?? {},
    deductions: (data.deductions as Record<string, number>) ?? {},
    credits: (data.credits as Record<string, number>) ?? {},
    taxYear: toNumber(data.taxYear),
  };
}

/**
 * Normalize a mixed array of income documents into a canonical format.
 */
export function normalizeIncomeData(
  documents: Array<{ type: string; data: Record<string, unknown> }>
): NormalizedIncomeDocument[] {
  return documents.map((doc) => {
    if (doc.type === "w2") {
      const w2 = parseW2(doc.data);
      const stateAllocations = Object.entries(w2.stateWages).map(([state, amount]) => ({
        state,
        amount,
        withholding: w2.stateWithholding[state] ?? 0,
      }));
      return {
        sourceType: "w2",
        sourceId: w2.employerEIN,
        grossAmount: w2.wages,
        federalWithholding: w2.federalWithholding,
        stateAllocations,
        metadata: { employer: w2.employerName, box12Codes: w2.box12Codes },
      };
    }

    if (doc.type.startsWith("1099")) {
      const variant = doc.type.replace("1099-", "").replace("1099_", "");
      const form = parse1099(doc.data, variant);
      return {
        sourceType: `1099-${form.type}`,
        sourceId: form.payerTIN,
        grossAmount: form.amount,
        federalWithholding: form.federalWithholding,
        stateAllocations: form.state
          ? [
              {
                state: form.state,
                amount: form.amount,
                withholding: form.stateWithholding ?? 0,
              },
            ]
          : [],
        metadata: { payer: form.payerName, additionalFields: form.additionalFields },
      };
    }

    if (doc.type === "k1") {
      const k1 = parseK1(doc.data);
      const total =
        k1.ordinaryIncome +
        k1.rentalIncome +
        k1.interestIncome +
        k1.dividendIncome +
        Object.values(k1.capitalGains).reduce((a, b) => a + b, 0);
      return {
        sourceType: "k1",
        sourceId: k1.partnershipEIN,
        grossAmount: total,
        federalWithholding: 0,
        stateAllocations: [],
        metadata: { partnership: k1.partnershipName, details: k1 },
      };
    }

    return {
      sourceType: doc.type,
      sourceId: "",
      grossAmount: toNumber((doc.data as Record<string, unknown>).amount),
      federalWithholding: toNumber((doc.data as Record<string, unknown>).federalWithholding),
      stateAllocations: [],
      metadata: doc.data,
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNumber(value: unknown): number {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function omit(
  obj: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
}

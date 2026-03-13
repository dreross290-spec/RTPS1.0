// ── State Rules Engine ────────────────────────────────────────────────────────

export interface StateRules {
  state: string;
  hasIncomeTax: boolean;
  flatRate?: number;
  conformsToFederalAGI: boolean;
  standardDeduction: {
    single: number;
    marriedFilingJointly: number;
    headOfHousehold?: number;
  };
  personalExemption?: {
    single: number;
    marriedFilingJointly: number;
    dependents?: number;
  };
  efileSupported: boolean;
  dueDate: string; // ISO date format
  extensions: boolean;
  notes?: string;
}

export interface StateTaxBracket {
  rate: number;
  min: number;
  max: number;
}

export interface StateCredits {
  rentersCredit?: number;
  childCareCredit?: number;
  earnedIncomeCredit?: number;
  otherCredits?: Record<string, number>;
}

// ── State Rules Registry ──────────────────────────────────────────────────────

const STATE_RULES: Record<string, StateRules> = {
  CA: {
    state: "CA",
    hasIncomeTax: true,
    conformsToFederalAGI: false,
    standardDeduction: { single: 5202, marriedFilingJointly: 10404, headOfHousehold: 10404 },
    personalExemption: { single: 144, marriedFilingJointly: 288, dependents: 433 },
    efileSupported: true,
    dueDate: "2025-04-15",
    extensions: true,
    notes: "CA SDI and SDI withholding; mental health surcharge 1% on income > $1M.",
  },
  NY: {
    state: "NY",
    hasIncomeTax: true,
    conformsToFederalAGI: false,
    standardDeduction: { single: 8000, marriedFilingJointly: 16050, headOfHousehold: 11200 },
    personalExemption: { single: 0, marriedFilingJointly: 0 },
    efileSupported: true,
    dueDate: "2025-04-15",
    extensions: true,
  },
  TX: {
    state: "TX",
    hasIncomeTax: false,
    conformsToFederalAGI: false,
    standardDeduction: { single: 0, marriedFilingJointly: 0 },
    efileSupported: false,
    dueDate: "N/A",
    extensions: false,
    notes: "No state income tax. Franchise tax may apply to businesses.",
  },
  FL: {
    state: "FL",
    hasIncomeTax: false,
    conformsToFederalAGI: false,
    standardDeduction: { single: 0, marriedFilingJointly: 0 },
    efileSupported: false,
    dueDate: "N/A",
    extensions: false,
    notes: "No state income tax.",
  },
  IL: {
    state: "IL",
    hasIncomeTax: true,
    flatRate: 0.0495,
    conformsToFederalAGI: true,
    standardDeduction: { single: 0, marriedFilingJointly: 0 },
    personalExemption: { single: 2425, marriedFilingJointly: 4850, dependents: 2425 },
    efileSupported: true,
    dueDate: "2025-04-15",
    extensions: true,
  },
  WA: {
    state: "WA",
    hasIncomeTax: false,
    conformsToFederalAGI: false,
    standardDeduction: { single: 0, marriedFilingJointly: 0 },
    efileSupported: false,
    dueDate: "N/A",
    extensions: false,
    notes: "Capital Gains Excise Tax applies to long-term capital gains over $262,000.",
  },
  NJ: {
    state: "NJ",
    hasIncomeTax: true,
    conformsToFederalAGI: false,
    standardDeduction: { single: 0, marriedFilingJointly: 0 },
    personalExemption: { single: 1000, marriedFilingJointly: 2000, dependents: 1500 },
    efileSupported: true,
    dueDate: "2025-04-15",
    extensions: true,
    notes: "NJ does not recognize a standard deduction.",
  },
  MA: {
    state: "MA",
    hasIncomeTax: true,
    flatRate: 0.05,
    conformsToFederalAGI: false,
    standardDeduction: { single: 0, marriedFilingJointly: 0 },
    personalExemption: { single: 4400, marriedFilingJointly: 8800, dependents: 1000 },
    efileSupported: true,
    dueDate: "2025-04-15",
    extensions: true,
  },
  PA: {
    state: "PA",
    hasIncomeTax: true,
    flatRate: 0.0307,
    conformsToFederalAGI: false,
    standardDeduction: { single: 0, marriedFilingJointly: 0 },
    efileSupported: true,
    dueDate: "2025-04-15",
    extensions: true,
    notes: "PA uses a unique income classification system.",
  },
  OH: {
    state: "OH",
    hasIncomeTax: true,
    conformsToFederalAGI: true,
    standardDeduction: { single: 0, marriedFilingJointly: 0 },
    personalExemption: { single: 2400, marriedFilingJointly: 4800, dependents: 2400 },
    efileSupported: true,
    dueDate: "2025-04-15",
    extensions: true,
  },
  GA: {
    state: "GA",
    hasIncomeTax: true,
    flatRate: 0.055,
    conformsToFederalAGI: true,
    standardDeduction: { single: 5400, marriedFilingJointly: 7100 },
    personalExemption: { single: 7000, marriedFilingJointly: 14000, dependents: 3000 },
    efileSupported: true,
    dueDate: "2025-04-15",
    extensions: true,
  },
  NC: {
    state: "NC",
    hasIncomeTax: true,
    flatRate: 0.0475,
    conformsToFederalAGI: true,
    standardDeduction: { single: 12750, marriedFilingJointly: 25500 },
    efileSupported: true,
    dueDate: "2025-04-15",
    extensions: true,
  },
};

const STATE_TAX_BRACKETS: Record<string, Record<number, Record<string, StateTaxBracket[]>>> = {
  CA: {
    2024: {
      single: [
        { rate: 0.01, min: 0, max: 10099 },
        { rate: 0.02, min: 10099, max: 23942 },
        { rate: 0.04, min: 23942, max: 37788 },
        { rate: 0.06, min: 37788, max: 52455 },
        { rate: 0.08, min: 52455, max: 66295 },
        { rate: 0.093, min: 66295, max: 338639 },
        { rate: 0.103, min: 338639, max: 406364 },
        { rate: 0.113, min: 406364, max: 677275 },
        { rate: 0.123, min: 677275, max: Infinity },
      ],
    },
  },
  NY: {
    2024: {
      single: [
        { rate: 0.04, min: 0, max: 8500 },
        { rate: 0.045, min: 8500, max: 11700 },
        { rate: 0.0525, min: 11700, max: 13900 },
        { rate: 0.0585, min: 13900, max: 80650 },
        { rate: 0.0625, min: 80650, max: 215400 },
        { rate: 0.0685, min: 215400, max: 1077550 },
        { rate: 0.0965, min: 1077550, max: 5000000 },
        { rate: 0.103, min: 5000000, max: 25000000 },
        { rate: 0.109, min: 25000000, max: Infinity },
      ],
    },
  },
};

// ── Core Functions ────────────────────────────────────────────────────────────

export function getStateRules(state: string): StateRules | null {
  return STATE_RULES[state.toUpperCase()] ?? null;
}

export function checkFilingRequirement(
  state: string,
  income: number,
  residency: "resident" | "part_year" | "nonresident"
): boolean {
  const rules = getStateRules(state);
  if (!rules || !rules.hasIncomeTax) return false;

  // Simplified threshold: if any income earned in state, filing required
  if (residency === "nonresident") {
    return income > 0;
  }
  return income > 0;
}

export function getStateDeductions(
  state: string,
  _federalAGI: number,
  filingStatus: string
): number {
  const rules = getStateRules(state);
  if (!rules) return 0;

  if (filingStatus === "married_filing_jointly") {
    return rules.standardDeduction.marriedFilingJointly;
  }
  if (filingStatus === "head_of_household") {
    return rules.standardDeduction.headOfHousehold ?? rules.standardDeduction.single;
  }
  return rules.standardDeduction.single;
}

export function getStateCredits(
  state: string,
  filingData: Record<string, unknown>
): StateCredits {
  // State-specific credit calculations — extendable per state
  const credits: StateCredits = {};

  if (state === "CA") {
    const agi = Number(filingData.agi ?? 0);
    // CA renters credit: $60 single / $120 MFJ for AGI under threshold
    if (filingData.isRenter && agi < 50746) {
      credits.rentersCredit =
        filingData.filingStatus === "married_filing_jointly" ? 120 : 60;
    }
    // CA Young Child Tax Credit: $1,117 per child under 6
    const youngChildren = Number(filingData.youngChildrenCount ?? 0);
    if (youngChildren > 0) {
      credits.childCareCredit = youngChildren * 1117;
    }
  }

  return credits;
}

export function getStateTaxBrackets(
  state: string,
  taxYear: number
): StateTaxBracket[] | null {
  return (
    STATE_TAX_BRACKETS[state.toUpperCase()]?.[taxYear]?.["single"] ?? null
  );
}

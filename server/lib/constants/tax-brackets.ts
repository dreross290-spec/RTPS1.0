// ── 2024 Federal Tax Brackets ─────────────────────────────────────────────────

export interface TaxBracket {
  rate: number;
  min: number;
  max: number;
}

export type BracketMap = Record<string, TaxBracket[]>;

export const TAX_BRACKETS: Record<number, BracketMap> = {
  2024: {
    single: [
      { rate: 0.10, min: 0, max: 11600 },
      { rate: 0.12, min: 11600, max: 47150 },
      { rate: 0.22, min: 47150, max: 100525 },
      { rate: 0.24, min: 100525, max: 191950 },
      { rate: 0.32, min: 191950, max: 243725 },
      { rate: 0.35, min: 243725, max: 609350 },
      { rate: 0.37, min: 609350, max: Infinity },
    ],
    married_filing_jointly: [
      { rate: 0.10, min: 0, max: 23200 },
      { rate: 0.12, min: 23200, max: 94300 },
      { rate: 0.22, min: 94300, max: 201050 },
      { rate: 0.24, min: 201050, max: 383900 },
      { rate: 0.32, min: 383900, max: 487450 },
      { rate: 0.35, min: 487450, max: 731200 },
      { rate: 0.37, min: 731200, max: Infinity },
    ],
    married_filing_separately: [
      { rate: 0.10, min: 0, max: 11600 },
      { rate: 0.12, min: 11600, max: 47150 },
      { rate: 0.22, min: 47150, max: 100525 },
      { rate: 0.24, min: 100525, max: 191950 },
      { rate: 0.32, min: 191950, max: 243725 },
      { rate: 0.35, min: 243725, max: 365600 },
      { rate: 0.37, min: 365600, max: Infinity },
    ],
    head_of_household: [
      { rate: 0.10, min: 0, max: 16550 },
      { rate: 0.12, min: 16550, max: 63100 },
      { rate: 0.22, min: 63100, max: 100500 },
      { rate: 0.24, min: 100500, max: 191950 },
      { rate: 0.32, min: 191950, max: 243700 },
      { rate: 0.35, min: 243700, max: 609350 },
      { rate: 0.37, min: 609350, max: Infinity },
    ],
    qualifying_widow: [
      { rate: 0.10, min: 0, max: 23200 },
      { rate: 0.12, min: 23200, max: 94300 },
      { rate: 0.22, min: 94300, max: 201050 },
      { rate: 0.24, min: 201050, max: 383900 },
      { rate: 0.32, min: 383900, max: 487450 },
      { rate: 0.35, min: 487450, max: 731200 },
      { rate: 0.37, min: 731200, max: Infinity },
    ],
  },
  2025: {
    single: [
      { rate: 0.10, min: 0, max: 11925 },
      { rate: 0.12, min: 11925, max: 48475 },
      { rate: 0.22, min: 48475, max: 103350 },
      { rate: 0.24, min: 103350, max: 197300 },
      { rate: 0.32, min: 197300, max: 250525 },
      { rate: 0.35, min: 250525, max: 626350 },
      { rate: 0.37, min: 626350, max: Infinity },
    ],
    married_filing_jointly: [
      { rate: 0.10, min: 0, max: 23850 },
      { rate: 0.12, min: 23850, max: 96950 },
      { rate: 0.22, min: 96950, max: 206700 },
      { rate: 0.24, min: 206700, max: 394600 },
      { rate: 0.32, min: 394600, max: 501050 },
      { rate: 0.35, min: 501050, max: 751600 },
      { rate: 0.37, min: 751600, max: Infinity },
    ],
    married_filing_separately: [
      { rate: 0.10, min: 0, max: 11925 },
      { rate: 0.12, min: 11925, max: 48475 },
      { rate: 0.22, min: 48475, max: 103350 },
      { rate: 0.24, min: 103350, max: 197300 },
      { rate: 0.32, min: 197300, max: 250525 },
      { rate: 0.35, min: 250525, max: 375800 },
      { rate: 0.37, min: 375800, max: Infinity },
    ],
    head_of_household: [
      { rate: 0.10, min: 0, max: 17000 },
      { rate: 0.12, min: 17000, max: 64850 },
      { rate: 0.22, min: 64850, max: 103350 },
      { rate: 0.24, min: 103350, max: 197300 },
      { rate: 0.32, min: 197300, max: 250500 },
      { rate: 0.35, min: 250500, max: 626350 },
      { rate: 0.37, min: 626350, max: Infinity },
    ],
    qualifying_widow: [
      { rate: 0.10, min: 0, max: 23850 },
      { rate: 0.12, min: 23850, max: 96950 },
      { rate: 0.22, min: 96950, max: 206700 },
      { rate: 0.24, min: 206700, max: 394600 },
      { rate: 0.32, min: 394600, max: 501050 },
      { rate: 0.35, min: 501050, max: 751600 },
      { rate: 0.37, min: 751600, max: Infinity },
    ],
  },
};

// ── Standard Deductions ───────────────────────────────────────────────────────

export const STANDARD_DEDUCTIONS: Record<number, Record<string, number>> = {
  2024: {
    single: 14600,
    married_filing_jointly: 29200,
    married_filing_separately: 14600,
    head_of_household: 21900,
    qualifying_widow: 29200,
    // Additional for age 65+ or blind: $1,550 single / $1,250 MFJ (each)
    additional_65_or_blind_single: 1550,
    additional_65_or_blind_joint: 1250,
  },
  2025: {
    single: 15000,
    married_filing_jointly: 30000,
    married_filing_separately: 15000,
    head_of_household: 22500,
    qualifying_widow: 30000,
    additional_65_or_blind_single: 1600,
    additional_65_or_blind_joint: 1300,
  },
};

// ── AMT Exemptions ────────────────────────────────────────────────────────────

export const AMT_EXEMPTIONS: Record<
  number,
  Record<string, { exemption: number; phaseout: number }>
> = {
  2024: {
    single: { exemption: 85700, phaseout: 609350 },
    marriedFilingJointly: { exemption: 133300, phaseout: 1218700 },
    marriedFilingSeparately: { exemption: 66650, phaseout: 609350 },
  },
  2025: {
    single: { exemption: 88100, phaseout: 626350 },
    marriedFilingJointly: { exemption: 137000, phaseout: 1252700 },
    marriedFilingSeparately: { exemption: 68500, phaseout: 626350 },
  },
};

// ── Capital Gains Rates ───────────────────────────────────────────────────────

export const CAPITAL_GAINS_BRACKETS: Record<
  number,
  Record<string, Array<{ rate: number; max: number }>>
> = {
  2024: {
    single: [
      { rate: 0.0, max: 47025 },
      { rate: 0.15, max: 518900 },
      { rate: 0.20, max: Infinity },
    ],
    married_filing_jointly: [
      { rate: 0.0, max: 94050 },
      { rate: 0.15, max: 583750 },
      { rate: 0.20, max: Infinity },
    ],
  },
  2025: {
    single: [
      { rate: 0.0, max: 48350 },
      { rate: 0.15, max: 533400 },
      { rate: 0.20, max: Infinity },
    ],
    married_filing_jointly: [
      { rate: 0.0, max: 96700 },
      { rate: 0.15, max: 600050 },
      { rate: 0.20, max: Infinity },
    ],
  },
};

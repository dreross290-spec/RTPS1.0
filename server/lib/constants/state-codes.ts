// ── US State Codes ────────────────────────────────────────────────────────────

export interface StateInfo {
  code: string;
  name: string;
  hasIncomeTax: boolean;
  filingRequired: boolean;
  standardFilingDeadline: string; // e.g. "April 15"
}

export const US_STATES: StateInfo[] = [
  { code: "AL", name: "Alabama", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "AK", name: "Alaska", hasIncomeTax: false, filingRequired: false, standardFilingDeadline: "N/A" },
  { code: "AZ", name: "Arizona", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "AR", name: "Arkansas", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "CA", name: "California", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "CO", name: "Colorado", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "CT", name: "Connecticut", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "DE", name: "Delaware", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 30" },
  { code: "DC", name: "District of Columbia", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "FL", name: "Florida", hasIncomeTax: false, filingRequired: false, standardFilingDeadline: "N/A" },
  { code: "GA", name: "Georgia", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "HI", name: "Hawaii", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 20" },
  { code: "ID", name: "Idaho", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "IL", name: "Illinois", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "IN", name: "Indiana", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "IA", name: "Iowa", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 30" },
  { code: "KS", name: "Kansas", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "KY", name: "Kentucky", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "LA", name: "Louisiana", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "May 15" },
  { code: "ME", name: "Maine", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "MD", name: "Maryland", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "MA", name: "Massachusetts", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "MI", name: "Michigan", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "MN", name: "Minnesota", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "MS", name: "Mississippi", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "MO", name: "Missouri", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "MT", name: "Montana", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "NE", name: "Nebraska", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "NV", name: "Nevada", hasIncomeTax: false, filingRequired: false, standardFilingDeadline: "N/A" },
  { code: "NH", name: "New Hampshire", hasIncomeTax: false, filingRequired: false, standardFilingDeadline: "N/A" },
  { code: "NJ", name: "New Jersey", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "NM", name: "New Mexico", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "NY", name: "New York", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "NC", name: "North Carolina", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "ND", name: "North Dakota", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "OH", name: "Ohio", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "OK", name: "Oklahoma", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "OR", name: "Oregon", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "PA", name: "Pennsylvania", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "RI", name: "Rhode Island", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "SC", name: "South Carolina", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "SD", name: "South Dakota", hasIncomeTax: false, filingRequired: false, standardFilingDeadline: "N/A" },
  { code: "TN", name: "Tennessee", hasIncomeTax: false, filingRequired: false, standardFilingDeadline: "N/A" },
  { code: "TX", name: "Texas", hasIncomeTax: false, filingRequired: false, standardFilingDeadline: "N/A" },
  { code: "UT", name: "Utah", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "VT", name: "Vermont", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "VA", name: "Virginia", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "May 1" },
  { code: "WA", name: "Washington", hasIncomeTax: false, filingRequired: false, standardFilingDeadline: "N/A" },
  { code: "WV", name: "West Virginia", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "WI", name: "Wisconsin", hasIncomeTax: true, filingRequired: true, standardFilingDeadline: "April 15" },
  { code: "WY", name: "Wyoming", hasIncomeTax: false, filingRequired: false, standardFilingDeadline: "N/A" },
];

export const STATE_MAP = Object.fromEntries(
  US_STATES.map((s) => [s.code, s])
) as Record<string, StateInfo>;

export const INCOME_TAX_STATES = US_STATES.filter((s) => s.hasIncomeTax).map(
  (s) => s.code
);

export const NO_INCOME_TAX_STATES = US_STATES.filter((s) => !s.hasIncomeTax).map(
  (s) => s.code
);

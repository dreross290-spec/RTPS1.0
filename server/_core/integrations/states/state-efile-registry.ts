// ── State e-file Registry ─────────────────────────────────────────────────────

export interface StateEfileInfo {
  state: string;
  stateName: string;
  supported: boolean;
  endpoint: string | null;
  federalStatelinked: boolean; // true if state return is submitted with federal
  separateLoginRequired: boolean;
  credentials: string[]; // required credential types
  supportedForms: string[];
  testEnvironment?: string;
}

const STATE_EFILE_REGISTRY: Record<string, StateEfileInfo> = {
  AL: {
    state: "AL", stateName: "Alabama", supported: true,
    endpoint: "https://myalabamataxes.alabama.gov/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin", "etin"], supportedForms: ["40", "40NR"],
  },
  AK: {
    state: "AK", stateName: "Alaska", supported: false,
    endpoint: null, federalStatelinked: false, separateLoginRequired: false,
    credentials: [], supportedForms: [],
    testEnvironment: undefined,
  },
  AZ: {
    state: "AZ", stateName: "Arizona", supported: true,
    endpoint: "https://aztaxes.gov/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin"], supportedForms: ["140", "140NR", "140PY"],
  },
  CA: {
    state: "CA", stateName: "California", supported: true,
    endpoint: "https://webapp.ftb.ca.gov/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin", "ctec"],
    supportedForms: ["540", "540NR", "540-2EZ"],
    testEnvironment: "https://webapp.ftb.ca.gov/efile/test/",
  },
  CO: {
    state: "CO", stateName: "Colorado", supported: true,
    endpoint: "https://tax.colorado.gov/efile/",
    federalStatelinked: true, separateLoginRequired: false,
    credentials: ["efin"], supportedForms: ["104", "104NR"],
  },
  FL: {
    state: "FL", stateName: "Florida", supported: false,
    endpoint: null, federalStatelinked: false, separateLoginRequired: false,
    credentials: [], supportedForms: [],
  },
  GA: {
    state: "GA", stateName: "Georgia", supported: true,
    endpoint: "https://gtc.dor.ga.gov/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin"], supportedForms: ["500", "500NOL"],
  },
  IL: {
    state: "IL", stateName: "Illinois", supported: true,
    endpoint: "https://tax.illinois.gov/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin"], supportedForms: ["IL-1040", "IL-1040-NR"],
  },
  MA: {
    state: "MA", stateName: "Massachusetts", supported: true,
    endpoint: "https://www.mass.gov/mafile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin", "macode"], supportedForms: ["1", "1NR/PY"],
  },
  MI: {
    state: "MI", stateName: "Michigan", supported: true,
    endpoint: "https://www.michigan.gov/taxes/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin"], supportedForms: ["MI-1040"],
  },
  MN: {
    state: "MN", stateName: "Minnesota", supported: true,
    endpoint: "https://www.revenue.state.mn.us/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin"], supportedForms: ["M1", "M1NR"],
  },
  NJ: {
    state: "NJ", stateName: "New Jersey", supported: true,
    endpoint: "https://www.state.nj.us/treasury/taxation/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin"], supportedForms: ["NJ-1040", "NJ-1040NR"],
  },
  NY: {
    state: "NY", stateName: "New York", supported: true,
    endpoint: "https://www.tax.ny.gov/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin", "nysefin"],
    supportedForms: ["IT-201", "IT-203"],
    testEnvironment: "https://test.tax.ny.gov/efile/",
  },
  NC: {
    state: "NC", stateName: "North Carolina", supported: true,
    endpoint: "https://www.ncdor.gov/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin"], supportedForms: ["D-400"],
  },
  OH: {
    state: "OH", stateName: "Ohio", supported: true,
    endpoint: "https://tax.ohio.gov/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin"], supportedForms: ["IT 1040", "IT 1040NR"],
  },
  PA: {
    state: "PA", stateName: "Pennsylvania", supported: true,
    endpoint: "https://www.revenue.pa.gov/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin"], supportedForms: ["PA-40"],
  },
  TX: {
    state: "TX", stateName: "Texas", supported: false,
    endpoint: null, federalStatelinked: false, separateLoginRequired: false,
    credentials: [], supportedForms: [],
  },
  VA: {
    state: "VA", stateName: "Virginia", supported: true,
    endpoint: "https://www.tax.virginia.gov/efile/",
    federalStatelinked: false, separateLoginRequired: true,
    credentials: ["efin"], supportedForms: ["760", "760PY", "763"],
  },
  WA: {
    state: "WA", stateName: "Washington", supported: false,
    endpoint: null, federalStatelinked: false, separateLoginRequired: false,
    credentials: [], supportedForms: [],
    testEnvironment: undefined,
  },
};

// ── Core Functions ────────────────────────────────────────────────────────────

export function getStateEfileInfo(state: string): StateEfileInfo | null {
  return STATE_EFILE_REGISTRY[state.toUpperCase()] ?? null;
}

export function isStateEfileAvailable(state: string): boolean {
  const info = getStateEfileInfo(state);
  return info?.supported ?? false;
}

export function getSupportedStates(): string[] {
  return Object.values(STATE_EFILE_REGISTRY)
    .filter((s) => s.supported)
    .map((s) => s.state);
}

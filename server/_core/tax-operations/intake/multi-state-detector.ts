// ── State filing threshold constants (2024) ───────────────────────────────────

interface StateRequirements {
  state: string;
  hasIncomeTax: boolean;
  filingThresholds: {
    single: number;
    marriedFilingJointly: number;
    marriedFilingSeparately: number;
    headOfHousehold: number;
  };
  nonresidentThreshold: number | null;
  conformsToFederal: boolean;
  notes: string;
}

const STATE_REQUIREMENTS: Record<string, StateRequirements> = {
  CA: {
    state: "CA",
    hasIncomeTax: true,
    filingThresholds: {
      single: 18241,
      marriedFilingJointly: 36484,
      marriedFilingSeparately: 18241,
      headOfHousehold: 24400,
    },
    nonresidentThreshold: 1,
    conformsToFederal: false,
    notes: "California does not conform to many federal tax law changes.",
  },
  NY: {
    state: "NY",
    hasIncomeTax: true,
    filingThresholds: {
      single: 4000,
      marriedFilingJointly: 8000,
      marriedFilingSeparately: 4000,
      headOfHousehold: 5600,
    },
    nonresidentThreshold: 0,
    conformsToFederal: false,
    notes: "New York City imposes an additional local tax.",
  },
  TX: {
    state: "TX",
    hasIncomeTax: false,
    filingThresholds: {
      single: Infinity,
      marriedFilingJointly: Infinity,
      marriedFilingSeparately: Infinity,
      headOfHousehold: Infinity,
    },
    nonresidentThreshold: null,
    conformsToFederal: false,
    notes: "Texas has no state income tax.",
  },
  FL: {
    state: "FL",
    hasIncomeTax: false,
    filingThresholds: {
      single: Infinity,
      marriedFilingJointly: Infinity,
      marriedFilingSeparately: Infinity,
      headOfHousehold: Infinity,
    },
    nonresidentThreshold: null,
    conformsToFederal: false,
    notes: "Florida has no state income tax.",
  },
  IL: {
    state: "IL",
    hasIncomeTax: true,
    filingThresholds: {
      single: 2175,
      marriedFilingJointly: 4350,
      marriedFilingSeparately: 2175,
      headOfHousehold: 2175,
    },
    nonresidentThreshold: 1000,
    conformsToFederal: false,
    notes: "Illinois has a flat income tax rate of 4.95%.",
  },
  WA: {
    state: "WA",
    hasIncomeTax: false,
    filingThresholds: {
      single: Infinity,
      marriedFilingJointly: Infinity,
      marriedFilingSeparately: Infinity,
      headOfHousehold: Infinity,
    },
    nonresidentThreshold: null,
    conformsToFederal: false,
    notes: "Washington has no state income tax (capital gains tax applies).",
  },
  NJ: {
    state: "NJ",
    hasIncomeTax: true,
    filingThresholds: {
      single: 10000,
      marriedFilingJointly: 20000,
      marriedFilingSeparately: 10000,
      headOfHousehold: 10000,
    },
    nonresidentThreshold: 1000,
    conformsToFederal: false,
    notes: "New Jersey does not allow standard deduction; itemized only.",
  },
  MA: {
    state: "MA",
    hasIncomeTax: true,
    filingThresholds: {
      single: 8000,
      marriedFilingJointly: 16400,
      marriedFilingSeparately: 8000,
      headOfHousehold: 14600,
    },
    nonresidentThreshold: 8000,
    conformsToFederal: false,
    notes: "Massachusetts has a flat 5% income tax rate.",
  },
};

export interface IntakeDataForDetection {
  personalInfo: Record<string, unknown>;
  documents: Array<{ type: string; data: Record<string, unknown> }>;
  interviewAnswers: Array<{ section: string; questionKey: string; answer: unknown }>;
}

/**
 * Return a list of states that require a filing based on the intake data.
 */
export function detectStates(intakeData: IntakeDataForDetection): string[] {
  const stateSet = new Set<string>();
  const primaryState = String(intakeData.personalInfo.state ?? "").toUpperCase();

  if (primaryState) stateSet.add(primaryState);

  // W-2 state wages
  intakeData.documents.forEach((doc) => {
    if (doc.type === "w2") {
      const stateWages = (doc.data.stateWages as Record<string, number>) ?? {};
      Object.keys(stateWages).forEach((s) => stateSet.add(s.toUpperCase()));
    }
  });

  // Answer-based states
  const answerMap = Object.fromEntries(
    intakeData.interviewAnswers.map((a) => [`${a.section}.${a.questionKey}`, a.answer])
  );

  ["work.stateOfEmployment", "residency.movedFromState", "rental.propertyState"].forEach(
    (key) => {
      if (answerMap[key]) stateSet.add(String(answerMap[key]).toUpperCase());
    }
  );

  // Remove states without income tax if they have no nexus issues
  return Array.from(stateSet).filter((s) => {
    const req = STATE_REQUIREMENTS[s];
    return !req || req.hasIncomeTax;
  });
}

/**
 * Apportion income across states using the ratio of days / wages earned in each state.
 */
export function calculateApportionment(
  totalIncome: number,
  states: Array<{ state: string; daysWorked?: number; incomeEarned?: number }>
): Record<string, number> {
  const totalDays = states.reduce((sum, s) => sum + (s.daysWorked ?? 0), 0);
  const totalEarned = states.reduce((sum, s) => sum + (s.incomeEarned ?? 0), 0);

  const result: Record<string, number> = {};

  states.forEach((s) => {
    if (totalEarned > 0 && s.incomeEarned !== undefined) {
      // Income-based apportionment
      result[s.state] = (s.incomeEarned / totalEarned) * totalIncome;
    } else if (totalDays > 0 && s.daysWorked !== undefined) {
      // Day-count apportionment fallback
      result[s.state] = (s.daysWorked / totalDays) * totalIncome;
    } else {
      result[s.state] = totalIncome / states.length;
    }
  });

  return result;
}

/**
 * Return filing requirements for a specific state.
 */
export function getStateRequirements(state: string): StateRequirements {
  return (
    STATE_REQUIREMENTS[state.toUpperCase()] ?? {
      state: state.toUpperCase(),
      hasIncomeTax: true,
      filingThresholds: {
        single: 0,
        marriedFilingJointly: 0,
        marriedFilingSeparately: 0,
        headOfHousehold: 0,
      },
      nonresidentThreshold: 0,
      conformsToFederal: true,
      notes: "Filing requirements not configured for this state.",
    }
  );
}

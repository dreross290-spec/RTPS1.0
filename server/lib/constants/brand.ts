/**
 * Ross Tax Pro Software — Brand Constants
 *
 * Single source of truth for brand identity used across:
 *   - Admin UI sidebar / headers
 *   - PDF report headers and footers
 *   - Email / SMS "from" defaults
 *   - API client user-agent strings
 *
 * Colors:
 *   Navy  #0B1F44  (primary background)
 *   Gold  #C9A84C  (accent / highlights)
 */

// ─── Firm Identity ────────────────────────────────────────────────────────────

export const BRAND = {
  /** Official firm/software name. */
  firmName: "Ross Tax Pro Software",

  /** CEO & Founder displayed in reports and emails. */
  founderName: "Andreaa Chan\u2019nel, MPA, BA",

  /** Professional credential line. */
  founderTitle: "CEO & Founder | IRS Authorized ERO",

  /** Service area tagline. */
  tagline: "Tax Practitioner | Serving All 50 States",

  /** Short two-letter abbreviation used in logos and identifiers. */
  abbreviation: "RT",

  /** Contact / support email (override via env). */
  supportEmail:
    process.env["BRAND_SUPPORT_EMAIL"] ?? "support@rosstaxpro.com",

  /** Public website URL. */
  website:
    process.env["BRAND_WEBSITE"] ?? "https://www.rosstaxpro.com",

  /** Physical mailing address for CAN-SPAM compliance. */
  physicalAddress:
    process.env["FIRM_ADDRESS_LINE1"] ?? "Ross Tax Pro Software",

  /** City / State / ZIP for CAN-SPAM footer. */
  cityStateZip:
    process.env["FIRM_CITY_STATE_ZIP"] ?? "",

  /** Phone number for PDF footer. */
  phone:
    process.env["FIRM_PHONE"] ?? "",
} as const;

// ─── Color Palette ────────────────────────────────────────────────────────────

export const BRAND_COLORS = {
  /** Primary dark navy — used as sidebar/header backgrounds. */
  navy: "#0B1F44",

  /** Deep navy variant — active nav items, hover states. */
  navyDark: "#071530",

  /** Mid-navy — card borders, dividers. */
  navyMid: "#162E5C",

  /** Gold accent — logo, headings, highlights, borders. */
  gold: "#C9A84C",

  /** Light gold — hover tints, watermarks. */
  goldLight: "#E8D08A",

  /** Muted gold text — secondary labels on dark backgrounds. */
  goldMuted: "#A88930",

  /** Off-white body text on dark backgrounds. */
  textLight: "#F0F4FF",

  /** Muted text on dark backgrounds. */
  textMuted: "#94A3B8",

  /** White. */
  white: "#FFFFFF",

  /** Light grey — main content background. */
  bgGrey: "#F8FAFC",

  /** Border grey — card / section dividers on light backgrounds. */
  borderGrey: "#E2E8F0",

  /** Status colours. */
  statusGreen: "#16A34A",
  statusOrange: "#D97706",
  statusRed: "#DC2626",
  statusBlue: "#2563EB",
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const BRAND_FONTS = {
  /** System font stack (no external dependency). */
  system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  monospace: "'Menlo', 'Courier New', monospace",
} as const;

// ─── API / HTTP ───────────────────────────────────────────────────────────────

/** User-agent string sent to upstream APIs. */
export const RTPS_USER_AGENT = "RossTaxPro/1.0";

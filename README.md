# RTPS — State & Federal Tax Return Intake, Preparation, and Transmittal Platform

A comprehensive, production-ready platform for tax preparation firms to intake, prepare, transmit, and track federal and state tax returns — built with Next.js, TypeScript, tRPC, Drizzle ORM, and PostgreSQL.

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [Background Workers](#background-workers)
8. [Refund Notification System](#refund-notification-system)
9. [Security](#security)
10. [Tax Calculation Engine](#tax-calculation-engine)
11. [Multi-State Filing](#multi-state-filing)
12. [IRS Integration](#irs-integration)
13. [Compliance](#compliance)
14. [TCPA Compliance](#tcpa-compliance)
15. [CI/CD](#cicd)

---

## Features

### Core Platform
- **Multi-tenant architecture** — full tenant isolation with account-scoped queries
- **Role-Based Access Control (RBAC)** — `super_admin`, `firm_admin`, `preparer`, `reviewer`
- **MFA authentication** — TOTP-based MFA with IP allowlisting
- **Comprehensive audit logging** — every action is logged with before/after state

### Tax Operations
- **Intake system** — interview-based intake with document upload and parsing
- **Form parsing** — W-2, 1099 variants, K-1 automatic parsing and normalization
- **Tax calculation engine** — 2024/2025 federal brackets, AMT, SE tax, all major credits
- **AGI calculation** — above-the-line deductions, Social Security inclusion
- **State tax engine** — rules for all 50 states + DC, multi-state apportionment
- **Validation engine** — 50+ validation rules including due diligence checks

### Transmittal & Tracking
- **IRS e-file (MeF)** — Modernized e-File XML payload builder, FIRE API integration
- **State e-file** — registry of 20+ state e-file endpoints
- **ACK processing** — automatic parsing of IRS acknowledgment files
- **Refund status tracking** — real-time IRS transcript polling with change detection

### Notifications (Critical Feature)
- **SMS via Twilio** — TCPA-compliant SMS notifications with opt-out tracking
- **Email via SendGrid** — HTML email templates with unsubscribe handling
- **Customizable templates** — per-account template overrides
- **Event types**: `return_accepted`, `refund_approved`, `payment_issued`, `direct_deposit_sent`, `check_mailed`, `refund_delayed`, `additional_info_required`

### Compliance
- **EITC due diligence** — IRC §6695(g) compliance checks
- **Form 8867 validation** — Paid Preparer's Due Diligence
- **Charitable contribution checks** — Form 8283 triggers
- **Home office due diligence** — Form 8829 validation
- **Preparer certification monitoring** — PTIN and CE hour tracking

---

## Architecture

```
RTPS Platform
├── Next.js (Pages Router)          — UI layer
├── tRPC                            — Type-safe API layer
├── Drizzle ORM + PostgreSQL        — Database
├── Background Workers              — Scheduled jobs (refund polling, transmittal)
└── External Integrations
    ├── IRS FIRE API                — e-file submission
    ├── IRS Transcript Service      — refund status polling
    ├── Twilio                      — SMS notifications
    └── SendGrid                    — Email notifications
```

### Multi-Tenant Model
Every database record includes an `account_id` foreign key. All queries are required to include this filter, enforced by the `tenant-manager.ts` module.

---

## Project Structure

```
├── drizzle/
│   ├── schema/                     # Database schemas (Drizzle ORM)
│   └── migrations/                 # Generated migrations
├── server/
│   ├── _core/
│   │   ├── account-hub/            # Admin auth, permissions, tenant isolation
│   │   ├── tax-operations/
│   │   │   ├── intake/             # Form parsing, data normalization
│   │   │   ├── preparation/        # Tax calculation, validation, AGI
│   │   │   ├── transmittal/        # IRS/state e-file, status tracking
│   │   │   └── compliance/         # Audit trail, due diligence, exceptions
│   │   └── integrations/
│   │       ├── irs/                # FIRE API, transcript service, ACK processor
│   │       └── states/             # State rules engine, e-file registry
│   ├── lib/
│   │   ├── schemas/                # Zod validation schemas
│   │   ├── constants/              # Tax brackets, state codes, filing requirements
│   │   ├── utils/                  # Encryption, SSN validation, tax utilities
│   │   └── tax-rules/              # Federal rules, credit calculations
│   ├── routers/                    # tRPC routers
│   └── workers/                    # Background job workers
├── client/
│   ├── components/                 # React UI components
│   ├── pages/                      # Next.js pages (client-side)
│   └── hooks/                      # React hooks
└── pages/
    └── api/                        # Next.js API routes (tRPC handler, webhooks)
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Twilio account (for SMS)
- SendGrid account (for email)

### Installation

```bash
git clone https://github.com/your-org/rtps
cd rtps
npm install
cp .env.example .env
# Edit .env with your credentials
```

### Database Setup

```bash
# Generate Drizzle migrations
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations
npm run db:migrate
```

### Development

```bash
# Start Next.js dev server
npm run dev

# Start background workers (separate terminal)
npm run workers
```

---

## Environment Variables

See [`.env.example`](.env.example) for all required environment variables.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth.js secret key |
| `ENCRYPTION_KEY` | 32-char AES-256 encryption key for SSN/PII |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `SENDGRID_API_KEY` | SendGrid API key |
| `IRS_FIRE_ENDPOINT` | IRS FIRE API endpoint |
| `REFUND_POLL_INTERVAL_MINUTES` | How often to poll IRS for refund status (default: 60) |

---

## Background Workers

Workers run as long-lived Node.js processes. Start all workers with:

```bash
npm run workers
```

| Worker | Interval | Description |
|---|---|---|
| `RefundNotification` | Every 60 min | Polls IRS transcripts and sends notifications |
| `TaxCalculation` | Every 2 min | Processes calculation queue |
| `TransmittalQueue` | Every 5 min | Submits approved returns to IRS |
| `TransmittalRetry` | Every 30 min | Retries failed transmittals |
| `ACKMonitor` | Every 15 min | Downloads and processes IRS ACK files |
| `ComplianceChecker` | Daily | Checks preparer certifications and compliance |

---

## Refund Notification System

The refund notification worker (`server/workers/refund-notification.ts`) is the most critical component:

1. **Polls IRS CADE-2/transcript service** for all accepted returns
2. **Detects status changes** and records them in `refund_status_history`
3. **Checks client preferences** (SMS/email/both/none)
4. **Verifies TCPA opt-out** before every SMS send
5. **Sends via Twilio** (SMS) or **SendGrid** (email)
6. **Logs all notifications** in `notification_log` for audit
7. **Customizable templates** — firms can override default message templates

### Event Flow

```
IRS Transcript → detectStatusChange → processStatusChange
    → getNotificationTemplate → renderTemplate
    → isClientOptedOut (TCPA check)
    → sendSMSNotification / sendEmailNotification
    → logNotification
```

---

## Security

### Data Encryption
- All SSNs and sensitive identifiers are encrypted at rest using **AES-256-GCM**
- Encrypted values: SSN, EIN, bank account numbers
- HMAC-SHA256 for indexed lookup without decryption

### Authentication
- **MFA required** for all admin users (TOTP/authenticator app)
- **IP allowlisting** per account with CIDR support
- **Session management** with configurable timeout and sliding expiration

### Multi-Tenancy
- Every query is automatically scoped to `account_id`
- `tenant-manager.ts` enforces tenant isolation
- Cross-tenant data access is impossible by design

---

## Tax Calculation Engine

The calculation engine supports **2024 and 2025** tax years:

- **Federal income tax** — all filing statuses with correct brackets
- **Alternative Minimum Tax (AMT)** — with phase-out calculations
- **Self-employment tax** — SECA with deductible portion
- **State taxes** — brackets for CA, NY, IL, NJ, MA, PA, OH, GA, NC + flat-rate states
- **Credits**: EITC, Child Tax Credit, AOC, LLC, Child Care, Retirement Savers

---

## Multi-State Filing

The multi-state detector (`server/_core/tax-operations/intake/multi-state-detector.ts`) handles:

- Automatic state detection from W-2, interview answers, address data
- Income apportionment (income-based or day-count methods)
- Residency classification (resident / part-year / nonresident)
- Per-state filing requirement checks

---

## IRS Integration

### e-File (MeF)
- MeF XML payload builder (`buildMEFPayload`)
- FIRE API integration with mutual-TLS support (`fire-api.ts`)
- ACK file parsing (fixed-width and XML formats)
- Automatic rejection handling with error code routing

### Transcript Service
- CADE-2 status polling
- Refund stage detection (6 stages from received to check mailed)
- Change detection with database persistence

---

## Compliance

- **EITC due diligence** — all 4 EITC eligibility tests
- **Form 8867** — Paid Preparer's Checklist validation
- **Charitable contributions** — Form 8283 trigger and appraisal requirements
- **Home office** — Form 8829 area calculation and exclusive use verification
- **Exception queue** — flag, track, and resolve compliance issues
- **Preparer PTIN verification** — all active preparers must have valid PTINs
- **CE hours tracking** — 30-day expiration warnings

---

## TCPA Compliance

TCPA (Telephone Consumer Protection Act) compliance is built in:

1. **Opt-out is checked immediately before every SMS send**
2. **Twilio webhook** handles STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT replies
3. **Database is updated synchronously** when opt-out is received
4. **All opt-outs are permanent** until explicitly reversed by the client

---

## CI/CD

### Tax Rules Validation (`.github/workflows/tax-rules-validation.yml`)
- Runs on changes to tax brackets, rules, or calculation engine
- TypeScript type check
- Bracket integrity validation (no gaps, correct order)
- ESLint with zero warnings

### Compliance Audit (`.github/workflows/compliance-audit.yml`)
- Runs daily at 2 AM UTC
- EITC calculation integrity tests
- Dependency security audit (`npm audit`)
- Compliance module lint check

---

## License

See [LICENSE](./LICENSE) for details.
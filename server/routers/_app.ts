import { createTRPCRouter } from "./trpc";
import { adminAccountRouter } from "./admin.account";
import { adminPreparersRouter } from "./admin.preparers";
import { adminClientsRouter } from "./admin.clients";
import { adminPermissionsRouter } from "./admin.permissions";
import { adminAuditRouter } from "./admin.audit";
import { intakeFormsRouter } from "./intake.forms";
import { intakeDocumentsRouter } from "./intake.documents";
import { preparationReturnsRouter } from "./preparation.returns";
import { transmittalIRSRouter } from "./transmittal.irs";
import { transmittalStatesRouter } from "./transmittal.states";
import { transmittalTrackingRouter } from "./transmittal.tracking";
import { complianceAuditRouter } from "./compliance.audit";
import { notificationsRouter } from "./notifications";

export const appRouter = createTRPCRouter({
  admin: createTRPCRouter({
    account: adminAccountRouter,
    preparers: adminPreparersRouter,
    clients: adminClientsRouter,
    permissions: adminPermissionsRouter,
    audit: adminAuditRouter,
  }),
  intake: createTRPCRouter({
    forms: intakeFormsRouter,
    documents: intakeDocumentsRouter,
  }),
  preparation: createTRPCRouter({
    returns: preparationReturnsRouter,
  }),
  transmittal: createTRPCRouter({
    irs: transmittalIRSRouter,
    states: transmittalStatesRouter,
    tracking: transmittalTrackingRouter,
  }),
  compliance: createTRPCRouter({
    audit: complianceAuditRouter,
  }),
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;

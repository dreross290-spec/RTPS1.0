"use client";

// Type-safe tRPC hook placeholder.
// In a real setup wire this to the generated tRPC client from @server/routers/_app.
// import { trpc } from '@/utils/trpc';

export interface AccountSettings {
  accountId: string;
  firmName: string;
  firmType: string;
  eroNumber: string | null;
  stateRegistrations: string[];
  adminContactEmail: string;
}

export interface Preparer {
  preparerId: string;
  accountId: string;
  firstName: string;
  lastName: string;
  ptin: string;
  active: boolean;
  ceHours: number;
  certExpiryDate?: Date | null;
}

/**
 * Hook for admin operations.
 *
 * Usage:
 *   const { preparers, createPreparer, updateCE, auditLogs, exportAudit } = useAdmin(accountId);
 */
export function useAdmin(accountId: string) {
  const isLoading = false;

  const updateSettings = async (settings: Partial<AccountSettings>): Promise<void> => {
    // await trpc.admin.account.updateSettings.mutate({ accountId, ...settings });
    throw new Error("Connect to tRPC client to update settings.");
  };

  const createPreparer = async (data: Omit<Preparer, "preparerId" | "accountId" | "active" | "ceHours">): Promise<void> => {
    // await trpc.admin.preparers.create.mutate({ accountId, ...data });
    throw new Error("Connect to tRPC client to create preparer.");
  };

  const updateCE = async (preparerId: string, ceHours: number): Promise<void> => {
    // await trpc.admin.preparers.updateCE.mutate({ preparerId, accountId, ceHours });
    throw new Error("Connect to tRPC client to update CE hours.");
  };

  const exportAuditLog = async (startDate: Date, endDate: Date): Promise<void> => {
    // await trpc.admin.audit.exportLog.mutate({ accountId, startDate, endDate });
    throw new Error("Connect to tRPC client to export audit log.");
  };

  return {
    accountId,
    isLoading,
    settings: null as AccountSettings | null,
    preparers: [] as Preparer[],
    updateSettings,
    createPreparer,
    updateCE,
    exportAuditLog,
  };
}

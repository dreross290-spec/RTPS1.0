"use client";

import { useMemo } from "react";

// Type-safe tRPC hook placeholder.
// In a real setup wire this to the generated tRPC client from @server/routers/_app.
// import { trpc } from '@/utils/trpc';

export interface TransmittalStatus {
  transmittalStatus: string | null;
  ackNumber: string | null;
  refundStatus: string | null;
  refundAmount: string | null;
  lastRefundCheckAt: Date | null;
}

export interface TransmittalHistoryEntry {
  transmittalId: string;
  returnId: string;
  transmittalType: string;
  status: string;
  ackDate?: Date | string | null;
  errorDetails?: Record<string, unknown> | null;
  createdAt: Date | string;
}

/**
 * Hook to interact with transmittal data for a given return.
 *
 * Usage:
 *   const { status, history, isLoading, submitToIRS, checkStatus } = useTransmittal(returnId);
 */
export function useTransmittal(returnId: string) {
  // These would use trpc.transmittal.tracking.getStatus.useQuery(...)
  // and trpc.transmittal.tracking.getHistory.useQuery(...)
  // in a real implementation.

  const isLoading = false;

  const submitToIRS = async (): Promise<void> => {
    // await trpc.transmittal.irs.submit.mutate({ returnId });
    throw new Error("Connect to tRPC client to enable transmittal.");
  };

  const checkStatus = async (): Promise<void> => {
    // await trpc.transmittal.tracking.getStatus.query({ returnId });
    throw new Error("Connect to tRPC client to check status.");
  };

  const getRefundStatus = async (): Promise<void> => {
    // await trpc.notifications.getRefundStatus.query({ returnId });
    throw new Error("Connect to tRPC client to get refund status.");
  };

  return {
    returnId,
    isLoading,
    status: null as TransmittalStatus | null,
    history: [] as TransmittalHistoryEntry[],
    submitToIRS,
    checkStatus,
    getRefundStatus,
  };
}

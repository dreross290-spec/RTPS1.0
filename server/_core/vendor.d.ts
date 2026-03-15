/**
 * Ambient type declarations for third-party packages that lack bundled types.
 */

declare module "node-cron" {
  export interface ScheduledTask {
    start(): void;
    stop(): void;
    destroy(): void;
    getStatus(): "scheduled" | "stopped" | "destroyed";
  }

  export interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
    name?: string;
    runOnInit?: boolean;
    recoverMissedExecutions?: boolean;
  }

  export function schedule(
    expression: string,
    func: () => void | Promise<void>,
    options?: ScheduleOptions,
  ): ScheduledTask;

  export function validate(expression: string): boolean;

  export function getTasks(): Map<string, ScheduledTask>;
}

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

declare module "@sendgrid/eventwebhook" {
  export class EventWebhook {
    convertPublicKeyToECDSA(publicKey: string): unknown;
    convertPublicKeyToECDH(publicKey: string): unknown;
    verifySignature(
      publicKey: unknown,
      payload: string | Buffer,
      signature: string,
      timestamp: string
    ): boolean;
  }
  const eventWebhookPkg: { EventWebhook: typeof EventWebhook };
  export default eventWebhookPkg;
}

declare module "postgres" {
  interface Sql {
    (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
    end(): Promise<void>;
  }
  interface Options {
    max?: number;
    idle_timeout?: number;
    connect_timeout?: number;
    ssl?: boolean | Record<string, unknown>;
  }
  function postgres(connectionString: string, options?: Options): Sql;
  export = postgres;
  export default postgres;
}

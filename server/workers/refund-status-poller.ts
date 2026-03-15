/**
 * Refund Status Poller Worker
 * Long-running process that polls IRS transcripts for status changes.
 */
import { TranscriptPoller } from "../_core/integrations/irs/transcript-poller.js";
import { CADE2Client } from "../_core/integrations/irs/cade2-client.js";

const client = new CADE2Client(
  process.env["IRS_CADE2_SERVICE_URL"] ?? "",
  process.env["IRS_CADE2_API_KEY"] ?? "",
);

const poller = new TranscriptPoller(client);

poller.on("statusChange", (event: unknown) => {
  console.log(JSON.stringify({ level: "info", event: "statusChange", data: event }));
});

poller.on("error", (err: unknown) => {
  console.error(JSON.stringify({ level: "error", event: "pollerError", message: String(err) }));
});

poller.startPolling();
console.log(JSON.stringify({ level: "info", message: "Refund status poller started" }));

function shutdown() {
  console.log(JSON.stringify({ level: "info", message: "Shutting down poller" }));
  poller.stopPolling();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

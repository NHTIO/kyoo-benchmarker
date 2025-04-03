import { env } from "../env";
import type { KyooQueueWorkerOptions } from "@nhtio/kyoo";

const config: Partial<KyooQueueWorkerOptions> = {
  autoStart: false,
  blocking: env.get("KYOO_WORKER_BLOCKING", true),
  noAck: env.get("KYOO_WORKER_NOACK", false),
};

export default config;

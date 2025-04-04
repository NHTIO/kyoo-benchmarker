import { logger, inspect } from "../providers/logger";
import { KyooConnection } from "@nhtio/kyoo";
import { scriptAbortController } from "./cli";
import { env } from "../env";
import { inspect as nodeInspect } from "node:util";
import { getDatabase } from "../lib/utils";
import type { Options } from "./cli";
import type { Config } from "@nestmtx/config";

export const runConsumer = async (opts: Options, config: Config) => {
  const database = getDatabase(config.get("database"));
  const configuration = config.get(opts.client!);
  const connection = new KyooConnection(configuration);
  scriptAbortController.signal.addEventListener("abort", () => {
    connection.disconnect(true);
  });
  const queue = connection.queues.get(
    env.get("KYOO_QUEUE_NAME", "kyoo-benchmark"),
  );
  let count = 0;
  const processRate = async () => {
    const rate = count;
    count = 0;
    await database("kyoo_rates").insert({
      client: opts.client,
      queue: env.get("KYOO_QUEUE_NAME", "kyoo-benchmark"),
      side: opts.side,
      rate,
    });
    inspect(
      {
        client: opts.client,
        side: opts.side,
        rate,
      },
      "debug",
    );
    if (scriptAbortController.signal.aborted) {
      return;
    }
    const to = 1000;
    setTimeout(processRate, to);
  };
  const worker = queue.worker(
    async ({ job }, { ack }) => {
      logger.debug(
        `Processing job ${job.id} with payload: ${nodeInspect(job.payload, { depth: 10, colors: true })}`,
      );
      count++;
      await ack();
    },
    {
      autoStart: false,
      blocking: env.get("KYOO_WORKER_BLOCKING", true),
      noAck: env.get("KYOO_WORKER_NOACK", false),
    },
  );

  logger.info("Establishing consumer connection");
  connection.connect().then((connected) => {
    if (connected) {
      logger.info("Consumer connection established");
      worker.resume().then(() => {
        processRate();
      });
    } else {
      logger.error("Consumer connection failed");
      scriptAbortController.abort();
      return;
    }
  });
  return await new Promise((resolve) => {
    scriptAbortController.signal.addEventListener("abort", () => {
      resolve(true);
    });
  });
};

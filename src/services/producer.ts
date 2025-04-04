import { logger, inspect } from "../providers/logger";
import { KyooConnection } from "@nhtio/kyoo";
import { scriptAbortController } from "./cli";
import { env } from "../env";
import { getDatabase } from "../lib/utils";
import type { Options } from "./cli";
import type { Config } from "@nestmtx/config";

export const runProducer = async (opts: Options, config: Config) => {
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
  const doEnqueue = async () => {
    if (scriptAbortController.signal.aborted) {
      return;
    }
    const jobs = Array(100)
      .fill(0)
      .map((_, i) => ({
        payload: {
          now: new Date(),
          index: i,
        },
      }));
    await Promise.all(
      jobs.map(async (job) => {
        return await queue.jobs.enqueue(job).catch(() => {});
      }),
    );
    count += jobs.length;
    const total = await queue.jobs.enqueued();
    logger.debug(
      `Enqueued ${jobs.length} in ${opts.client} jobs, total enqueued: ${total}`,
    );
    if (scriptAbortController.signal.aborted) {
      return;
    }
    const to = 1000;
    logger.debug(
      `Enqueued ${jobs.length} jobs in ${opts.client}, waiting ${to}ms to enqueue again`,
    );
    setTimeout(doEnqueue, to);
  };

  logger.info("Establishing producer connection");
  connection.connect().then((connected) => {
    if (connected) {
      logger.info("Producer connection established");
      doEnqueue();
      processRate();
    } else {
      logger.error("Producer connection failed");
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

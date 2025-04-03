import { KyooConnection } from "@nhtio/kyoo";
import { randomInt } from "node:crypto";
import { scriptAbortController } from "./cli";
import type { Options } from "./cli";
import type { Config } from "@nestmtx/config";

export const runProducer = async (opts: Options, config: Config) => {
  const configuration = config.get(opts.client!);
  const connection = new KyooConnection(configuration);
  scriptAbortController.signal.addEventListener("abort", () => {
    connection.disconnect(true);
  });
  const queue = connection.queues.get("kyoo-benchmark");

  const doEnqueue = async () => {
    if (scriptAbortController.signal.aborted) {
      return;
    }
    const jobs = Array(randomInt(1, 100))
      .fill(0)
      .map((_, i) => ({
        payload: {
          now: new Date(),
          index: i,
        },
      }));
    // @ts-ignore
    await queue.jobs.enqueue(...jobs);
    const total = await queue.jobs.enqueued();
    console.log(`Enqueued ${jobs.length} jobs, total enqueued: ${total}`);
    if (scriptAbortController.signal.aborted) {
      return;
    }
    const to = randomInt(500, 5000);
    console.log(
      `Enqueued ${jobs.length} jobs, waiting ${to}ms to enqueue again`,
    );
    setTimeout(doEnqueue, to);
  };

  console.log("Establishing producer connection");
  connection.connect().then((connected) => {
    if (connected) {
      console.log("Producer connection established");
      doEnqueue();
    } else {
      console.log("Producer connection failed");
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

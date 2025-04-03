import { logger } from "../providers/logger";
import {
  confirmServerAvailability,
  confirmUrlAvailability,
  getDatabase,
} from "../lib/utils";
import { scriptAbortController } from "./cli";
import { runProcessFor } from "../providers/process";
import type { Options } from "./cli";
import type { Config } from "@nestmtx/config";
import type { Knex } from "knex";

const makeDatabase = async (database: Knex) => {
  await database.schema.createTable("kyoo_metrics", (table) => {
    table.increments("id").primary();
    table.string("client").notNullable();
    table.string("side").notNullable();
    table.float("cpu", 8, 2).notNullable();
    table.float("memory", 8, 2).notNullable();
    table.timestamp("created_at").defaultTo(database.fn.now());
  });
};

export const mainThread = async (
  BASEDIR: string,
  opts: Options,
  config: Config,
) => {
  logger.info("Welcome to Kyo͞o Benchmark Utility");
  logger.info("Checking connectivity to the stats database...");
  const database = getDatabase(config.get("database"));
  const exists = await database.schema.hasTable("kyoo_metrics");
  if (!exists) {
    logger.info("The table kyoo_metrics does not exist. Creating it...");
    await makeDatabase(database);
  } else {
    logger.info(
      "The table kyoo_metrics exists. Dropping it and recreating it...",
    );
    await database.schema.dropTable("kyoo_metrics");
    await makeDatabase(database);
  }
  logger.info("Checking connectivity to the queue brokers...");
  const [amqpAvailable, redisAvailable, sqsAvailable] = await Promise.all([
    confirmServerAvailability(
      config.get("amqp.configuration.host.hostname"),
      config.get("amqp.configuration.host.port"),
    ),
    confirmServerAvailability(
      config.get("bullmq.configuration.options.host"),
      config.get("bullmq.configuration.options.port"),
    ),
    confirmUrlAvailability(config.get("sqs.configuration.endpoint") as string),
  ]);
  if (!amqpAvailable) {
    logger.error(
      `AMQP broker is not available at ${config.get(
        "amqp.configuration.host.hostname",
      )}:${config.get("amqp.configuration.host.port")}`,
    );
  }
  if (!redisAvailable) {
    logger.error(
      `Redis broker is not available at ${config.get(
        "bullmq.configuration.options.host",
      )}:${config.get("bullmq.configuration.options.port")}`,
    );
  }
  if (!sqsAvailable) {
    logger.error(
      `SQS broker is not available at ${config.get(
        "sqs.configuration.endpoint",
      )}`,
    );
  }
  if (!amqpAvailable || !redisAvailable || !sqsAvailable) {
    throw new Error(
      "One or more queue brokers are not available. Please check your configuration.",
    );
  }
  logger.info("All queue brokers are available.");
  const timeoutController = new AbortController();
  const processes = {
    "amqp|producer": runProcessFor(
      "amqp",
      "producer",
      timeoutController.signal,
      BASEDIR,
    ),
    "amqp|consumer": runProcessFor(
      "amqp",
      "consumer",
      timeoutController.signal,
      BASEDIR,
    ),
    "bullmq|producer": runProcessFor(
      "bullmq",
      "producer",
      timeoutController.signal,
      BASEDIR,
    ),
    "bullmq|consumer": runProcessFor(
      "bullmq",
      "consumer",
      timeoutController.signal,
      BASEDIR,
    ),
    "sqs|producer": runProcessFor(
      "sqs",
      "producer",
      timeoutController.signal,
      BASEDIR,
    ),
    "sqs|consumer": runProcessFor(
      "sqs",
      "consumer",
      timeoutController.signal,
      BASEDIR,
    ),
  };
  Promise.allSettled(Object.values(processes)).then(() => {
    timeoutController.abort();
  });
  logger.info(
    `Starting operations with a timeout of ${opts.timeout} seconds...`,
  );
  const timeout = setTimeout(
    timeoutController.abort.bind(timeoutController),
    opts.timeout * 1000,
  );
  scriptAbortController.signal.addEventListener("abort", () => {
    clearTimeout(timeout);
    timeoutController.abort();
  });
  const done = new Promise<void>((resolve) => {
    timeoutController.signal.addEventListener("abort", () => {
      resolve();
    });
  });
  await done;
  if (scriptAbortController.signal.aborted) {
    logger.info("Process aborted by user.");
    clearTimeout(timeout);
    return;
  }
  logger.info("Benchmarking complete.");
};

import { logger } from "../providers/logger";
import {
  confirmServerAvailability,
  confirmUrlAvailability,
  getDatabase,
} from "../lib/utils";
import { scriptAbortController } from "./cli";
import { runProcessFor } from "../providers/process";
import { default as pidusage } from "pidusage";
import { default as prettyBytes } from "pretty-bytes";
import { default as clit } from "cli-table";
import { KyooConnection } from "@nhtio/kyoo";
import { env } from "../env";
import type { Options } from "./cli";
import type { Config } from "@nestmtx/config";
import type { Knex } from "knex";
import type { KyooClient } from "@nhtio/kyoo";

const makeDatabase = async (database: Knex) => {
  const hasMetricsTable = await database.schema.hasTable("kyoo_metrics");
  if (!hasMetricsTable) {
    await database.schema.createTable("kyoo_metrics", (table) => {
      table.increments("id").primary();
      table.string("queue").notNullable();
      table.string("client").notNullable();
      table.string("side").notNullable();
      table.float("cpu", 8, 2).notNullable();
      table.integer("memory").notNullable().unsigned();
      table.timestamp("created_at").defaultTo(database.fn.now());
    });
  }
  const hasRatesTable = await database.schema.hasTable("kyoo_rates");
  if (!hasRatesTable) {
    await database.schema.createTable("kyoo_rates", (table) => {
      table.increments("id").primary();
      table.string("queue").notNullable();
      table.string("client").notNullable();
      table.string("side").notNullable();
      table.integer("rate").notNullable().unsigned();
      table.timestamp("created_at").defaultTo(database.fn.now());
    });
  }
  await database("kyoo_metrics")
    .where("queue", env.get("KYOO_QUEUE_NAME", "kyoo-benchmark"))
    .del();
  await database("kyoo_rates")
    .where("queue", env.get("KYOO_QUEUE_NAME", "kyoo-benchmark"))
    .del();
};

export const mainThread = async (
  BASEDIR: string,
  opts: Options,
  config: Config,
) => {
  logger.info("Welcome to Kyo͞o Benchmark Utility");
  logger.info("Checking connectivity to the stats database...");
  const database = getDatabase(config.get("database"));
  await makeDatabase(database);
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
  const amqpConn = new KyooConnection(config.get("amqp"));
  const redisConn = new KyooConnection(config.get("bullmq"));
  const sqsConn = new KyooConnection(config.get("sqs"));
  const amqpQueue = amqpConn.queues.get(
    env.get("KYOO_QUEUE_NAME", "kyoo-benchmark"),
  );
  const redisQueue = redisConn.queues.get(
    env.get("KYOO_QUEUE_NAME", "kyoo-benchmark"),
  );
  const sqsQueue = sqsConn.queues.get(
    env.get("KYOO_QUEUE_NAME", "kyoo-benchmark"),
  );
  await Promise.all([
    amqpConn.connect(),
    redisConn.connect(),
    sqsConn.connect(),
  ]);
  logger.info("Purging all queues...");
  await Promise.all([
    amqpQueue.jobs.purge(),
    redisQueue.jobs.purge(),
    sqsQueue.jobs.purge(),
  ]);
  logger.info("All queues purged.");
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
  const compute = async () => {
    const pids: Set<number> = new Set();
    const pidToKey: Map<number, string> = new Map();
    Object.keys(processes).forEach((key) => {
      const pid = processes[key as keyof typeof processes].pid;
      if (pid) {
        pids.add(pid);
        pidToKey.set(pid, key);
      }
    });
    const now = new Date();
    const usage = await pidusage(Array.from(pids));
    const insertable: Array<{
      client: KyooClient;
      queue: string;
      side: "producer" | "consumer";
      cpu: number;
      memory: number;
      created_at: Date;
    }> = [];
    for (const upid in usage) {
      const { cpu, memory } = usage[upid];
      const key = pidToKey.get(Number.parseInt(upid));
      if (!key) {
        continue;
      }
      const [client, side] = key.split("|") as [
        KyooClient,
        "producer" | "consumer",
      ];
      insertable.push({
        client,
        queue: env.get("KYOO_QUEUE_NAME", "kyoo-benchmark"),
        side,
        cpu,
        memory,
        created_at: now,
      });
    }
    try {
      await database("kyoo_metrics").insert(insertable);
    } catch (error) {
      logger.error("Error inserting metrics into the database");
      logger.error(error);
      scriptAbortController.abort();
    }
    const sortedIterable = insertable.sort((a, b) => {
      if (a.client === b.client) {
        if (a.side === b.side) {
          return 0;
        }
        return a.side.localeCompare(b.side);
      }
      return a.client.localeCompare(b.client);
    });
    const [amqpJobs, redisJobs, sqsJobs] = await Promise.all([
      amqpQueue.jobs.enqueued(),
      redisQueue.jobs.enqueued(),
      sqsQueue.jobs.enqueued(),
    ]);
    const jobCounts = new Map<KyooClient, number>();
    jobCounts.set("amqp", amqpJobs);
    jobCounts.set("bullmq", redisJobs);
    jobCounts.set("sqs", sqsJobs);
    const table = new clit({
      head: [
        "Adapter",
        "Role",
        "CPU Utilization",
        "Memory Utilization",
        "Enqueued Jobs",
      ],
    });
    sortedIterable.forEach((r) => {
      table.push([
        r.client,
        r.side,
        `${Math.round(r.cpu)}%`,
        prettyBytes(r.memory),
        jobCounts.get(r.client)!.toString(),
      ]);
    });
    logger.info("\n" + table.toString());
  };
  const iterate = async () => {
    if (
      scriptAbortController.signal.aborted ||
      timeoutController.signal.aborted
    ) {
      return;
    }
    await compute();
    setTimeout(iterate, 1000);
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
  setTimeout(() => {
    iterate();
  }, 1000);
  await done;
  if (scriptAbortController.signal.aborted) {
    logger.info("Process aborted by user.");
    clearTimeout(timeout);
    return;
  }
  logger.info("Benchmarking complete.");
  const results = await database("kyoo_metrics")
    .where("queue", env.get("KYOO_QUEUE_NAME", "kyoo-benchmark"))
    .select("client", "side")
    .avg("cpu", { as: "cpu" })
    .avg("memory", { as: "memory" })
    .min("cpu", { as: "min_cpu" })
    .max("cpu", { as: "max_cpu" })
    .min("memory", { as: "min_memory" })
    .max("memory", { as: "max_memory" })
    .groupBy("client", "side")
    .orderBy("client")
    .orderBy("side");
  const rates = await database<{
    client: KyooClient;
    side: "producer" | "consumer";
    rate: number;
  }>("kyoo_rates")
    .where("queue", env.get("KYOO_QUEUE_NAME", "kyoo-benchmark"))
    .select("client", "side")
    .avg("rate", { as: "rate" })
    .groupBy("client", "side")
    .orderBy("client")
    .orderBy("side");
  const getAverageRateFor = (
    client: KyooClient,
    side: "producer" | "consumer",
  ) => {
    const rate = rates.find((r) => r.client === client && r.side === side);
    if (!rate) {
      return 0;
    }
    return Math.round(rate.rate);
  };
  const fixed = results.map((result) => ({
    ...result,
    memory: Number.parseFloat(result.memory),
  })) as Array<{
    client: KyooClient;
    side: "producer" | "consumer";
    cpu: number;
    memory: number;
    min_cpu: number;
    max_cpu: number;
    min_memory: number;
    max_memory: number;
  }>;
  const table = new clit({
    head: [
      "Adapter",
      "Role",
      "Min CPU",
      "Avg CPU",
      "Max CPU",
      "Min Memory",
      "Avg Memory",
      "Max Memory",
      "Rate",
    ],
  });
  fixed.forEach((r) => {
    table.push([
      r.client,
      r.side,
      `${Math.round(r.min_cpu)}%`,
      `${Math.round(r.cpu)}%`,
      `${Math.round(r.max_cpu)}%`,
      prettyBytes(r.min_memory),
      prettyBytes(r.memory),
      prettyBytes(r.max_memory),
      `${getAverageRateFor(r.client, r.side)}/s`,
    ]);
  });
  console.log(table.toString());
};

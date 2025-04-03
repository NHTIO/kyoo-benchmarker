import cla from "command-line-args";
import clu from "command-line-usage";
import joi from "joi";

import { logger, logCompletePromise } from "../providers/logger";
import type { KyooClient } from "@nhtio/kyoo";

const options = [
  /**
   * This is where you define the options for the script
   */
  {
    name: "help",
    alias: "h",
    type: Boolean,
    description: "Print this usage guide",
  },
  {
    name: "client",
    alias: "c",
    type: String,
    description:
      "The client to use for the benchmark. Options are: `amqp`, `bullmq`, or `sqs`",
  },
  {
    name: "side",
    alias: "s",
    type: String,
    description:
      "The operation side to benchmark. Options are: `producer` or `consumer`",
  },
  {
    name: "timeout",
    alias: "t",
    type: String,
    description:
      "The amount of time to wait for the benchmark to complete. Default is 86400 seconds (24 hours)",
  },
];

export interface Options {
  client?: KyooClient;
  side?: "producer" | "consumer";
  timeout: number;
}

interface Arguments extends Options {
  help: boolean;
}

const optionsSchema = joi.object<Arguments>({
  help: joi.boolean().optional().default(false),
  /**
   * This is where you define the schema for the options
   */
  client: joi.string().valid("amqp", "bullmq", "sqs").optional(),
  side: joi.when("client", {
    switch: [
      {
        is: "amqp",
        then: joi.string().valid("producer", "consumer").required(),
      },
      {
        is: "bullmq",
        then: joi.string().valid("producer", "consumer").required(),
      },
      {
        is: "sqs",
        then: joi.string().valid("producer", "consumer").required(),
      },
    ],
    otherwise: joi.string().valid("producer", "consumer").optional(),
  }),
  timeout: joi.number().min(1).max(86400).default(86400),
});

const args = cla(options);
const usage = clu([
  {
    header: "Kyo͞o Benchmark Utility",
    content: "A utility for testing the performance of Kyo͞o",
  },
  {
    header: "Options",
    optionList: options,
  },
]);

export const scriptAbortController = new AbortController();

export const cleanup = async () => {
  await Promise.all([logCompletePromise]);
  scriptAbortController.abort();
};

export const run = async () => {
  const { error, value: opts } = optionsSchema.validate(args);
  if (error) {
    logger.error(error.message);
    logger.info(usage);
    return;
  }
  if (opts.help) {
    logger.info(usage);
    return;
  }
  return Object.assign(
    {},
    ...Object.keys(opts)
      .filter((k) => "help" !== k)
      .map((k) => ({ [k]: opts[k as keyof Options] })),
  ) as Options;
};

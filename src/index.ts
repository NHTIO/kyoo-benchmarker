import "reflect-metadata";
import * as sourceMapSupport from "source-map-support";
import { prettyPrintError, inspect, logger } from "./providers/logger";
import { cleanup, run, scriptAbortController } from "./services/cli";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { Config } from "@nestmtx/config";
import { mainThread } from "./services/main";
import { runProducer } from "./services/producer";

sourceMapSupport.install({
  handleUncaughtExceptions: false,
  hookRequire: true,
  environment: "node",
});

const CURRENT_FILENAME = fileURLToPath(import.meta.url);
const BASEDIR = dirname(CURRENT_FILENAME);
const CONFIG_DIR = resolve(BASEDIR, "config");

process
  .on("unhandledRejection", (reason, p) => {
    console.error(reason, "Unhandled Rejection at Promise", p);
  })
  .on("uncaughtException", (err) => {
    console.error(err.stack);
    cleanup().finally(() => process.exit(1));
  })
  .on("SIGINT", () => {
    scriptAbortController.abort();
    cleanup().finally(() => process.exit(255));
  })
  .on("SIGTERM", () => {
    scriptAbortController.abort();
    cleanup().finally(() => process.exit(255));
  });

run()
  .then(async (opts) => {
    if (!opts) {
      return;
    }
    let config: Config | undefined;
    if (existsSync(CONFIG_DIR)) {
      config = await Config.initialize(CONFIG_DIR);
    } else {
      throw new Error(
        `Configuration directory ${CONFIG_DIR} does not exist. Please create it and add your configuration files.`,
      );
    }
    /**
     * This is the main entry point of the script
     */
    if (opts.client) {
      if (!opts.side) {
        logger.error("Side is required when client is specified");
        return;
      }
      logger.info(`Running ${opts.client} ${opts.side}...`);
      if (opts.side === "producer") {
        await runProducer(opts, config);
      } else {
        logger.error("Consumer is not implemented yet");
        return;
      }
      // inspect({
      //   baseDir: BASEDIR,
      //   opts,
      //   config: config.root,
      // });
    } else {
      await mainThread(BASEDIR, opts, config);
    }
    cleanup().finally(() => process.exit(0));
  })
  .catch((err) => {
    prettyPrintError(err);
    cleanup().finally(() => process.exit(1));
  });

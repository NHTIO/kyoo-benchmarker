import { Env } from "@nestmtx/config";
import Joi from "joi";

import type { EnvSchema } from "@nestmtx/config";

const envSchema: EnvSchema = {
  LOG_LEVEL: Joi.string()
    .allow(
      "emerg",
      "alert",
      "crit",
      "error",
      "warning",
      "notice",
      "info",
      "debug",
    )
    .default("info"),
  /*
  |----------------------------------------------------------
  | Configuration options for redis-based queue broker
  |----------------------------------------------------------
  */
  REDIS_HOST: Joi.string().default("127.0.0.1"),
  REDIS_PORT: Joi.number().min(1).max(65535).default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow("", null),
  REDIS_DB: Joi.number().min(0).max(15).default(0),
  REDIS_TLS: Joi.boolean().default(false),
  /*
  |----------------------------------------------------------
  | Configuration options for AMQP-based queue broker
  |----------------------------------------------------------
  */
  AMQP_PROTOCOL: Joi.string().allow("amqp", "amqps").default("amqp"),
  AMQP_HOSTNAME: Joi.string().default("127.0.0.1"),
  AMQP_PORT: Joi.number().min(1).max(65535).default(5672),
  AMQP_USERNAME: Joi.string().default("guest"),
  AMQP_PASSWORD: Joi.string().default("guest"),
  AMQP_VHOST: Joi.string().default("/"),
  AMQP_EXCHANGE: Joi.string().default("kyo͞o"),
  /*
  |----------------------------------------------------------
  | Configuration options for SQS-based queue broker
  |----------------------------------------------------------
  */
  SQS_ACCESS_KEY_ID: Joi.string().default("fakeAccessKeyId"),
  SQS_SECRET_ACCESS_KEY: Joi.string().default("fakeSecretAccessKey"),
  SQS_REGION: Joi.string().default("us-east-1"),
  SQS_ENDPOINT: Joi.string()
    .uri({
      scheme: ["http", "https"],
    })
    .optional()
    .default("http://localhost:9324"),
  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_CONNECTION: Joi.string()
    .allow("mysql", "mssql", "postgre", "sqlite")
    .default("sqlite"),
  DB_HOST: Joi.string().optional().allow("", null),
  DB_PATH: Joi.string().optional().allow("", null),
  DB_PORT: Joi.number().optional().min(1).max(65535),
  DB_USER: Joi.string().optional().allow("", null),
  DB_PASSWORD: Joi.string().optional().allow("", null),
  DB_NAME: Joi.string().optional().allow("", null),
  DB_SECURE: Joi.boolean().optional().default(false),
  /*
  |----------------------------------------------------------
  | Variables for configuring kyoo workers
  |----------------------------------------------------------
  */
  KYOO_WORKER_NOACK: Joi.boolean().optional().default(false),
  KYOO_WORKER_BLOCKING: Joi.boolean().optional().default(true),
  KYOO_QUEUE_NAME: Joi.string().default("kyoo-benchmark"),
};

export const env = new Env(envSchema);

import { env } from "../env";
import { defineAdapterConfiguration } from "@nhtio/kyoo";

const config = defineAdapterConfiguration<"bullmq">({
  client: "bullmq",
  configuration: {
    options: {
      host: env.get("REDIS_HOST", "127.0.0.1"),
      port: env.get("REDIS_PORT", 6379),
      password: env.get("REDIS_PASSWORD")
        ? env.get("REDIS_PASSWORD")
        : undefined,
      db: env.get("REDIS_DB", 0),
      tls: env.get("REDIS_TLS", false)
        ? { rejectUnauthorized: false }
        : undefined,
      maxRetriesPerRequest: null,
    },
  },
});

export default config;

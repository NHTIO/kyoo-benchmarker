import { env } from "../env";
import { defineAdapterConfiguration } from "@nhtio/kyoo";

const config = defineAdapterConfiguration<"sqs">({
  client: "sqs",
  configuration: {
    region: env.get("SQS_REGION", "us-east-1"),
    endpoint: env.get("SQS_ENDPOINT", "http://localhost:9324"),
    credentials: {
      accessKeyId: env.get("SQS_ACCESS_KEY_ID", "fakeAccessKeyId"),
      secretAccessKey: env.get("SQS_SECRET_ACCESS_KEY", "fakeSecretAccessKey"),
    },
  },
});

export default config;

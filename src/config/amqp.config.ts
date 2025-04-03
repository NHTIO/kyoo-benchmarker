import { env } from "../env";
import { defineAdapterConfiguration } from "@nhtio/kyoo";

const config = defineAdapterConfiguration<"amqp">({
  client: "amqp",
  configuration: {
    host: {
      protocol: env.get("AMQP_PROTOCOL", "amqp"),
      hostname: env.get("AMQP_HOSTNAME", "127.0.0.1"),
      port: env.get("AMQP_PORT", 5672),
      username: env.get("AMQP_USERNAME", "guest"),
      password: env.get("AMQP_PASSWORD", "guest"),
      name: env.get("AMQP_NAME"),
      frameMax: env.get("AMQP_FRAMEMAX"),
      channelMax: env.get("AMQP_CHANNELMAX"),
      heartbeat: env.get("AMQP_HEARTBEAT"),
      vhost: env.get("AMQP_VHOST", "/"),
    },
    exchange: env.get("AMQP_EXCHANGE", "kyoo"),
  },
});

export default config;

import type { Knex } from "knex";
import { env } from "../env";

const connection: Knex.Config["connection"] =
  "sqlite" === env.get("DB_CONNECTION", "sqlite")
    ? {
        filename: env.get("DB_PATH"),
      }
    : {
        host: env.get("DB_HOST", "localhost"),
        port: env.get("DB_PORT", 3306),
        user: env.get("DB_USER", "lucid"),
        password: env.get("DB_PASSWORD", ""),
        database: env.get("DB_NAME", "lucid"),
      };
if (env.get("DB_SECURE", false)) {
  switch (env.get("DB_CONNECTION", "sqlite")) {
    case "mysql":
      // @ts-ignore
      connection.ssl = {
        rejectUnauthorized: true,
      };
      break;
    case "postgres":
    case "postgre":
    case "pg":
      // @ts-ignore
      connection.ssl = true;
      break;
  }
}

const config: Knex.Config = {
  client:
    env.get("DB_CONNECTION", "sqlite") === "sqlite"
      ? "sqlite3"
      : env.get("DB_CONNECTION") === "mysql"
        ? "mysql2"
        : env.get("DB_CONNECTION") === "mssql"
          ? "mssql"
          : "pg",
  connection,
  useNullAsDefault:
    env.get("DB_CONNECTION", "sqlite") === "sqlite" ? true : undefined,
};

switch (env.get("DB_CONNECTION", "sqlite")) {
  case "sqlite":
    if (!env.get("DB_PATH")) {
      throw new Error("DB_PATH is required for an sqlite connection");
    }
    break;

  default:
    if (!env.get("DB_HOST")) {
      throw new Error("DB_HOST is required for a non-sqlite connection");
    }
    if (!env.get("DB_PORT")) {
      throw new Error("DB_PORT is required for a non-sqlite connection");
    }
    if (!env.get("DB_USER")) {
      throw new Error("DB_USER is required for a non-sqlite connection");
    }
    if (!env.get("DB_PASSWORD")) {
      throw new Error("DB_PASSWORD is required for a non-sqlite connection");
    }
    if (!env.get("DB_NAME")) {
      throw new Error("DB_NAME is required for a non-sqlite connection");
    }
    break;
}

export default config;

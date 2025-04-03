import { default as knex } from "knex";
import { Socket } from "node:net";
import type { Knex } from "knex";

export const confirmServerAvailability = async (
  host: string,
  port: number,
  timeout: number = 5000,
): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    const socket = new Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeout);
    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
    socket.on("close", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
};

export const confirmUrlAvailability = async (
  url: string,
  timeout: number = 5000,
): Promise<boolean> => {
  const epAsUrl = new URL(url);
  const hostname = epAsUrl.hostname;
  const port = epAsUrl.port
    ? Number.parseInt(epAsUrl.port)
    : epAsUrl.protocol === "https:"
      ? 443
      : 80;
  return await confirmServerAvailability(hostname, port, timeout);
};

export const getDatabase = (config: Readonly<Knex.Config>): Knex => {
  const unreadonlyConfig = JSON.parse(JSON.stringify(config));
  return knex(unreadonlyConfig);
};

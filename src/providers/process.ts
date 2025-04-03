import { execa } from "execa";
import type { KyooClient } from "@nhtio/kyoo";

export const runProcessFor = (
  client: KyooClient,
  side: "producer" | "consumer",
  signal: AbortSignal,
  cwd: string,
) => {
  return execa("node", ["index.mjs", "--client", client, "--side", side], {
    cwd,
    cancelSignal: signal,
    stdio: "inherit",
    reject: false,
  });
};

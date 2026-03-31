import { spawnSync } from "node:child_process";

export function which(binary: string): string | null {
  const result = spawnSync("which", [binary], { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }

  const output = result.stdout.trim();
  return output.length > 0 ? output : null;
}

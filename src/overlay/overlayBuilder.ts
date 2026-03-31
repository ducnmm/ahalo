import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CACHE_DIR } from "../config";

export function ensureOverlayBinary(sourcePath: string): string {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Overlay source not found: ${sourcePath}`);
  }

  const binDir = path.join(CACHE_DIR, "bin");
  const binaryPath = path.join(binDir, "overlay-helper");
  fs.mkdirSync(binDir, { recursive: true });

  const needsBuild =
    !fs.existsSync(binaryPath) ||
    fs.statSync(binaryPath).mtimeMs < fs.statSync(sourcePath).mtimeMs;

  if (!needsBuild) {
    return binaryPath;
  }

  const result = spawnSync(
    "swiftc",
    ["-O", "-framework", "AppKit", sourcePath, "-o", binaryPath],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(
      `Failed to compile overlay helper\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
  }

  fs.chmodSync(binaryPath, 0o755);
  return binaryPath;
}

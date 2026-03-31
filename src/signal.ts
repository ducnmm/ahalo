/**
 * Signal file utilities — the shared communication protocol between
 * agent hooks and the ahalo daemon/overlay.
 *
 * Every agent adapter writes "busy" or "idle" to the same signal file.
 * The daemon watches this file and toggles the overlay accordingly.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SIGNAL_FILE = path.join(os.tmpdir(), "ahalo-signal");

export function getSignalFilePath(): string {
  return SIGNAL_FILE;
}

export function readSignalFile(signalPath: string): "busy" | "idle" | null {
  try {
    const content = fs.readFileSync(signalPath, "utf8").trim();
    if (content === "busy" || content === "idle") {
      return content;
    }
    return null;
  } catch {
    return null;
  }
}

export function cleanupSignalFile(signalPath: string): void {
  try {
    fs.unlinkSync(signalPath);
  } catch {
    // ignore
  }
}

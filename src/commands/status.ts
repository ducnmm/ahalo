import fs from "node:fs";
import { execSync } from "node:child_process";
import { getSignalFilePath, readSignalFile } from "../signal";
import { ALL_ADAPTERS } from "../adapters/registry";
import { PLIST_LABEL, PLIST_PATH } from "../constants";


export async function runStatusCommand(): Promise<number> {
  console.log("ahalo status\n");

  // show status for each registered adapter
  for (const adapter of ALL_ADAPTERS) {
    const available = adapter.isAvailable();
    const configured = adapter.isConfigured();

    let status: string;
    if (!available) {
      status = "✗ not found";
    } else if (configured) {
      status = "✓ configured";
    } else {
      status = "⚠ found but not configured";
    }
    console.log(`${adapter.displayName}: ${status}`);
  }

  let daemonRunning = false;
  try {
    const output = execSync(`launchctl list 2>/dev/null | grep ${PLIST_LABEL}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    daemonRunning = output.trim().length > 0;
  } catch {
    daemonRunning = false;
  }
  console.log(`daemon: ${daemonRunning ? "✓ running" : "✗ not running"}`);

  const signalPath = getSignalFilePath();
  const signal = readSignalFile(signalPath);
  if (signal) {
    console.log(`signal: ${signal} (${signalPath})`);
  } else {
    console.log(`signal: no data`);
  }

  const plistExists = fs.existsSync(PLIST_PATH);
  console.log(`plist:  ${plistExists ? "✓ installed" : "✗ not installed"}`);

  const anyConfigured = ALL_ADAPTERS.some((a) => a.isConfigured());
  if (!anyConfigured || !daemonRunning) {
    console.log("\nRun `ahalo install` to set up.");
  }

  return 0;
}

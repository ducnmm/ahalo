import fs from "node:fs";
import { execSync } from "node:child_process";
import { getSignalFilePath, cleanupSignalFile } from "../signal";
import { ALL_ADAPTERS } from "../adapters/registry";
import { PLIST_PATH } from "../constants";

export async function runUninstallCommand(): Promise<number> {
  console.log("ahalo uninstall\n");

  try {
    execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, { stdio: "ignore" });
    console.log("✓ daemon stopped");
  } catch {
    console.log("- daemon was not running");
  }

  try {
    fs.unlinkSync(PLIST_PATH);
    console.log("✓ launchagent removed");
  } catch {
    console.log("- launchagent not found");
  }

  // uninstall hooks for all adapters
  for (const adapter of ALL_ADAPTERS) {
    adapter.uninstall();
    console.log(`✓ ${adapter.displayName} hooks removed`);
  }

  cleanupSignalFile(getSignalFilePath());
  console.log("✓ signal file cleaned");

  console.log("\nahalo uninstalled.");
  return 0;
}

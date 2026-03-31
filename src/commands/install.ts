import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { ensureConfig, writeConfig, CONFIG_PATH } from "../config";
import { OVERLAY_SOURCE_PATH, DEFAULT_ICON_PATH, DEFAULT_ENTER_ICON_PATH, DEFAULT_EXIT_ICON_PATH, PROJECT_ROOT } from "../runtimePaths";
import { ensureOverlayBinary } from "../overlay/overlayBuilder";
import { getSignalFilePath } from "../signal";
import { ALL_ADAPTERS } from "../adapters/registry";
import { which } from "../utils/which";
import { PLIST_LABEL, LAUNCH_AGENTS_DIR, PLIST_PATH } from "../constants";



export async function runInstallCommand(): Promise<number> {
  console.log("ahalo install\n");

  const config = ensureConfig();
  config.iconPath = DEFAULT_ICON_PATH;
  config.enterIconPath = DEFAULT_ENTER_ICON_PATH;
  config.exitIconPath = DEFAULT_EXIT_ICON_PATH;
  writeConfig(config);
  console.log(`✓ config: ${CONFIG_PATH}`);

  let overlayOk = false;
  try {
    ensureOverlayBinary(OVERLAY_SOURCE_PATH);
    overlayOk = true;
  } catch {
    overlayOk = false;
  }
  console.log(`${overlayOk ? "✓" : "✗"} overlay helper`);

  if (!overlayOk) {
    console.error("  swift compiler required. install xcode command line tools.");
    return 1;
  }

  // install hooks for each available agent adapter
  const signalPath = getSignalFilePath();
  let anyAdapterInstalled = false;

  for (const adapter of ALL_ADAPTERS) {
    if (!adapter.isAvailable()) {
      console.log(`⊘ ${adapter.displayName} (not found in PATH)`);
      continue;
    }

    const ok = adapter.install(signalPath);
    console.log(`${ok ? "✓" : "✗"} ${adapter.displayName} hooks`);

    if (ok) anyAdapterInstalled = true;
  }

  if (!anyAdapterInstalled) {
    console.error("\n✗ no supported agent CLIs found. install codex or another supported agent.");
    return 1;
  }

  const daemonOk = installLaunchAgent();
  console.log(`${daemonOk ? "✓" : "✗"} daemon (launchagent)`);

  console.log("\nahalo installed! use your agent CLI normally — overlay will appear automatically.");
  console.log("run `ahalo status` to check, `ahalo uninstall` to remove.");

  return 0;
}

function installLaunchAgent(): boolean {
  try {
    fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });

    const bunPath = which("bun");
    if (!bunPath) {
      console.error("  bun not found in path");
      return false;
    }

    const cliPath = path.join(PROJECT_ROOT, "src", "cli.ts");

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${bunPath}</string>
    <string>run</string>
    <string>${cliPath}</string>
    <string>daemon</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/ahalo-daemon.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/ahalo-daemon.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${process.env.PATH}</string>
  </dict>
</dict>
</plist>`;

    try {
      execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, { stdio: "ignore" });
    } catch {}

    fs.writeFileSync(PLIST_PATH, plist, "utf8");
    execSync(`launchctl load "${PLIST_PATH}"`, { stdio: "inherit" });

    return true;
  } catch (err) {
    console.error("  launchagent error:", err);
    return false;
  }
}

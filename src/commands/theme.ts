import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { readConfig, writeConfig } from "../config";
import { ASSETS_DIR } from "../runtimePaths";

const THEMES_DIR = path.join(ASSETS_DIR, "themes");
const LAUNCHAGENT_LABEL = "com.ahalo.daemon";

function getAvailableThemes(): string[] {
  if (!fs.existsSync(THEMES_DIR)) return [];
  return fs
    .readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function getCurrentTheme(config: { iconPath: string }): string {
  const match = config.iconPath.match(/themes\/([^/]+)\//);
  if (match) return match[1];
  if (config.iconPath.includes("/assets/icon.gif")) return "monk";
  return "unknown";
}

function restartDaemon(): void {
  try {
    execSync(`launchctl stop ${LAUNCHAGENT_LABEL}`, { stdio: "ignore" });
    execSync(`launchctl start ${LAUNCHAGENT_LABEL}`, { stdio: "ignore" });
  } catch {
    // daemon might not be running, that's ok
  }
}

export async function runThemeCommand(rawArgs: string[]): Promise<number> {
  const config = readConfig();
  if (!config) {
    console.error("missing config. run `ahalo install` first.");
    return 1;
  }

  const themes = getAvailableThemes();
  const themeName = rawArgs[0];

  if (!themeName) {
    const current = getCurrentTheme(config);
    console.log(`\ncurrent theme: ${current}\n`);
    console.log("available themes:");
    for (const t of themes) {
      const marker = t === current ? " ←" : "";
      console.log(`  • ${t}${marker}`);
    }
    console.log(`\nusage: ahalo theme <name>`);
    return 0;
  }

  if (!themes.includes(themeName)) {
    console.error(`theme "${themeName}" not found.`);
    console.error(`available: ${themes.join(", ")}`);
    return 1;
  }

  const themeDir = path.join(THEMES_DIR, themeName);
  config.iconPath = path.join(themeDir, "icon.gif");
  config.enterIconPath = path.join(themeDir, "icon_enter.gif");
  config.exitIconPath = path.join(themeDir, "icon_exit.gif");

  for (const [name, p] of [
    ["icon", config.iconPath],
    ["enter", config.enterIconPath],
    ["exit", config.exitIconPath],
  ]) {
    if (!fs.existsSync(p)) {
      console.error(`missing ${name} file: ${p}`);
      return 1;
    }
  }

  writeConfig(config);
  restartDaemon();
  console.log(`\n✓ theme set to "${themeName}"`);
  console.log("✓ daemon restarted\n");
  return 0;
}

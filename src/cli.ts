import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInstallCommand } from "./commands/install";
import { runUninstallCommand } from "./commands/uninstall";
import { runStatusCommand } from "./commands/status";
import { runDaemonCommand } from "./commands/daemon";
import { runCodexCommand } from "./commands/codex";
import { runThemeCommand } from "./commands/theme";

const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const VERSION = JSON.parse(fs.readFileSync(pkgPath, "utf8")).version as string;

function printHelp(): void {
  console.log(`ahalo v${VERSION} — overlay icon for codex cli

usage:
  ahalo install         setup hooks, notify, and start daemon
  ahalo uninstall       remove all ahalo integrations
  ahalo status          check daemon and configuration
  ahalo codex [-- ...]  legacy: wrap codex with pty monitoring
  ahalo theme [name]    list or switch animation themes

after install, just use \`codex\` normally — overlay appears automatically.`);
}

async function main(): Promise<number> {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case "install":
    case "init":
      return runInstallCommand();

    case "uninstall":
      return runUninstallCommand();

    case "status":
      return runStatusCommand();

    case "daemon":
      return runDaemonCommand();

    case "codex":
      return runCodexCommand(args);

    case "theme":
      return runThemeCommand(args);

    case "-v":
    case "--version":
      console.log(VERSION);
      return 0;

    case "-h":
    case "--help":
    case undefined:
      printHelp();
      return 0;

    default:
      console.error(`unknown command: ${command}`);
      printHelp();
      return 1;
  }
}

void main().then((code) => {
  process.exitCode = code;
});

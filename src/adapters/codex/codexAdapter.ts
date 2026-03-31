/**
 * CodexAdapter — ahalo integration for OpenAI Codex CLI.
 *
 * Installs hooks into ~/.codex/ so that Codex writes "busy"/"idle"
 * to the shared signal file whenever it starts/finishes processing.
 *
 * Config locations:
 *   - ~/.codex/config.toml   (notify command + [features] codex_hooks)
 *   - ~/.codex/hooks.json    (UserPromptSubmit hook)
 *   - ~/.codex/hooks/        (shell scripts: ahalo-busy.sh, ahalo-notify.sh)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AgentAdapter } from "../adapter";
import { which } from "../../utils/which";

const CODEX_DIR = path.join(os.homedir(), ".codex");
const CODEX_CONFIG = path.join(CODEX_DIR, "config.toml");
const HOOKS_JSON = path.join(CODEX_DIR, "hooks.json");
const HOOKS_DIR = path.join(CODEX_DIR, "hooks");

export class CodexAdapter implements AgentAdapter {
  readonly id = "codex";
  readonly displayName = "Codex CLI";

  isAvailable(): boolean {
    return which("codex") !== null;
  }

  isConfigured(): boolean {
    try {
      const hasNotify =
        fs.existsSync(CODEX_CONFIG) &&
        fs.readFileSync(CODEX_CONFIG, "utf8").includes("ahalo-notify.sh");
      const hasHooks =
        fs.existsSync(HOOKS_JSON) &&
        fs.readFileSync(HOOKS_JSON, "utf8").includes("ahalo-busy.sh");
      return hasNotify && hasHooks;
    } catch {
      return false;
    }
  }

  install(signalFilePath: string): boolean {
    try {
      fs.mkdirSync(CODEX_DIR, { recursive: true });
      fs.mkdirSync(HOOKS_DIR, { recursive: true });

      this.createHookScripts(signalFilePath);
      this.setupHooksJson();
      this.setupNotifyConfig();
      this.enableCodexHooksFeature();

      return true;
    } catch (err) {
      console.error(`[ahalo] failed to setup ${this.displayName} integration:`, err);
      return false;
    }
  }

  uninstall(): void {
    this.removeHookScripts();
    this.removeFromHooksJson();
    this.removeNotifyConfig();
  }

  // --- private helpers ---

  private createHookScripts(signalFilePath: string): void {
    const busyScript = `#!/bin/bash\necho "busy" > "${signalFilePath}"\n`;
    const idleScript = `#!/bin/bash\necho "idle" > "${signalFilePath}"\n`;

    fs.writeFileSync(path.join(HOOKS_DIR, "ahalo-busy.sh"), busyScript, { mode: 0o755 });
    fs.writeFileSync(path.join(HOOKS_DIR, "ahalo-notify.sh"), idleScript, { mode: 0o755 });
  }

  private removeHookScripts(): void {
    for (const name of ["ahalo-busy.sh", "ahalo-notify.sh"]) {
      try {
        fs.unlinkSync(path.join(HOOKS_DIR, name));
      } catch {
        // ignore
      }
    }
  }

  private setupHooksJson(): void {
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(HOOKS_JSON)) {
      try {
        existing = JSON.parse(fs.readFileSync(HOOKS_JSON, "utf8"));
      } catch {
        existing = {};
      }
    }

    const hooks = (existing.hooks ?? {}) as Record<string, unknown[]>;

    for (const event of Object.keys(hooks)) {
      hooks[event] = (hooks[event] as Array<{ hooks?: Array<{ command?: string }> }>).filter(
        (g) => !g.hooks?.some((h) => h.command?.includes("ahalo-")),
      );
      if (hooks[event].length === 0) delete hooks[event];
    }

    const busyCmd = path.join(HOOKS_DIR, "ahalo-busy.sh");
    hooks.UserPromptSubmit = [
      ...((hooks.UserPromptSubmit ?? []) as unknown[]),
      { hooks: [{ type: "command", command: busyCmd }] },
    ];

    fs.writeFileSync(HOOKS_JSON, JSON.stringify({ ...existing, hooks }, null, 2) + "\n", "utf8");
  }

  private removeFromHooksJson(): void {
    if (!fs.existsSync(HOOKS_JSON)) return;

    try {
      const existing = JSON.parse(fs.readFileSync(HOOKS_JSON, "utf8"));
      const hooks = (existing.hooks ?? {}) as Record<string, unknown[]>;

      for (const event of Object.keys(hooks)) {
        hooks[event] = (hooks[event] as Array<{ hooks?: Array<{ command?: string }> }>).filter(
          (g) => !g.hooks?.some((h) => h.command?.includes("ahalo-")),
        );
        if (hooks[event].length === 0) delete hooks[event];
      }

      existing.hooks = hooks;
      fs.writeFileSync(HOOKS_JSON, JSON.stringify(existing, null, 2) + "\n", "utf8");
    } catch {
      // ignore parse errors
    }
  }

  private setupNotifyConfig(): void {
    let content = fs.existsSync(CODEX_CONFIG)
      ? fs.readFileSync(CODEX_CONFIG, "utf8")
      : "";

    if (content.includes("ahalo-notify.sh")) return;

    const notifyScript = path.join(HOOKS_DIR, "ahalo-notify.sh");
    const notifyLine = `notify = ["bash", "${notifyScript}"]`;

    if (/^notify\s*=/m.test(content)) {
      console.log("[ahalo] existing notify config found. please add ahalo-notify.sh manually.");
      return;
    }

    const sectionMatch = content.match(/^\[/m);
    if (sectionMatch?.index !== undefined) {
      content = content.slice(0, sectionMatch.index) + notifyLine + "\n\n" + content.slice(sectionMatch.index);
    } else {
      content += "\n" + notifyLine + "\n";
    }

    fs.writeFileSync(CODEX_CONFIG, content, "utf8");
  }

  private removeNotifyConfig(): void {
    if (!fs.existsSync(CODEX_CONFIG)) return;

    let content = fs.readFileSync(CODEX_CONFIG, "utf8");
    content = content.replace(/^notify\s*=.*ahalo-notify\.sh.*\n?/m, "");
    fs.writeFileSync(CODEX_CONFIG, content, "utf8");
  }

  private enableCodexHooksFeature(): void {
    let content = fs.existsSync(CODEX_CONFIG)
      ? fs.readFileSync(CODEX_CONFIG, "utf8")
      : "";

    if (/codex_hooks\s*=\s*true/.test(content)) return;

    if (/\[features\]/.test(content)) {
      if (/codex_hooks\s*=\s*false/.test(content)) {
        content = content.replace(/codex_hooks\s*=\s*false/, "codex_hooks = true");
      } else {
        content = content.replace(/\[features\]/, "[features]\ncodex_hooks = true");
      }
    } else {
      content += "\n[features]\ncodex_hooks = true\n";
    }

    fs.writeFileSync(CODEX_CONFIG, content, "utf8");
  }
}

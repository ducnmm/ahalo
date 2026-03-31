/**
 * ClaudeCodeAdapter — ahalo integration for Anthropic Claude Code CLI.
 *
 * Installs hooks into ~/.claude/settings.json so that Claude Code writes
 * "busy" / "idle" to the shared signal file whenever it starts/finishes
 * processing.
 *
 * Claude Code hook events used:
 *   - UserPromptSubmit → write "busy" (user submitted a prompt)
 *   - Notification      → write "idle" (claude finished, waiting for input)
 *   - Stop              → write "idle" (claude stopped responding)
 *
 * Config location:
 *   - ~/.claude/settings.json  (hooks block)
 *   - ~/.claude/hooks/         (shell scripts: ahalo-busy.sh, ahalo-idle.sh)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AgentAdapter } from "../adapter";
import { which } from "../../utils/which";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, "settings.json");
const HOOKS_DIR = path.join(CLAUDE_DIR, "hooks");

/** Marker to identify ahalo-managed hooks in settings.json */
const AHALO_MARKER = "ahalo-";

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly id = "claude-code";
  readonly displayName = "Claude Code";

  isAvailable(): boolean {
    return which("claude") !== null;
  }

  isConfigured(): boolean {
    try {
      if (!fs.existsSync(CLAUDE_SETTINGS)) return false;

      const settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS, "utf8"));
      const hooks = settings.hooks;
      if (!hooks) return false;

      // Check that we have ahalo hooks in at least UserPromptSubmit
      const promptHooks = hooks.UserPromptSubmit;
      if (!Array.isArray(promptHooks)) return false;

      return promptHooks.some((group: { hooks?: Array<{ command?: string }> }) =>
        group.hooks?.some((h) => h.command?.includes(AHALO_MARKER)),
      );
    } catch {
      return false;
    }
  }

  install(signalFilePath: string): boolean {
    try {
      fs.mkdirSync(HOOKS_DIR, { recursive: true });

      this.createHookScripts(signalFilePath);
      this.setupSettingsHooks();

      return true;
    } catch (err) {
      console.error(`[ahalo] failed to setup ${this.displayName} integration:`, err);
      return false;
    }
  }

  uninstall(): void {
    this.removeHookScripts();
    this.removeFromSettings();
  }

  // --- private helpers ---

  private createHookScripts(signalFilePath: string): void {
    const busyScript = `#!/bin/bash\necho "busy" > "${signalFilePath}"\n`;
    const idleScript = `#!/bin/bash\necho "idle" > "${signalFilePath}"\n`;

    fs.writeFileSync(path.join(HOOKS_DIR, "ahalo-busy.sh"), busyScript, { mode: 0o755 });
    fs.writeFileSync(path.join(HOOKS_DIR, "ahalo-idle.sh"), idleScript, { mode: 0o755 });
  }

  private removeHookScripts(): void {
    for (const name of ["ahalo-busy.sh", "ahalo-idle.sh"]) {
      try {
        fs.unlinkSync(path.join(HOOKS_DIR, name));
      } catch {
        // ignore
      }
    }
  }

  private setupSettingsHooks(): void {
    let settings: Record<string, unknown> = {};
    if (fs.existsSync(CLAUDE_SETTINGS)) {
      try {
        settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS, "utf8"));
      } catch {
        settings = {};
      }
    }

    const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;

    // Remove any existing ahalo hooks first (idempotent)
    this.removeAhaloFromHooks(hooks);

    const busyCmd = path.join(HOOKS_DIR, "ahalo-busy.sh");
    const idleCmd = path.join(HOOKS_DIR, "ahalo-idle.sh");

    // UserPromptSubmit → busy
    hooks.UserPromptSubmit = [
      ...((hooks.UserPromptSubmit ?? []) as unknown[]),
      { matcher: "", hooks: [{ type: "command", command: busyCmd }] },
    ];

    // Notification → idle (claude is waiting for input)
    hooks.Notification = [
      ...((hooks.Notification ?? []) as unknown[]),
      { matcher: "", hooks: [{ type: "command", command: idleCmd }] },
    ];

    // Stop → idle (claude finished responding)
    hooks.Stop = [
      ...((hooks.Stop ?? []) as unknown[]),
      { matcher: "", hooks: [{ type: "command", command: idleCmd }] },
    ];

    settings.hooks = hooks;
    fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + "\n", "utf8");
  }

  private removeFromSettings(): void {
    if (!fs.existsSync(CLAUDE_SETTINGS)) return;

    try {
      const settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS, "utf8"));
      const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;

      this.removeAhaloFromHooks(hooks);

      settings.hooks = hooks;
      fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + "\n", "utf8");
    } catch {
      // ignore parse errors
    }
  }

  private removeAhaloFromHooks(hooks: Record<string, unknown[]>): void {
    for (const event of Object.keys(hooks)) {
      hooks[event] = (hooks[event] as Array<{ hooks?: Array<{ command?: string }> }>).filter(
        (group) => !group.hooks?.some((h) => h.command?.includes(AHALO_MARKER)),
      );
      if (hooks[event].length === 0) delete hooks[event];
    }
  }
}

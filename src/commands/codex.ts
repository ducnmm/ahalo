import { readConfig } from "../config";
import { OVERLAY_SOURCE_PATH } from "../runtimePaths";

import { SwiftOverlayManager } from "../overlay/overlayManager";
import { spawnPty } from "../pty/bunPty";
import { which } from "../utils/which";
import { getSignalFilePath, readSignalFile, cleanupSignalFile } from "../signal";
import fs from "node:fs";

function normalizeCodexArgs(rawArgs: string[]): string[] {
  const idx = rawArgs.indexOf("--");
  return idx >= 0 ? rawArgs.slice(idx + 1) : rawArgs;
}

function buildCodexArgs(userArgs: string[]): string[] {
  if (process.env.AHALO_PRESERVE_CODEX_CONFIG === "1") {
    return userArgs;
  }
  return [
    "-c", "mcp_servers={}",
    "-c", 'model_reasoning_effort="high"',
    ...userArgs,
  ];
}

export async function runCodexCommand(rawArgs: string[]): Promise<number> {
  const codexPath = which("codex");
  if (!codexPath) {
    console.error("codex not found in path.");
    return 1;
  }

  const config = readConfig();
  if (!config) {
    console.error("missing config. run `ahalo install` first.");
    return 1;
  }

  const codexArgs = buildCodexArgs(normalizeCodexArgs(rawArgs));
  const overlay = new SwiftOverlayManager(OVERLAY_SOURCE_PATH, config.overlay);

  await overlay.start();

  const signalPath = getSignalFilePath();
  fs.writeFileSync(signalPath, "idle", "utf8");
  process.env.AHALO_SIGNAL_FILE = signalPath;

  const debug = process.env.AHALO_DEBUG === "1";
  let isShowing = false;
  let lastSignal: string | null = null;

  const pty = spawnPty(codexPath, codexArgs, process.cwd());
  const inheritedStdio = pty.isStdioInherited();

  const interval = setInterval(async () => {
    const signal = readSignalFile(signalPath);
    if (signal === lastSignal) return;
    lastSignal = signal;

    if (signal === "busy" && !isShowing) {
      try {
        if (debug) console.error("[ahalo] overlay: show");
        await overlay.show(config.iconPath, config.enterIconPath);
        isShowing = true;
      } catch (err) { if (debug) console.error("[ahalo] overlay show error:", err); }
    } else if (signal === "idle" && isShowing) {
      try {
        if (debug) console.error("[ahalo] overlay: hide");
        await overlay.hide(config.exitIconPath);
        isShowing = false;
      } catch (err) { if (debug) console.error("[ahalo] overlay hide error:", err); }
    }
  }, config.detection.checkIntervalMs);

  const disposeData = pty.onData((chunk) => {
    if (!inheritedStdio) {
      process.stdout.write(chunk);
    }
  });

  let stdinRawWasEnabled = false;
  const onInput = (chunk: Buffer) => pty.write(chunk.toString("utf8"));
  const onResize = () => pty.resize(process.stdout.columns || 120, process.stdout.rows || 36);

  const cleanupInput = () => {
    if (inheritedStdio) return;
    process.stdin.off("data", onInput);
    process.stdout.off("resize", onResize);
    if (process.stdin.isTTY) process.stdin.setRawMode(stdinRawWasEnabled);
    process.stdin.pause();
  };

  if (!inheritedStdio && process.stdin.isTTY) {
    stdinRawWasEnabled = Boolean((process.stdin as unknown as { isRaw?: boolean }).isRaw);
    process.stdin.setRawMode(true);
  }
  if (!inheritedStdio) {
    process.stdin.resume();
    process.stdin.on("data", onInput);
    process.stdout.on("resize", onResize);
  }

  const exitCode = await new Promise<number>((resolve) => {
    pty.onExit(({ exitCode }) => resolve(exitCode));
  });

  clearInterval(interval);
  disposeData();
  cleanupInput();
  cleanupSignalFile(signalPath);
  if (isShowing) {
    try { await overlay.hide(config.exitIconPath); } catch (err) { if (debug) console.error("[ahalo] cleanup hide error:", err); }
  }
  await overlay.stop();

  return exitCode;
}

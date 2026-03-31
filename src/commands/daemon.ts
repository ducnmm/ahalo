import fs from "node:fs";
import path from "node:path";
import { readConfig } from "../config";
import { OVERLAY_SOURCE_PATH } from "../runtimePaths";
import { SwiftOverlayManager } from "../overlay/overlayManager";
import { getSignalFilePath, readSignalFile } from "../signal";

const debug = process.env.AHALO_DEBUG === "1";

export async function runDaemonCommand(): Promise<number> {
  const config = readConfig();
  if (!config) {
    console.error("[ahalo] missing config. run `ahalo install` first.");
    return 1;
  }

  const signalPath = getSignalFilePath();
  const signalDir = path.dirname(signalPath);
  const signalName = path.basename(signalPath);
  const overlay = new SwiftOverlayManager(OVERLAY_SOURCE_PATH, config.overlay);
  const started = await overlay.start();

  if (!started) {
    console.error("[ahalo] failed to start overlay helper.");
    return 1;
  }

  console.log(`[ahalo] daemon started (signal: ${signalPath})`);

  let isShowing = false;
  let lastState: "busy" | "idle" | null = null;

  const handleSignal = async () => {
    const state = readSignalFile(signalPath);
    if (state === null || state === lastState) return;

    lastState = state;

    if (state === "busy" && !isShowing) {
      try {
        await overlay.show(config.iconPath, config.enterIconPath);
        isShowing = true;
        if (debug) console.log("[ahalo] overlay: show");
      } catch (err) {
        if (debug) console.error("[ahalo] overlay show error:", err);
      }
    } else if (state === "idle" && isShowing) {
      try {
        await overlay.hide(config.exitIconPath);
        isShowing = false;
        if (debug) console.log("[ahalo] overlay: hide");
      } catch (err) {
        if (debug) console.error("[ahalo] overlay hide error:", err);
      }
    }
  };

  if (!fs.existsSync(signalPath)) {
    fs.writeFileSync(signalPath, "idle", "utf8");
  }

  let watcher: fs.FSWatcher | null = null;
  const startWatcher = () => {
    try {
      watcher = fs.watch(signalDir, (eventType, filename) => {
        if (filename === signalName) {
          void handleSignal();
        }
      });
      watcher.on("error", () => {
        watcher = null;
      });
    } catch {
      watcher = null;
    }
  };

  startWatcher();

  const fallbackTimer = setInterval(() => void handleSignal(), 2000);

  const shutdown = async () => {
    console.log("[ahalo] daemon stopping...");
    watcher?.close();
    clearInterval(fallbackTimer);
    if (isShowing) {
      try { await overlay.hide(config.exitIconPath); } catch { /* ignore */ }
    }
    await overlay.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await new Promise(() => {});
  return 0;
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AhaloConfig } from "./types";
import { DEFAULT_ICON_PATH, DEFAULT_ENTER_ICON_PATH, DEFAULT_EXIT_ICON_PATH } from "./runtimePaths";

export const CONFIG_DIR = path.join(os.homedir(), ".config", "ahalo");
export const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
export const CACHE_DIR = path.join(os.homedir(), ".cache", "ahalo");

export function getDefaultConfig(): AhaloConfig {
  return {
    iconPath: DEFAULT_ICON_PATH,
    enterIconPath: DEFAULT_ENTER_ICON_PATH,
    exitIconPath: DEFAULT_EXIT_ICON_PATH,
    overlay: {
      sizePx: 96,
      offsetX: 24,
      offsetY: 24,
    },
    detection: {
      checkIntervalMs: 100,
      persistenceMs: 1000,
      idlePersistenceMs: 2000,
      minimumStateDurationMs: 1000,
    },
    fallbackNotification: true,
  };
}

export function readConfig(): AhaloConfig | null {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<AhaloConfig>;
  return mergeWithDefaults(parsed);
}

export function writeConfig(config: AhaloConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function ensureConfig(): AhaloConfig {
  const current = readConfig();
  if (current) {
    return current;
  }

  const defaults = getDefaultConfig();
  writeConfig(defaults);
  return defaults;
}

function mergeWithDefaults(partial: Partial<AhaloConfig>): AhaloConfig {
  const defaults = getDefaultConfig();
  return {
    iconPath: partial.iconPath ?? defaults.iconPath,
    enterIconPath: partial.enterIconPath ?? defaults.enterIconPath,
    exitIconPath: partial.exitIconPath ?? defaults.exitIconPath,
    overlay: {
      sizePx: partial.overlay?.sizePx ?? defaults.overlay.sizePx,
      offsetX: partial.overlay?.offsetX ?? defaults.overlay.offsetX,
      offsetY: partial.overlay?.offsetY ?? defaults.overlay.offsetY,
    },
    detection: {
      checkIntervalMs:
        partial.detection?.checkIntervalMs ?? defaults.detection.checkIntervalMs,
      persistenceMs: partial.detection?.persistenceMs ?? defaults.detection.persistenceMs,
      idlePersistenceMs:
        partial.detection?.idlePersistenceMs ?? defaults.detection.idlePersistenceMs,
      minimumStateDurationMs:
        partial.detection?.minimumStateDurationMs ??
        defaults.detection.minimumStateDurationMs,
    },
    fallbackNotification:
      partial.fallbackNotification ?? defaults.fallbackNotification,
  };
}

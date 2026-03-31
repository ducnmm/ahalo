import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(currentDir, "..");
export const ASSETS_DIR = path.join(PROJECT_ROOT, "assets");
export const NATIVE_DIR = path.join(PROJECT_ROOT, "native");
export const DEFAULT_THEME = "monk";
export const THEMES_DIR = path.join(ASSETS_DIR, "themes");
export const DEFAULT_ICON_PATH = path.join(THEMES_DIR, DEFAULT_THEME, "icon.gif");
export const DEFAULT_ENTER_ICON_PATH = path.join(THEMES_DIR, DEFAULT_THEME, "icon_enter.gif");
export const DEFAULT_EXIT_ICON_PATH = path.join(THEMES_DIR, DEFAULT_THEME, "icon_exit.gif");
export const OVERLAY_SOURCE_PATH = path.join(NATIVE_DIR, "OverlayHelper.swift");

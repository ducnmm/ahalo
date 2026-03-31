import path from "node:path";
import os from "node:os";

export const PLIST_LABEL = "com.ahalo.daemon";
export const LAUNCH_AGENTS_DIR = path.join(os.homedir(), "Library", "LaunchAgents");
export const PLIST_PATH = path.join(LAUNCH_AGENTS_DIR, `${PLIST_LABEL}.plist`);

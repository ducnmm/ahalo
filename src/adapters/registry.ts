/**
 * Adapter registry — central list of all supported agent adapters.
 *
 * To add a new agent:
 *   1. Create src/adapters/<agent>/<agent>Adapter.ts implementing AgentAdapter
 *   2. Import and add it to ALL_ADAPTERS below
 *   3. That's it — install/uninstall/status commands pick it up automatically
 */

import type { AgentAdapter } from "./adapter";
import { CodexAdapter } from "./codex/codexAdapter";
import { ClaudeCodeAdapter } from "./claude-code/claudeCodeAdapter";

/** All registered agent adapters */
export const ALL_ADAPTERS: AgentAdapter[] = [
  new CodexAdapter(),
  new ClaudeCodeAdapter(),
];

/** Returns only adapters whose CLI binary is found in PATH */
export function getAvailableAdapters(): AgentAdapter[] {
  return ALL_ADAPTERS.filter((a) => a.isAvailable());
}

/** Returns only adapters that have hooks already configured */
export function getConfiguredAdapters(): AgentAdapter[] {
  return ALL_ADAPTERS.filter((a) => a.isConfigured());
}

/** Find an adapter by its id */
export function getAdapterById(id: string): AgentAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.id === id);
}

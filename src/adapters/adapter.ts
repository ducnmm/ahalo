/**
 * AgentAdapter defines the interface for integrating ahalo with a CLI agent.
 *
 * Each supported agent (Codex, Claude Code, Aider, etc.) implements this
 * interface to handle its own hook/config installation so that the agent
 * writes "busy" / "idle" to the shared signal file.
 *
 * To add support for a new agent:
 *   1. Create src/adapters/<agent>/<agent>Adapter.ts implementing AgentAdapter
 *   2. Register it in src/adapters/registry.ts
 *   3. Done — install/uninstall/status commands pick it up automatically
 */
export interface AgentAdapter {
  /** Unique identifier, e.g. "codex", "claude-code" */
  readonly id: string;

  /** Human-readable name shown in CLI output */
  readonly displayName: string;

  /** Check whether the agent's CLI binary exists in PATH */
  isAvailable(): boolean;

  /** Check whether ahalo hooks are already configured for this agent */
  isConfigured(): boolean;

  /**
   * Install hooks/config so this agent writes to the signal file.
   * @param signalFilePath - absolute path to the shared signal file
   * @returns true if installation succeeded
   */
  install(signalFilePath: string): boolean;

  /** Remove all ahalo hooks/config for this agent */
  uninstall(): void;
}

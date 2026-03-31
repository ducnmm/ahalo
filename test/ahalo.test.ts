import { describe, test, expect, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readSignalFile, cleanupSignalFile } from "../src/signal";
import { CodexAdapter } from "../src/adapters/codex/codexAdapter";
import { ALL_ADAPTERS, getAvailableAdapters, getAdapterById } from "../src/adapters/registry";

describe("signal file", () => {
  const testSignalPath = path.join(os.tmpdir(), `ahalo-test-signal-${process.pid}`);

  afterEach(() => {
    cleanupSignalFile(testSignalPath);
  });

  test("reads 'busy' from signal file", () => {
    fs.writeFileSync(testSignalPath, "busy", "utf8");
    expect(readSignalFile(testSignalPath)).toBe("busy");
  });

  test("reads 'idle' from signal file", () => {
    fs.writeFileSync(testSignalPath, "idle", "utf8");
    expect(readSignalFile(testSignalPath)).toBe("idle");
  });

  test("returns null for non-existent file", () => {
    expect(readSignalFile("/tmp/ahalo-nonexistent-file")).toBeNull();
  });

  test("returns null for invalid content", () => {
    fs.writeFileSync(testSignalPath, "unknown", "utf8");
    expect(readSignalFile(testSignalPath)).toBeNull();
  });

  test("handles whitespace/newlines in signal file", () => {
    fs.writeFileSync(testSignalPath, "busy\n", "utf8");
    expect(readSignalFile(testSignalPath)).toBe("busy");
  });

  test("cleanupSignalFile removes the file", () => {
    fs.writeFileSync(testSignalPath, "idle", "utf8");
    expect(fs.existsSync(testSignalPath)).toBe(true);
    cleanupSignalFile(testSignalPath);
    expect(fs.existsSync(testSignalPath)).toBe(false);
  });

  test("cleanup ignores missing file", () => {
    cleanupSignalFile("/tmp/ahalo-nonexistent-cleanup");
  });
});

describe("config", () => {
  test("getDefaultConfig returns valid config", async () => {
    const { getDefaultConfig } = await import("../src/config");
    const config = getDefaultConfig();

    expect(config.overlay.sizePx).toBeGreaterThan(0);
    expect(config.detection.checkIntervalMs).toBeGreaterThan(0);
    expect(config.iconPath).toBeDefined();
    expect(config.fallbackNotification).toBe(true);
  });
});

describe("adapter registry", () => {
  test("ALL_ADAPTERS contains at least codex", () => {
    expect(ALL_ADAPTERS.length).toBeGreaterThanOrEqual(1);
    expect(ALL_ADAPTERS[0].id).toBe("codex");
  });

  test("getAdapterById returns correct adapter", () => {
    const codex = getAdapterById("codex");
    expect(codex).toBeDefined();
    expect(codex!.id).toBe("codex");
    expect(codex!.displayName).toBe("Codex CLI");
  });

  test("getAdapterById returns undefined for unknown id", () => {
    expect(getAdapterById("nonexistent")).toBeUndefined();
  });

  test("getAvailableAdapters returns array", () => {
    const available = getAvailableAdapters();
    expect(Array.isArray(available)).toBe(true);
  });
});

describe("codex adapter", () => {
  test("CodexAdapter has correct id and displayName", () => {
    const adapter = new CodexAdapter();
    expect(adapter.id).toBe("codex");
    expect(adapter.displayName).toBe("Codex CLI");
  });

  test("isConfigured returns boolean", () => {
    const adapter = new CodexAdapter();
    expect(typeof adapter.isConfigured()).toBe("boolean");
  });

  test("isAvailable returns boolean", () => {
    const adapter = new CodexAdapter();
    expect(typeof adapter.isAvailable()).toBe("boolean");
  });
});

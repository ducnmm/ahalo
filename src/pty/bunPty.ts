import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ChildProcess, ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EventEmitter } from "node:events";

export interface PtyExitEvent {
  exitCode: number;
}

export interface PtyProcess {
  write(data: string): void;
  resize(columns: number, rows: number): void;
  kill(): void;
  onData(listener: (data: string) => void): () => void;
  onExit(listener: (event: PtyExitEvent) => void): () => void;
  isStdioInherited(): boolean;
}

class PipeProcess implements PtyProcess {
  private readonly events = new EventEmitter();
  private readonly child: ChildProcessWithoutNullStreams;

  constructor(command: string, args: string[], cwd: string) {
    this.child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.stdout.on("data", (chunk: Buffer) => {
      this.events.emit("data", chunk.toString("utf8"));
    });

    this.child.stderr.on("data", (chunk: Buffer) => {
      this.events.emit("data", chunk.toString("utf8"));
    });

    this.child.on("exit", (code) => {
      this.events.emit("exit", { exitCode: code ?? 1 });
    });
  }

  write(data: string): void {
    this.child.stdin.write(data);
  }

  resize(_columns: number, _rows: number): void {}

  kill(): void {
    this.child.kill();
  }

  onData(listener: (data: string) => void): () => void {
    this.events.on("data", listener);
    return () => this.events.off("data", listener);
  }

  onExit(listener: (event: PtyExitEvent) => void): () => void {
    this.events.on("exit", listener);
    return () => this.events.off("exit", listener);
  }

  isStdioInherited(): boolean {
    return false;
  }
}

class ScriptInheritedProcess implements PtyProcess {
  private readonly events = new EventEmitter();
  private readonly child: ChildProcess;
  private readonly logPath: string;
  private offset = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(command: string, args: string[], cwd: string) {
    this.logPath = path.join(
      os.tmpdir(),
      `ahalo-script-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.log`,
    );

    this.child = spawn("script", ["-q", this.logPath, command, ...args], {
      cwd,
      env: process.env,
      stdio: "inherit",
    });

    this.timer = setInterval(() => {
      this.pollLog();
    }, 120);

    this.child.on("exit", (code) => {
      this.pollLog();
      this.clearTimer();
      this.events.emit("exit", { exitCode: code ?? 1 });
      this.cleanupLog();
    });
  }

  write(_data: string): void {}

  resize(_columns: number, _rows: number): void {}

  kill(): void {
    this.child.kill();
  }

  onData(listener: (data: string) => void): () => void {
    this.events.on("data", listener);
    return () => this.events.off("data", listener);
  }

  onExit(listener: (event: PtyExitEvent) => void): () => void {
    this.events.on("exit", listener);
    return () => this.events.off("exit", listener);
  }

  isStdioInherited(): boolean {
    return true;
  }

  private pollLog(): void {
    if (!fs.existsSync(this.logPath)) {
      return;
    }

    const stats = fs.statSync(this.logPath);
    if (stats.size <= this.offset) {
      return;
    }

    const length = stats.size - this.offset;
    const fd = fs.openSync(this.logPath, "r");
    const buffer = Buffer.alloc(length);
    try {
      fs.readSync(fd, buffer, 0, length, this.offset);
    } finally {
      fs.closeSync(fd);
    }

    this.offset = stats.size;
    this.events.emit("data", buffer.toString("utf8"));
  }

  private clearTimer(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  private cleanupLog(): void {
    try {
      fs.unlinkSync(this.logPath);
    } catch {
      // ignore
    }
  }
}

export function spawnPty(command: string, args: string[], cwd: string): PtyProcess {
  if (process.env.AHALO_FORCE_PIPE === "1") {
    return new PipeProcess(command, args, cwd);
  }

  if (process.stdin.isTTY && process.stdout.isTTY) {
    return new ScriptInheritedProcess(command, args, cwd);
  }

  return new PipeProcess(command, args, cwd);
}

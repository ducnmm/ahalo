import { ChildProcess, spawn } from "node:child_process";
import { OverlayController, OverlayConfig } from "../types";
import { ensureOverlayBinary } from "./overlayBuilder";

export class SwiftOverlayManager implements OverlayController {
  private readonly sourcePath: string;
  private readonly config: OverlayConfig;
  private child: ChildProcess | null = null;
  private available = false;

  constructor(sourcePath: string, config: OverlayConfig) {
    this.sourcePath = sourcePath;
    this.config = config;
  }

  async start(): Promise<boolean> {
    try {
      const binaryPath = ensureOverlayBinary(this.sourcePath);
      this.child = spawn(
        binaryPath,
        [
          "--size",
          String(this.config.sizePx),
          "--offset-x",
          String(this.config.offsetX),
          "--offset-y",
          String(this.config.offsetY),
        ],
        {
          stdio: ["pipe", "ignore", "pipe"],
        },
      );

      this.child.stderr?.on("data", () => {});

      this.child.once("error", () => {
        this.available = false;
      });

      this.child.once("exit", () => {
        this.available = false;
        this.child = null;
      });

      this.available = true;
      return true;
    } catch {
      this.available = false;
      this.child = null;
      return false;
    }
  }

  isAvailable(): boolean {
    return this.available && this.child !== null && !this.child.killed;
  }

  async show(iconPath: string, enterPath?: string): Promise<void> {
    await this.send({ cmd: "show", iconPath, enterPath });
  }

  async hide(exitPath?: string): Promise<void> {
    await this.send({ cmd: "hide", exitPath });
  }

  async stop(): Promise<void> {
    if (!this.child) {
      this.available = false;
      return;
    }

    try {
      await this.send({ cmd: "quit" });
    } finally {
      this.child.kill();
      this.child = null;
      this.available = false;
    }
  }

  private async send(payload: { cmd: "show" | "hide" | "quit"; iconPath?: string; enterPath?: string; exitPath?: string }): Promise<void> {
    if (!this.isAvailable() || !this.child?.stdin) {
      throw new Error("Overlay helper is unavailable");
    }

    await new Promise<void>((resolve, reject) => {
      const line = `${JSON.stringify(payload)}\n`;
      this.child?.stdin?.write(line, (error) => {
        if (error) {
          this.available = false;
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

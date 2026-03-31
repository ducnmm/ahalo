import { spawn } from "node:child_process";
import { Notifier } from "../types";

export class MacNotifier implements Notifier {
  async notify(title: string, message: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const script = `display notification ${toAppleString(message)} with title ${toAppleString(title)}`;
      const child = spawn("osascript", ["-e", script], {
        stdio: ["ignore", "ignore", "ignore"],
      });

      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`osascript exited with code ${code ?? -1}`));
        }
      });
    });
  }
}

function toAppleString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

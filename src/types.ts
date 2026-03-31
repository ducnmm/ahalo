export type AgentState = "idle" | "busy" | "waiting_input";

export interface OverlayConfig {
  sizePx: number;
  offsetX: number;
  offsetY: number;
}

export interface DetectionConfig {
  checkIntervalMs: number;
  persistenceMs: number;
  idlePersistenceMs: number;
  minimumStateDurationMs: number;
}

export interface AhaloConfig {
  iconPath: string;
  enterIconPath: string;
  exitIconPath: string;
  overlay: OverlayConfig;
  detection: DetectionConfig;
  fallbackNotification: boolean;
}

export interface OverlayController {
  start(): Promise<boolean>;
  isAvailable(): boolean;
  show(iconPath: string, enterPath?: string): Promise<void>;
  hide(exitPath?: string): Promise<void>;
  stop(): Promise<void>;
}

export interface Notifier {
  notify(title: string, message: string): Promise<void>;
}

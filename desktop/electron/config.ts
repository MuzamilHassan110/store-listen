import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export type DesktopConfig = {
  backendUrl: string;
  autoUpdate: boolean;
  channel: "latest" | "beta";
  installOnQuit: boolean;
};

const DEFAULTS: DesktopConfig = {
  backendUrl: "",
  autoUpdate: true,
  channel: "latest",
  installOnQuit: true,
};

function configPath(): string {
  return path.join(app.getPath("userData"), "desktop-config.json");
}

export function readDesktopConfig(): DesktopConfig {
  try {
    const raw = fs.readFileSync(configPath(), "utf8");
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DesktopConfig>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeDesktopConfig(patch: Partial<DesktopConfig>): DesktopConfig {
  const next = { ...readDesktopConfig(), ...patch };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

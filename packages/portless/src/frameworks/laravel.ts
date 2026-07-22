import * as fs from "node:fs";
import * as path from "node:path";
import type { FrameworkAdapter, FrameworkEnvContext } from "./types.js";

/** True when composer.json lists laravel/framework in require or require-dev. */
export function hasLaravelFramework(cwd: string): boolean {
  const composerPath = path.join(cwd, "composer.json");
  try {
    const raw = fs.readFileSync(composerPath, "utf-8");
    const composer = JSON.parse(raw) as {
      require?: Record<string, string>;
      "require-dev"?: Record<string, string>;
    };
    return (
      typeof composer.require?.["laravel/framework"] === "string" ||
      typeof composer["require-dev"]?.["laravel/framework"] === "string"
    );
  } catch {
    return false;
  }
}

/** True when composer.json defines a named script. */
export function hasComposerScript(scriptName: string, cwd: string): boolean {
  const composerPath = path.join(cwd, "composer.json");
  try {
    const raw = fs.readFileSync(composerPath, "utf-8");
    const composer = JSON.parse(raw) as { scripts?: Record<string, unknown> };
    const value = composer.scripts?.[scriptName];
    return value !== undefined && value !== null;
  } catch {
    return false;
  }
}

function hasArtisan(cwd: string): boolean {
  try {
    fs.accessSync(path.join(cwd, "artisan"), fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export const laravelAdapter: FrameworkAdapter = {
  id: "laravel",

  detect(cwd: string): boolean {
    return hasArtisan(cwd) && hasLaravelFramework(cwd);
  },

  childEnv(ctx: FrameworkEnvContext): Record<string, string> {
    return {
      APP_URL: ctx.url,
      ASSET_URL: ctx.url,
      SERVER_PORT: String(ctx.port),
      SERVER_HOST: ctx.host,
    };
  },

  defaultCommand(cwd: string, scriptName: string): string[] | null {
    if (hasComposerScript(scriptName, cwd)) {
      return ["composer", "run", scriptName];
    }
    return ["php", "artisan", "serve"];
  },
};

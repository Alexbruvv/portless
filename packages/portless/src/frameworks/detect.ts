import { laravelAdapter } from "./laravel.js";
import type { FrameworkAdapter } from "./types.js";

/** Ordered registry of framework adapters. First match wins for defaults. */
export const FRAMEWORK_ADAPTERS: readonly FrameworkAdapter[] = [laravelAdapter];

/**
 * Return all adapters whose filesystem detection matches `cwd`.
 * Multiple adapters may match (e.g. future nested stacks); callers merge env.
 */
export function detectFrameworks(
  cwd: string,
  adapters: readonly FrameworkAdapter[] = FRAMEWORK_ADAPTERS
): FrameworkAdapter[] {
  return adapters.filter((adapter) => {
    try {
      return adapter.detect(cwd);
    } catch {
      return false;
    }
  });
}

/**
 * Resolve a default command from detected framework adapters.
 * The first adapter that returns a non-null defaultCommand wins.
 */
export function resolveFrameworkDefaultCommand(
  cwd: string,
  scriptName: string,
  adapters: readonly FrameworkAdapter[] = FRAMEWORK_ADAPTERS
): string[] | null {
  for (const adapter of detectFrameworks(cwd, adapters)) {
    if (!adapter.defaultCommand) continue;
    const command = adapter.defaultCommand(cwd, scriptName);
    if (command && command.length > 0) return command;
  }
  return null;
}

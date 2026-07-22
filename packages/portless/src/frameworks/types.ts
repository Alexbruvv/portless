/**
 * Context passed to framework adapters when building child-process env vars.
 */
export interface FrameworkEnvContext {
  /** Public URL of the app (e.g. https://myapp.localhost). */
  url: string;
  /** Ephemeral port the app should listen on. */
  port: number;
  /** Bind address for the app server (usually 127.0.0.1). */
  host: string;
  /** Whether the proxy is terminating TLS. */
  tls: boolean;
}

/**
 * Pluggable framework integration. Detect via filesystem, contribute child
 * env vars, and optionally supply a default command when none was given.
 */
export interface FrameworkAdapter {
  id: string;
  /** Return true when `cwd` looks like a project for this framework. */
  detect(cwd: string): boolean;
  /** Extra env vars merged into the child process environment. */
  childEnv(ctx: FrameworkEnvContext): Record<string, string>;
  /**
   * Default command when the user runs bare `portless` with no command.
   * Return null to defer to the next adapter or package.json scripts.
   */
  defaultCommand?(cwd: string, scriptName: string): string[] | null;
}

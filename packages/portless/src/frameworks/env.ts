import * as fs from "node:fs";
import * as path from "node:path";
import { detectFrameworks } from "./detect.js";
import type { FrameworkAdapter } from "./types.js";

export interface BuildChildEnvOptions {
  port: number;
  url: string;
  /** Bind address. Omit (undefined) to leave HOST unset (e.g. Expo LAN). */
  host?: string;
  tlds: readonly string[];
  tls: boolean;
  /** State directory used to locate ca.pem when TLS is enabled. */
  stateDir?: string;
  lanMode?: boolean;
  tailscaleUrl?: string;
  ngrokUrl?: string;
  cwd: string;
  /** Existing NODE_EXTRA_CA_CERTS in the parent env; when set, do not override. */
  existingCaCerts?: string;
  adapters?: readonly FrameworkAdapter[];
}

function formatViteAllowedHosts(tlds: readonly string[]): string {
  return tlds.map((configuredTld) => `.${configuredTld}`).join(",");
}

/**
 * Build only the env vars portless injects (no process.env spread).
 * Used for turbo manifests and for merging into a spawn env.
 */
export function buildChildEnvOverrides(options: BuildChildEnvOptions): Record<string, string> {
  const {
    port,
    url,
    host,
    tlds,
    tls,
    stateDir,
    lanMode,
    tailscaleUrl,
    ngrokUrl,
    cwd,
    existingCaCerts,
    adapters,
  } = options;

  const overrides: Record<string, string> = {
    PORT: String(port),
    PORTLESS_URL: url,
    __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: formatViteAllowedHosts(tlds),
  };

  if (host) {
    overrides.HOST = host;
  }

  if (lanMode) {
    overrides.PORTLESS_LAN = "1";
  }
  if (tailscaleUrl) {
    overrides.PORTLESS_TAILSCALE_URL = tailscaleUrl;
  }
  if (ngrokUrl) {
    overrides.PORTLESS_NGROK_URL = ngrokUrl;
  }

  if (tls && stateDir && !existingCaCerts) {
    const caPath = path.join(stateDir, "ca.pem");
    if (fs.existsSync(caPath)) {
      overrides.NODE_EXTRA_CA_CERTS = caPath;
    }
  }

  const hostForFrameworks = host ?? "127.0.0.1";
  for (const adapter of detectFrameworks(cwd, adapters)) {
    Object.assign(
      overrides,
      adapter.childEnv({
        url,
        port,
        host: hostForFrameworks,
        tls,
      })
    );
  }

  return overrides;
}

/**
 * Full child-process env: base env plus portless / framework overrides.
 */
export function buildChildEnv(
  options: BuildChildEnvOptions,
  baseEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    ...buildChildEnvOverrides({
      ...options,
      existingCaCerts: options.existingCaCerts ?? baseEnv.NODE_EXTRA_CA_CERTS,
    }),
  };
}

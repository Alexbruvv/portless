import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  detectFrameworks,
  resolveFrameworkDefaultCommand,
  buildChildEnv,
  buildChildEnvOverrides,
  laravelAdapter,
  hasLaravelFramework,
  hasComposerScript,
} from "./index.js";
import type { FrameworkAdapter } from "./types.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "portless-fw-test-"));
}

function cleanupDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeLaravelProject(
  dir: string,
  options: {
    artisan?: boolean;
    laravelFramework?: boolean;
    composerScripts?: Record<string, string | string[]>;
  } = {}
): void {
  const { artisan = true, laravelFramework = true, composerScripts } = options;

  if (artisan) {
    fs.writeFileSync(path.join(dir, "artisan"), "#!/usr/bin/env php\n");
  }

  const composer: {
    require?: Record<string, string>;
    "require-dev"?: Record<string, string>;
    scripts?: Record<string, string | string[]>;
  } = {};

  if (laravelFramework) {
    composer.require = { "laravel/framework": "^11.0" };
  }

  if (composerScripts) {
    composer.scripts = composerScripts;
  }

  fs.writeFileSync(path.join(dir, "composer.json"), JSON.stringify(composer, null, 2));
}

describe("hasLaravelFramework", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it("returns true when laravel/framework is in require", () => {
    writeLaravelProject(tmpDir, { artisan: false });
    expect(hasLaravelFramework(tmpDir)).toBe(true);
  });

  it("returns true when laravel/framework is in require-dev", () => {
    fs.writeFileSync(
      path.join(tmpDir, "composer.json"),
      JSON.stringify({ "require-dev": { "laravel/framework": "^11.0" } })
    );
    expect(hasLaravelFramework(tmpDir)).toBe(true);
  });

  it("returns false when laravel/framework is absent", () => {
    fs.writeFileSync(
      path.join(tmpDir, "composer.json"),
      JSON.stringify({ require: { php: "^8.2" } })
    );
    expect(hasLaravelFramework(tmpDir)).toBe(false);
  });

  it("returns false when composer.json is missing", () => {
    expect(hasLaravelFramework(tmpDir)).toBe(false);
  });
});

describe("hasComposerScript", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it("returns true for a string script", () => {
    writeLaravelProject(tmpDir, { composerScripts: { dev: "php artisan serve" } });
    expect(hasComposerScript("dev", tmpDir)).toBe(true);
  });

  it("returns true for an array script", () => {
    writeLaravelProject(tmpDir, {
      composerScripts: { dev: ["php artisan serve", "npm run dev"] },
    });
    expect(hasComposerScript("dev", tmpDir)).toBe(true);
  });

  it("returns false when the script is missing", () => {
    writeLaravelProject(tmpDir, { composerScripts: { test: "phpunit" } });
    expect(hasComposerScript("dev", tmpDir)).toBe(false);
  });
});

describe("laravelAdapter.detect", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it("detects a Laravel app with artisan and laravel/framework", () => {
    writeLaravelProject(tmpDir);
    expect(laravelAdapter.detect(tmpDir)).toBe(true);
    expect(detectFrameworks(tmpDir).map((a) => a.id)).toEqual(["laravel"]);
  });

  it("does not detect when artisan is missing", () => {
    writeLaravelProject(tmpDir, { artisan: false });
    expect(laravelAdapter.detect(tmpDir)).toBe(false);
  });

  it("does not detect when laravel/framework is missing", () => {
    writeLaravelProject(tmpDir, { laravelFramework: false });
    expect(laravelAdapter.detect(tmpDir)).toBe(false);
  });
});

describe("laravelAdapter.childEnv", () => {
  it("sets APP_URL, ASSET_URL, SERVER_PORT, and SERVER_HOST", () => {
    expect(
      laravelAdapter.childEnv({
        url: "https://myapp.localhost",
        port: 4321,
        host: "127.0.0.1",
        tls: true,
      })
    ).toEqual({
      APP_URL: "https://myapp.localhost",
      ASSET_URL: "https://myapp.localhost",
      SERVER_PORT: "4321",
      SERVER_HOST: "127.0.0.1",
    });
  });
});

describe("laravelAdapter.defaultCommand", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it("prefers a matching Composer script", () => {
    writeLaravelProject(tmpDir, { composerScripts: { dev: "php artisan serve" } });
    expect(laravelAdapter.defaultCommand!(tmpDir, "dev")).toEqual(["composer", "run", "dev"]);
  });

  it("falls back to php artisan serve when the Composer script is missing", () => {
    writeLaravelProject(tmpDir);
    expect(laravelAdapter.defaultCommand!(tmpDir, "dev")).toEqual(["php", "artisan", "serve"]);
  });
});

describe("resolveFrameworkDefaultCommand", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it("returns Composer run for a detected Laravel app with a script", () => {
    writeLaravelProject(tmpDir, { composerScripts: { serve: "php artisan serve" } });
    expect(resolveFrameworkDefaultCommand(tmpDir, "serve")).toEqual(["composer", "run", "serve"]);
  });

  it("returns null when no framework is detected", () => {
    expect(resolveFrameworkDefaultCommand(tmpDir, "dev")).toBeNull();
  });
});

describe("buildChildEnvOverrides", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it("includes core env vars", () => {
    const overrides = buildChildEnvOverrides({
      port: 4001,
      url: "https://app.localhost",
      host: "127.0.0.1",
      tlds: ["localhost"],
      tls: false,
      cwd: tmpDir,
    });
    expect(overrides).toMatchObject({
      PORT: "4001",
      HOST: "127.0.0.1",
      PORTLESS_URL: "https://app.localhost",
      __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: ".localhost",
    });
    expect(overrides.APP_URL).toBeUndefined();
  });

  it("merges Laravel env when detected", () => {
    writeLaravelProject(tmpDir);
    const overrides = buildChildEnvOverrides({
      port: 4001,
      url: "https://app.localhost",
      host: "127.0.0.1",
      tlds: ["localhost"],
      tls: false,
      cwd: tmpDir,
    });
    expect(overrides.APP_URL).toBe("https://app.localhost");
    expect(overrides.ASSET_URL).toBe("https://app.localhost");
    expect(overrides.SERVER_PORT).toBe("4001");
    expect(overrides.SERVER_HOST).toBe("127.0.0.1");
  });

  it("sets NODE_EXTRA_CA_CERTS when TLS and ca.pem exist", () => {
    fs.writeFileSync(path.join(tmpDir, "ca.pem"), "ca");
    const overrides = buildChildEnvOverrides({
      port: 4001,
      url: "https://app.localhost",
      host: "127.0.0.1",
      tlds: ["localhost"],
      tls: true,
      stateDir: tmpDir,
      cwd: tmpDir,
    });
    expect(overrides.NODE_EXTRA_CA_CERTS).toBe(path.join(tmpDir, "ca.pem"));
  });

  it("does not override an existing NODE_EXTRA_CA_CERTS", () => {
    fs.writeFileSync(path.join(tmpDir, "ca.pem"), "ca");
    const overrides = buildChildEnvOverrides({
      port: 4001,
      url: "https://app.localhost",
      host: "127.0.0.1",
      tlds: ["localhost"],
      tls: true,
      stateDir: tmpDir,
      cwd: tmpDir,
      existingCaCerts: "/custom/ca.pem",
    });
    expect(overrides.NODE_EXTRA_CA_CERTS).toBeUndefined();
  });

  it("omits HOST when host is undefined", () => {
    const overrides = buildChildEnvOverrides({
      port: 4001,
      url: "https://app.localhost",
      tlds: ["localhost"],
      tls: false,
      cwd: tmpDir,
    });
    expect(overrides.HOST).toBeUndefined();
  });
});

describe("buildChildEnv", () => {
  it("spreads base env and overrides", () => {
    const env = buildChildEnv(
      {
        port: 4001,
        url: "https://app.localhost",
        host: "127.0.0.1",
        tlds: ["localhost"],
        tls: false,
        cwd: os.tmpdir(),
      },
      { FOO: "bar", PATH: "/usr/bin" }
    );
    expect(env.FOO).toBe("bar");
    expect(env.PORT).toBe("4001");
    expect(env.PORTLESS_URL).toBe("https://app.localhost");
  });
});

describe("detectFrameworks with custom adapters", () => {
  it("merges env from all matching adapters", () => {
    const a: FrameworkAdapter = {
      id: "a",
      detect: () => true,
      childEnv: () => ({ A: "1" }),
    };
    const b: FrameworkAdapter = {
      id: "b",
      detect: () => true,
      childEnv: () => ({ B: "2" }),
    };
    const overrides = buildChildEnvOverrides({
      port: 1,
      url: "https://x.localhost",
      host: "127.0.0.1",
      tlds: ["localhost"],
      tls: false,
      cwd: os.tmpdir(),
      adapters: [a, b],
    });
    expect(overrides.A).toBe("1");
    expect(overrides.B).toBe("2");
  });
});

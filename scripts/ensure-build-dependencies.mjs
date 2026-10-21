import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const expectedVersions = {
  "@tanstack/react-router": "1.170.42",
  "@tanstack/react-start": "1.168.61",
  "@tanstack/router-plugin": "1.168.43",
};

function packageVersion(packageName) {
  const packagePath = join("node_modules", packageName, "package.json");

  if (!existsSync(packagePath)) return null;

  try {
    return JSON.parse(readFileSync(packagePath, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

function hasSerovalPluginExport() {
  const clientPath = join(
    "node_modules",
    "@tanstack",
    "router-core",
    "dist",
    "esm",
    "ssr",
    "client.js",
  );

  if (!existsSync(clientPath)) return false;

  return readFileSync(clientPath, "utf8").includes("makeSerovalPlugin");
}

function inspectDependencies() {
  const versions = Object.fromEntries(
    Object.keys(expectedVersions).map((packageName) => [
      packageName,
      packageVersion(packageName),
    ]),
  );

  const mismatches = Object.entries(expectedVersions)
    .filter(([packageName, expectedVersion]) => versions[packageName] !== expectedVersion)
    .map(([packageName, expectedVersion]) => {
      return `${packageName}: ${versions[packageName] ?? "missing"} (expected ${expectedVersion})`;
    });

  if (!hasSerovalPluginExport()) {
    mismatches.push("@tanstack/router-core: missing ssr/client makeSerovalPlugin export");
  }

  if (!packageVersion("vite")) {
    mismatches.push("vite: missing build dependency");
  }

  return { mismatches, versions };
}

function printVersions(versions) {
  console.log(
    `[build-preflight] TanStack versions: ${Object.entries(versions)
      .map(([packageName, version]) => `${packageName}=${version ?? "missing"}`)
      .join(", ")}`,
  );
}

let inspection = inspectDependencies();
printVersions(inspection.versions);

if (inspection.mismatches.length > 0) {
  console.warn(
    `[build-preflight] Stale dependency graph detected: ${inspection.mismatches.join("; ")}`,
  );
  console.warn("[build-preflight] Reinstalling from package-lock.json with npm ci.");

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    npmCommand,
    ["ci", "--include=dev", "--ignore-scripts"],
    {
      env: { ...process.env, npm_config_production: "false" },
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  inspection = inspectDependencies();
  printVersions(inspection.versions);
}

if (inspection.mismatches.length > 0) {
  console.error(
    `[build-preflight] Unable to validate production dependencies: ${inspection.mismatches.join("; ")}`,
  );
  process.exit(1);
}

console.log("[build-preflight] Dependency graph is ready for SSR build.");

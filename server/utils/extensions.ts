import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, basename, dirname, extname, resolve } from "node:path";
import { getAgentDir, hasTrustRequiringProjectResources } from "@earendil-works/pi-coding-agent";
import type { ExtensionEntry, ExtensionScope, ExtensionsResponse } from "#shared/lib/types";

const EXTENSIONS = new Set([".ts", ".js", ".mjs", ".cjs"]);
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

interface ScanOptions {
  agentDir?: string;
  projectTrusted?: boolean;
}

interface PackageManifest {
  name?: unknown;
  pi?: { extensions?: unknown };
}

function isExtensionFile(filePath: string): boolean {
  return EXTENSIONS.has(extname(filePath).toLowerCase());
}

function readManifest(dir: string): PackageManifest | null {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
  } catch {
    return null;
  }
}

function statusFor(scope: ExtensionScope, projectTrusted: boolean) {
  return scope === "project" && !projectTrusted ? "needs-trust" as const : "ready" as const;
}

function entryFromFile(filePath: string, scope: ExtensionScope, projectTrusted: boolean): ExtensionEntry {
  return {
    id: `${scope}:${filePath}`,
    name: basename(filePath, extname(filePath)),
    filePath,
    scope,
    kind: "file",
    status: statusFor(scope, projectTrusted),
  };
}

function entryFromPackage(dir: string, manifest: PackageManifest, scope: ExtensionScope, projectTrusted: boolean): ExtensionEntry {
  const name = typeof manifest.name === "string" && manifest.name ? manifest.name : basename(dir);
  return {
    id: `${scope}:${dir}`,
    name,
    filePath: dir,
    scope,
    kind: "package",
    status: statusFor(scope, projectTrusted),
  };
}

function scanRoot(root: string, scope: ExtensionScope, projectTrusted: boolean): ExtensionEntry[] {
  if (!existsSync(root)) return [];
  const entries: ExtensionEntry[] = [];
  for (const item of readdirSync(root, { withFileTypes: true })) {
    const itemPath = join(root, item.name);
    if (item.isFile() && isExtensionFile(item.name)) {
      entries.push(entryFromFile(itemPath, scope, projectTrusted));
      continue;
    }
    if (!item.isDirectory()) continue;
    const manifest = readManifest(itemPath);
    const index = ["index.ts", "index.js", "index.mjs", "index.cjs"]
      .map((name) => join(itemPath, name))
      .find(existsSync);
    const declaredExtensions = Array.isArray(manifest?.pi?.extensions) && manifest?.pi?.extensions.length > 0;
    if (manifest && (declaredExtensions || index)) {
      entries.push(entryFromPackage(itemPath, manifest, scope, projectTrusted));
      continue;
    }
    if (index) entries.push(entryFromFile(index, scope, projectTrusted));
  }
  return entries;
}

function normalizeTrustPath(path: string): string {
  const normalized = resolve(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

// 沿父目录向上找最近的信任决定 插件包管理等其他能力也依赖它判断 project 作用域是否可写
export function readTrustDecision(agentDir: string, cwd: string): boolean {
  const trustPath = join(agentDir, "trust.json");
  if (!existsSync(trustPath)) return false;
  try {
    const data = JSON.parse(readFileSync(trustPath, "utf8")) as Record<string, unknown>;
    let current = normalizeTrustPath(cwd);
    while (true) {
      const value = Object.entries(data).find(([key]) => normalizeTrustPath(key) === current)?.[1];
      if (value === true || value === false) return value;
      const parent = dirname(current);
      if (parent === current) return false;
      current = parent;
    }
  } catch {
    return false;
  }
}

// 只做静态目录扫描 不能为了列出扩展而执行项目代码
export function listExtensions(cwd: string, options: ScanOptions = {}): ExtensionsResponse {
  const agentDir = options.agentDir ?? getAgentDir();
  const trust = options.projectTrusted ?? readTrustDecision(agentDir, cwd);
  const extensions = [
    ...scanRoot(join(agentDir, "extensions"), "global", true),
    ...scanRoot(join(cwd, ".pi", "extensions"), "project", trust),
  ].sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.filePath, b.filePath));

  return {
    extensions,
    projectTrusted: trust,
    projectNeedsTrust: hasTrustRequiringProjectResources(cwd) && !trust,
  };
}

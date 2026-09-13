// 移植自 pi-web app/api/plugins/route.ts 的读取聚合与包动作逻辑 MIT License 按 CLAUDE.md 编码规范改写
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative } from "node:path";
import {
  DefaultPackageManager,
  getAgentDir,
  SettingsManager,
  type PackageSource,
  type ResolvedPaths,
  type ResolvedResource,
} from "@earendil-works/pi-coding-agent";
import type {
  PluginActionRequest,
  PluginDiagnostic,
  PluginPackageInfo,
  PluginResourceCounts,
  PluginResourceInfo,
  PluginResourceKind,
  PluginScope,
  PluginsResponse,
} from "#shared/lib/types";
import { readTrustDecision } from "./extensions";
import { isPluginSourceCheckable } from "./plugin-updates";

// 动作失败需要给前端区分状态码 项目未信任是 403 参数缺失是 400 其余按 500
export class PluginActionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

interface PackageKeyedMaps {
  countsByPackage: Map<string, PluginResourceCounts>;
  resourcesByPackage: Map<string, PluginResourceInfo[]>;
}

// 供 route 与测试构造同一套 manager 配置 project 未信任时 SettingsManager 会隔离项目级配置
const createManager = (cwd: string, agentDir?: string) => {
  const dir = agentDir ?? getAgentDir();
  const projectTrusted = readTrustDecision(dir, cwd);
  const settingsManager = SettingsManager.create(cwd, dir, {
    projectTrusted,
  });
  return {
    settingsManager,
    packageManager: new DefaultPackageManager({ cwd, agentDir: dir, settingsManager }),
    projectTrusted,
  };
};

const emptyCounts = (): PluginResourceCounts => ({
  extensions: 0,
  skills: 0,
  prompts: 0,
  themes: 0,
});

const toPluginScope = (scope: string): PluginScope => (scope === "project" ? "project" : "global");

// settings 里的包没有 id 字段 用 scope 加 source 拼出唯一键 与 pi-web 保持一致
const keyFor = (source: string, scope: PluginScope): string => `${scope}\0${source}`;

const getPackageSource = (entry: PackageSource): string =>
  typeof entry === "string" ? entry : entry.source;

// disable 的实现是把四类资源数组清空 所以四个数组同时为空就代表被禁用
const isDisabledPackage = (entry: PackageSource): boolean => {
  if (typeof entry === "string") return false;
  return (
    Array.isArray(entry.extensions) &&
    entry.extensions.length === 0 &&
    Array.isArray(entry.skills) &&
    entry.skills.length === 0 &&
    Array.isArray(entry.prompts) &&
    entry.prompts.length === 0 &&
    Array.isArray(entry.themes) &&
    entry.themes.length === 0
  );
};

const getDisabledPackages = (settingsManager: SettingsManager): Map<string, boolean> => {
  const disabled = new Map<string, boolean>();
  for (const entry of settingsManager.getGlobalSettings().packages ?? []) {
    disabled.set(keyFor(getPackageSource(entry), "global"), isDisabledPackage(entry));
  }
  for (const entry of settingsManager.getProjectSettings().packages ?? []) {
    disabled.set(keyFor(getPackageSource(entry), "project"), isDisabledPackage(entry));
  }
  return disabled;
};

// enable 时把对象条目还原成纯字符串 source 让 SDK 恢复默认资源选择
const setPackageDisabled = (
  settingsManager: SettingsManager,
  source: string,
  scope: PluginScope,
  disabled: boolean,
): boolean => {
  const current =
    scope === "project"
      ? (settingsManager.getProjectSettings().packages ?? [])
      : (settingsManager.getGlobalSettings().packages ?? []);
  let changed = false;
  const next = current.map((entry): PackageSource => {
    if (getPackageSource(entry) !== source) return entry;
    changed = true;
    if (disabled) {
      return {
        ...(typeof entry === "string" ? { source: entry } : entry),
        extensions: [],
        skills: [],
        prompts: [],
        themes: [],
      };
    }
    return getPackageSource(entry);
  });
  if (!changed) return false;
  if (scope === "project") settingsManager.setProjectPackages(next);
  else settingsManager.setPackages(next);
  return true;
};

// skill.md 与 extension 的 index.ts 语义上属于所在目录 不用文件名
const getResourceName = (path: string, kind: PluginResourceKind): string => {
  const file = basename(path);
  const ext = extname(file);
  if (kind === "skill" && file.toLowerCase() === "skill.md") return basename(dirname(path));
  if ((kind === "extension" || kind === "theme" || kind === "prompt") && ext) {
    if (kind === "extension" && /^index\.(ts|js)$/.test(file)) return basename(dirname(path));
    return file.slice(0, -ext.length);
  }
  return file;
};

const getRelativePath = (resource: ResolvedResource): string => {
  const baseDir = resource.metadata.baseDir;
  if (!baseDir) return resource.path;
  const rel = relative(baseDir, resource.path);
  return rel && !rel.startsWith("..") ? rel : resource.path;
};

// npm:pkg@1.2.3 取末尾版本 git 与 url 来源取末尾 @ 之后 scoped npm 包要跳过首个 @
const getConfiguredVersion = (source: string): string | undefined => {
  const npmSpec = source.startsWith("npm:") ? source.slice(4) : undefined;
  if (npmSpec) {
    const lastAt = npmSpec.lastIndexOf("@");
    const packageNameEnd = npmSpec.startsWith("@") ? npmSpec.indexOf("/", 1) : 0;
    if (lastAt > packageNameEnd) return npmSpec.slice(lastAt + 1) || undefined;
    return undefined;
  }

  if (source.startsWith("git:") || /^[a-z]+:\/\//.test(source)) {
    const lastAt = source.lastIndexOf("@");
    const lastSlash = source.lastIndexOf("/");
    const lastColon = source.lastIndexOf(":");
    if (lastAt > Math.max(lastSlash, lastColon)) return source.slice(lastAt + 1) || undefined;
  }
  return undefined;
};

const readPackageMetadata = (
  installedPath?: string,
): { packageName?: string; version?: string } => {
  if (!installedPath) return {};
  try {
    const stats = statSync(installedPath);
    const packageJsonPath = stats.isDirectory()
      ? join(installedPath, "package.json")
      : join(dirname(installedPath), "package.json");
    if (!existsSync(packageJsonPath)) return {};
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: unknown;
      version?: unknown;
    };
    return {
      packageName: typeof parsed.name === "string" ? parsed.name : undefined,
      version: typeof parsed.version === "string" ? parsed.version : undefined,
    };
  } catch {
    return {};
  }
};

const addCount = (counts: PluginResourceCounts, kind: keyof PluginResourceCounts): void => {
  counts[kind] += 1;
};

// 只统计 enabled 且 origin 为 package 的资源 top-level 目录资源不属于任何包
const collectResource = (
  resource: ResolvedResource,
  kind: keyof PluginResourceCounts,
  maps: PackageKeyedMaps,
  totals: PluginResourceCounts,
): void => {
  if (!resource.enabled || resource.metadata.origin !== "package") return;
  const source = resource.metadata.source;
  const scope = toPluginScope(resource.metadata.scope);
  const key = keyFor(source, scope);
  const counts = maps.countsByPackage.get(key) ?? emptyCounts();
  addCount(counts, kind);
  addCount(totals, kind);
  maps.countsByPackage.set(key, counts);
  const resources = maps.resourcesByPackage.get(key) ?? [];
  const resourceKind: PluginResourceKind =
    kind === "extensions"
      ? "extension"
      : kind === "skills"
        ? "skill"
        : kind === "prompts"
          ? "prompt"
          : "theme";
  resources.push({
    kind: resourceKind,
    name: getResourceName(resource.path, resourceKind),
    path: resource.path,
    relativePath: getRelativePath(resource),
  });
  maps.resourcesByPackage.set(key, resources);
};

const collectResources = (
  paths: ResolvedPaths,
): PackageKeyedMaps & { totals: PluginResourceCounts } => {
  const maps: PackageKeyedMaps = {
    countsByPackage: new Map(),
    resourcesByPackage: new Map(),
  };
  const totals = emptyCounts();
  for (const resource of paths.extensions) collectResource(resource, "extensions", maps, totals);
  for (const resource of paths.skills) collectResource(resource, "skills", maps, totals);
  for (const resource of paths.prompts) collectResource(resource, "prompts", maps, totals);
  for (const resource of paths.themes) collectResource(resource, "themes", maps, totals);
  return { ...maps, totals };
};

// 只做静态解析与元数据读取 resolve 阶段不会执行包内代码
export const readPlugins = async (cwd: string): Promise<PluginsResponse> => {
  const { settingsManager, packageManager, projectTrusted } = createManager(cwd);

  const diagnostics: PluginDiagnostic[] = [];
  let maps: PackageKeyedMaps = { countsByPackage: new Map(), resourcesByPackage: new Map() };
  let totals: PluginResourceCounts = emptyCounts();
  const disabledByPackage = getDisabledPackages(settingsManager);

  try {
    const resolved = await packageManager.resolve(async (source) => {
      diagnostics.push({
        type: "warning",
        source,
        message: "Package is configured but not installed yet.",
      });
      return "skip";
    });
    const collected = collectResources(resolved);
    maps = {
      countsByPackage: collected.countsByPackage,
      resourcesByPackage: collected.resourcesByPackage,
    };
    totals = collected.totals;
  } catch (error) {
    diagnostics.push({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const packages = packageManager.listConfiguredPackages().map((pkg): PluginPackageInfo => {
    const scope = toPluginScope(pkg.scope);
    const key = keyFor(pkg.source, scope);
    const disabled = disabledByPackage.get(key) ?? false;
    const counts = maps.countsByPackage.get(key) ?? emptyCounts();
    const resources = maps.resourcesByPackage.get(key) ?? [];
    const resourceCount = counts.extensions + counts.skills + counts.prompts + counts.themes;
    const packageMetadata = readPackageMetadata(pkg.installedPath);
    if (!pkg.installedPath) {
      diagnostics.push({
        type: "warning",
        source: pkg.source,
        message: "Configured package path was not found.",
      });
    }
    return {
      source: pkg.source,
      scope,
      canCheckForUpdates: isPluginSourceCheckable(pkg.source),
      filtered: pkg.filtered,
      disabled,
      installedPath: pkg.installedPath,
      packageName: packageMetadata.packageName,
      version: packageMetadata.version,
      configuredVersion: getConfiguredVersion(pkg.source),
      counts,
      resources,
      status: disabled
        ? "disabled"
        : resourceCount > 0
          ? "loaded"
          : pkg.installedPath
            ? "installed"
            : "missing",
    };
  });

  return {
    packages,
    totals,
    diagnostics,
    projectResourcesLoaded: projectTrusted,
  };
};

// SDK 把 settings 里的本地来源按 agentDir 或项目 .pi 为基准归一化成相对路径
// 但 remove 的输入匹配按 manager 的 cwd 解析 直接回传相对串会解析错位置导致静默不删
const resolvePersistSource = (source: string, cwd: string, projectScope: boolean): string => {
  if (
    source.startsWith("~") ||
    /^(npm:|git:|github:|http:|https:|ssh:)/i.test(source) ||
    isAbsolute(source)
  ) {
    return source;
  }
  const base = projectScope ? join(cwd, ".pi") : getAgentDir();
  return join(base, source);
};

// 包变更动作的统一入口 route 只负责参数校验与状态码映射
export const runPluginAction = async (request: PluginActionRequest): Promise<PluginsResponse> => {
  const { cwd, action, source, scope } = request;
  const trimmed = source?.trim();
  const projectScope = scope === "project";
  const { settingsManager, packageManager, projectTrusted } = createManager(cwd);

  if (projectScope && !projectTrusted) {
    throw new PluginActionError(
      "Project resources must be trusted before modifying project plugins",
      403,
    );
  }

  if (action === "install") {
    if (!trimmed) throw new PluginActionError("source is required", 400);
    await packageManager.installAndPersist(trimmed, { local: projectScope });
  } else if (action === "remove") {
    if (!trimmed) throw new PluginActionError("source is required", 400);
    await packageManager.removeAndPersist(resolvePersistSource(trimmed, cwd, projectScope), {
      local: projectScope,
    });
  } else if (action === "update") {
    // 全量更新会触及 project 包 未信任时拒绝而不是静默跳过
    if (
      !trimmed &&
      !projectTrusted &&
      packageManager.listConfiguredPackages().some((pkg) => pkg.scope === "project")
    ) {
      throw new PluginActionError(
        "Project resources must be trusted before updating project plugins",
        403,
      );
    }
    await packageManager.update(trimmed || undefined);
  } else if (action === "disable") {
    if (!trimmed) throw new PluginActionError("source is required", 400);
    setPackageDisabled(settingsManager, trimmed, scope ?? "global", true);
    await settingsManager.flush();
  } else if (action === "enable") {
    if (!trimmed) throw new PluginActionError("source is required", 400);
    setPackageDisabled(settingsManager, trimmed, scope ?? "global", false);
    await settingsManager.flush();
  } else {
    throw new PluginActionError(`Unsupported action: ${String(action)}`, 400);
  }

  return readPlugins(cwd);
};

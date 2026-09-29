// 目录浏览的路径处理 列出本机目录供工作区选择
// Windows 与类 Unix 路径规则不同 判断父目录时按平台选 win32 或 posix 规则

import { readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, posix, resolve, win32 } from "node:path";

export interface BrowsableDirectory {
  name: string;
  path: string;
}

// Windows 且未指定起始目录时先让用户选盘符
export function shouldShowWindowsDrivePicker(directory?: string): boolean {
  return process.platform === "win32" && !directory;
}

// 未指定目录时从用户主目录开始浏览
export function getBrowseStartDirectory(directory?: string): string {
  return directory || homedir();
}

// 枚举 A 到 Z 的盘符候选 是否存在交给 stat 判定
export function getWindowsDriveCandidates(): BrowsableDirectory[] {
  return Array.from({ length: 26 }, (_, index) => {
    const letter = String.fromCharCode("A".charCodeAt(0) + index);
    return { name: `${letter}:`, path: `${letter}:\\` };
  });
}

// 过滤出真实存在的盘符 挂载缺失的盘 stat 会抛错
export async function listWindowsDrives(): Promise<BrowsableDirectory[]> {
  const drives = await Promise.all(
    getWindowsDriveCandidates().map(async (drive) => {
      try {
        return (await stat(drive.path)).isDirectory() ? drive : null;
      } catch {
        return null;
      }
    }),
  );

  return drives.filter((drive): drive is BrowsableDirectory => drive !== null);
}

// 展开 ~ 与相对路径 转成绝对路径
export function normalizeDirectory(directory: string): string {
  if (directory === "~") return homedir();
  if (directory.startsWith("~/")) return resolve(homedir(), directory.slice(2));
  return resolve(directory);
}

// 返回父目录 盘符根与文件系统根没有父目录返回 null
// win32 规则处理盘符与反斜杠 UNC 路径 其余按 posix 规则
export function getParentDirectory(directory: string): string | null {
  const pathApi = /^[a-zA-Z]:[\\/]/.test(directory) || directory.startsWith("\\\\") ? win32 : posix;
  const normalized = pathApi.normalize(directory);
  const parent = pathApi.dirname(normalized);
  return parent === normalized ? null : parent;
}

// realpath 消解符号链接并归一化 返回磁盘真实路径
export async function resolveDirectory(directory: string): Promise<string> {
  return realpath(normalizeDirectory(directory));
}

// 列出子目录 符号链接目录先 realpath 再 stat 确认仍是目录 坏链与指向文件的链接不列出
export async function listDirectories(directory: string): Promise<BrowsableDirectory[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const directories = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory()) return { name: entry.name, path: join(directory, entry.name) };
      if (!entry.isSymbolicLink()) return null;

      try {
        const entryPath = join(directory, entry.name);
        // 符号链接指向的目标可能是文件或坏链 跟随解析后再判定
        return (await stat(await realpath(entryPath))).isDirectory()
          ? { name: entry.name, path: entryPath }
          : null;
      } catch {
        return null;
      }
    }),
  );

  return directories
    .filter((directory): directory is BrowsableDirectory => directory !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}

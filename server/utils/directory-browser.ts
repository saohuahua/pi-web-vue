import { readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, posix, resolve, win32 } from "node:path";

export interface BrowsableDirectory {
  name: string;
  path: string;
}

export function shouldShowWindowsDrivePicker(directory?: string): boolean {
  return process.platform === "win32" && !directory;
}

export function getBrowseStartDirectory(directory?: string): string {
  return directory || homedir();
}

export function getWindowsDriveCandidates(): BrowsableDirectory[] {
  return Array.from({ length: 26 }, (_, index) => {
    const letter = String.fromCharCode("A".charCodeAt(0) + index);
    return { name: `${letter}:`, path: `${letter}:\\` };
  });
}

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

export function normalizeDirectory(directory: string): string {
  if (directory === "~") return homedir();
  if (directory.startsWith("~/")) return resolve(homedir(), directory.slice(2));
  return resolve(directory);
}

export function getParentDirectory(directory: string): string | null {
  const pathApi = /^[a-zA-Z]:[\\/]/.test(directory) || directory.startsWith("\\\\") ? win32 : posix;
  const normalized = pathApi.normalize(directory);
  const parent = pathApi.dirname(normalized);
  return parent === normalized ? null : parent;
}

export async function resolveDirectory(directory: string): Promise<string> {
  return realpath(normalizeDirectory(directory));
}

export async function listDirectories(directory: string): Promise<BrowsableDirectory[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const directories = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory()) return { name: entry.name, path: join(directory, entry.name) };
      if (!entry.isSymbolicLink()) return null;

      try {
        const entryPath = join(directory, entry.name);
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

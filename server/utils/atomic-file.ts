// Ported from pi-web lib/atomic-file.ts — https://github.com/agegr/pi-web (MIT)
// 原子替换文件内容 临时文件完整写盘后再 rename 避免读端拿到半截 json
// 调用方需保证父目录已存在

import { randomUUID } from "node:crypto";
import { renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export const writePrivateFileAtomicSync = (path: string, contents: string): void => {
  const dir = dirname(path);
  const tempPath = join(dir, `.${basename(path)}-${randomUUID()}.tmp`);
  let operationFailed = false;

  try {
    writeFileSync(tempPath, contents, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
      flush: true,
    });
    renameSync(tempPath, path);
  } catch (error) {
    operationFailed = true;
    throw error;
  } finally {
    try {
      unlinkSync(tempPath);
    } catch (error) {
      // rename 成功后临时文件已不存在 只有关联失败才向上抛清理异常
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !operationFailed) {
        throw error;
      }
    }
  }
};

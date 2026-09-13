// 多个 pi 进程共享 ~/.pi/agent 时 proper-lockfile 的锁目录在 Windows 上有 mkdir/rmdir 竞态
// 抛出的 EPERM 并不是真正的权限问题 只是瞬时冲突 锁都是短生命周期的 重试就能拿到
// pi CLI 与 pi-web 共享同一份配置是常态 本侧自行重试对它们零影响

import {
  createAgentSessionServices,
  getAgentDir,
  type AgentSessionServices,
  type CreateAgentSessionServicesOptions,
} from "@earendil-works/pi-coding-agent";

const LOCK_RETRY_LIMIT = 5;
const LOCK_RETRY_BASE_MS = 150;

// 只匹配锁路径上的文件系统错误 其他错误原样抛出避免掩盖真实故障
const isTransientLockError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /\.lock/.test(message) && /(EPERM|EACCES|EEXIST|ENOTEMPTY|EBUSY)/.test(message);
};

export const createAgentServicesWithRetry = async (options: {
  cwd: string;
  settingsManager?: CreateAgentSessionServicesOptions["settingsManager"];
}): Promise<AgentSessionServices> => {
  const agentDir = getAgentDir();

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await createAgentSessionServices({ ...options, agentDir });
    } catch (error) {
      if (attempt >= LOCK_RETRY_LIMIT || !isTransientLockError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_BASE_MS * 2 ** attempt));
    }
  }
};

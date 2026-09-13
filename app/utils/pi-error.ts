// pi SDK 的凭证锁在多进程共享 ~/.pi/agent 时偶发 Windows 竞态
// 裸 EPERM 报错对用户没有可行动信息 统一映射成可行动的提示

const LOCK_ERROR_PATTERN = /\.lock/;
const LOCK_ERRNO_PATTERN = /EPERM|EACCES|EEXIST|ENOTEMPTY|EBUSY/;

export const friendlyAgentError = (message: string): string => {
  if (LOCK_ERROR_PATTERN.test(message) && LOCK_ERRNO_PATTERN.test(message)) {
    return "模型配置正被其他 pi 进程占用 请稍后重试";
  }
  return message;
};

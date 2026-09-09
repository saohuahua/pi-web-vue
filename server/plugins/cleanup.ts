import { destroyAllRpcSessions } from "../utils/rpc-manager";

// 进程退出时销毁全部 wrapper 让 SDK 有机会落盘清理
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("close", () => destroyAllRpcSessions());
});

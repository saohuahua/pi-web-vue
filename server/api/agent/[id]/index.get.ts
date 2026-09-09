import { getRpcSession } from "../../../utils/rpc-manager";

// 单个会话的运行状态 wrapper 不存在或不存活时返回 running false
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const wrapper = getRpcSession(id);
  if (!wrapper?.isAlive()) return { running: false };
  return { running: true, state: await wrapper.send({ type: "get_state" }) };
});

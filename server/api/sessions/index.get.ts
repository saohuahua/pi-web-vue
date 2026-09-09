import { listSessions } from "../../utils/session-reader";

// 会话列表 ?force=1 跳过缓存
export default defineEventHandler((event) => {
  const force = getQuery(event).force === "1";
  return { sessions: listSessions(force) };
});

import type { SessionContext, SessionDetailResponse } from "./types";

export const fetchSessionDetail = async (id: string): Promise<SessionDetailResponse> => {
  const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`会话加载失败 ${response.status}`);
  return response.json() as Promise<SessionDetailResponse>;
};

export const previewSessionContext = async (
  id: string,
  leafId: string,
): Promise<SessionContext> => {
  const response = await fetch(
    `/api/sessions/${encodeURIComponent(id)}/context?leafId=${encodeURIComponent(leafId)}`,
  );
  if (!response.ok) throw new Error(`目标分支加载失败 ${response.status}`);
  const body = (await response.json()) as { context: SessionContext };
  return body.context;
};

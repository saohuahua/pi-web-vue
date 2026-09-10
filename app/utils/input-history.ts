// 输入历史 只存成功提交的文本 不存图片 base64 与系统生成内容
// 上/下方向键在输入为空或光标边界时翻阅 避免干扰中文输入法

const HISTORY_KEY = "pi-agent:input-history";
const MAX_HISTORY = 50;

export function loadInputHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

// 连续重复只在栈顶保留一条 push 后最新在末尾
export function pushInputHistory(history: string[], text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return history;
  const next = history.filter((v) => v !== trimmed);
  next.push(trimmed);
  const capped = next.slice(-MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(capped));
  } catch {
    // 存储满或被禁用 忽略
  }
  return capped;
}

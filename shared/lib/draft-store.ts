export interface StoredDraft {
  text: string;
  updatedAt: number;
  editingMessageId?: string;
}

const STORAGE_KEY = "pi-agent:drafts:v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export class DraftStore {
  private readonly memory = new Map<string, StoredDraft>();
  private unavailable = false;
  private warned = false;

  constructor(
    private readonly storage: () => Pick<Storage, "getItem" | "setItem" | "removeItem">,
    private readonly onWarning: (message: string) => void = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  private warn(message: string) {
    if (this.warned) return;
    this.warned = true;
    this.onWarning(message);
  }

  private readAll(): Record<string, StoredDraft> {
    if (this.unavailable) return Object.fromEntries(this.memory);
    try {
      const raw = this.storage().getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("invalid drafts");
      const result: Record<string, StoredDraft> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const candidate = value as Record<string, unknown>;
        if (typeof candidate.text !== "string" || typeof candidate.updatedAt !== "number") continue;
        if (this.now() - candidate.updatedAt > MAX_AGE_MS) continue;
        result[key] = {
          text: candidate.text,
          updatedAt: candidate.updatedAt,
          ...(typeof candidate.editingMessageId === "string"
            ? { editingMessageId: candidate.editingMessageId }
            : {}),
        };
      }
      return result;
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        (error instanceof Error && error.message === "invalid drafts")
      ) {
        try {
          this.storage().removeItem(STORAGE_KEY);
        } catch {
          this.unavailable = true;
        }
        this.warn("草稿数据已损坏 已重新开始保存");
        return {};
      }
      this.unavailable = true;
      this.warn("浏览器存储不可用 草稿仅在当前页面保留");
      return Object.fromEntries(this.memory);
    }
  }

  get(key: string): StoredDraft | null {
    const item = this.readAll()[key];
    return item ? { ...item } : null;
  }

  set(key: string, text: string, editingMessageId?: string): void {
    const all = this.readAll();
    if (!text && !editingMessageId) delete all[key];
    else
      all[key] = { text, updatedAt: this.now(), ...(editingMessageId ? { editingMessageId } : {}) };
    if (this.unavailable) {
      this.memory.clear();
      for (const [id, item] of Object.entries(all)) this.memory.set(id, item);
      return;
    }
    try {
      this.storage().setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      this.unavailable = true;
      this.memory.clear();
      for (const [id, item] of Object.entries(all)) this.memory.set(id, item);
      this.warn("浏览器存储不可用 草稿仅在当前页面保留");
    }
  }
}

export const mergeDraftText = (submitted: string, current: string): string => {
  if (!submitted.trim()) return current;
  if (!current.trim()) return submitted;
  return `${submitted}\n\n${current}`;
};

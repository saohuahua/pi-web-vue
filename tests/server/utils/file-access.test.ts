import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";

vi.mock("#server/utils/session-reader", () => ({ listSessions: vi.fn(async () => []) }));

beforeEach(() => vi.resetModules());

describe("file root authorization", () => {
  it("授权新目录后立即刷新已存在的缓存", async () => {
    const access = await import("#server/utils/file-access");
    const root = resolve("new-authorized-workspace");
    expect((await access.getAllowedFileRoots()).has(root)).toBe(false);
    access.allowFileRoot(root);
    expect((await access.getAllowedFileRoots()).has(root)).toBe(true);
  });

  it("扫描会话期间新增的授权不会被旧扫描覆盖", async () => {
    const { listSessions } = await import("#server/utils/session-reader");
    const pending = Promise.withResolvers<Awaited<ReturnType<typeof listSessions>>>();
    vi.mocked(listSessions).mockReturnValueOnce(pending.promise);
    const access = await import("#server/utils/file-access");
    const root = resolve("concurrent-authorized-workspace");
    const scan = access.getAllowedFileRoots();
    access.allowFileRoot(root);
    pending.resolve([]);
    expect((await scan).has(root)).toBe(true);
    expect((await access.getAllowedFileRoots()).has(root)).toBe(true);
  });
});

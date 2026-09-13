import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAgentServicesWithRetry } from "#server/utils/agent-services";

const LOCK_ERROR =
  "EPERM: operation not permitted, mkdir 'C:\\Users\\x\\.pi\\agent\\auth.json.lock'";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSessionServices: createMock,
  getAgentDir: () => "C:\\fake\\agent",
}));

describe("createAgentServicesWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("锁竞争错误自动重试直到成功", async () => {
    createMock.mockRejectedValueOnce(new Error(LOCK_ERROR));
    createMock.mockResolvedValueOnce({ ok: true });

    const pending = createAgentServicesWithRetry({ cwd: "C:/proj" });
    await expect(vi.runAllTimersAsync().then(() => pending)).resolves.toEqual({ ok: true });
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenCalledWith({ cwd: "C:/proj", agentDir: "C:\\fake\\agent" });
  });

  it("重试耗尽后原样抛出 锁错误不吞", async () => {
    createMock.mockRejectedValue(new Error(LOCK_ERROR));

    const pending = createAgentServicesWithRetry({ cwd: "C:/proj" });
    await expect(vi.runAllTimersAsync().then(() => pending)).rejects.toThrow(LOCK_ERROR);
  });

  it("非锁错误不重试 直接抛出", async () => {
    createMock.mockRejectedValueOnce(new Error("boom"));
    createMock.mockResolvedValueOnce({ ok: true });

    await expect(createAgentServicesWithRetry({ cwd: "C:/proj" })).rejects.toThrow("boom");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("透传 settingsManager 选项", async () => {
    createMock.mockResolvedValueOnce({ ok: true });
    const settingsManager = { foo: 1 };

    await createAgentServicesWithRetry({
      cwd: "C:/proj",
      settingsManager: settingsManager as never,
    });

    expect(createMock).toHaveBeenCalledWith({
      cwd: "C:/proj",
      settingsManager,
      agentDir: "C:\\fake\\agent",
    });
  });
});

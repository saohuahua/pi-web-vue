import type { Ref } from "vue";
import { sendAgentCommand } from "#shared/lib/agent-client";
import type { QueueMessages } from "./usePromptQueue";

interface RuntimeDependencies {
  sessionId: Ref<string | null>;
  model: Ref<{ provider: string; id: string } | null>;
  thinkingLevel: Ref<string>;
  isCompacting: Ref<boolean>;
  contextUsage: Ref<{
    percent: number | null;
    contextWindow: number;
    tokens: number | null;
  } | null>;
  slashCommands: Ref<Array<{ name: string; description: string; source: string }>>;
  generation(): number;
  queueVersion(): number;
  applyQueueSnapshot(messages: QueueMessages, version: number): void;
  notice(message: string): void;
}

export const useSessionRuntime = (dependencies: RuntimeDependencies) => {
  let runtimeInfoLoadedFor: string | null = null;

  // 运行态快照可能晚于 SSE 队列事件 返回时只能覆盖同一版本的队列
  const refreshRuntimeState = async () => {
    const id = dependencies.sessionId.value;
    if (!id) return;
    const generation = dependencies.generation();
    const version = dependencies.queueVersion();
    try {
      const state = await sendAgentCommand<{
        model?: { id: string; provider: string };
        thinkingLevel?: string;
        isCompacting?: boolean;
        queuedMessages?: QueueMessages;
        contextUsage?: {
          percent: number | null;
          contextWindow: number;
          tokens: number | null;
        } | null;
      }>(id, { type: "get_state" });
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation()) return;
      if (state.model)
        dependencies.model.value = { provider: state.model.provider, id: state.model.id };
      if (typeof state.thinkingLevel === "string")
        dependencies.thinkingLevel.value = state.thinkingLevel;
      if (typeof state.isCompacting === "boolean")
        dependencies.isCompacting.value = state.isCompacting;
      dependencies.contextUsage.value = state.contextUsage ?? null;
      if (state.queuedMessages) dependencies.applyQueueSnapshot(state.queuedMessages, version);
    } catch {
      // wrapper 未起或刚被回收 下次事件会重新获取运行态
    }
  };

  const fetchRuntimeInfo = async () => {
    const id = dependencies.sessionId.value;
    if (!id || runtimeInfoLoadedFor === id) return;
    const generation = dependencies.generation();
    try {
      const commands = await sendAgentCommand<{
        commands: Array<{ name: string; description: string; source: string }>;
      }>(id, { type: "get_commands" });
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation()) return;
      dependencies.slashCommands.value = commands.commands ?? [];
      runtimeInfoLoadedFor = id;
    } catch {
      // 命令面板非关键路径 失败后可在下次打开时重试
    }
  };

  const setModel = async (provider: string, modelId: string): Promise<boolean> => {
    const id = dependencies.sessionId.value;
    if (!id) return false;
    const generation = dependencies.generation();
    try {
      await sendAgentCommand(id, { type: "set_model", provider, modelId });
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation())
        return false;
      dependencies.model.value = { provider, id: modelId };
      void refreshRuntimeState();
      return true;
    } catch (error) {
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation())
        return false;
      dependencies.notice(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  const setThinkingLevel = async (level: string): Promise<boolean> => {
    const id = dependencies.sessionId.value;
    if (!id) return false;
    const generation = dependencies.generation();
    try {
      await sendAgentCommand(id, { type: "set_thinking_level", level });
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation())
        return false;
      dependencies.thinkingLevel.value = level;
      return true;
    } catch (error) {
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation())
        return false;
      dependencies.notice(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  // 压缩结果由事件落定 HTTP 接纳不代表压缩结束
  const compact = async () => {
    const id = dependencies.sessionId.value;
    if (!id || dependencies.isCompacting.value) return;
    const generation = dependencies.generation();
    dependencies.isCompacting.value = true;
    try {
      await sendAgentCommand(id, { type: "compact" });
    } catch (error) {
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation()) return;
      dependencies.isCompacting.value = false;
      dependencies.notice(error instanceof Error ? error.message : String(error));
    }
  };

  const abortCompaction = async () => {
    const id = dependencies.sessionId.value;
    if (!id) return;
    const generation = dependencies.generation();
    try {
      await sendAgentCommand(id, { type: "abort_compaction" });
    } catch (error) {
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation()) return;
      dependencies.notice(error instanceof Error ? error.message : String(error));
    }
  };

  const reset = () => {
    runtimeInfoLoadedFor = null;
  };

  return {
    refreshRuntimeState,
    fetchRuntimeInfo,
    setModel,
    setThinkingLevel,
    compact,
    abortCompaction,
    reset,
  };
};

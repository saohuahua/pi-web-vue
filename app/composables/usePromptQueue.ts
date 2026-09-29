import { ref, toRaw, type Ref } from "vue";
import { AgentCommandError, sendAgentCommand } from "#shared/lib/agent-client";
import { mergeDraftText } from "#shared/lib/draft-store";
import type { AttachedImage } from "#shared/lib/types";

export interface QueueMessages {
  steering: string[];
  followUp: string[];
}

interface QueueDependencies {
  sessionId: Ref<string | null>;
  isRunning: Ref<boolean>;
  isStopping: Ref<boolean>;
  positionUnknown: Ref<boolean>;
  draft: Ref<string>;
  attachedImages: Ref<AttachedImage[]>;
  generation(): number;
  ensureConnected(id: string): Promise<void>;
  reserveDraft(id: string, text: string): boolean;
  settleDraft(id: string, text: string, accepted: boolean): void;
  persistDraft(): void;
  notice(message: string): void;
  refreshRuntimeState(): Promise<void>;
}

export const usePromptQueue = (dependencies: QueueDependencies) => {
  const queuedMessages = ref<QueueMessages>({ steering: [], followUp: [] });
  const queueSubmitting = ref(false);
  const queueActionPending = ref(false);
  let version = 0;

  const applyUpdate = (messages: QueueMessages) => {
    version += 1;
    queuedMessages.value = {
      steering: [...messages.steering],
      followUp: [...messages.followUp],
    };
  };

  const applySnapshot = (messages: QueueMessages, requestedAtVersion: number) => {
    if (requestedAtVersion === version) applyUpdate(messages);
  };

  const reset = () => {
    applyUpdate({ steering: [], followUp: [] });
    queueSubmitting.value = false;
    queueActionPending.value = false;
  };

  // SDK 在接纳时判断入队或开启新轮 前端不根据过时的运行状态猜测
  const submitQueuedPrompt = async (
    text: string,
    behavior: "steer" | "followUp",
    images = [...dependencies.attachedImages.value],
  ): Promise<boolean | null> => {
    const id = dependencies.sessionId.value;
    const generation = dependencies.generation();
    if (
      !id ||
      !dependencies.isRunning.value ||
      dependencies.isStopping.value ||
      queueSubmitting.value ||
      queueActionPending.value ||
      dependencies.positionUnknown.value
    )
      return false;
    if (!text.trim() && images.length === 0) return false;
    if (!dependencies.reserveDraft(id, text)) return false;
    queueSubmitting.value = true;
    try {
      await dependencies.ensureConnected(id);
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation())
        return null;
      await sendAgentCommand(id, {
        type: "prompt",
        message: text.trim(),
        streamingBehavior: behavior,
        ...(images.length
          ? { images: images.map(({ data, mimeType }) => ({ type: "image", data, mimeType })) }
          : {}),
      });
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation())
        return null;
      const sentImages = images.map((image) => toRaw(image));
      dependencies.attachedImages.value = dependencies.attachedImages.value.filter(
        (image) => !sentImages.includes(toRaw(image)),
      );
      dependencies.settleDraft(id, text, true);
      return true;
    } catch (error) {
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation())
        return null;
      dependencies.settleDraft(id, text, false);
      if (error instanceof AgentCommandError) dependencies.notice(error.message);
      else {
        dependencies.notice("排队结果未确认 请先核对队列再重试");
        void dependencies.refreshRuntimeState();
      }
      return false;
    } finally {
      if (generation === dependencies.generation()) queueSubmitting.value = false;
    }
  };

  // Pi 只支持清空全部队列 仅恢复 SDK 实际返回且尚未消费的文字
  const recallQueue = async (): Promise<boolean> => {
    const id = dependencies.sessionId.value;
    const generation = dependencies.generation();
    if (!id || queueActionPending.value) return false;
    const requestedAtVersion = version;
    queueActionPending.value = true;
    try {
      const removed = await sendAgentCommand<QueueMessages>(id, { type: "clear_queue" });
      if (dependencies.sessionId.value !== id || generation !== dependencies.generation())
        return false;
      const text = [...removed.steering, ...removed.followUp].join("\n\n");
      dependencies.draft.value = mergeDraftText(text, dependencies.draft.value);
      applySnapshot({ steering: [], followUp: [] }, requestedAtVersion);
      dependencies.persistDraft();
      return true;
    } catch (error) {
      if (dependencies.sessionId.value === id && generation === dependencies.generation())
        dependencies.notice(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      if (dependencies.sessionId.value === id && generation === dependencies.generation())
        queueActionPending.value = false;
    }
  };

  return {
    queuedMessages,
    queueSubmitting,
    queueActionPending,
    version: () => version,
    applyUpdate,
    applySnapshot,
    reset,
    submitQueuedPrompt,
    recallQueue,
  };
};

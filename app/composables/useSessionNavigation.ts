import { ref, type Ref } from "vue";
import { sendAgentCommand } from "#shared/lib/agent-client";
import { previewSessionContext } from "#shared/lib/session-client";
import type { SessionInfo } from "#shared/lib/types";

interface NavigationDependencies {
  sessionId: Ref<string | null>;
  activeLeafId: Ref<string | null>;
  isRunning: Ref<boolean>;
  isCompacting: Ref<boolean>;
  generation(): number;
  invalidateReload(): void;
  reload(): Promise<SessionInfo | null>;
  notice(message: string): void;
}

export const useSessionNavigation = (dependencies: NavigationDependencies) => {
  const isNavigating = ref(false);
  const positionUnknown = ref(false);
  const navigationError = ref<string | null>(null);

  const reset = () => {
    isNavigating.value = false;
    positionUnknown.value = false;
    navigationError.value = null;
  };

  // 先预览再导航 防止无效目标改变服务端分支
  // 导航之后只信权威详情 失败时尽量回到原叶子
  const navigateToLeaf = async (targetId: string): Promise<boolean> => {
    const id = dependencies.sessionId.value;
    if (
      !id ||
      !targetId ||
      dependencies.isRunning.value ||
      dependencies.isCompacting.value ||
      isNavigating.value ||
      positionUnknown.value
    )
      return false;
    if (targetId === dependencies.activeLeafId.value) return true;
    const previous = dependencies.activeLeafId.value;
    const generation = dependencies.generation();
    isNavigating.value = true;
    navigationError.value = null;
    dependencies.invalidateReload();
    let commandSent = false;
    try {
      await previewSessionContext(id, targetId);
      if (generation !== dependencies.generation() || dependencies.sessionId.value !== id)
        return false;
      commandSent = true;
      await sendAgentCommand(id, { type: "navigate_tree", targetId });
      if (generation !== dependencies.generation() || dependencies.sessionId.value !== id)
        return false;
      await dependencies.reload();
      if (dependencies.activeLeafId.value !== targetId) throw new Error("目标分支尚未确认");
      return true;
    } catch {
      if (generation !== dependencies.generation() || dependencies.sessionId.value !== id)
        return false;
      // 请求失败可能发生在服务端导航之后 先重新读取再决定是否回退
      if (commandSent) {
        const info = await dependencies.reload();
        if (!info || dependencies.activeLeafId.value !== previous) {
          if (previous) {
            try {
              await sendAgentCommand(id, { type: "navigate_tree", targetId: previous });
              const restored = await dependencies.reload();
              if (!restored || dependencies.activeLeafId.value !== previous)
                positionUnknown.value = true;
            } catch {
              positionUnknown.value = true;
            }
          } else {
            positionUnknown.value = true;
          }
        }
      }
      if (dependencies.activeLeafId.value !== previous) positionUnknown.value = true;
      navigationError.value = positionUnknown.value
        ? "会话位置未确认 请重新加载"
        : "分支切换失败 已恢复原分支";
      dependencies.notice(navigationError.value);
      return false;
    } finally {
      if (generation === dependencies.generation()) isNavigating.value = false;
    }
  };

  return { isNavigating, positionUnknown, navigationError, navigateToLeaf, reset };
};

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="cap-dialog"
      :class="{ compact: compactTab, 'split-view': splitTab }"
      aria-labelledby="capability-title"
      @cancel.prevent="requestClose"
      @close="onClosed"
      @click="closeFromBackdrop"
    >
      <div class="cap-modal">
        <header class="cap-header">
          <div class="cap-header-title">
            <div class="cap-header-icon"><SlidersHorizontal :size="19" aria-hidden="true" /></div>
            <div>
              <div class="cap-title-row">
                <h1 id="capability-title">能力中心</h1>
                <span class="cap-header-scope">{{ scopeLabel }}</span>
              </div>
              <p>管理本机 Agent 的偏好 资源与可用能力</p>
            </div>
          </div>
          <PiIconButton label="关闭能力中心" @click="requestClose">
            <X :size="18" aria-hidden="true" />
          </PiIconButton>
        </header>

        <nav class="cap-tabs" role="tablist" aria-label="能力中心页面" @keydown="moveTab">
          <button
            v-for="tab in tabs"
            :id="`${tab.key}-tab`"
            :key="tab.key"
            class="cap-tab"
            :class="{ active: center.activeTab === tab.key }"
            type="button"
            role="tab"
            :aria-selected="center.activeTab === tab.key"
            :aria-controls="`${tab.key}-panel`"
            :tabindex="center.activeTab === tab.key ? 0 : -1"
            @click="center.activeTab = tab.key"
          >
            <component :is="tab.icon" :size="16" aria-hidden="true" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <div class="cap-content">
          <div
            id="general-panel"
            role="tabpanel"
            aria-labelledby="general-tab"
            :hidden="center.activeTab !== 'general'"
          >
            <GeneralSettingsPanel v-if="center.activeTab === 'general'" />
          </div>
          <div
            id="models-panel"
            role="tabpanel"
            aria-labelledby="models-tab"
            :hidden="center.activeTab !== 'models'"
          >
            <ModelsPanel v-if="center.activeTab === 'models'" />
          </div>
          <div
            id="skills-panel"
            role="tabpanel"
            aria-labelledby="skills-tab"
            :hidden="center.activeTab !== 'skills'"
          >
            <SkillsPanel v-if="center.activeTab === 'skills'" />
          </div>
          <div
            id="extensions-panel"
            role="tabpanel"
            aria-labelledby="extensions-tab"
            :hidden="center.activeTab !== 'extensions'"
          >
            <ExtensionsPanel v-if="center.activeTab === 'extensions'" />
          </div>
          <div
            id="plugins-panel"
            role="tabpanel"
            aria-labelledby="plugins-tab"
            :hidden="center.activeTab !== 'plugins'"
          >
            <PluginsPanel v-if="center.activeTab === 'plugins'" />
          </div>
          <div
            id="mcp-panel"
            role="tabpanel"
            aria-labelledby="mcp-tab"
            :hidden="center.activeTab !== 'mcp'"
          >
            <McpPanel v-if="center.activeTab === 'mcp'" />
          </div>
        </div>
        <div v-if="confirmDiscard" class="cap-confirm-backdrop" role="presentation">
          <section
            class="cap-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-title"
          >
            <h2 id="discard-title">放弃未保存的变更</h2>
            <p>关闭能力中心会丢弃当前草稿</p>
            <div class="cap-confirm-actions">
              <PiButton variant="secondary" @click="confirmDiscard = false">继续编辑</PiButton>
              <PiButton variant="danger" @click="discardAndClose">放弃变更</PiButton>
            </div>
          </section>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import {
  BrainCircuit,
  Cable,
  Package,
  Puzzle,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-vue-next";
import PiButton from "~/components/pi/PiButton/index.vue";
import PiIconButton from "~/components/pi/PiIconButton/index.vue";
import {
  capabilityTabs,
  type CapabilityTab,
  useCapabilityCenterStore,
} from "~/stores/capability-center";
import { useWorkspaceStore } from "~/stores/workspace";
import GeneralSettingsPanel from "~/components/capabilities/GeneralSettingsPanel.vue";
import ModelsPanel from "~/components/capabilities/ModelsPanel.vue";
import SkillsPanel from "~/components/capabilities/SkillsPanel.vue";
import ExtensionsPanel from "~/components/capabilities/ExtensionsPanel.vue";
import PluginsPanel from "~/components/capabilities/PluginsPanel.vue";
import McpPanel from "~/components/capabilities/McpPanel.vue";

const center = useCapabilityCenterStore();
const workspace = useWorkspaceStore();
const dialog = ref<HTMLDialogElement | null>(null);
const confirmDiscard = ref(false);
let trigger: HTMLElement | null = null;
let previousBodyOverflow = "";

const tabs = [
  { key: "general" as const, label: "常规", icon: Settings2 },
  { key: "models" as const, label: "模型", icon: BrainCircuit },
  { key: "skills" as const, label: "技能", icon: Sparkles },
  { key: "extensions" as const, label: "扩展", icon: Puzzle },
  { key: "plugins" as const, label: "插件", icon: Package },
  { key: "mcp" as const, label: "MCP", icon: Cable },
];
const scopeLabel = computed(() => (workspace.selectedCwd ? "当前项目" : "浏览器偏好"));
const compactTab = computed(() => ["general", "extensions", "mcp"].includes(center.activeTab));
const splitTab = computed(() => ["models", "skills", "plugins"].includes(center.activeTab));

const requestClose = () => {
  if (center.dirty) {
    confirmDiscard.value = true;
    return;
  }
  center.hide();
};

const discardAndClose = () => {
  confirmDiscard.value = false;
  center.hide();
};

// 原生 dialog 关闭后恢复触发控件 保持键盘流程连续
const onClosed = () => {
  if (center.open) center.hide();
  trigger?.focus();
  trigger = null;
};

const closeFromBackdrop = (event: MouseEvent) => {
  if (event.target === dialog.value) requestClose();
};

const moveTab = (event: KeyboardEvent) => {
  const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const current = capabilityTabs.indexOf(center.activeTab);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? capabilityTabs.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + capabilityTabs.length) %
          capabilityTabs.length;
  center.activeTab = capabilityTabs[next] as CapabilityTab;
  nextTick(() => document.getElementById(`${center.activeTab}-tab`)?.focus());
};

watch(
  () => center.open,
  async (open) => {
    if (open) {
      trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      await nextTick();
      if (!dialog.value?.open) dialog.value?.showModal();
      document.getElementById(`${center.activeTab}-tab`)?.focus();
      return;
    }
    document.body.style.overflow = previousBodyOverflow;
    if (dialog.value?.open) dialog.value.close();
  },
);

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow;
});
</script>

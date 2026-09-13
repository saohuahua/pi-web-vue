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
          <button class="cap-icon-button" type="button" title="关闭能力中心" aria-label="关闭能力中心" @click="requestClose">
            <X :size="18" aria-hidden="true" />
          </button>
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
          <div id="general-panel" role="tabpanel" aria-labelledby="general-tab" :hidden="center.activeTab !== 'general'">
            <GeneralSettingsPanel v-if="center.activeTab === 'general'" />
          </div>
          <div id="models-panel" role="tabpanel" aria-labelledby="models-tab" :hidden="center.activeTab !== 'models'">
            <ModelsPanel v-if="center.activeTab === 'models'" />
          </div>
          <div id="skills-panel" role="tabpanel" aria-labelledby="skills-tab" :hidden="center.activeTab !== 'skills'">
            <SkillsPanel v-if="center.activeTab === 'skills'" />
          </div>
          <div id="extensions-panel" role="tabpanel" aria-labelledby="extensions-tab" :hidden="center.activeTab !== 'extensions'">
            <ExtensionsPanel v-if="center.activeTab === 'extensions'" />
          </div>
          <div id="mcp-panel" role="tabpanel" aria-labelledby="mcp-tab" :hidden="center.activeTab !== 'mcp'">
            <McpPanel v-if="center.activeTab === 'mcp'" />
          </div>
        </div>
        <div v-if="confirmDiscard" class="cap-confirm-backdrop" role="presentation">
          <section class="cap-confirm" role="alertdialog" aria-modal="true" aria-labelledby="discard-title">
            <h2 id="discard-title">放弃未保存的变更</h2>
            <p>关闭能力中心会丢弃当前草稿</p>
            <div class="cap-confirm-actions">
              <button class="cap-secondary-button" type="button" @click="confirmDiscard = false">继续编辑</button>
              <button class="cap-danger-button" type="button" @click="discardAndClose">放弃变更</button>
            </div>
          </section>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { BrainCircuit, Cable, Puzzle, Settings2, SlidersHorizontal, Sparkles, X } from "lucide-vue-next";
import { capabilityTabs, type CapabilityTab, useCapabilityCenterStore } from "~/stores/capability-center";
import { useWorkspaceStore } from "~/stores/workspace";
import GeneralSettingsPanel from "~/components/capabilities/GeneralSettingsPanel.vue";
import ModelsPanel from "~/components/capabilities/ModelsPanel.vue";
import SkillsPanel from "~/components/capabilities/SkillsPanel.vue";
import ExtensionsPanel from "~/components/capabilities/ExtensionsPanel.vue";
import McpPanel from "~/components/capabilities/McpPanel.vue";

const center = useCapabilityCenterStore();
const workspace = useWorkspaceStore();
const dialog = ref<HTMLDialogElement | null>(null);
const confirmDiscard = ref(false);
let trigger: HTMLElement | null = null;

const tabs = [
  { key: "general" as const, label: "常规", icon: Settings2 },
  { key: "models" as const, label: "模型", icon: BrainCircuit },
  { key: "skills" as const, label: "技能", icon: Sparkles },
  { key: "extensions" as const, label: "扩展", icon: Puzzle },
  { key: "mcp" as const, label: "MCP", icon: Cable },
];
const scopeLabel = computed(() => workspace.selectedCwd ? "当前项目" : "浏览器偏好");
const compactTab = computed(() => ["general", "extensions", "mcp"].includes(center.activeTab));
const splitTab = computed(() => ["models", "skills"].includes(center.activeTab));

function requestClose() {
  if (center.dirty) {
    confirmDiscard.value = true;
    return;
  }
  center.hide();
}

function discardAndClose() {
  confirmDiscard.value = false;
  center.hide();
}

function onClosed() {
  if (center.open) center.hide();
  trigger?.focus();
  trigger = null;
}

function closeFromBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) requestClose();
}

function moveTab(event: KeyboardEvent) {
  const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const current = capabilityTabs.indexOf(center.activeTab);
  const next = event.key === "Home"
    ? 0
    : event.key === "End"
      ? capabilityTabs.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + capabilityTabs.length) % capabilityTabs.length;
  center.activeTab = capabilityTabs[next] as CapabilityTab;
  nextTick(() => document.getElementById(`${center.activeTab}-tab`)?.focus());
}

watch(() => center.open, async (open) => {
  if (open) {
    trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    if (!dialog.value?.open) dialog.value?.showModal();
    document.getElementById(`${center.activeTab}-tab`)?.focus();
    return;
  }
  if (dialog.value?.open) dialog.value.close();
});
</script>

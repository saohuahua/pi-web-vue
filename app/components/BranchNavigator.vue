<template>
  <PiPopover v-model:open="open" label="会话分支" role="listbox">
    <template #trigger="{ toggle }">
      <button
        class="branch-trigger"
        type="button"
        :aria-expanded="open"
        :disabled="chat.isRunning || chat.isCompacting || chat.isNavigating || chat.positionUnknown"
        @click="toggle"
      >
        <GitBranch :size="15" aria-hidden="true" />
        分支 {{ chat.branches.length }}
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
    </template>

    <div class="branch-list" @keydown="onKeydown">
      <button
        v-for="(branch, index) in chat.branches"
        :key="branch.id"
        :ref="(element) => setOption(element, index)"
        class="branch-option"
        type="button"
        role="option"
        :aria-selected="branch.isActive"
        :disabled="chat.isNavigating"
        @click="choose(branch.leafId)"
      >
        <span class="branch-preview">{{ branch.preview }}</span>
        <span v-if="branch.isActive" class="branch-current">当前</span>
      </button>
    </div>
  </PiPopover>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from "vue";
import { ChevronDown, GitBranch } from "lucide-vue-next";
import PiPopover from "~/components/pi/PiPopover/index.vue";
import { useChatStore } from "~/stores/chat";

const chat = useChatStore();
const open = ref(false);
const options = ref<HTMLButtonElement[]>([]);

const setOption = (element: Element | ComponentPublicInstance | null, index: number) => {
  if (element instanceof HTMLButtonElement) options.value[index] = element;
};

const choose = async (leafId: string) => {
  if (await chat.navigateToLeaf(leafId)) open.value = false;
};

const onKeydown = (event: KeyboardEvent) => {
  const current = options.value.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const next = (current + delta + options.value.length) % options.value.length;
    options.value[next]?.focus();
  }
};

watch(open, (value) => {
  if (value) nextTick(() => options.value[0]?.focus());
  else options.value = [];
});
</script>

<style scoped>
@layer features {
  .branch-trigger,
  .branch-option {
    display: flex;
    align-items: center;
    gap: var(--ds-space-2);
    min-height: var(--ds-control-height-touch);
    width: 100%;
    text-align: left;
  }
  .branch-trigger {
    width: auto;
    padding: 0 var(--ds-space-3);
    color: var(--ds-ink-muted);
  }
  .branch-list {
    min-width: 220px;
    max-width: min(360px, 80vw);
  }
  .branch-option {
    justify-content: space-between;
    padding: var(--ds-space-2) var(--ds-space-3);
  }
  .branch-option:hover,
  .branch-option:focus-visible {
    background: var(--ds-primary-soft);
  }
  .branch-preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .branch-current {
    flex: none;
    color: var(--ds-primary);
  }
}
</style>

<template>
  <div ref="root" class="pi-popover">
    <slot name="trigger" :open="props.open" :toggle="toggle" :close="close" />
    <div
      v-if="props.open"
      ref="content"
      :class="['pi-popover__content', `pi-popover__content--${props.placement}`]"
      :role="props.role"
      :aria-label="props.label"
      tabindex="-1"
    >
      <slot :close="close" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

type PopoverPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

const props = withDefaults(
  defineProps<{
    open: boolean;
    label: string;
    placement?: PopoverPlacement;
    role?: "dialog" | "listbox" | "menu";
  }>(),
  {
    placement: "bottom-start",
    role: "dialog",
  },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const root = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);
let trigger: HTMLElement | null = null;

const close = () => {
  if (!props.open) return;
  emit("update:open", false);
};

// 打开前记录触发控件 关闭后恢复键盘焦点
const toggle = () => {
  trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  emit("update:open", !props.open);
};

const onDocumentPointerdown = (event: PointerEvent) => {
  if (root.value?.contains(event.target as Node)) return;
  close();
};

const onDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  close();
};

watch(
  () => props.open,
  async (open) => {
    if (open) {
      document.addEventListener("pointerdown", onDocumentPointerdown);
      document.addEventListener("keydown", onDocumentKeydown);
      await nextTick();
      content.value?.focus();
      return;
    }

    document.removeEventListener("pointerdown", onDocumentPointerdown);
    document.removeEventListener("keydown", onDocumentKeydown);
    trigger?.focus();
    trigger = null;
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerdown);
  document.removeEventListener("keydown", onDocumentKeydown);
});
</script>

<style scoped src="./style.css"></style>

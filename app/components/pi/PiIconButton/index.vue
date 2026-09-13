<template>
  <button
    v-bind="nativeAttrs"
    :class="buttonClass"
    type="button"
    :disabled="props.disabled || props.loading"
    :aria-label="props.label"
    :aria-busy="props.loading || undefined"
  >
    <span v-if="props.loading" class="pi-icon-button__spinner" aria-hidden="true"></span>
    <slot v-else />
    <span v-if="hasTooltip" class="pi-icon-button__tooltip" role="tooltip">{{ tooltipText }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

type IconButtonVariant = "ghost" | "secondary" | "danger";
type IconButtonSize = "default" | "compact";

const props = withDefaults(
  defineProps<{
    label: string;
    tooltip?: string | false;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    tooltip: undefined,
    variant: "ghost",
    size: "default",
    loading: false,
    disabled: false,
  },
);

const attrs = useAttrs();

// 原语自己提供可读名称与提示 避免调用方传入冲突文本
const nativeAttrs = computed(() => {
  const { class: ignoredClass, style: ignoredStyle, title: ignoredTitle, ...rest } = attrs;
  return rest;
});

const buttonClass = computed(() => [
  "pi-icon-button",
  `pi-icon-button--${props.variant}`,
  `pi-icon-button--${props.size}`,
]);

const hasTooltip = computed(() => props.tooltip !== false);
const tooltipText = computed(() => props.tooltip ?? props.label);
</script>

<style scoped src="./style.css"></style>

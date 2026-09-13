<template>
  <button
    v-bind="nativeAttrs"
    :class="buttonClass"
    :type="props.type"
    :disabled="props.disabled || props.loading"
    :aria-busy="props.loading || undefined"
  >
    <span v-if="props.loading" class="pi-button__spinner" aria-hidden="true"></span>
    <span class="pi-button__content"><slot /></span>
  </button>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "compact";

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
  }>(),
  {
    variant: "secondary",
    size: "default",
    loading: false,
    disabled: false,
    type: "button",
  },
);

const attrs = useAttrs();

// 不透传 class 与 style 防止调用方改变原语视觉角色
const nativeAttrs = computed(() => {
  const { class: ignoredClass, style: ignoredStyle, ...rest } = attrs;
  return rest;
});

const buttonClass = computed(() => [
  "pi-button",
  `pi-button--${props.variant}`,
  `pi-button--${props.size}`,
]);
</script>

<style scoped src="./style.css"></style>

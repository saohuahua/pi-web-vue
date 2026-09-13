<template>
  <label
    :class="[
      'pi-input',
      { 'pi-input--invalid': props.invalid, 'pi-input--disabled': props.disabled },
    ]"
  >
    <span v-if="$slots.leading" class="pi-input__leading"><slot name="leading" /></span>
    <input
      v-bind="nativeAttrs"
      :value="props.modelValue"
      :type="props.type"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :aria-label="props.label"
      :aria-invalid="props.invalid || undefined"
      @input="onInput"
    />
    <button
      v-if="props.clearable && props.modelValue && !props.disabled"
      class="pi-input__clear"
      type="button"
      :aria-label="`清空${props.label}`"
      @click="clear"
    >
      <X :size="14" aria-hidden="true" />
    </button>
    <span v-if="$slots.trailing" class="pi-input__trailing"><slot name="trailing" /></span>
  </label>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { X } from "lucide-vue-next";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    type?: string;
    placeholder?: string;
    invalid?: boolean;
    disabled?: boolean;
    clearable?: boolean;
  }>(),
  {
    type: "text",
    placeholder: "",
    invalid: false,
    disabled: false,
    clearable: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  clear: [];
}>();

const attrs = useAttrs();

// 不透传 class 与 style 保持输入框状态由原语统一管理
const nativeAttrs = computed(() => {
  const { class: ignoredClass, style: ignoredStyle, ...rest } = attrs;
  return rest;
});

const onInput = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
};

// 清空需要同步模型值与业务侧的筛选状态
const clear = () => {
  emit("update:modelValue", "");
  emit("clear");
};
</script>

<style scoped src="./style.css"></style>

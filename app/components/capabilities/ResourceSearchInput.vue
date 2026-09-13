<template>
  <label class="resource-search-input">
    <Search :size="15" aria-hidden="true" />
    <input
      :value="modelValue"
      type="search"
      :placeholder="placeholder"
      :aria-label="label"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <button v-if="modelValue" type="button" :aria-label="`清空${label}`" title="清空" @click="emit('update:modelValue', '')">
      <X :size="14" aria-hidden="true" />
    </button>
  </label>
</template>

<script setup lang="ts">
import { Search, X } from "lucide-vue-next";

defineProps<{
  modelValue: string;
  placeholder: string;
  label: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

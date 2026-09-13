<template>
  <div class="sidebar-search-input" role="search">
    <Search :size="14" aria-hidden="true" />
    <input
      :value="modelValue"
      type="search"
      :placeholder="placeholder"
      :aria-label="label"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <button
      v-if="modelValue"
      class="sidebar-search-clear"
      type="button"
      title="清空搜索"
      aria-label="清空搜索"
      @click="emit('update:modelValue', '')"
    ><X :size="13" aria-hidden="true" /></button>
  </div>
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

<template>
  <div class="resource-search-input">
    <PiInput
      :model-value="modelValue"
      type="search"
      :placeholder="placeholder"
      :label="label"
      clearable
      @update:model-value="emit('update:modelValue', $event)"
      @clear="emit('update:modelValue', '')"
    >
      <template #leading><Search :size="15" aria-hidden="true" /></template>
    </PiInput>
  </div>
</template>

<script setup lang="ts">
import { Search } from "lucide-vue-next";
import PiInput from "~/components/pi/PiInput/index.vue";

defineProps<{
  modelValue: string;
  placeholder: string;
  label: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <span class="brand-mark" :class="`brand-mark-${variant}`" aria-hidden="true">AD</span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: "sidebar" | "empty" | "hero" | "mobile";
}>(), {
  variant: "sidebar",
});
</script>

<template>
  <span :class="['pi-status-tag', `pi-status-tag--${props.tone}`]">
    <span class="pi-status-tag__dot" aria-hidden="true"></span>
    <span><slot /></span>
  </span>
</template>

<script setup lang="ts">
type StatusTone = "neutral" | "active" | "success" | "warning" | "danger";

const props = withDefaults(
  defineProps<{
    tone?: StatusTone;
  }>(),
  {
    tone: "neutral",
  },
);
</script>

<style scoped src="./style.css"></style>

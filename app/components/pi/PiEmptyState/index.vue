<template>
  <section class="pi-empty-state">
    <div v-if="$slots.icon" class="pi-empty-state__icon"><slot name="icon" /></div>
    <div class="pi-empty-state__copy">
      <h3>{{ props.title }}</h3>
      <p v-if="props.description">{{ props.description }}</p>
    </div>
    <div v-if="$slots.action" class="pi-empty-state__action"><slot name="action" /></div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  description?: string;
}>();
</script>

<style scoped src="./style.css"></style>

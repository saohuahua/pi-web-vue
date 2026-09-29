<template>
  <div v-if="count > 0" class="queue-strip" role="status">
    <div class="queue-strip__heading">
      <span>已排队 {{ count }} 条指令</span>
      <PiButton
        variant="ghost"
        size="compact"
        :disabled="chat.queueActionPending || chat.queueSubmitting || chat.isStopping"
        @click="chat.recallQueue()"
      >
        全部撤回
      </PiButton>
    </div>
    <div class="queue-strip__items">
      <span
        v-for="(text, index) in chat.queuedMessages.steering"
        :key="`steer-${index}`"
        class="queue-strip__item"
        :title="text"
      >
        <strong>纠偏</strong>{{ text }}
      </span>
      <span
        v-for="(text, index) in chat.queuedMessages.followUp"
        :key="`follow-${index}`"
        class="queue-strip__item"
        :title="text"
      >
        <strong>后续</strong>{{ text }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChatStore } from "~/stores/chat";
import PiButton from "~/components/pi/PiButton/index.vue";

const chat = useChatStore();
const count = computed(
  () => chat.queuedMessages.steering.length + chat.queuedMessages.followUp.length,
);
</script>

<style scoped>
@layer features {
  .queue-strip {
    min-width: 0;
    margin-bottom: var(--ds-space-2);
    padding: var(--ds-space-2) var(--ds-space-4);
    border: 1px solid var(--ds-line);
    border-radius: var(--ds-radius-md);
    color: var(--ds-ink-muted);
    background: var(--ds-surface);
    font-size: var(--ds-font-size-caption);
  }
  .queue-strip__heading,
  .queue-strip__items {
    display: flex;
    align-items: center;
    gap: var(--ds-space-2);
  }
  .queue-strip__heading {
    justify-content: space-between;
  }
  .queue-strip__items {
    overflow-x: auto;
  }
  .queue-strip__item {
    display: inline-flex;
    flex: none;
    gap: var(--ds-space-1);
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .queue-strip__item strong {
    color: var(--ds-ink);
  }
}
</style>

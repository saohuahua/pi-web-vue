<template>
  <section class="cap-panel" aria-labelledby="quick-prompts-title">
    <div class="cap-panel-heading">
      <h2 id="quick-prompts-title">快捷提示词</h2>
      <div class="cap-prompt-head-actions">
        <PiIconButton label="恢复默认提示词" @click="settings.resetQuickPrompts">
          <RotateCcw :size="15" aria-hidden="true" />
        </PiIconButton>
        <PiButton variant="primary" size="compact" @click="settings.addQuickPrompt">
          <Plus :size="15" aria-hidden="true" />新增
        </PiButton>
      </div>
    </div>

    <div class="cap-prompt-list">
      <article
        v-for="(prompt, index) in settings.quickPrompts"
        :key="prompt.id"
        class="cap-prompt-row"
      >
        <div class="cap-prompt-row-head">
          <span class="cap-prompt-order">{{ String(index + 1).padStart(2, "0") }}</span>
          <span class="cap-prompt-current">{{ prompt.label || "未命名提示词" }}</span>
          <div class="cap-prompt-actions">
            <PiIconButton
              label="上移"
              size="compact"
              :disabled="index === 0"
              @click="settings.moveQuickPrompt(prompt.id, -1)"
            >
              <ArrowUp :size="14" aria-hidden="true" />
            </PiIconButton>
            <PiIconButton
              label="下移"
              size="compact"
              :disabled="index === settings.quickPrompts.length - 1"
              @click="settings.moveQuickPrompt(prompt.id, 1)"
            >
              <ArrowDown :size="14" aria-hidden="true" />
            </PiIconButton>
            <PiIconButton
              label="删除"
              variant="danger"
              size="compact"
              @click="settings.removeQuickPrompt(prompt.id)"
            >
              <Trash2 :size="14" aria-hidden="true" />
            </PiIconButton>
          </div>
        </div>
        <div class="cap-prompt-fields">
          <label>
            <span>名称</span>
            <input
              :value="prompt.label"
              type="text"
              maxlength="24"
              @input="
                settings.updateQuickPrompt(prompt.id, {
                  label: ($event.target as HTMLInputElement).value,
                })
              "
            />
          </label>
          <label>
            <span>提示词内容</span>
            <textarea
              :value="prompt.prompt"
              rows="2"
              maxlength="500"
              @input="
                settings.updateQuickPrompt(prompt.id, {
                  prompt: ($event.target as HTMLTextAreaElement).value,
                })
              "
            ></textarea>
          </label>
        </div>
      </article>
      <p v-if="!settings.quickPrompts.length" class="cap-readonly">暂无快捷提示词</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-vue-next";
import PiButton from "~/components/pi/PiButton/index.vue";
import PiIconButton from "~/components/pi/PiIconButton/index.vue";
import { useSettingsStore } from "~/stores/settings";

const settings = useSettingsStore();
</script>

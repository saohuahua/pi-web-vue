<template>
  <section class="cap-panel" aria-labelledby="general-title">
    <div class="cap-panel-heading">
      <div>
        <h2 id="general-title">常规设置</h2>
        <p>这些偏好只保存在当前浏览器</p>
      </div>
    </div>

    <div class="cap-section">
      <h3>外观</h3>
      <div class="cap-option-grid" role="radiogroup" aria-label="主题">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          class="cap-choice"
          :class="{ selected: settings.theme === option.value }"
          type="button"
          role="radio"
          :aria-checked="settings.theme === option.value"
          @click="settings.setTheme(option.value)"
        >
          <span class="cap-choice-title">{{ option.label }}</span>
          <span class="cap-choice-note">{{ option.note }}</span>
        </button>
      </div>
    </div>

    <div class="cap-section">
      <h3>反馈</h3>
      <label class="cap-switch-row">
        <span>
          <span class="cap-switch-title">运行完成提示音</span>
          <span class="cap-switch-note">agent 结束回答后播放短促提示音</span>
        </span>
        <input
          :checked="settings.completionSound"
          type="checkbox"
          role="switch"
          aria-label="运行完成提示音"
          @change="settings.setCompletionSound(($event.target as HTMLInputElement).checked)"
        />
      </label>
      <label class="cap-switch-row">
        <span>
          <span class="cap-switch-title">减少动效</span>
          <span class="cap-switch-note">关闭非必要的过渡和加载动画</span>
        </span>
        <input
          :checked="settings.reduceMotion"
          type="checkbox"
          role="switch"
          aria-label="减少动效"
          @change="settings.setReduceMotion(($event.target as HTMLInputElement).checked)"
        />
      </label>
    </div>

    <div class="cap-section">
      <h3>本机边界</h3>
      <p class="cap-readonly">此工作台只绑定本机地址 资源配置不会同步到远端服务</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useSettingsStore } from "~/stores/settings";

const settings = useSettingsStore();

const themeOptions = [
  { value: "auto" as const, label: "跟随系统", note: "使用操作系统外观" },
  { value: "light" as const, label: "浅色", note: "冷白工作台" },
  { value: "dark" as const, label: "深色", note: "低眩光工作台" },
];
</script>

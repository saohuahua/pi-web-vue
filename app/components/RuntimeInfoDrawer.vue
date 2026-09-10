<template>
  <!-- 只读运行信息抽屉 系统提示词与已注册工具 -->
  <aside v-if="ui.runtimeInfoOpen" class="runtime-drawer" aria-label="运行信息">
    <header class="flex items-center gap-2 border-b border-line px-4 py-2.5">
      <span class="flex-1 text-[13px] font-medium text-ink">系统与工具</span>
      <button
        class="rounded px-1 text-[15px] leading-none text-muted transition-colors hover:text-ink"
        type="button"
        aria-label="关闭"
        @click="ui.runtimeInfoOpen = false"
      >×</button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <section class="border-b border-line px-4 py-3">
        <h3 class="pb-1.5 font-mono text-[11px] text-muted">SYSTEM PROMPT</h3>
        <pre class="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink-soft">{{ chat.systemPrompt || "（空）" }}</pre>
      </section>

      <section class="px-4 py-3">
        <h3 class="pb-1.5 font-mono text-[11px] text-muted">TOOLS ({{ chat.toolDefinitions.length }})</h3>
        <p v-if="!chat.toolDefinitions.length" class="text-[12px] text-muted">尚未加载 打开会话后自动获取</p>
        <dl v-else class="space-y-1.5">
          <div
            v-for="tool in chat.toolDefinitions"
            :key="tool.name"
            class="rounded-lg border border-line px-3 py-2"
            :class="{ 'opacity-50': !tool.active }"
          >
            <dt class="flex items-center gap-2 font-mono text-[12px] text-accent-deep">
              {{ tool.name }}
              <span v-if="!tool.active" class="text-[10px] text-muted">未启用</span>
            </dt>
            <dd class="pt-0.5 text-[11.5px] leading-relaxed text-muted">{{ tool.description }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useChatStore } from "~/stores/chat";
import { useUiStore } from "~/stores/ui";

// 只读展示 system prompt 与工具定义 来自 get_state 与 get_commands
const chat = useChatStore();
const ui = useUiStore();
</script>

<template>
  <!-- 左下入口打开的三合一抽屉 模型 技能 设置 -->
  <aside v-if="ui.settingsOpen" class="runtime-drawer" aria-label="配置面板">
    <header class="flex items-center gap-1 border-b border-line px-4 py-2.5">
      <span class="flex-1 text-[13px] font-medium text-ink">配置</span>
      <button
        class="rounded px-1 text-[15px] leading-none text-muted transition-colors hover:text-ink"
        type="button"
        aria-label="关闭"
        @click="ui.settingsOpen = false"
      >×</button>
    </header>

    <!-- 三个页签 -->
    <nav class="flex gap-1 border-b border-line px-3 py-2" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="rounded-full px-3 py-1 text-[12px] transition-colors"
        :class="activeTab === tab.key ? 'bg-accent-soft text-accent-deep' : 'text-muted hover:bg-surface-2'"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.key"
        @click="activeTab = tab.key"
      >{{ tab.label }}</button>
    </nav>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <!-- 模型页 当前 默认 错误与刷新 -->
      <section v-if="activeTab === 'models'">
        <div class="flex items-center gap-2 pb-2">
          <p v-if="models.modelError" class="flex-1 text-[12px] text-danger">{{ models.modelError }}</p>
          <span v-else class="flex-1 text-[12px] text-muted">
            {{ models.modelList.length }} 个可用模型
          </span>
          <button
            class="rounded-md px-2 py-1 text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            type="button"
            :disabled="models.loading"
            @click="refreshModels"
          >{{ models.loading ? "刷新中…" : "刷新" }}</button>
        </div>
        <p v-if="!models.modelList.length && !models.modelError" class="py-4 text-center text-[12px] text-muted">
          {{ models.loading ? "加载中…" : "无可用模型" }}
        </p>
        <ul v-else class="space-y-1">
          <li
            v-for="m in models.modelList.slice(0, 200)"
            :key="`${m.provider}:${m.id}`"
            class="flex items-center gap-2 rounded-lg border border-line px-3 py-2"
            :class="{ 'border-accent/40 bg-accent-soft': isCurrent(m) }"
          >
            <span class="min-w-0 flex-1 truncate text-[12.5px] text-ink">{{ m.name || m.id }}</span>
            <span v-if="isCurrent(m)" class="shrink-0 text-[10.5px] text-accent-deep">当前</span>
            <span v-else-if="isDefault(m)" class="shrink-0 text-[10.5px] text-muted">默认</span>
            <span class="shrink-0 font-mono text-[10px] text-muted">{{ m.provider }}</span>
          </li>
          <p v-if="models.modelList.length > 200" class="pt-1 text-[11px] text-muted">
            仅显示前 200 个 完整列表在输入框的模型选择器
          </p>
        </ul>
      </section>

      <!-- 技能页 列出与允许模型调用开关 -->
      <section v-else-if="activeTab === 'skills'">
        <p class="pb-2 text-[12px] text-muted">{{ skills.length }} 个技能 按当前项目加载</p>
        <p v-if="skillsError" class="py-2 text-[12px] text-danger">{{ skillsError }}</p>
        <p v-else-if="!skills.length && !skillsLoading" class="py-4 text-center text-[12px] text-muted">没有可用技能</p>
        <ul class="space-y-1.5">
          <li
            v-for="skill in skills"
            :key="skill.filePath"
            class="rounded-lg border border-line px-3 py-2"
          >
            <div class="flex items-center gap-2">
              <span class="min-w-0 flex-1 truncate font-mono text-[12.5px] text-accent-deep">{{ skill.name }}</span>
              <label class="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted">
                <input
                  type="checkbox"
                  :checked="!skill.disableModelInvocation"
                  :disabled="busySkills.has(skill.filePath)"
                  @change="toggleSkill(skill, ($event.target as HTMLInputElement).checked)"
                >允许模型调用
              </label>
            </div>
            <p class="pt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted">{{ skill.description }}</p>
            <p class="pt-1 font-mono text-[10px] text-muted/80">
              {{ skill.sourceInfo.source ?? "unknown" }} · {{ skill.baseDir }}
            </p>
          </li>
        </ul>
      </section>

      <!-- 设置页 主题与提示音 -->
      <section v-else class="space-y-4">
        <div>
          <p class="pb-1.5 text-[12px] font-medium text-ink">主题</p>
          <div class="flex gap-1">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              class="rounded-full px-3 py-1.5 text-[12px] transition-colors"
              :class="settings.theme === option.value ? 'bg-accent-soft text-accent-deep' : 'border border-line text-muted hover:bg-surface-2'"
              type="button"
              @click="settings.setTheme(option.value)"
            >{{ option.label }}</button>
          </div>
        </div>
        <div>
          <p class="pb-1.5 text-[12px] font-medium text-ink">运行完成提示音</p>
          <label class="flex cursor-pointer items-center gap-2 text-[12px] text-ink-soft">
            <input
              type="checkbox"
              :checked="settings.completionSound"
              @change="settings.setCompletionSound(($event.target as HTMLInputElement).checked)"
            >agent 回答结束后播放短促提示音
          </label>
        </div>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useModelsStore } from "~/stores/models";
import { useSettingsStore } from "~/stores/settings";
import { useUiStore } from "~/stores/ui";
import { useWorkspaceStore } from "~/stores/workspace";
import type { SkillEntry } from "#shared/lib/types";

// 配置抽屉 模型只读可见 技能可切换允许模型调用 设置是浏览器偏好
const ui = useUiStore();
const models = useModelsStore();
const settings = useSettingsStore();
const workspace = useWorkspaceStore();

const tabs = [
  { key: "models", label: "模型" },
  { key: "skills", label: "技能" },
  { key: "settings", label: "设置" },
] as const;
// 初始页签来自侧栏入口 之后用户自由切换
const activeTab = ref<(typeof tabs)[number]["key"]>(ui.settingsTab);
watch(() => ui.settingsTab, (tab) => {
  if (ui.settingsOpen) activeTab.value = tab;
});

const chat = useChatStore();
const isCurrent = (m: { provider: string; id: string }) =>
  chat.model?.provider === m.provider && chat.model?.id === m.id;
const isDefault = (m: { provider: string; id: string }) =>
  models.defaultModel?.provider === m.provider && models.defaultModel?.modelId === m.id;

function refreshModels() {
  if (workspace.selectedCwd) void models.load(workspace.selectedCwd);
}

// ---------- 技能 ----------

const skills = ref<SkillEntry[]>([]);
const skillsLoading = ref(false);
const skillsError = ref("");
const busySkills = reactive(new Set<string>());

async function loadSkills() {
  const cwd = workspace.selectedCwd;
  if (!cwd) {
    skillsError.value = "先在左侧选择项目";
    return;
  }
  skillsLoading.value = true;
  skillsError.value = "";
  try {
    const res = await fetch(`/api/skills?cwd=${encodeURIComponent(cwd)}`);
    const body = await res.json() as { skills?: SkillEntry[]; error?: string };
    if (!res.ok || body.error) {
      skillsError.value = body.error ?? `HTTP ${res.status}`;
      skills.value = [];
      return;
    }
    skills.value = body.skills ?? [];
  } catch (e) {
    skillsError.value = e instanceof Error ? e.message : String(e);
  } finally {
    skillsLoading.value = false;
  }
}

// 切换只改目标 frontmatter 字段 失败回滚勾选状态
async function toggleSkill(skill: SkillEntry, allow: boolean) {
  busySkills.add(skill.filePath);
  try {
    const res = await fetch("/api/skills", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filePath: skill.filePath, disableModelInvocation: !allow }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      skillsError.value = body.error ?? `HTTP ${res.status}`;
      return;
    }
    skill.disableModelInvocation = !allow;
    skillsError.value = "";
  } catch (e) {
    skillsError.value = e instanceof Error ? e.message : String(e);
  } finally {
    busySkills.delete(skill.filePath);
  }
}

const themeOptions = [
  { value: "auto" as const, label: "跟随系统" },
  { value: "light" as const, label: "浅色" },
  { value: "dark" as const, label: "深色" },
];

// 打开抽屉即拉当前数据 模型可能尚未加载
watch(() => ui.settingsOpen, (open) => {
  if (!open) return;
  if (activeTab.value === "models" && !models.modelList.length) refreshModels();
  if (activeTab.value === "skills") void loadSkills();
});
watch(activeTab, (tab) => {
  if (tab === "skills" && !skills.value.length && !skillsError.value) void loadSkills();
});
</script>

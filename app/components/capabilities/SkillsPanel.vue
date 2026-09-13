<template>
  <section class="cap-split" aria-labelledby="skills-title">
    <aside class="cap-index">
      <div class="cap-index-head">
        <div>
          <h2 id="skills-title">技能</h2>
          <p>{{ skills.entries.length }} 个已发现技能</p>
        </div>
        <button
          class="cap-icon-button"
          type="button"
          title="刷新技能"
          aria-label="刷新技能"
          :disabled="skills.loading"
          @click="loadSkills"
        ><RefreshCw :size="16" aria-hidden="true" /></button>
      </div>

      <ResourceSearchInput v-model="query" placeholder="搜索技能" label="搜索技能" />

      <p v-if="skills.error" class="cap-error">{{ skills.error }}</p>
      <div v-else-if="skills.loading" class="cap-loading-list" aria-label="正在加载技能">
        <span v-for="index in 5" :key="index"></span>
      </div>
      <p v-else-if="!skills.entries.length" class="cap-empty">选择项目后可查看全局和项目技能</p>
      <nav v-else class="cap-index-list" aria-label="技能列表">
        <button
          v-for="skill in filteredSkills"
          :key="skill.filePath"
          class="cap-index-item"
          :class="{ selected: skill.filePath === selectedPath }"
          type="button"
          @click="selectedPath = skill.filePath"
        >
          <span class="cap-index-item-name">{{ skill.name }}</span>
          <span class="cap-index-item-meta">{{ skill.disableModelInvocation ? "未调用" : "可调用" }}</span>
        </button>
      </nav>
    </aside>

    <div class="cap-detail">
      <template v-if="selected">
        <header class="cap-detail-head">
          <div>
            <div class="cap-detail-title-row">
              <h2>{{ selected.name }}</h2>
              <span class="cap-status" :class="{ active: !selected.disableModelInvocation }">
                {{ selected.disableModelInvocation ? "不调用" : "可调用" }}
              </span>
            </div>
            <p class="cap-mono" :title="selected.filePath">{{ selected.filePath }}</p>
          </div>
          <label class="cap-switch-row compact">
            <span class="sr-only">允许模型调用</span>
            <input
              :checked="!selected.disableModelInvocation"
              :disabled="skills.updating.has(selected.filePath)"
              type="checkbox"
              role="switch"
              aria-label="允许模型调用"
              @change="changeInvocation(($event.target as HTMLInputElement).checked)"
            >
          </label>
        </header>

        <div class="cap-section">
          <h3>技能说明</h3>
          <p class="cap-description">{{ selected.description || "该技能没有提供说明" }}</p>
        </div>

        <div class="cap-section cap-info-grid">
          <div>
            <h3>来源</h3>
            <p>{{ selected.sourceInfo.source ?? "unknown" }}</p>
          </div>
          <div>
            <h3>基础目录</h3>
            <p class="cap-mono">{{ selected.baseDir }}</p>
          </div>
        </div>

        <div class="cap-section cap-model-note">
          <h3>重新加载</h3>
          <p>变更会写入技能 frontmatter 已运行的 agent 不会被中途替换 下次创建或重新加载资源时生效</p>
        </div>
      </template>
      <div v-else class="cap-empty-detail">从左侧选择一个技能查看详情</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import ResourceSearchInput from "~/components/capabilities/ResourceSearchInput.vue";
import { useSkillsStore } from "~/stores/skills";
import { useWorkspaceStore } from "~/stores/workspace";

const skills = useSkillsStore();
const workspace = useWorkspaceStore();
const query = ref("");
const selectedPath = ref("");

const filteredSkills = computed(() => {
  const text = query.value.trim().toLocaleLowerCase();
  if (!text) return skills.entries;
  return skills.entries.filter((skill) =>
    `${skill.name} ${skill.description} ${skill.sourceInfo.source ?? ""}`.toLocaleLowerCase().includes(text),
  );
});
const selected = computed(() =>
  skills.entries.find((skill) => skill.filePath === selectedPath.value) ?? null,
);

function loadSkills() {
  void skills.load(workspace.selectedCwd);
}

function changeInvocation(allowed: boolean) {
  if (selected.value) void skills.setInvocation(selected.value, allowed);
}

watch([() => skills.entries, filteredSkills], () => {
  if (!selected.value || !filteredSkills.value.some((skill) => skill.filePath === selectedPath.value)) {
    selectedPath.value = filteredSkills.value[0]?.filePath ?? "";
  }
}, { immediate: true });

onMounted(loadSkills);
</script>

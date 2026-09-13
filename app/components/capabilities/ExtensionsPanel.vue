<template>
  <section class="cap-panel" aria-labelledby="extensions-title">
    <div class="cap-panel-heading">
      <div>
        <h2 id="extensions-title">扩展</h2>
        <p>Pi 扩展可以注册工具 命令和模型提供商</p>
      </div>
      <PiIconButton label="刷新扩展" :disabled="extensions.loading" @click="refresh">
        <RefreshCw :size="16" aria-hidden="true" />
      </PiIconButton>
    </div>

    <p v-if="extensions.error" class="cap-error">{{ extensions.error }}</p>
    <div v-else-if="extensions.loading" class="cap-loading-list" aria-label="正在读取扩展">
      <span v-for="index in 3" :key="index"></span>
    </div>
    <PiEmptyState
      v-else-if="!entries.length"
      title="没有发现扩展"
      description="当前工作区和全局标准目录中没有可识别的 Pi 扩展 不会因为扫描而执行任何文件"
    >
      <template #icon><Puzzle :size="22" aria-hidden="true" /></template>
    </PiEmptyState>
    <ul v-else class="cap-extension-list" aria-label="扩展注册表">
      <li v-for="entry in entries" :key="entry.id" class="cap-extension-row">
        <Puzzle :size="17" aria-hidden="true" />
        <div class="cap-extension-main">
          <div class="cap-detail-title-row">
            <strong>{{ entry.name }}</strong>
            <PiStatusTag :tone="entry.status === 'ready' ? 'success' : 'warning'">
              {{ statusLabel(entry.status) }}
            </PiStatusTag>
          </div>
          <p class="cap-mono" :title="entry.filePath">{{ entry.filePath }}</p>
        </div>
        <span class="cap-extension-scope">{{ scopeLabel(entry.scope) }}</span>
      </li>
    </ul>

    <div v-if="extensions.data?.projectNeedsTrust" class="cap-trust-note">
      <span>当前项目含有需要信任的资源 项目扩展必须在明确授权后才能加载</span>
      <PiButton variant="secondary" :disabled="trusting" @click="trustProject">
        {{ trusting ? "确认中" : "信任当前项目" }}
      </PiButton>
    </div>

    <!-- 插件包管理嵌在扩展注册表下方 上下排布 限高容器内独立滚动 -->
    <div class="cap-section">
      <div class="cap-section-head">
        <div>
          <h3>插件包</h3>
          <p>npm Git 与本地路径来源的包 一个包可同时提供扩展 技能 提示词和主题</p>
        </div>
      </div>
      <div class="cap-plugin-embed">
        <PluginsPanel />
      </div>
    </div>

    <div class="cap-section cap-model-note">
      <h3>安全边界</h3>
      <p>扩展是可执行代码 读取未知扩展时不会执行文件 安装和更新插件包会执行第三方代码 需确认来源和作用域</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Puzzle, RefreshCw } from "lucide-vue-next";
import PiButton from "~/components/pi/PiButton/index.vue";
import PiEmptyState from "~/components/pi/PiEmptyState/index.vue";
import PiIconButton from "~/components/pi/PiIconButton/index.vue";
import PiStatusTag from "~/components/pi/PiStatusTag/index.vue";
import PluginsPanel from "~/components/capabilities/PluginsPanel.vue";
import { useExtensionsStore } from "~/stores/extensions";
import { useWorkspaceStore } from "~/stores/workspace";

const extensions = useExtensionsStore();
const workspace = useWorkspaceStore();
const entries = computed(() => extensions.data?.extensions ?? []);
const trusting = ref(false);

const statusLabel = (status: "ready" | "needs-trust") => {
  return status === "ready" ? "已发现" : "等待信任";
};

const scopeLabel = (scope: "global" | "project") => {
  return scope === "global" ? "全局" : "项目";
};

const refresh = () => {
  void extensions.load(workspace.selectedCwd);
};

const trustProject = async () => {
  if (trusting.value) return;
  trusting.value = true;
  try {
    await extensions.trustProject(workspace.selectedCwd);
  } finally {
    trusting.value = false;
  }
};

onMounted(() => {
  void extensions.load(workspace.selectedCwd);
});
</script>

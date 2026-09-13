<template>
  <section class="cap-panel" aria-labelledby="extensions-title">
    <div class="cap-panel-heading">
      <div>
        <h2 id="extensions-title">扩展</h2>
        <p>Pi 扩展可以注册工具 命令和模型提供商</p>
      </div>
      <button class="cap-icon-button" type="button" title="刷新扩展" aria-label="刷新扩展" :disabled="extensions.loading" @click="refresh">
        <RefreshCw :size="16" aria-hidden="true" />
      </button>
    </div>

    <p v-if="extensions.error" class="cap-error">{{ extensions.error }}</p>
    <div v-else-if="extensions.loading" class="cap-loading-list" aria-label="正在读取扩展">
      <span v-for="index in 3" :key="index"></span>
    </div>
    <div v-else-if="!entries.length" class="cap-unavailable">
      <Puzzle :size="22" aria-hidden="true" />
      <div>
        <h3>没有发现扩展</h3>
        <p>当前工作区和全局标准目录中没有可识别的 Pi 扩展 不会因为扫描而执行任何文件</p>
      </div>
    </div>
    <ul v-else class="cap-extension-list" aria-label="扩展注册表">
      <li v-for="entry in entries" :key="entry.id" class="cap-extension-row">
        <Puzzle :size="17" aria-hidden="true" />
        <div class="cap-extension-main">
          <div class="cap-detail-title-row">
            <strong>{{ entry.name }}</strong>
            <span class="cap-status" :class="{ active: entry.status === 'ready' }">{{ statusLabel(entry.status) }}</span>
          </div>
          <p class="cap-mono" :title="entry.filePath">{{ entry.filePath }}</p>
        </div>
        <span class="cap-extension-scope">{{ scopeLabel(entry.scope) }}</span>
      </li>
    </ul>

    <div v-if="extensions.data?.projectNeedsTrust" class="cap-trust-note">
      <span>当前项目含有需要信任的资源 项目扩展必须在明确授权后才能加载</span>
      <button class="cap-secondary-button" type="button" :disabled="trusting" @click="trustProject">
        {{ trusting ? "确认中" : "信任当前项目" }}
      </button>
    </div>

    <div class="cap-section cap-model-note">
      <h3>安全边界</h3>
      <p>扩展是可执行代码 读取未知扩展时不会执行文件 安装和启用前必须确认来源和作用域</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Puzzle, RefreshCw } from "lucide-vue-next";
import { useExtensionsStore } from "~/stores/extensions";
import { useWorkspaceStore } from "~/stores/workspace";

const extensions = useExtensionsStore();
const workspace = useWorkspaceStore();
const entries = computed(() => extensions.data?.extensions ?? []);
const trusting = ref(false);

function statusLabel(status: "ready" | "needs-trust") {
  return status === "ready" ? "已发现" : "等待信任";
}

function scopeLabel(scope: "global" | "project") {
  return scope === "global" ? "全局" : "项目";
}

function refresh() {
  void extensions.load(workspace.selectedCwd);
}

async function trustProject() {
  if (trusting.value) return;
  trusting.value = true;
  try {
    await extensions.trustProject(workspace.selectedCwd);
  } finally {
    trusting.value = false;
  }
}

onMounted(() => void extensions.load(workspace.selectedCwd));
</script>

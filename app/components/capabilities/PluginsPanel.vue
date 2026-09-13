<template>
  <section class="cap-split" aria-labelledby="plugins-title">
    <aside class="cap-index">
      <div class="cap-index-head">
        <div>
          <h2 id="plugins-title">插件</h2>
          <p>{{ packages.length }} 个已配置包</p>
        </div>
        <PiIconButton label="刷新插件" :disabled="plugins.loading" @click="refresh">
          <RefreshCw :size="16" aria-hidden="true" />
        </PiIconButton>
      </div>

      <p v-if="plugins.error" class="cap-error">{{ plugins.error }}</p>
      <div v-else-if="plugins.loading" class="cap-loading-list" aria-label="正在加载插件">
        <span v-for="index in 3" :key="index"></span>
      </div>
      <PiEmptyState
        v-else-if="!packages.length"
        title="没有已配置的插件包"
        description="添加 npm Git 或本地路径来源后 这里会列出包及其提供的资源"
      />

      <!-- 包列表按 project global 分组 与 pi CLI 的 packages 配置一致 -->
      <nav v-else class="cap-index-list" aria-label="插件包列表">
        <div v-for="group in groups" :key="group.scope" class="cap-index-group">
          <p>{{ scopeLabel(group.scope) }}</p>
          <button
            v-for="pkg in group.packages"
            :key="packageKey(pkg)"
            class="cap-index-item"
            :class="{ selected: !addMode && selectedKey === packageKey(pkg) }"
            type="button"
            @click="selecting(pkg)"
          >
            <span class="cap-index-item-name">
              {{ pkg.source }}
              <span v-if="hasUpdate(pkg)" class="cap-plugin-update-flag">
                ↑<span class="sr-only">有可用更新</span>
              </span>
            </span>
            <span class="cap-index-item-meta">{{ metaLine(pkg) }}</span>
          </button>
        </div>
      </nav>

      <div class="cap-action-row">
        <PiButton :variant="addMode ? 'primary' : 'secondary'" @click="openAdd">添加插件</PiButton>
      </div>
    </aside>

    <div class="cap-detail">
      <!-- 安装面板 source 支持三种来源粘贴 pi install 命令会自动归一化 -->
      <template v-if="addMode">
        <header class="cap-detail-head">
          <div class="cap-detail-title-row">
            <h2>添加插件</h2>
          </div>
        </header>

        <div class="cap-section">
          <h3>插件来源</h3>
          <PiInput
            v-model="installSource"
            label="插件来源"
            placeholder="npm:@scope/pkg git:https://github.com/user/repo 或本地绝对路径"
            :disabled="installing"
            clearable
          />
          <p class="cap-choice-note">
            支持 npm: 与 git: 前缀或本地绝对路径 粘贴 pi install xxx 会自动去掉命令部分
          </p>
        </div>

        <div class="cap-section">
          <h3>安装作用域</h3>
          <div class="cap-plugin-scope-toggle" role="radiogroup" aria-label="安装作用域">
            <button
              type="button"
              :class="{ active: installScope === 'global' }"
              :aria-pressed="installScope === 'global'"
              @click="installScope = 'global'"
            >
              全局
            </button>
            <button
              type="button"
              :class="{ active: installScope === 'project' }"
              :disabled="!projectUsable"
              :aria-pressed="installScope === 'project'"
              :title="projectUsable ? undefined : '项目作用域需要先信任当前项目'"
              @click="installScope = 'project'"
            >
              项目
            </button>
          </div>
          <p v-if="!projectUsable" class="cap-choice-note">项目作用域需要先信任当前项目</p>
        </div>

        <div class="cap-action-row">
          <PiButton
            variant="primary"
            :disabled="!installSource.trim() || installing"
            :loading="installing"
            @click="submitInstall"
          >
            安装
          </PiButton>
        </div>

        <p v-if="plugins.actionError" class="cap-error">{{ plugins.actionError }}</p>
        <p v-else-if="plugins.actionMessage" class="cap-choice-note">{{ plugins.actionMessage }}</p>
      </template>

      <!-- 包详情 启停 卸载 更新检查与资源清单 -->
      <template v-else-if="selected">
        <header class="cap-detail-head">
          <div>
            <div class="cap-detail-title-row">
              <h2>{{ selected.source }}</h2>
              <PiStatusTag :tone="statusTone(selected)">{{ statusLabel(selected) }}</PiStatusTag>
            </div>
            <p class="cap-mono" :title="selected.installedPath ?? ''">
              {{ selected.installedPath ?? "安装路径不存在" }}
            </p>
          </div>
          <label class="cap-switch-row compact">
            <span class="sr-only">启用该插件包</span>
            <input
              type="checkbox"
              role="switch"
              aria-label="启用该插件包"
              :checked="!selected.disabled"
              :disabled="busyFor(selected, 'disable') || busyFor(selected, 'enable')"
              @change="toggleDisabled(selected)"
            />
          </label>
        </header>

        <div class="cap-section cap-info-grid">
          <div>
            <h3>包名</h3>
            <p class="cap-mono">{{ selected.packageName ?? "未知" }}</p>
          </div>
          <div>
            <h3>版本</h3>
            <p class="cap-mono">{{ versionLine(selected) }}</p>
          </div>
        </div>

        <!-- 更新检查 npm 走 semver 对比 git 走远端 commit 对比 -->
        <div class="cap-section">
          <h3>更新</h3>
          <div class="cap-action-row">
            <PiButton variant="secondary" :disabled="checkingSelected" @click="checkOne(selected)">
              {{ checkingSelected ? "检查中" : "检查更新" }}
            </PiButton>
            <PiButton
              variant="secondary"
              :disabled="!hasCheckable || anyChecking"
              @click="checkAll"
            >
              {{ anyChecking ? "检查中" : "检查全部" }}
            </PiButton>
            <PiButton
              variant="primary"
              :disabled="!availableUpdateCount || plugins.busyKey === 'update:all'"
              :loading="plugins.busyKey === 'update:all'"
              @click="updateAll"
            >
              一键更新{{ availableUpdateCount ? ` ${availableUpdateCount} 项` : "" }}
            </PiButton>
          </div>
          <p v-if="updateLine(selected)" class="cap-choice-note">{{ updateLine(selected) }}</p>
          <p v-if="plugins.updateError" class="cap-error">{{ plugins.updateError }}</p>
        </div>

        <div class="cap-section">
          <h3>提供的资源</h3>
          <div v-if="resourceGroups(selected).length" class="cap-plugin-resource-groups">
            <div
              v-for="group in resourceGroups(selected)"
              :key="group.kind"
              class="cap-plugin-resource-group"
            >
              <p>{{ group.label }} · {{ group.items.length }}</p>
              <div v-for="resource in group.items" :key="resource.path" class="cap-plugin-resource">
                <span :title="resource.path">{{ resource.name }}</span>
                <span class="cap-mono" :title="resource.path">{{ resource.relativePath }}</span>
              </div>
            </div>
          </div>
          <p v-else class="cap-choice-note">
            {{ selected.disabled ? "该包已禁用" : "该包没有解析出资源" }}
          </p>
        </div>

        <div class="cap-action-row">
          <PiButton
            variant="danger"
            :loading="busyFor(selected, 'remove')"
            @click="remove(selected)"
          >
            卸载
          </PiButton>
        </div>

        <p v-if="plugins.actionMessage" class="cap-choice-note">{{ plugins.actionMessage }}</p>
        <p v-if="plugins.actionError" class="cap-error">{{ plugins.actionError }}</p>

        <div class="cap-section cap-model-note">
          <h3>安全边界</h3>
          <p>安装和更新会执行第三方包代码 请确认来源可信 变更需重建会话后生效</p>
        </div>
      </template>

      <div v-else class="cap-empty-detail">从左侧选择一个包 或添加新插件</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RefreshCw } from "lucide-vue-next";
import PiButton from "~/components/pi/PiButton/index.vue";
import PiEmptyState from "~/components/pi/PiEmptyState/index.vue";
import PiIconButton from "~/components/pi/PiIconButton/index.vue";
import PiInput from "~/components/pi/PiInput/index.vue";
import PiStatusTag from "~/components/pi/PiStatusTag/index.vue";
import { packageKey, usePluginsStore } from "~/stores/plugins";
import { useWorkspaceStore } from "~/stores/workspace";
import type { PluginAction } from "~/stores/plugins";
import type {
  PluginPackageInfo,
  PluginResourceKind,
  PluginScope,
  PluginUpdateResult,
} from "#shared/lib/types";

const plugins = usePluginsStore();
const workspace = useWorkspaceStore();

const addMode = ref(false);
const selectedKey = ref("");
const installSource = ref("");
const installScope = ref<PluginScope>("global");

const packages = computed(() => plugins.data?.packages ?? []);
const projectUsable = computed(() => plugins.data?.projectResourcesLoaded ?? false);
const selected = computed(
  () => packages.value.find((pkg) => packageKey(pkg) === selectedKey.value) ?? null,
);

const anyChecking = computed(() => plugins.checkingKeys.size > 0);
const checkingSelected = computed(() =>
  selected.value ? plugins.checkingKeys.has(packageKey(selected.value)) : false,
);
const installing = computed(() => plugins.busyKey.startsWith("install:"));

const availableUpdateCount = computed(
  () =>
    Object.values(plugins.updateStatuses).filter((status) => status.state === "update-available")
      .length,
);
const hasCheckable = computed(() => packages.value.some((pkg) => pkg.canCheckForUpdates));

const groups = computed(() =>
  (["project", "global"] as PluginScope[])
    .map((scope) => ({ scope, packages: packages.value.filter((pkg) => pkg.scope === scope) }))
    .filter((group) => group.packages.length > 0),
);

const RESOURCE_LABELS: Record<PluginResourceKind, string> = {
  extension: "扩展",
  skill: "技能",
  prompt: "提示词",
  theme: "主题",
};

const STATUS_LABELS: Record<PluginPackageInfo["status"], string> = {
  loaded: "已加载",
  installed: "已安装",
  missing: "路径缺失",
  disabled: "已禁用",
};

const STATUS_TONES: Record<
  PluginPackageInfo["status"],
  "success" | "warning" | "danger" | "neutral"
> = {
  loaded: "success",
  installed: "warning",
  missing: "danger",
  disabled: "neutral",
};

const scopeLabel = (scope: PluginScope): string =>
  scope === "project" ? "项目作用域" : "全局作用域";

const statusLabel = (pkg: PluginPackageInfo): string => STATUS_LABELS[pkg.status];

const statusTone = (pkg: PluginPackageInfo) => STATUS_TONES[pkg.status];

const metaLine = (pkg: PluginPackageInfo): string => {
  if (pkg.disabled) return "已禁用";
  const parts = [
    pkg.counts.extensions ? `扩展 ${pkg.counts.extensions}` : "",
    pkg.counts.skills ? `技能 ${pkg.counts.skills}` : "",
    pkg.counts.prompts ? `提示词 ${pkg.counts.prompts}` : "",
    pkg.counts.themes ? `主题 ${pkg.counts.themes}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "暂无资源统计";
};

const versionLine = (pkg: PluginPackageInfo): string => {
  const parts = [
    pkg.version ? `已装 ${pkg.version}` : "",
    pkg.configuredVersion ? `配置 ${pkg.configuredVersion}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "未知";
};

const hasUpdate = (pkg: PluginPackageInfo): boolean =>
  plugins.updateStatuses[packageKey(pkg)]?.state === "update-available";

const updateLine = (pkg: PluginPackageInfo): string => {
  const status: PluginUpdateResult | undefined = plugins.updateStatuses[packageKey(pkg)];
  if (!status) return "";
  if (status.state === "update-available") return "发现可用更新 可一键更新";
  if (status.state === "up-to-date") return "已是最新版本";
  if (status.state === "unsupported") return status.message ?? "该来源无法自动检查更新";
  return status.message ?? "检查更新失败";
};

const resourceGroups = (pkg: PluginPackageInfo) =>
  (["extension", "skill", "prompt", "theme"] as PluginResourceKind[])
    .map((kind) => ({
      kind,
      label: RESOURCE_LABELS[kind],
      items: pkg.resources.filter((resource) => resource.kind === kind),
    }))
    .filter((group) => group.items.length > 0);

const busyFor = (pkg: PluginPackageInfo, action: PluginAction): boolean =>
  plugins.busyKey === `${action}:${packageKey(pkg)}`;

const selecting = (pkg: PluginPackageInfo) => {
  selectedKey.value = packageKey(pkg);
  addMode.value = false;
  plugins.clearMessages();
};

const openAdd = () => {
  addMode.value = true;
  plugins.clearMessages();
};

// 粘贴 pi install xxx 时去掉命令部分 只留来源
const normalizeSourceInput = (value: string): string => {
  const match = value.trim().match(/^\$?\s*pi\s+install\s+(\S+)\s*$/);
  return match?.[1] ?? value.trim();
};

// 安装后服务端可能归一化 source 字符串 按精确 npm 前缀 尾部匹配 文件名依次回退
const findInstalled = (source: string, scope: PluginScope): PluginPackageInfo | undefined => {
  const withoutNpmPrefix = source.startsWith("npm:") ? source.slice(4) : source;
  const name = withoutNpmPrefix.replaceAll("\\", "/").split("/").filter(Boolean).pop() ?? "";
  return (
    packages.value.find((pkg) => pkg.scope === scope && pkg.source === source) ??
    packages.value.find((pkg) => pkg.scope === scope && pkg.source === `npm:${withoutNpmPrefix}`) ??
    packages.value.find((pkg) => pkg.scope === scope && pkg.source.endsWith(source)) ??
    packages.value.find((pkg) => pkg.scope === scope && pkg.source.endsWith(name))
  );
};

const submitInstall = async () => {
  const source = normalizeSourceInput(installSource.value);
  if (!source) return;
  installSource.value = source;
  const scope = installScope.value;
  await plugins.install(source, scope, workspace.selectedCwd);
  if (plugins.actionError) return;
  addMode.value = false;
  installSource.value = "";
  selectedKey.value = packageKey(findInstalled(source, scope) ?? { source, scope });
};

const toggleDisabled = (pkg: PluginPackageInfo) => {
  void plugins.runAction(pkg.disabled ? "enable" : "disable", pkg, workspace.selectedCwd);
};

const remove = (pkg: PluginPackageInfo) => {
  void plugins.runAction("remove", pkg, workspace.selectedCwd);
};

const checkOne = (pkg: PluginPackageInfo) => {
  void plugins.checkUpdates(pkg, workspace.selectedCwd);
};

const checkAll = () => {
  void plugins.checkUpdates(undefined, workspace.selectedCwd);
};

const updateAll = () => {
  void plugins.runAction("update", undefined, workspace.selectedCwd);
};

const refresh = () => {
  void plugins.load(workspace.selectedCwd);
};

// 数据刷新后保持选中有效 列表为空时自动进入添加面板
watch(packages, () => {
  if (addMode.value) return;
  if (selected.value) return;
  if (packages.value.length) {
    selectedKey.value = packageKey(packages.value[0] as PluginPackageInfo);
    return;
  }
  addMode.value = true;
});

onMounted(refresh);
</script>

<template>
  <section class="cap-split" aria-labelledby="models-title">
    <aside class="cap-index">
      <div class="cap-index-head">
        <div>
          <h2 id="models-title">模型</h2>
          <p>{{ models.modelList.length }} 个可用模型</p>
        </div>
        <div class="cap-action-row">
          <PiButton size="compact" @click="emit('manage')">管理自定义 Provider</PiButton>
          <PiIconButton label="刷新模型" :disabled="models.loading" @click="loadModels"
            ><RefreshCw :size="16" aria-hidden="true"
          /></PiIconButton>
        </div>
      </div>

      <ResourceSearchInput v-model="query" placeholder="搜索模型或 Provider" label="搜索模型" />

      <p v-if="models.modelError" class="cap-error">{{ modelError }}</p>
      <p v-for="warning in models.modelScopeWarnings" :key="warning" class="cap-readonly">
        {{ warning }}
      </p>
      <div
        v-if="models.loading && !models.modelList.length"
        class="cap-loading-list"
        aria-label="正在加载模型"
      >
        <span v-for="index in 5" :key="index"></span>
      </div>
      <PiEmptyState
        v-else-if="!models.modelList.length"
        title="没有可用模型"
        description="选择项目后可查看本机已配置模型"
      />
      <nav v-else class="cap-index-list" aria-label="模型列表">
        <div v-for="group in groups" :key="group.provider" class="cap-index-group">
          <p>{{ group.provider }}</p>
          <button
            v-for="model in group.models"
            :key="keyOf(model)"
            class="cap-index-item"
            :class="{ selected: keyOf(model) === selectedKey }"
            type="button"
            @click="selectedKey = keyOf(model)"
          >
            <span class="cap-index-item-name">{{ model.name || model.id }}</span>
            <span class="cap-index-item-meta">
              <span v-if="isCurrent(model)">当前</span>
              <span v-else-if="isDefault(model)">默认</span>
              <span v-else>{{ model.id }}</span>
            </span>
          </button>
        </div>
      </nav>
      <p v-if="filteredModels.length > visibleModels.length" class="cap-limit">
        仅显示前 {{ visibleModels.length }} 个匹配模型 请继续搜索缩小范围
      </p>
    </aside>

    <div class="cap-detail">
      <template v-if="selected">
        <header class="cap-detail-head">
          <div>
            <div class="cap-detail-title-row">
              <h2>{{ selected.name || selected.id }}</h2>
              <PiStatusTag v-if="isCurrent(selected)" tone="active">当前会话</PiStatusTag>
              <PiStatusTag v-else-if="isDefault(selected)">默认模型</PiStatusTag>
            </div>
            <p class="cap-mono">{{ selected.provider }} / {{ selected.id }}</p>
          </div>
          <div class="cap-action-row">
            <PiButton
              variant="secondary"
              :disabled="isDefault(selected) || savingDefault"
              @click="setDefault"
              >{{ defaultLabel }}</PiButton
            >
            <PiButton
              variant="primary"
              :disabled="!chat.sessionId || isCurrent(selected) || switching"
              @click="useInSession"
              >{{ actionLabel }}</PiButton
            >
          </div>
        </header>

        <div class="cap-section">
          <h3>输入能力</h3>
          <div class="cap-tag-list">
            <span v-for="kind in selected.input" :key="kind" class="cap-tag">{{
              inputLabel(kind)
            }}</span>
            <span v-if="!selected.input.length" class="cap-readonly">未提供能力信息</span>
          </div>
        </div>

        <div class="cap-section">
          <h3>思考等级</h3>
          <div v-if="thinkingLevels.length" class="cap-tag-list">
            <span v-for="level in thinkingLevels" :key="level" class="cap-tag mono">{{
              level
            }}</span>
          </div>
          <p v-else class="cap-readonly">该模型没有可选思考等级</p>
        </div>

        <div class="cap-section cap-model-note">
          <h3>作用范围</h3>
          <p>此处只切换当前会话的模型 选择会作为会话历史的一部分保存 不会修改全局默认模型或凭证</p>
        </div>
      </template>
      <div v-else class="cap-empty-detail">从左侧选择一个模型查看详情</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RefreshCw } from "lucide-vue-next";
import PiButton from "~/components/pi/PiButton/index.vue";
import PiEmptyState from "~/components/pi/PiEmptyState/index.vue";
import PiIconButton from "~/components/pi/PiIconButton/index.vue";
import PiStatusTag from "~/components/pi/PiStatusTag/index.vue";
import ResourceSearchInput from "~/components/capabilities/ResourceSearchInput.vue";
import { useChatStore } from "~/stores/chat";
import { useModelsStore } from "~/stores/models";
import { useWorkspaceStore } from "~/stores/workspace";
import type { ModelListEntry } from "#shared/lib/types";

const emit = defineEmits<{ manage: [] }>();

const models = useModelsStore();
const chat = useChatStore();
const workspace = useWorkspaceStore();
const query = ref("");
const selectedKey = ref("");
const switching = ref(false);
const savingDefault = ref(false);

const modelError = computed(() => {
  if (/auth\.json\.lock|EPERM/i.test(models.modelError))
    return "模型配置正被其他 pi 进程占用 请稍后刷新";
  return models.modelError;
});
const filteredModels = computed(() => {
  const text = query.value.trim().toLocaleLowerCase();
  if (!text) return models.modelList;
  return models.modelList.filter((model) =>
    `${model.name} ${model.id} ${model.provider}`.toLocaleLowerCase().includes(text),
  );
});
const visibleModels = computed(() => filteredModels.value.slice(0, 200));
const groups = computed(() => {
  const byProvider = new Map<string, ModelListEntry[]>();
  for (const model of visibleModels.value) {
    const list = byProvider.get(model.provider) ?? [];
    list.push(model);
    byProvider.set(model.provider, list);
  }
  return [...byProvider].map(([provider, list]) => ({ provider, models: list }));
});
const selected = computed(
  () => models.modelList.find((model) => keyOf(model) === selectedKey.value) ?? null,
);
const thinkingLevels = computed(() =>
  selected.value ? (models.thinkingLevels[keyOf(selected.value)] ?? []) : [],
);
const actionLabel = computed(() => {
  if (!chat.sessionId) return "先打开会话";
  if (switching.value) return "切换中";
  if (selected.value && isCurrent(selected.value)) return "当前模型";
  return "用于当前会话";
});
const defaultLabel = computed(() => {
  if (savingDefault.value) return "保存中";
  return selected.value && isDefault(selected.value) ? "默认模型" : "设为默认";
});

const keyOf = (model: Pick<ModelListEntry, "provider" | "id">) => {
  return `${model.provider}:${model.id}`;
};

const isCurrent = (model: Pick<ModelListEntry, "provider" | "id">) => {
  return chat.model?.provider === model.provider && chat.model.id === model.id;
};

const isDefault = (model: Pick<ModelListEntry, "provider" | "id">) => {
  return (
    models.defaultModel?.provider === model.provider && models.defaultModel.modelId === model.id
  );
};

const inputLabel = (input: string) => {
  return input === "image" ? "图片输入" : input === "text" ? "文本输入" : input;
};

const loadModels = () => {
  if (workspace.selectedCwd) void models.load(workspace.selectedCwd);
};

const useInSession = async () => {
  if (!selected.value || switching.value) return;
  switching.value = true;
  try {
    await chat.setModel(selected.value.provider, selected.value.id);
  } finally {
    switching.value = false;
  }
};

const setDefault = async () => {
  if (!selected.value || savingDefault.value) return;
  savingDefault.value = true;
  try {
    await models.setDefault(workspace.selectedCwd, selected.value.provider, selected.value.id);
  } finally {
    savingDefault.value = false;
  }
};

watch(
  [() => models.modelList, () => chat.model],
  () => {
    const current = models.modelList.find(isCurrent);
    if (!selected.value || !models.modelList.some((model) => keyOf(model) === selectedKey.value)) {
      selectedKey.value = current
        ? keyOf(current)
        : models.modelList[0]
          ? keyOf(models.modelList[0])
          : "";
    }
  },
  { immediate: true },
);

onMounted(loadModels);
</script>

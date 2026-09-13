<template>
  <section class="cap-split" aria-labelledby="provider-title">
    <aside class="cap-index">
      <div class="cap-index-head">
        <div>
          <h2 id="provider-title">自定义 Provider</h2>
          <p>{{ config.providerNames.length }} 个配置 来自 models.json</p>
        </div>
        <div class="cap-action-row">
          <PiButton size="compact" @click="emit('back')">返回模型列表</PiButton>
        </div>
      </div>

      <!-- 新建 Provider 只需要名称 其余字段创建后在右侧补充 -->
      <form v-if="creating" class="cap-new-provider" @submit.prevent="confirmCreate">
        <input
          v-model="newName"
          class="cap-new-provider-input"
          placeholder="Provider 名称 例如 my-gateway"
          aria-label="新 Provider 名称"
        />
        <div class="cap-action-row">
          <PiButton variant="primary" size="compact" type="submit" :disabled="!newName.trim()"
            >创建</PiButton
          >
          <PiButton size="compact" type="button" @click="creating = false">取消</PiButton>
        </div>
      </form>

      <p v-if="config.loadError" class="cap-error">{{ config.loadError }}</p>
      <div
        v-if="config.loading && !config.providerNames.length"
        class="cap-loading-list"
        aria-label="正在加载配置"
      >
        <span v-for="index in 3" :key="index"></span>
      </div>
      <PiEmptyState
        v-else-if="!config.providerNames.length && !creating"
        title="还没有自定义 Provider"
        description="新建 Provider 后保存 会写入 ~/.pi/agent/models.json 与 pi CLI 共享"
      />
      <nav v-else class="cap-index-list" aria-label="自定义 Provider 列表">
        <button
          v-for="name in config.providerNames"
          :key="name"
          class="cap-index-item"
          :class="{ selected: name === selectedName }"
          type="button"
          @click="selectProvider(name)"
        >
          <span class="cap-index-item-name">{{ name }}</span>
          <span class="cap-index-item-meta">{{ modelCount(name) }} 个模型</span>
        </button>
      </nav>

      <div class="cap-save-bar">
        <PiButton
          variant="primary"
          :loading="config.saving"
          :disabled="!config.dirty"
          @click="saveAll"
          >保存全部</PiButton
        >
        <PiButton :disabled="!config.dirty || config.saving" @click="discardDraft"
          >放弃修改</PiButton
        >
      </div>
      <p v-if="config.saveError" class="cap-error">{{ config.saveError }}</p>
      <p v-if="justSaved" class="cap-readonly">已保存 模型列表已刷新</p>
    </aside>

    <div class="cap-detail">
      <template v-if="selectedName && config.providers[selectedName]">
        <!-- 模型编辑层 从 provider 详情点进某个模型 -->
        <template v-if="editingModelIndex !== null">
          <header class="cap-detail-head">
            <div>
              <h2>编辑模型</h2>
              <p class="cap-mono">{{ selectedName }} / {{ editingModel?.id || "未命名模型" }}</p>
            </div>
            <div class="cap-action-row">
              <PiButton @click="editingModelIndex = null">返回 Provider</PiButton>
            </div>
          </header>
          <ModelForm :provider-name="selectedName" :index="editingModelIndex" />
        </template>

        <template v-else>
          <header class="cap-detail-head">
            <div>
              <h2>{{ selectedName }}</h2>
              <p>baseUrl 与 api 决定请求协议 密钥明文保存在 models.json</p>
            </div>
            <div class="cap-action-row">
              <PiButton @click="config.addModel(selectedName)">添加模型</PiButton>
              <PiButton variant="danger" @click="removeSelected">删除 Provider</PiButton>
            </div>
          </header>

          <ProviderForm :name="selectedName" />

          <div class="cap-section">
            <h3>模型列表</h3>
            <p v-if="!providerModels.length" class="cap-readonly">还没有模型 点击右上角添加模型</p>
            <ul v-else class="cap-model-rows">
              <li v-for="(model, index) in providerModels" :key="index" class="cap-model-row">
                <button class="cap-model-row-open" type="button" @click="editingModelIndex = index">
                  <span class="cap-model-row-id">{{ model.id || "未命名模型" }}</span>
                  <span class="cap-model-row-meta">{{ modelSummary(model) }}</span>
                </button>
                <PiIconButton
                  label="删除模型"
                  size="compact"
                  @click="config.removeModel(selectedName, index)"
                  ><Trash2 :size="14" aria-hidden="true"
                /></PiIconButton>
              </li>
            </ul>
          </div>
        </template>
      </template>
      <div v-else class="cap-empty-detail">从左侧选择一个 Provider 或新建一个</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Trash2 } from "lucide-vue-next";
import PiButton from "~/components/pi/PiButton/index.vue";
import PiEmptyState from "~/components/pi/PiEmptyState/index.vue";
import PiIconButton from "~/components/pi/PiIconButton/index.vue";
import ProviderForm from "~/components/capabilities/models/ProviderForm.vue";
import ModelForm from "~/components/capabilities/models/ModelForm.vue";
import { useModelsConfigStore } from "~/stores/models-config";
import { useModelsStore } from "~/stores/models";
import { useWorkspaceStore } from "~/stores/workspace";
import type { CustomModelConfig } from "#shared/lib/types";

const emit = defineEmits<{ back: [] }>();

const config = useModelsConfigStore();
const models = useModelsStore();
const workspace = useWorkspaceStore();
const selectedName = ref("");
const creating = ref(false);
const newName = ref("");
// null 表示在 provider 详情层 数字表示正在编辑该下标的模型
const editingModelIndex = ref<number | null>(null);
const justSaved = ref(false);

const providerModels = computed(() => config.providers[selectedName.value]?.models ?? []);
const editingModel = computed(() =>
  editingModelIndex.value === null ? null : (providerModels.value[editingModelIndex.value] ?? null),
);

const modelCount = (name: string) => {
  return config.providers[name]?.models?.length ?? 0;
};

const modelSummary = (model: CustomModelConfig) => {
  const parts: string[] = [];
  if (model.api) parts.push(model.api);
  if (model.reasoning) parts.push("reasoning");
  if (model.contextWindow) parts.push(`${model.contextWindow} ctx`);
  return parts.join(" · ") || "未补充参数";
};

const selectProvider = (name: string) => {
  selectedName.value = name;
  editingModelIndex.value = null;
};

const confirmCreate = () => {
  const name = newName.value.trim();
  if (!name) return;
  config.upsertProvider(name);
  selectProvider(name);
  newName.value = "";
  creating.value = false;
};

const removeSelected = () => {
  if (!selectedName.value) return;
  // 草稿层面的删除 未保存前随时可以放弃修改找回
  config.removeProvider(selectedName.value);
  selectedName.value = "";
  editingModelIndex.value = null;
};

// 保存成功后立刻刷新模型列表 新增的模型马上出现在浏览视图
const saveAll = async () => {
  justSaved.value = false;
  const ok = await config.save();
  if (!ok) return;
  if (workspace.selectedCwd) void models.load(workspace.selectedCwd);
  justSaved.value = true;
};

const discardDraft = async () => {
  await config.load();
  selectProvider(selectedName.value);
};

onMounted(() => {
  void config.load();
});
</script>

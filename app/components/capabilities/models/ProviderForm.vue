<template>
  <div class="cap-section">
    <h3>连接配置</h3>
    <div class="cap-form-grid">
      <label class="cap-field">
        <span>Base URL</span>
        <input v-model="baseUrl" placeholder="https://api.example.com/v1" spellcheck="false" />
      </label>
      <label class="cap-field">
        <span>API 协议</span>
        <select v-model="api">
          <option value="">跟随默认 openai-completions</option>
          <option v-for="option in API_OPTIONS" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
      <label class="cap-field">
        <span>API Key 明文保存在 models.json 不要把该文件提交到仓库或分享</span>
        <input v-model="apiKey" type="password" autocomplete="off" spellcheck="false" />
      </label>
    </div>
  </div>

  <div class="cap-section">
    <h3>自定义请求头</h3>
    <p class="cap-readonly">常用于网关鉴权或代理转发 名称留空的行会被忽略</p>
    <div class="cap-header-rows">
      <div v-for="row in headerRows" :key="row.id" class="cap-header-row">
        <input
          v-model="row.name"
          placeholder="Header 名称"
          spellcheck="false"
          @input="applyHeaders"
        />
        <input v-model="row.value" placeholder="值" spellcheck="false" @input="applyHeaders" />
        <PiIconButton label="删除该请求头" size="compact" @click="removeRow(row.id)">
          <X :size="14" aria-hidden="true" />
        </PiIconButton>
      </div>
    </div>
    <PiButton size="compact" @click="addRow">添加请求头</PiButton>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { X } from "lucide-vue-next";
import PiButton from "~/components/pi/PiButton/index.vue";
import PiIconButton from "~/components/pi/PiIconButton/index.vue";
import { useModelsConfigStore } from "~/stores/models-config";

const props = defineProps<{ name: string }>();

const config = useModelsConfigStore();

const API_OPTIONS = [
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
] as const;

interface HeaderRow {
  id: number;
  name: string;
  value: string;
}

let rowSeq = 0;
const headerRows = ref<HeaderRow[]>([]);

const provider = computed(() => config.providers[props.name]);

const baseUrl = computed({
  get: () => provider.value?.baseUrl ?? "",
  set: (value) => {
    if (!provider.value) return;
    provider.value.baseUrl = value.trim() || undefined;
    config.markDirty();
  },
});

const api = computed({
  get: () => provider.value?.api ?? "",
  set: (value) => {
    if (!provider.value) return;
    provider.value.api = value || undefined;
    config.markDirty();
  },
});

const apiKey = computed({
  get: () => provider.value?.apiKey ?? "",
  set: (value) => {
    if (!provider.value) return;
    provider.value.apiKey = value || undefined;
    config.markDirty();
  },
});

// 行编辑在本地草稿上进行 每次输入都序列化回 store 保证草稿始终可保存
const applyHeaders = () => {
  if (!provider.value) return;
  const headers: Record<string, string> = {};
  for (const row of headerRows.value) {
    const name = row.name.trim();
    if (name) headers[name] = row.value;
  }
  provider.value.headers = Object.keys(headers).length ? headers : undefined;
  config.markDirty();
};

const syncRows = () => {
  headerRows.value = Object.entries(provider.value?.headers ?? {}).map(([name, value]) => ({
    id: ++rowSeq,
    name,
    value: value ?? "",
  }));
};

const addRow = () => {
  headerRows.value.push({ id: ++rowSeq, name: "", value: "" });
};

const removeRow = (id: number) => {
  headerRows.value = headerRows.value.filter((row) => row.id !== id);
  applyHeaders();
};

// 切换 provider 时按该 provider 的 headers 重建行 本地行状态不能跨 provider 串
watch(() => props.name, syncRows, { immediate: true });
</script>

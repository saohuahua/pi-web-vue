<template>
  <div class="cap-section">
    <h3>模型字段</h3>
    <p class="cap-readonly">
      id 必填 保存时未填写 id 的模型会被丢弃 compat thinkingLevelMap 等未展示字段原样保留
    </p>
    <div class="cap-form-grid">
      <div class="cap-field-row">
        <label class="cap-field">
          <span>模型 ID 上游接口使用的标识</span>
          <input v-model="modelId" placeholder="gpt-4o claude-sonnet-4 等" spellcheck="false" />
        </label>
        <label class="cap-field">
          <span>显示名称 可留空</span>
          <input v-model="modelName" placeholder="默认与 ID 相同" spellcheck="false" />
        </label>
      </div>

      <label class="cap-field">
        <span>API 协议覆盖 可留空跟随 Provider</span>
        <select v-model="modelApi">
          <option value="">跟随 Provider</option>
          <option v-for="option in API_OPTIONS" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>

      <div class="cap-field-row">
        <label class="cap-field cap-check-field">
          <span>
            <input v-model="reasoning" type="checkbox" />
            支持思考 reasoning
          </span>
        </label>
        <div class="cap-field">
          <span>输入能力</span>
          <div class="cap-check-group">
            <label v-for="kind in INPUT_KINDS" :key="kind" class="cap-check-label">
              <input v-model="inputKinds" type="checkbox" :value="kind" />
              {{ kind }}
            </label>
          </div>
        </div>
      </div>

      <div class="cap-field-row">
        <label class="cap-field">
          <span>上下文窗口 tokens</span>
          <input v-model.number="contextWindow" type="number" min="0" placeholder="例如 200000" />
        </label>
        <label class="cap-field">
          <span>最大输出 tokens</span>
          <input v-model.number="maxTokens" type="number" min="0" placeholder="例如 8192" />
        </label>
      </div>
    </div>
  </div>

  <div class="cap-section">
    <h3>费用 每百万 token 美元</h3>
    <div class="cap-field-row">
      <label v-for="key in COST_KEYS" :key="key" class="cap-field">
        <span>{{ COST_LABELS[key] }}</span>
        <input
          :value="costDraft[key]"
          type="number"
          min="0"
          step="any"
          @input="onCostInput(key, $event)"
        />
      </label>
    </div>
  </div>

  <div class="cap-section">
    <h3>连通性测试</h3>
    <p class="cap-readonly">用当前草稿真实请求一次 不需要先保存 配置无效不影响已保存内容</p>
    <div class="cap-action-row">
      <PiButton variant="primary" :loading="testing" :disabled="!modelId.trim()" @click="runTest"
        >测试连通</PiButton
      >
      <PiButton variant="danger" @click="removeSelf">删除该模型</PiButton>
    </div>
    <div v-if="result?.ok" class="cap-action-row">
      <PiStatusTag tone="success">连通成功</PiStatusTag>
      <span v-if="result.latencyMs !== undefined" class="cap-readonly"
        >{{ result.latencyMs }}ms</span
      >
      <span v-if="result.status" class="cap-readonly">HTTP {{ result.status }}</span>
    </div>
    <p v-if="result?.ok && result.responseText" class="cap-mono cap-test-text">
      {{ result.responseText }}
    </p>
    <div v-if="result && !result.ok" class="cap-action-row">
      <PiStatusTag tone="danger">连通失败</PiStatusTag>
    </div>
    <p v-if="result && !result.ok" class="cap-error">{{ result.error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import PiButton from "~/components/pi/PiButton/index.vue";
import PiStatusTag from "~/components/pi/PiStatusTag/index.vue";
import { useModelsConfigStore } from "~/stores/models-config";
import type { CustomModelConfig, ModelsConfigTestResult } from "#shared/lib/types";

const props = defineProps<{ providerName: string; index: number }>();

const config = useModelsConfigStore();

const API_OPTIONS = [
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
] as const;
const INPUT_KINDS = ["text", "image"] as const;
const COST_KEYS = ["input", "output", "cacheRead", "cacheWrite"] as const;
const COST_LABELS: Record<(typeof COST_KEYS)[number], string> = {
  input: "输入",
  output: "输出",
  cacheRead: "缓存读",
  cacheWrite: "缓存写",
};

const model = computed<CustomModelConfig | undefined>(
  () => config.providers[props.providerName]?.models?.[props.index],
);

const writeModel = (apply: (draft: CustomModelConfig) => void) => {
  if (!model.value) return;
  apply(model.value);
  config.markDirty();
};

const modelId = computed({
  get: () => model.value?.id ?? "",
  set: (value) =>
    writeModel((draft) => {
      draft.id = value;
    }),
});

const modelName = computed({
  get: () => model.value?.name ?? "",
  set: (value) =>
    writeModel((draft) => {
      draft.name = value || undefined;
    }),
});

const modelApi = computed({
  get: () => model.value?.api ?? "",
  set: (value) =>
    writeModel((draft) => {
      draft.api = value || undefined;
    }),
});

const reasoning = computed({
  get: () => model.value?.reasoning ?? false,
  set: (value) =>
    writeModel((draft) => {
      draft.reasoning = value || undefined;
    }),
});

const inputKinds = computed({
  get: () => model.value?.input ?? [],
  set: (value) =>
    writeModel((draft) => {
      draft.input = value.length ? [...value] : undefined;
    }),
});

// 数字字段三种取值 空串删除字段 合法数字写入 非法输入忽略不落草稿
const numberField = (key: "contextWindow" | "maxTokens") =>
  computed({
    get: () => {
      const value = model.value?.[key];
      return value === undefined ? "" : value;
    },
    set: (value: number | string) => {
      writeModel((draft) => {
        if (value === "") draft[key] = undefined;
        else if (typeof value === "number" && Number.isFinite(value) && value >= 0)
          draft[key] = value;
      });
    },
  });
const contextWindow = numberField("contextWindow");
const maxTokens = numberField("maxTokens");

const costDraft = computed<Record<(typeof COST_KEYS)[number], number | "">>(() => ({
  input: model.value?.cost?.input ?? "",
  output: model.value?.cost?.output ?? "",
  cacheRead: model.value?.cost?.cacheRead ?? "",
  cacheWrite: model.value?.cost?.cacheWrite ?? "",
}));

const setCost = (key: (typeof COST_KEYS)[number], value: number | "") => {
  writeModel((draft) => {
    if (value === "") {
      if (draft.cost) delete draft.cost[key];
      return;
    }
    if (!Number.isFinite(value) || value < 0) return;
    if (!draft.cost) draft.cost = {};
    draft.cost[key] = value;
  });
};

// costDraft 是只读投影 不能直接 v-model 必须经 setCost 写回草稿
const onCostInput = (key: (typeof COST_KEYS)[number], event: Event) => {
  const raw = (event.target as HTMLInputElement).value;
  setCost(key, raw === "" ? "" : Number(raw));
};

const testing = ref(false);
const result = ref<ModelsConfigTestResult | null>(null);

const runTest = async () => {
  const draft = model.value;
  const provider = config.providers[props.providerName];
  if (!draft?.id.trim() || !provider || testing.value) return;
  testing.value = true;
  result.value = null;
  try {
    result.value = await config.testModel(props.providerName, provider, draft);
  } finally {
    testing.value = false;
  }
};

const removeSelf = () => {
  config.removeModel(props.providerName, props.index);
};
</script>

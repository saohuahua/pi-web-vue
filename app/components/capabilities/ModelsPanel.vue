<template>
  <!-- 浏览视图展示本机可用模型 管理视图编辑 models.json 里的自定义 Provider -->
  <ModelsBrowseView v-if="view === 'browse'" @manage="view = 'manage'" />
  <ProviderManageView v-else @back="view = 'browse'" />
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import ModelsBrowseView from "~/components/capabilities/models/ModelsBrowseView.vue";
import ProviderManageView from "~/components/capabilities/models/ProviderManageView.vue";
import { useCapabilityCenterStore } from "~/stores/capability-center";
import { useModelsConfigStore } from "~/stores/models-config";

// 管理视图草稿的 dirty 决定能力中心关闭时要不要弹放弃确认
const center = useCapabilityCenterStore();
const config = useModelsConfigStore();
const view = ref<"browse" | "manage">("browse");

watch(
  () => config.dirty,
  (value) => {
    center.setDirty(value);
  },
);
</script>

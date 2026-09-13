<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="project-directory-dialog"
      aria-labelledby="project-directory-title"
      @cancel.prevent="requestClose"
      @click.self="requestClose"
      @close="onClosed"
    >
      <section class="directory-picker">
        <header class="directory-picker-header">
          <h2 id="project-directory-title">选择项目目录</h2>
          <PiIconButton label="关闭目录选择" :disabled="props.busy" @click="requestClose">
            <X :size="18" aria-hidden="true" />
          </PiIconButton>
        </header>

        <form class="directory-picker-path-form" @submit.prevent="submitPath">
          <PiIconButton
            label="转到上级目录"
            :disabled="loading || !canNavigateUp"
            @click="navigateUp"
          >
            <ArrowUp :size="17" aria-hidden="true" />
          </PiIconButton>
          <div class="directory-picker-path">
            <PiInput
              v-model="pathInput"
              label="项目目录路径"
              placeholder="输入或选择项目目录"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          <PiButton type="submit" :disabled="loading || !pathInput.trim()">转到</PiButton>
        </form>

        <div class="directory-picker-list" role="group" aria-label="目录列表" :aria-busy="loading">
          <p v-if="loading" class="directory-picker-state">正在读取目录</p>
          <template v-else-if="drives !== null">
            <button
              v-for="drive in drives"
              :key="drive.path"
              class="directory-picker-entry"
              type="button"
              :title="drive.path"
              @click="navigateTo(drive.path)"
            >
              <HardDrive :size="16" aria-hidden="true" />
              <span>{{ drive.name }}</span>
            </button>
            <p v-if="!drives.length" class="directory-picker-state">没有可访问的盘符</p>
          </template>
          <template v-else>
            <button
              v-for="entry in directories"
              :key="entry.path"
              class="directory-picker-entry"
              type="button"
              :title="entry.path"
              @click="navigateTo(entry.path)"
            >
              <Folder :size="16" aria-hidden="true" />
              <span>{{ entry.name }}</span>
            </button>
            <p v-if="!directories.length" class="directory-picker-state">当前目录没有子文件夹</p>
          </template>
          <p v-if="loadError || props.error" class="directory-picker-error">
            {{ loadError || props.error }}
          </p>
        </div>

        <footer class="directory-picker-footer">
          <PiButton variant="secondary" :disabled="props.busy" @click="requestClose">取消</PiButton>
          <PiButton
            variant="primary"
            :loading="props.busy"
            :disabled="!canSelect"
            @click="selectCurrentDirectory"
          >
            选择此文件夹
          </PiButton>
        </footer>
      </section>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ArrowUp, Folder, HardDrive, X } from "lucide-vue-next";
import PiButton from "~/components/pi/PiButton/index.vue";
import PiIconButton from "~/components/pi/PiIconButton/index.vue";
import PiInput from "~/components/pi/PiInput/index.vue";

interface DirectoryEntry {
  name: string;
  path: string;
}

interface DirectoryBrowseResponse {
  path?: string;
  parentPath?: string | null;
  directories?: DirectoryEntry[];
  drives?: DirectoryEntry[];
  error?: string;
}

const props = withDefaults(
  defineProps<{
    open: boolean;
    initialPath?: string | null;
    busy?: boolean;
    error?: string;
  }>(),
  {
    initialPath: null,
    busy: false,
    error: "",
  },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  select: [path: string];
}>();

const dialog = ref<HTMLDialogElement | null>(null);
const currentPath = ref("");
const parentPath = ref<string | null>(null);
const pathInput = ref("");
const directories = ref<DirectoryEntry[]>([]);
const drives = ref<DirectoryEntry[] | null>(null);
const loadError = ref("");
const loading = ref(false);
let latestRequest = 0;

const isWindowsDriveRoot = computed(() => /^[a-zA-Z]:[\\/]?$/.test(currentPath.value));
const canNavigateUp = computed(() => Boolean(parentPath.value) || isWindowsDriveRoot.value);
const canSelect = computed(
  () =>
    Boolean(currentPath.value) &&
    currentPath.value === pathInput.value.trim() &&
    !loading.value &&
    !props.busy,
);

// 快速切换目录时只接收最后一次返回
const navigateTo = async (directory?: string) => {
  const request = ++latestRequest;
  loading.value = true;
  loadError.value = "";

  try {
    const query = directory ? `?path=${encodeURIComponent(directory)}` : "";
    const response = await fetch(`/api/cwd/browse${query}`);
    const data = (await response.json()) as DirectoryBrowseResponse;
    if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);
    if (request !== latestRequest) return;

    currentPath.value = data.path ?? "";
    parentPath.value = data.parentPath ?? null;
    pathInput.value = data.path ?? "";
    directories.value = data.directories ?? [];
    drives.value = data.drives ?? null;
  } catch (error) {
    if (request !== latestRequest) return;
    loadError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (request === latestRequest) loading.value = false;
  }
};

const submitPath = () => {
  const candidate = pathInput.value.trim();
  if (candidate) void navigateTo(candidate);
};

const navigateUp = () => {
  void navigateTo(parentPath.value ?? undefined);
};

const selectCurrentDirectory = () => {
  if (!canSelect.value) return;
  emit("select", currentPath.value);
};

const requestClose = () => {
  if (props.busy) return;
  emit("update:open", false);
};

const onClosed = () => {
  if (props.open) emit("update:open", false);
};

watch(
  () => props.open,
  async (open) => {
    if (open) {
      await nextTick();
      if (!dialog.value?.open) dialog.value?.showModal();
      await navigateTo(props.initialPath ?? undefined);
      return;
    }
    if (dialog.value?.open) dialog.value.close();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close();
});
</script>

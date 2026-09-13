<template>
  <div v-if="node.isDir" class="select-none">
    <!-- 目录行 点击展开或收起 -->
    <div
      class="file-tree-row group flex cursor-pointer items-center gap-1 px-1 py-[3px] text-[12px] text-ink-soft transition-colors hover:bg-surface-2"
      :style="{ paddingLeft: `${depth * 12 + 4}px` }"
    >
      <button class="file-row-main" type="button" :aria-expanded="expanded" @click="emit('toggle', node)">
        <ChevronRight :size="12" class="shrink-0 transition-transform duration-150" :class="{ 'rotate-90': expanded }" aria-hidden="true" />
        <FileKindIcon :name="node.name" is-dir :open="expanded" :size="15" />
        <span class="min-w-0 flex-1 truncate" :title="node.name">{{ node.name }}</span>
      </button>
    </div>
    <!-- 展开后渲染子节点 目录按需加载 -->
    <template v-if="expanded">
      <div v-if="node.loading" class="py-1 text-[12px] text-muted" :style="{ paddingLeft: `${(depth + 1) * 12 + 8}px` }">加载中…</div>
      <template v-else>
        <FileTreeNode
          v-for="child in node.children"
          :key="child.path"
          :node="child"
          :depth="depth + 1"
          :expanded-paths="expandedPaths"
          @toggle="emit('toggle', $event)"
          @open="emit('open', $event)"
          @mention="emit('mention', $event)"
        />
      </template>
    </template>
  </div>

  <!-- 文件行 点击打开预览 悬停出现 @ 引用按钮 -->
  <div
    v-else
    class="file-tree-row group flex cursor-pointer items-center gap-1.5 px-1 py-[3px] text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    :style="{ paddingLeft: `${depth * 12 + 4}px` }"
  >
    <button class="file-row-main" type="button" :title="node.path" @click="emit('open', node.path)">
      <FileKindIcon :name="node.name" :size="15" />
      <span class="min-w-0 flex-1 truncate">{{ node.name }}</span>
    </button>
    <button
      class="file-row-action shrink-0 rounded bg-accent-soft px-1.5 font-mono text-[12px] leading-4 text-accent-deep"
      type="button"
      title="引用到输入框"
      aria-label="引用到输入框"
      @click="emit('mention', node.path)"
    ><AtSign :size="12" aria-hidden="true" /></button>
  </div>
</template>

<script setup lang="ts">
import { AtSign, ChevronRight } from "lucide-vue-next";
import FileKindIcon from "~/components/FileKindIcon.vue";

// 递归树节点 SFC 可按文件名自引用
// 展开状态放在父级统一管理 切 cwd 时一次性重置
export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
  loaded?: boolean;
  loading?: boolean;
}

const props = defineProps<{
  node: FileNode;
  depth: number;
  expandedPaths: Set<string>;
}>();

const emit = defineEmits<{
  toggle: [node: FileNode];
  open: [path: string];
  mention: [path: string];
}>();

const expanded = computed(() => props.expandedPaths.has(props.node.path));
</script>

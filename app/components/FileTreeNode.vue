<template>
  <div v-if="node.isDir" class="select-none">
    <!-- 目录行 点击展开或收起 -->
    <div
      class="group flex cursor-pointer items-center gap-1 rounded px-1 py-[3px] text-[12px] text-ink-soft transition-colors hover:bg-surface-2"
      :style="{ paddingLeft: `${depth * 12 + 4}px` }"
      @click="emit('toggle', node)"
    >
      <span
        class="inline-block h-0 w-0 shrink-0 border-l-[4px] border-l-muted border-y-[3px] border-y-transparent transition-transform duration-150"
        :class="{ 'rotate-90': expanded }"
        aria-hidden="true"
      ></span>
      <span class="min-w-0 flex-1 truncate" :title="node.name">{{ node.name }}</span>
    </div>
    <!-- 展开后渲染子节点 目录按需加载 -->
    <template v-if="expanded">
      <div v-if="node.loading" class="py-1 text-[11px] text-muted" :style="{ paddingLeft: `${(depth + 1) * 12 + 8}px` }">加载中…</div>
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
    class="group flex cursor-pointer items-center gap-1.5 rounded px-1 py-[3px] text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    :style="{ paddingLeft: `${depth * 12 + 4}px` }"
    :title="node.path"
    @click="emit('open', node.path)"
  >
    <span class="inline-block h-0 w-0 shrink-0 border-l-[4px] border-l-transparent border-y-[3px] border-y-transparent" aria-hidden="true"></span>
    <span class="min-w-0 flex-1 truncate">{{ node.name }}</span>
    <button
      class="hidden shrink-0 rounded bg-accent-soft px-1.5 font-mono text-[10px] leading-4 text-accent-deep group-hover:block"
      type="button"
      title="引用到输入框"
      @click.stop="emit('mention', node.path)"
    >@</button>
  </div>
</template>

<script setup lang="ts">
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

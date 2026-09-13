<template>
  <Icon :icon="icon" :width="size" :height="size" class="file-kind-icon" :class="kind" aria-hidden="true" />
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import archive from "@iconify-icons/fluent/archive-20-regular";
import codeFile from "@iconify-icons/fluent/code-20-regular";
import document from "@iconify-icons/fluent/document-20-regular";
import documentText from "@iconify-icons/fluent/document-text-20-regular";
import folder from "@iconify-icons/fluent/folder-20-regular";
import openFolder from "@iconify-icons/fluent/folder-open-20-regular";
import image from "@iconify-icons/fluent/image-20-regular";

const props = withDefaults(defineProps<{
  name: string;
  isDir?: boolean;
  open?: boolean;
  size?: number;
}>(), {
  isDir: false,
  open: false,
  size: 15,
});

const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"];
const codeExts = ["ts", "tsx", "js", "jsx", "vue", "css", "scss", "html", "xml", "json", "yml", "yaml", "sh", "ps1", "go", "mod", "sum", "toml", "ini", "env", "py", "rs", "java", "c", "h", "cpp", "cs"];
const textExts = ["md", "txt", "log", "pdf", "doc", "docx"];
const archiveExts = ["zip", "rar", "7z", "tar", "gz"];
const extension = computed(() => props.name.toLowerCase().split(".").at(-1) ?? "");
const icon = computed(() => {
  if (props.isDir) return props.open ? openFolder : folder;
  if (imageExts.includes(extension.value)) return image;
  if (codeExts.includes(extension.value)) return codeFile;
  if (textExts.includes(extension.value)) return documentText;
  if (archiveExts.includes(extension.value)) return archive;
  return document;
});
const kind = computed(() => {
  if (props.isDir) return "folder";
  if (imageExts.includes(extension.value)) return "image";
  if (codeExts.includes(extension.value)) return "code";
  if (archiveExts.includes(extension.value)) return "archive";
  return "text";
});
</script>

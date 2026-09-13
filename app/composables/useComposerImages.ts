import { compressImageFile } from "~/utils/image-compress";
import { useChatStore } from "~/stores/chat";
import { useModelsStore } from "~/stores/models";
import { MAX_ATTACHED_IMAGES, getBase64DecodedByteLength } from "#shared/lib/image-attachments";
import type { AttachedImage } from "#shared/lib/types";

// 图片操作独立于输入补全 减少 Composer 的状态负担
export function useComposerImages() {
  const chat = useChatStore();
  const models = useModelsStore();
  const fileInput = ref<HTMLInputElement | null>(null);
  const dragover = ref(false);

  const currentModelSupportsImages = computed(() => {
    if (!chat.model) return true;
    const entry = models.modelList.find((model) =>
      model.provider === chat.model?.provider && model.id === chat.model?.id,
    );
    return entry ? entry.input.includes("image") : true;
  });

  function warnUnsupportedImages(): boolean {
    if (currentModelSupportsImages.value) return false;
    const name = chat.model ? `${chat.model.provider}/${chat.model.id}` : "当前模型";
    chat.notices.push({ id: Date.now(), type: "error", message: `${name} 不支持图片输入 请移除图片或切换模型` });
    return true;
  }

  async function addImageFiles(files: FileList | File[]) {
    if (warnUnsupportedImages()) return;
    const images = [...files].filter((file) => file.type.startsWith("image/"));
    for (const file of images) {
      if (chat.attachedImages.length >= MAX_ATTACHED_IMAGES) {
        chat.notices.push({ id: Date.now(), type: "error", message: `最多附加 ${MAX_ATTACHED_IMAGES} 张图片` });
        return;
      }
      try {
        const { data, mimeType } = await compressImageFile(file);
        const bytes = getBase64DecodedByteLength(data);
        if (bytes === null || bytes > 10 * 1024 * 1024) {
          chat.notices.push({ id: Date.now(), type: "error", message: `${file.name} 超过 10MB 上限` });
          continue;
        }
        const image: AttachedImage = { data, mimeType, previewUrl: `data:${mimeType};base64,${data}` };
        chat.attachedImages.push(image);
      } catch {
        chat.notices.push({ id: Date.now(), type: "error", message: `${file.name} 读取失败` });
      }
    }
  }

  function onPaste(event: ClipboardEvent) {
    const files = event.clipboardData?.files;
    if (!files?.length) return;
    event.preventDefault();
    void addImageFiles(files);
  }

  function onDrop(event: DragEvent) {
    dragover.value = false;
    const files = event.dataTransfer?.files;
    if (files?.length) void addImageFiles(files);
  }

  function onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) void addImageFiles(input.files);
    input.value = "";
  }

  function removeImage(index: number) {
    chat.attachedImages.splice(index, 1);
  }

  return {
    maxImages: MAX_ATTACHED_IMAGES,
    fileInput,
    dragover,
    warnUnsupportedImages,
    onPaste,
    onDrop,
    onFileChange,
    removeImage,
  };
}

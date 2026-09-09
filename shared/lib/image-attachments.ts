// Ported from pi-web lib/image-attachments.ts — https://github.com/agegr/pi-web (MIT)
// 图片附件的边界校验 前端压缩只是体验优化 这里才是安全边界
// 浏览器限制可被直接 API 请求绕过 数量 体积 MIME 与 base64 都必须在此验证

export const MAX_ATTACHED_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHED_IMAGES = 10;

export interface Base64ImageAttachment {
  data: string;
  mimeType: string;
}

// 标准字母表逐字符校验 拒绝 data URI 前缀与空白字符
// 只算长度不做真实解码 避免为非法数据分配解码内存
function isBase64DataChar(code: number): boolean {
  return (code >= 0x41 && code <= 0x5a)
    || (code >= 0x61 && code <= 0x7a)
    || (code >= 0x30 && code <= 0x39)
    || code === 0x2b
    || code === 0x2f;
}

export function getBase64DecodedByteLength(data: string): number | null {
  if (!data || data.length % 4 !== 0) return null;
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  const dataEnd = data.length - padding;
  for (let index = 0; index < dataEnd; index += 1) {
    if (!isBase64DataChar(data.charCodeAt(index))) return null;
  }
  for (let index = dataEnd; index < data.length; index += 1) {
    if (data[index] !== "=") return null;
  }
  return (data.length / 4) * 3 - padding;
}

export function isBase64ImageWithinLimits(value: unknown): value is Base64ImageAttachment {
  if (!value || typeof value !== "object") return false;
  const image = value as Partial<Base64ImageAttachment>;
  if (typeof image.data !== "string" || typeof image.mimeType !== "string" || !image.mimeType.startsWith("image/")) {
    return false;
  }
  const bytes = getBase64DecodedByteLength(image.data);
  return bytes !== null && bytes <= MAX_ATTACHED_IMAGE_BYTES;
}

// prompt 命令 images 数组的入口校验 返回可读错误信息或 null
export function validateAgentImages(value: unknown): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return "images must be an array";
  if (value.length > MAX_ATTACHED_IMAGES) {
    return `A message can include at most ${MAX_ATTACHED_IMAGES} images`;
  }
  for (const image of value) {
    if (!image || typeof image !== "object" || (image as { type?: unknown }).type !== "image") {
      return "Each attachment must be an image";
    }
    if (!isBase64ImageWithinLimits(image)) {
      return `Each image must be valid base64 image data of ${MAX_ATTACHED_IMAGE_BYTES / (1024 * 1024)}MB or smaller`;
    }
  }
  return null;
}

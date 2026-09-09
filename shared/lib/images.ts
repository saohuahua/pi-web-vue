interface ImageSourceLike {
  type?: unknown;
  media_type?: unknown;
  data?: unknown;
  url?: unknown;
}

export interface ImageBlockLike {
  type?: unknown;
  source?: ImageSourceLike;
  data?: unknown;
  mimeType?: unknown;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function imageDataUrl(block: ImageBlockLike): string {
  const source = block.source;
  if (source?.type === "url") return stringValue(source.url);

  const sourceMime = stringValue(source?.media_type);
  const sourceData = stringValue(source?.data);
  if (source?.type === "base64") {
    return sourceMime && sourceData ? `data:${sourceMime};base64,${sourceData}` : "";
  }

  const legacyMime = stringValue(block.mimeType);
  const legacyData = stringValue(block.data);
  return legacyMime && legacyData ? `data:${legacyMime};base64,${legacyData}` : "";
}

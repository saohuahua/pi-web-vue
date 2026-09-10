// Ported from pi-web lib/models-cache.ts — https://github.com/agegr/pi-web (MIT)
// 模型列表的按 cwd TTL 缓存 选择器每次打开都会请求 不能每次都重建 services

import type { ModelsResponse } from "#shared/lib/types";

const MODELS_CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 32;

const cache = new Map<string, { data: ModelsResponse; expiresAt: number }>();
const inFlight = new Map<string, Promise<ModelsResponse>>();

export function invalidateModelsCache(): void {
  cache.clear();
  inFlight.clear();
}

export function loadModelsWithCache(cwd: string, loader: () => Promise<ModelsResponse>): Promise<ModelsResponse> {
  const cached = cache.get(cwd);
  if (cached) {
    if (cached.expiresAt > Date.now()) return Promise.resolve(cached.data);
    cache.delete(cwd);
  }

  const existing = inFlight.get(cwd);
  if (existing) return existing;

  const promise = loader().then((data) => {
    if (inFlight.get(cwd) === promise) inFlight.delete(cwd);
    cache.set(cwd, { data, expiresAt: Date.now() + MODELS_CACHE_TTL_MS });
    if (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return data;
  }).catch((error) => {
    if (inFlight.get(cwd) === promise) inFlight.delete(cwd);
    throw error;
  });

  inFlight.set(cwd, promise);
  return promise;
}

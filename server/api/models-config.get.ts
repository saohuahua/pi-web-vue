// GET /api/models-config 返回 ~/.pi/agent/models.json 的原始内容
// 缺失或损坏时返回空 providers 前端据此展示空态

import type { ModelsConfigFile } from "#shared/lib/types";
import { readModelsConfig } from "../utils/models-config-store";

export default defineEventHandler((): ModelsConfigFile => {
  return readModelsConfig();
});

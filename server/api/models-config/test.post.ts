// Ported from pi-web app/api/models-config/test/route.ts — https://github.com/agegr/pi-web (MIT)
// POST /api/models-config/test 连通性测试
// 思路 把待测 provider 写进临时目录的 models.json 用 ModelRuntime 加载后真实请求一次
// 全程不触碰真实配置文件 请求结束即销毁临时目录

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { completeSimple, type AssistantMessage } from "@earendil-works/pi-ai/compat";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { ModelsConfigTestRequest, ModelsConfigTestResult } from "#shared/lib/types";

const TEST_TIMEOUT_MS = 20_000;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const getAssistantText = (message: AssistantMessage): string => {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
};

export default defineEventHandler(async (event): Promise<ModelsConfigTestResult> => {
  let tempDir: string | undefined;

  try {
    const body = await readBody<Partial<ModelsConfigTestRequest>>(event);
    const providerName = typeof body?.providerName === "string" ? body.providerName.trim() : "";
    if (!providerName) return { ok: false, error: "缺少 providerName" };
    if (!isRecord(body.provider)) return { ok: false, error: "缺少 provider 配置" };
    if (!isRecord(body.model)) return { ok: false, error: "缺少 model 配置" };

    const modelId = typeof body.model.id === "string" ? body.model.id.trim() : "";
    if (!modelId) return { ok: false, error: "缺少模型 id" };

    tempDir = mkdtempSync(join(tmpdir(), "pi-web-vue-model-test-"));
    const modelsPath = join(tempDir, "models.json");
    writeFileSync(
      modelsPath,
      JSON.stringify(
        {
          providers: {
            [providerName]: {
              ...body.provider,
              models: [{ ...body.model, id: modelId }],
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const modelRuntime = await ModelRuntime.create({ modelsPath });
    const loadError = modelRuntime.getError();
    if (loadError) return { ok: false, error: loadError };

    const model = modelRuntime.getModel(providerName, modelId);
    if (!model) return { ok: false, error: `找不到模型 ${providerName}/${modelId}` };

    const resolved = await modelRuntime.getAuth(model);
    if (!resolved?.auth.apiKey) {
      return { ok: false, error: `没有找到 ${providerName} 的 API key` };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
    let status: number | undefined;
    const startedAt = Date.now();

    try {
      const message = await completeSimple(
        model,
        {
          messages: [
            {
              role: "user",
              content: "Reply with OK only.",
              timestamp: Date.now(),
            },
          ],
        },
        {
          apiKey: resolved.auth.apiKey,
          headers: resolved.auth.headers,
          maxTokens: 16,
          timeoutMs: TEST_TIMEOUT_MS,
          maxRetries: 0,
          cacheRetention: "none",
          signal: controller.signal,
          onResponse: (response) => {
            status = response.status;
          },
        },
      );

      const latencyMs = Date.now() - startedAt;

      // error 与 aborted 区分开 超时走 abort 必须给用户明确提示
      if (message.stopReason === "error" || message.stopReason === "aborted") {
        return {
          ok: false,
          error: message.errorMessage ?? (controller.signal.aborted ? "测试超时" : "模型返回错误"),
          latencyMs,
          status,
        };
      }

      return {
        ok: true,
        latencyMs,
        status,
        responseText: getAssistantText(message).slice(0, 300),
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
});

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "../utils/file-access";
import { setDisableModelInvocation } from "../utils/skill-frontmatter";

// PATCH /api/skills  切换技能的 disable-model-invocation
// 只允许可写的技能根 全局技能在 ~/.agents/skills 经符号链接解析后落在根外 要显式放行
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ filePath?: unknown; disableModelInvocation?: unknown }>(event);
    const filePath = typeof body?.filePath === "string" ? body.filePath : "";
    const disable = body?.disableModelInvocation === true;
    if (!filePath) {
      setResponseStatus(event, 400);
      return { error: "filePath is required" };
    }
    if (!existsSync(filePath)) {
      setResponseStatus(event, 404);
      return { error: "File not found" };
    }

    const allowedRoots = new Set(await getAllowedFileRoots());
    allowedRoots.add(getAgentDir());
    const globalSkillsDir = join(homedir(), ".agents", "skills");
    if (existsSync(globalSkillsDir)) allowedRoots.add(globalSkillsDir);
    if (!isExistingFilePathAllowed(filePath, allowedRoots)) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }

    const content = readFileSync(filePath, "utf8");
    const updated = setDisableModelInvocation(content, disable);
    writeFileSync(filePath, updated, "utf8");
    return { success: true };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

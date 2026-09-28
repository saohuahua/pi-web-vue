import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "../utils/file-access";
import { setDisableModelInvocation } from "../utils/skill-frontmatter";
import { listSkills } from "../utils/skills";
import { samePath } from "../utils/paths";

// PATCH /api/skills  切换技能的 disable-model-invocation
// 只允许可写的技能根 全局技能在 ~/.agents/skills 经符号链接解析后落在根外 要显式放行
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      cwd?: unknown;
      filePath?: unknown;
      disableModelInvocation?: unknown;
    }>(event);
    const cwd = typeof body?.cwd === "string" ? body.cwd : "";
    const filePath = typeof body?.filePath === "string" ? body.filePath : "";
    const disable = body?.disableModelInvocation === true;
    if (!cwd || !filePath || typeof body?.disableModelInvocation !== "boolean") {
      setResponseStatus(event, 400);
      return { error: "cwd filePath and boolean disableModelInvocation are required" };
    }
    if (!existsSync(filePath)) {
      setResponseStatus(event, 404);
      return { error: "File not found" };
    }

    const allowedRoots = new Set(await getAllowedFileRoots());
    if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }
    allowedRoots.add(getAgentDir());
    const globalSkillsDir = join(homedir(), ".agents", "skills");
    if (existsSync(globalSkillsDir)) allowedRoots.add(globalSkillsDir);
    if (!isExistingFilePathAllowed(filePath, allowedRoots)) {
      setResponseStatus(event, 403);
      return { error: "Access denied" };
    }

    // 授权根内的普通文件不能冒充技能写入
    const target = realpathSync(filePath);
    const skills = await listSkills(cwd);
    const discovered = skills.some((skill) => {
      try {
        return samePath(realpathSync(skill.filePath), target);
      } catch {
        return false;
      }
    });
    if (!discovered) {
      setResponseStatus(event, 403);
      return { error: "Not a discovered skill" };
    }
    const content = readFileSync(target, "utf8");
    const updated = setDisableModelInvocation(content, disable);
    writeFileSync(target, updated, "utf8");
    return { success: true };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

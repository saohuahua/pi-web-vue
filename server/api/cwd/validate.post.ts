import { statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { allowFileRoot } from "../../utils/file-access";
import { projectIdentityKey } from "../../utils/project-identity";
import { toNativePath } from "../../utils/paths";
import { resolveProject } from "../../utils/worktree";

function normalizeCwd(cwd: string): string {
  if (cwd === "~") return homedir();
  if (cwd.startsWith("~/")) return resolve(homedir(), cwd.slice(2));
  // 转本机分隔符 正斜杠输入与既有会话头的反斜杠风格保持一致
  return toNativePath(isAbsolute(cwd) ? cwd : resolve(cwd));
}

// POST /api/cwd/validate  UI 选择工作区前的校验入口
// 返回项目身份 projectKey 是分组与记忆的稳定键
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ cwd?: unknown }>(event);
    const cwd = typeof body.cwd === "string" ? body.cwd.trim() : "";

    if (!cwd) {
      setResponseStatus(event, 400);
      return { error: "Path is required" };
    }

    const normalizedCwd = normalizeCwd(cwd);
    let stat;
    try {
      stat = statSync(normalizedCwd);
    } catch {
      setResponseStatus(event, 400);
      return { error: `Directory does not exist: ${cwd}` };
    }
    if (!stat.isDirectory()) {
      setResponseStatus(event, 400);
      return { error: `Path is not a directory: ${cwd}` };
    }

    const project = await resolveProject(normalizedCwd);
    // 校验通过即授权该目录进文件浏览允许根 pi-web 同款语义
    allowFileRoot(normalizedCwd);
    return {
      success: true,
      cwd: normalizedCwd,
      projectRoot: project.projectRoot,
      projectKey: projectIdentityKey(project.projectRoot),
    };
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

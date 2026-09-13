import { stat } from "node:fs/promises";
import {
  getBrowseStartDirectory,
  getParentDirectory,
  listDirectories,
  listWindowsDrives,
  resolveDirectory,
  shouldShowWindowsDrivePicker,
} from "../../utils/directory-browser";

// GET /api/cwd/browse 列出用户显式打开的本机目录
export default defineEventHandler(async (event) => {
  try {
    const requested = getQuery(event).path;
    const path = typeof requested === "string" ? requested.trim() : "";

    if (shouldShowWindowsDrivePicker(path)) {
      return {
        path: "",
        parentPath: null,
        drives: await listWindowsDrives(),
        directories: [],
      };
    }

    let directory: string;
    try {
      directory = await resolveDirectory(getBrowseStartDirectory(path));
    } catch {
      setResponseStatus(event, 404);
      return { error: "目录不存在" };
    }

    if (!(await stat(directory)).isDirectory()) {
      setResponseStatus(event, 400);
      return { error: "路径不是文件夹" };
    }

    return {
      path: directory,
      parentPath: getParentDirectory(directory),
      directories: await listDirectories(directory),
    };
  } catch {
    setResponseStatus(event, 500);
    return { error: "无法读取目录" };
  }
});

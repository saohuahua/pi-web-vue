import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // 收窄后业务目录里的散落测试不会被收集 新测试只认 tests/ 规范由配置强制
  include: ["tests/**/*.test.ts"],
  resolve: {
    alias: {
      "#shared": fileURLToPath(new URL("./shared", import.meta.url)),
      // server 测试迁入 tests/ 后经此别名导入被测模块
      "#server": fileURLToPath(new URL("./server", import.meta.url)),
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
});

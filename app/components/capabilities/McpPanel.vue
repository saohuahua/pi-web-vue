<template>
  <section class="cap-panel" aria-labelledby="mcp-title">
    <div class="cap-panel-heading">
      <div>
        <h2 id="mcp-title">MCP 服务</h2>
        <p>通过受控扩展将外部工具接入当前 Agent</p>
      </div>
    </div>

    <PiEmptyState
      title="尚未接入 MCP Bridge"
      description="Pi 不提供原生 MCP 服务注册表 接入后这里才会显示真实服务状态 工具数量和最近错误"
    >
      <template #icon><Cable :size="22" aria-hidden="true" /></template>
    </PiEmptyState>

    <div class="cap-section cap-model-note">
      <h3>接入规则</h3>
      <p>连接测试必须由用户显式触发 环境变量和命令输出会脱敏 保存后可能需要重新加载 Agent 资源</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Cable } from "lucide-vue-next";
import PiEmptyState from "~/components/pi/PiEmptyState/index.vue";
</script>

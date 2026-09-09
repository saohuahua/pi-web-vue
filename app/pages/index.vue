<script setup lang="ts">
import NewSessionForm from "~/components/NewSessionForm.vue";
</script>

<template>
  <div class="page-home">
    <section class="home-hero">
      <!-- 数学方格纸背景 只在此处出现 阅读区保持干净 -->
      <span class="hero-mark" aria-hidden="true">π</span>
      <h1 class="hero-title">π agent</h1>
      <p class="hero-sub">
        浏览器里的 pi coding agent 与 pi CLI 共享同一套会话与配置
        可以读代码 写文件 跑命令
      </p>
      <div class="hero-form">
        <NewSessionForm />
      </div>
    </section>
  </div>
</template>

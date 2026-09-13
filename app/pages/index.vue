<template>
  <div class="page-home">
    <section class="home-hero">
      <!-- 数学方格纸背景 只在此处出现 阅读区保持干净 -->
      <BrandMark variant="hero" />
      <h1 class="hero-title">agentDesk</h1>
      <p class="hero-sub">
        浏览器里的本机 coding agent 工作台
        可以读代码 写文件 跑命令
      </p>
      <div class="hero-form">
        <NewSessionForm />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import NewSessionForm from "~/components/NewSessionForm.vue";
import BrandMark from "~/components/BrandMark.vue";
</script>

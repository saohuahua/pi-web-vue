// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  // 聊天 SPA 无 SEO 与首屏需求 pi-web 同为纯 CSR
  // 开着 SSR 只会引入 EventSource 与 localStorage 的水合麻烦 零收益
  ssr: false,
  // 显式绑 IPv4 loopback 否则 Windows 上 localhost 只解析到 ::1 curl 127.0.0.1 连不上
  devServer: { host: "127.0.0.1", port: 3000 },
  app: {
    head: {
      title: "agentDesk",
      htmlAttrs: { lang: "zh-CN" },
      // Plex 双字族 本地离线时回退系统字体
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
        },
      ],
    },
  },
  modules: ["@pinia/nuxt"],
  css: ["~/assets/css/main.css"],
  // Tailwind v4 工具类层 只取 utilities 不取 preflight 项目自有 reset 与设计系统继续生效
  vite: {
    plugins: [tailwindcss()],
  },
  nitro: {
    // pi SDK 是纯 ESM 且内嵌 WASM photon 的重包
    // 必须排除出 Nitro 打包 运行时从 node_modules 原样加载
    // 等价于 pi-web next.config.ts 的 serverExternalPackages
    externals: {
      external: [
        "@earendil-works/pi-coding-agent",
        "@earendil-works/pi-agent-core",
        "@earendil-works/pi-ai",
        "@earendil-works/pi-tui",
        "undici",
      ],
    },
  },
  devtools: { enabled: false },
  compatibilityDate: "2026-09-01",
});

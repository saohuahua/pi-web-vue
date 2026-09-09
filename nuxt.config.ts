// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // 聊天 SPA 无 SEO 与首屏需求 pi-web 同为纯 CSR
  // 开着 SSR 只会引入 EventSource 与 localStorage 的水合麻烦 零收益
  ssr: false,
  // 显式绑 IPv4 loopback 否则 Windows 上 localhost 只解析到 ::1 curl 127.0.0.1 连不上
  devServer: { host: "127.0.0.1", port: 3000 },
  modules: ["@pinia/nuxt"],
  css: ["~/assets/css/main.css"],
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

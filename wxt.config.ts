import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    // pdf.js is loaded lazily only when a resume is parsed.
    build: { chunkSizeWarningLimit: 1_000 }
  }),
  manifest: {
    name: "ResumePilot",
    description: "安全、可控的本地求职表单填写助手",
    default_locale: "zh_CN",
    permissions: ["activeTab", "alarms", "scripting", "sidePanel", "storage", "unlimitedStorage"],
    optional_host_permissions: ["https://*/*", "http://*/*"],
    action: {
      default_title: "ResumePilot"
    }
  }
});

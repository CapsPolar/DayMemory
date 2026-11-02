import { createApp } from "vue";
import App from "./App.vue";
import { applyTheme, getTheme } from "./theme";

applyTheme(getTheme());

createApp(App).mount("#app");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((err: unknown) => {
      console.error("Service worker registration failed:", err);
    });
  });
}
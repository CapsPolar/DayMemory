import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((err: unknown) => {
      console.error("Service worker registration failed:", err);
    });
  });
}

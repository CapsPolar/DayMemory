<!-- MainApp.vue -->
<script setup lang="ts">
import ThoughtsView from "./ThoughtsView.vue";
import SettingsView from "./SettingsView.vue";

defineProps<{
  activeView: "thoughts" | "settings";
  content: string;
  backupVisible: boolean;
  changePasswordVisible: boolean;
  backupMode: "export" | "import";
  backupText: string;
  backupStatus: string;
  oldPassword: string;
  newPassword: string;
  passwordConfirmation: string;
  passwordStatus: string;
}>();

const emit = defineEmits<{
  lock: [];
  navigate: [view: "thoughts" | "settings"];
  exportVault: [];
  importVault: [];
  togglePasswordPanel: [];
  submitBackup: [];
  submitPassword: [];
  "update:backupText": [value: string];
  "update:oldPassword": [value: string];
  "update:newPassword": [value: string];
  "update:passwordConfirmation": [value: string];
  "update:content": [value: string];
}>();
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>{{ activeView === "thoughts" ? "History" : "Settings" }}</h1>
      <button class="icon-btn" title="Lock Vault" aria-label="Lock Vault" @click="emit('lock')">
        🔒
      </button>
    </header>

    <main class="view-content-wrapper">
      <ThoughtsView
        v-if="activeView === 'thoughts'"
        :content="content"
        @update:content="emit('update:content', $event)"
      />
      <SettingsView
        v-else
        :backup-visible="backupVisible"
        :change-password-visible="changePasswordVisible"
        :backup-mode="backupMode"
        :backup-text="backupText"
        :backup-status="backupStatus"
        :old-password="oldPassword"
        :new-password="newPassword"
        :password-confirmation="passwordConfirmation"
        :password-status="passwordStatus"
        @export-vault="emit('exportVault')"
        @import-vault="emit('importVault')"
        @toggle-password-panel="emit('togglePasswordPanel')"
        @submit-backup="emit('submitBackup')"
        @submit-password="emit('submitPassword')"
        @update:backup-text="emit('update:backupText', $event)"
        @update:old-password="emit('update:oldPassword', $event)"
        @update:new-password="emit('update:newPassword', $event)"
        @update:password-confirmation="emit('update:passwordConfirmation', $event)"
      />
    </main>

    <nav class="bottom-nav" aria-label="Main navigation">
      <button
        class="nav-item"
        :class="{ active: activeView === 'thoughts' }"
        :aria-current="activeView === 'thoughts' ? 'page' : undefined"
        @click="emit('navigate', 'thoughts')"
      >
        <span class="nav-icon">📜</span>
        <span class="nav-label">History</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: activeView === 'settings' }"
        :aria-current="activeView === 'settings' ? 'page' : undefined"
        @click="emit('navigate', 'settings')"
      >
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">Settings</span>
      </button>
    </nav>
  </div>
</template>
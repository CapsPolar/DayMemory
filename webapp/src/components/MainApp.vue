<!-- MainApp.vue -->
<script setup lang="ts">
import ThoughtsView from "./ThoughtsView.vue";
import AnalyticsView from "./AnalyticsView.vue";
import SettingsView from "./SettingsView.vue";

defineProps<{
  activeView: "thoughts" | "analytics" | "settings";
  content: string;
  backupVisible: boolean;
  changePasswordVisible: boolean;
  backupMode: "encrypted-export" | "unencrypted-export" | "encrypted-import" | "unencrypted-import";
  backupText: string;
  backupStatus: string;
  oldPassword: string;
  newPassword: string;
  passwordConfirmation: string;
  passwordStatus: string;
  reminderIntervalDays: number;
}>();

const emit = defineEmits<{
  lock: [];
  navigate: [view: "thoughts" | "analytics" | "settings"];
  openExport: [type: "encrypted" | "unencrypted"];
  openImport: [type: "encrypted" | "unencrypted"];
  togglePasswordPanel: [];
  submitBackup: [actionType: "clipboard" | "file" | "restore"];
  fileImportUpload: [event: Event];
  submitPassword: [];
  "update:backupText": [value: string];
  "update:oldPassword": [value: string];
  "update:newPassword": [value: string];
  "update:passwordConfirmation": [value: string];
  "update:reminderIntervalDays": [value: number];
  "update:content": [value: string];
}>();
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>{{ activeView === "thoughts" ? "History" : activeView === "analytics" ? "Analytics" : "Settings" }}</h1>
    </header>

    <main class="view">
      <ThoughtsView
        v-if="activeView === 'thoughts'"
        :content="content"
        @update:content="emit('update:content', $event)"
      />
      <AnalyticsView
        v-else-if="activeView === 'analytics'"
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
        :reminder-interval-days="reminderIntervalDays"
        @open-export="emit('openExport', $event)"
        @open-import="emit('openImport', $event)"
        @toggle-password-panel="emit('togglePasswordPanel')"
        @submit-backup="emit('submitBackup', $event)"
        @file-import-upload="emit('fileImportUpload', $event)"
        @submit-password="emit('submitPassword')"
        @update:backup-text="emit('update:backupText', $event)"
        @update:old-password="emit('update:oldPassword', $event)"
        @update:new-password="emit('update:newPassword', $event)"
        @update:password-confirmation="emit('update:passwordConfirmation', $event)"
        @update:reminder-interval-days="emit('update:reminderIntervalDays', $event)"
      />
    </main>

    <button
      v-if="activeView === 'thoughts'"
      type="button"
      class="fab with-nav"
      aria-label="Lock vault and write"
      @click="emit('lock')"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
      Write…
    </button>

    <nav class="bottom-nav" aria-label="Main navigation">
      <button
        class="nav-item"
        :class="{ active: activeView === 'thoughts' }"
        :aria-current="activeView === 'thoughts' ? 'page' : undefined"
        @click="emit('navigate', 'thoughts')"
      >
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <polyline points="12 7.5 12 12 15 14" />
        </svg>
        History
      </button>
      <button
        class="nav-item"
        :class="{ active: activeView === 'analytics' }"
        :aria-current="activeView === 'analytics' ? 'page' : undefined"
        @click="emit('navigate', 'analytics')"
      >
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        Analytics
      </button>
      <button
        class="nav-item"
        :class="{ active: activeView === 'settings' }"
        :aria-current="activeView === 'settings' ? 'page' : undefined"
        @click="emit('navigate', 'settings')"
      >
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="17" x2="20" y2="17" />
          <circle cx="9" cy="7" r="2.2" />
          <circle cx="15" cy="17" r="2.2" />
        </svg>
        Settings
      </button>
    </nav>
  </div>
</template>
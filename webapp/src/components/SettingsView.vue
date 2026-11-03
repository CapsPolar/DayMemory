<!-- SettingsView.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";
import { getTheme, setTheme, type Theme } from "../theme";

const props = defineProps<{
  backupVisible: boolean;
  changePasswordVisible: boolean;
  backupMode: "encrypted-export" | "unencrypted-export" | "encrypted-import" | "unencrypted-import";
  backupText: string;
  backupStatus: string;
  oldPassword: string;
  newPassword: string;
  passwordConfirmation: string;
  passwordStatus: string;
  isFirstTimeImport?: boolean;
  exportOnly?: boolean;
}>();

const emit = defineEmits<{
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
}>();

const modeInfo = {
  "encrypted-export": {
    title: "Export encrypted vault string",
    hint: "Your vault string stays protected by your master password."
  },
  "unencrypted-export": {
    title: "Export unencrypted plain history text",
    hint: "Anyone with this plain history text can read your entries."
  },
  "encrypted-import": {
    title: "Import encrypted vault string",
    hint: "Choose a backup file or paste your encrypted vault string to restore."
  },
  "unencrypted-import": {
    title: "Import unencrypted plain history text",
    hint: "Choose a text file or paste plain history text. It replaces your vault and is re-encrypted with your current password."
  }
} as const;

const info = computed(() => modeInfo[props.backupMode]);
const isImport = computed(() => props.backupMode.includes("import"));

const themes: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
];
const theme = ref<Theme>(getTheme());

function chooseTheme(value: Theme): void {
  theme.value = value;
  setTheme(value);
}

const fileInputRef = ref<HTMLInputElement | null>(null);

function triggerFileInput(): void {
  fileInputRef.value?.click();
}
</script>

<template>
  <div v-if="!isFirstTimeImport && !exportOnly" class="list-row">
    Theme
    <div class="segmented" role="group" aria-label="Theme">
      <button
        v-for="option in themes"
        :key="option.value"
        type="button"
        :class="{ active: theme === option.value }"
        :aria-pressed="theme === option.value"
        @click="chooseTheme(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
  <button v-if="!isFirstTimeImport && !exportOnly" class="list-row" @click="emit('openExport', 'encrypted')">Export encrypted vault string</button>
  <button v-if="!isFirstTimeImport && !exportOnly" class="list-row" @click="emit('openExport', 'unencrypted')">
    Export unencrypted plain history text
    <span class="row-note">Not recommended</span>
  </button>
  <button v-if="!exportOnly" class="list-row" @click="emit('openImport', 'encrypted')">Import encrypted vault string</button>
  <button v-if="!exportOnly" class="list-row" @click="emit('openImport', 'unencrypted')">Import unencrypted plain history text</button>
  <button v-if="!isFirstTimeImport && !exportOnly" class="list-row" @click="emit('togglePasswordPanel')">Change password</button>

  <div v-if="backupVisible" class="panel">
    <p class="hint">
      <strong>{{ info.title }}.</strong>
      {{ info.hint }}
    </p>

    <input ref="fileInputRef" type="file" accept=".txt,text/plain" hidden @change="emit('fileImportUpload', $event)" />
    <button v-if="isImport" type="button" class="btn secondary" @click="triggerFileInput">Choose file</button>

    <textarea
      :value="backupText"
      :readonly="!isImport"
      :placeholder="isImport ? 'Paste content here or choose a file' : 'Vault data'"
      class="backup-area"
      @input="emit('update:backupText', ($event.target as HTMLTextAreaElement).value)"
    />

    <template v-if="!isImport">
      <button class="btn" @click="emit('submitBackup', 'file')">Download as .txt</button>
    </template>
    <button v-else class="btn danger" @click="emit('submitBackup', 'restore')">Restore backup (overwrite)</button>

    <span class="status" aria-live="polite">{{ backupStatus }}</span>
  </div>

  <div v-if="changePasswordVisible" class="panel">
    <input
      :value="oldPassword"
      type="password"
      placeholder="Current password"
      aria-label="Current password"
      autocomplete="off"
      @input="emit('update:oldPassword', ($event.target as HTMLInputElement).value)"
    />
    <input
      :value="newPassword"
      type="password"
      placeholder="New password"
      aria-label="New password"
      autocomplete="off"
      @input="emit('update:newPassword', ($event.target as HTMLInputElement).value)"
    />
    <input
      :value="passwordConfirmation"
      type="password"
      placeholder="Confirm new password"
      aria-label="Confirm new password"
      autocomplete="off"
      @input="emit('update:passwordConfirmation', ($event.target as HTMLInputElement).value)"
    />
    <button class="btn" @click="emit('submitPassword')">Update password</button>
    <span class="status" aria-live="polite">{{ passwordStatus }}</span>
  </div>
</template>
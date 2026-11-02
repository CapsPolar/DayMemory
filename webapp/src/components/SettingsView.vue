<!-- SettingsView.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";

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
    title: "Encrypted export",
    hint: "Your vault stays protected by your master password."
  },
  "unencrypted-export": {
    title: "Unencrypted export",
    hint: "Anyone with this text can read your entries."
  },
  "encrypted-import": {
    title: "Encrypted import",
    hint: "Choose a backup file or paste the encrypted text to restore your vault."
  },
  "unencrypted-import": {
    title: "Unencrypted import",
    hint: "Choose a text file or paste text. It replaces your vault and is re-encrypted with your current password."
  }
} as const;

const info = computed(() => modeInfo[props.backupMode]);
const isImport = computed(() => props.backupMode.includes("import"));

const fileInputRef = ref<HTMLInputElement | null>(null);

function triggerFileInput(): void {
  fileInputRef.value?.click();
}
</script>

<template>
  <button class="list-row" @click="emit('openExport', 'encrypted')">Export vault (encrypted)</button>
  <button class="list-row" @click="emit('openExport', 'unencrypted')">
    Export vault (unencrypted)
    <span class="row-note">Not recommended</span>
  </button>
  <button class="list-row" @click="emit('openImport', 'encrypted')">Import vault (encrypted)</button>
  <button class="list-row" @click="emit('openImport', 'unencrypted')">Import vault (unencrypted)</button>
  <button class="list-row" @click="emit('togglePasswordPanel')">Change password</button>

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
      :placeholder="isImport ? 'Paste text here or choose a file' : 'Vault export'"
      class="backup-area"
      @input="emit('update:backupText', ($event.target as HTMLTextAreaElement).value)"
    />

    <template v-if="!isImport">
      <button class="btn" @click="emit('submitBackup', 'clipboard')">Copy to clipboard</button>
      <button class="btn secondary" @click="emit('submitBackup', 'file')">Download as .txt</button>
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
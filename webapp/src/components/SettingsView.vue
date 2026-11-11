<!-- SettingsView.vue -->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { getTheme, setTheme, type Theme } from "../theme";
import LegalView from "./LegalView.vue";

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
  reminderIntervalDays: number;
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
  "update:reminderIntervalDays": [value: number];
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
const showClipboardFallback = ref(false);

const acceptedImportRisk = ref(false);
const showLegalViewModal = ref(false);

watch(() => props.backupVisible, (visible) => {
  if (!visible) {
    showClipboardFallback.value = false;
    acceptedImportRisk.value = false;
  }
});

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

  <div v-if="!isFirstTimeImport && !exportOnly" class="list-row">
    Backup reminder
    <select
      :value="reminderIntervalDays"
      class="select-input"
      style="width: auto; min-width: 140px; height: 36px;"
      aria-label="Backup reminder interval"
      @change="emit('update:reminderIntervalDays', Number(($event.target as HTMLSelectElement).value))"
    >
      <option :value="1">Every day</option>
      <option :value="2">Every 2 days</option>
      <option :value="3">Every 3 days</option>
      <option :value="7">Every 7 days</option>
      <option :value="14">Every 14 days</option>
      <option :value="30">Every 30 days</option>
      <option :value="0">Disabled</option>
    </select>
  </div>

  <button v-if="!isFirstTimeImport && !exportOnly" class="list-row" @click="emit('openExport', 'encrypted')">Export encrypted vault string</button>
  <button v-if="!isFirstTimeImport && !exportOnly" class="list-row" @click="emit('openExport', 'unencrypted')">
    Export unencrypted plain history text
    <span class="row-note">Not recommended</span>
  </button>
  <button v-if="!exportOnly" class="list-row" @click="emit('openImport', 'encrypted')">Import encrypted vault string</button>
  <button v-if="!exportOnly" class="list-row" @click="emit('openImport', 'unencrypted')">Import unencrypted plain history text</button>
  <button v-if="!isFirstTimeImport && !exportOnly" class="list-row" @click="emit('togglePasswordPanel')">Change password</button>
  
  <button class="list-row" @click="showLegalViewModal = true">Legal & terms</button>
  <a
    class="list-row source-link"
    href="https://github.com/CapsPolar/DayMemory"
    target="_blank"
    rel="noopener noreferrer"
  >
    Open-source project on GitHub
  </a>

  <div v-if="backupVisible" class="panel">
    <p class="hint">
      <strong>{{ info.title }}.</strong>
      {{ info.hint }}
    </p>

    <input ref="fileInputRef" type="file" accept=".txt,text/plain" hidden @change="emit('fileImportUpload', $event)" />
    <button v-if="isImport" type="button" class="btn secondary" @click="triggerFileInput">Choose file</button>

    <textarea
      :value="backupText"
      :readonly="!isImport && !showClipboardFallback"
      :placeholder="isImport ? 'Paste content here or choose a file' : 'Vault data'"
      class="backup-area"
      @input="emit('update:backupText', ($event.target as HTMLTextAreaElement).value)"
    />

    <template v-if="!isImport">
      <button class="btn" @click="emit('submitBackup', 'file')">Download as .txt</button>
      
      <button 
        type="button" 
        class="text-btn muted" 
        style="margin-top: 8px; align-self: center;"
        @click="showClipboardFallback = !showClipboardFallback"
      >
        {{ showClipboardFallback ? "Hide copy option" : "Have trouble downloading?" }}
      </button>

      <button v-if="showClipboardFallback" class="btn secondary" style="margin-top: 6px;" @click="emit('submitBackup', 'clipboard')">
        Copy to clipboard
      </button>
    </template>
    <template v-else>
      <div style="margin: 12px 0; font-size: 13px;">
  <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; opacity: 0.85;">
    <input v-model="acceptedImportRisk" type="checkbox" style="margin-top: 2px;" />
    <span>
      I understand this software comes with no warranties and use it at my own risk. 
      <button type="button" class="text-btn" style="display: inline; padding: 0; font-size: inherit; text-decoration: underline;" @click.prevent="showLegalViewModal = true">Learn more</button>
    </span>
  </label>
</div>
      <button class="btn danger" :disabled="!acceptedImportRisk" @click="emit('submitBackup', 'restore')">Restore backup (overwrite)</button>
    </template>

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

  <!-- Legal Modal Overlay from Settings -->
  <Transition name="sheet-slide">
    <div v-if="showLegalViewModal" class="sheet-backdrop" @click.self="showLegalViewModal = false" style="z-index: 100;">
      <div class="sheet" style="height: 80vh;">
        <div class="sheet-handle" />
        <LegalView :show-back="true" @back="showLegalViewModal = false" />
      </div>
    </div>
  </Transition>
</template>
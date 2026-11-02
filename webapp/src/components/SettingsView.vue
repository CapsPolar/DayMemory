<!-- SettingsView.vue -->
<script setup lang="ts">
import { ref } from "vue";

defineProps<{
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

const fileInputRef = ref<HTMLInputElement | null>(null);

function triggerFileInput(): void {
  fileInputRef.value?.click();
}
</script>

<template>
  <section class="nav-view-panel active">
    <div class="section-title">Data Administration</div>
    <div class="panel-box">
      <p class="section-desc">
        Manage encrypted and unencrypted exports, file uploads/downloads, text imports, and security credentials directly.
      </p>
      <div class="backup-actions">
        <button class="secondary-btn" @click="emit('openExport', 'encrypted')">
          Export Vault (Encrypted)
        </button>
        <button class="secondary-btn warning-action-btn" @click="emit('openExport', 'unencrypted')">
          <span>Export Vault (Unencrypted)</span>
          <span class="badge-not-recommended">⚠️ Not Recommended</span>
        </button>
        <button class="secondary-btn" @click="emit('openImport', 'encrypted')">
          Import Vault (Encrypted)
        </button>
        <button class="secondary-btn" @click="emit('openImport', 'unencrypted')">
          Import Vault (Unencrypted)
        </button>
        <button class="secondary-btn change-password-button" @click="emit('togglePasswordPanel')">
          🔑 Change Password
        </button>
      </div>

      <div v-if="backupVisible" class="settings-subpanel">
        <div class="export-mode-banner" :class="{ 'warning-banner': backupMode === 'unencrypted-export' }">
          <strong>
            {{ 
              backupMode === 'encrypted-export' ? '🔒 Encrypted Export Mode' :
              backupMode === 'unencrypted-export' ? '🔓 Unencrypted Export Mode (⚠️ Not Recommended)' :
              backupMode === 'encrypted-import' ? '📥 Encrypted Import Mode' :
              '📥 Unencrypted Import Mode'
            }}
          </strong>
          <p class="subpanel-hint">
            {{ 
              backupMode === 'encrypted-export' ? 'Your vault remains fully protected by zero-knowledge encryption.' :
              backupMode === 'unencrypted-export' ? 'Warning: Plain text exports expose your timeline history in readable text format.' :
              backupMode === 'encrypted-import' ? 'Upload an encrypted backup file or paste string blocks to restore your vault state.' :
              'Upload an unencrypted text file or paste text content to overwrite your vault and automatically re-encrypt it under your current master password.'
            }}
          </p>
        </div>

        <!-- Hidden file input for file-based imports -->
        <input
          ref="fileInputRef"
          type="file"
          accept=".txt,text/plain"
          style="display: none;"
          @change="emit('fileImportUpload', $event)"
        />

        <div v-if="backupMode.includes('import')" class="import-file-selector-bar">
          <button type="button" class="secondary-btn file-select-btn" @click="triggerFileInput">
            📁 Choose File to Import...
          </button>
        </div>

        <textarea
          :value="backupText"
          :readonly="!backupMode.includes('import')"
          :placeholder="
            backupMode.includes('import')
              ? 'Paste content/structure blocks here or select a file above...'
              : 'Vault export content string...'
          "
          class="backup-textarea"
          @input="emit('update:backupText', ($event.target as HTMLTextAreaElement).value)"
        />

        <div v-if="backupMode.includes('export')" class="export-options-group">
          <button
            class="backup-submit"
            @click="emit('submitBackup', 'clipboard')"
          >
            📋 Copy String to Clipboard
          </button>
          <button
            class="backup-submit secondary-submit"
            @click="emit('submitBackup', 'file')"
          >
            💾 Download as File (.txt)
          </button>
        </div>

        <button
          v-else
          class="backup-submit danger-btn"
          @click="emit('submitBackup', 'restore')"
        >
          🔥 Restore Backup (Overwrite)
        </button>

        <span class="status-msg" aria-live="polite">{{ backupStatus }}</span>
      </div>

      <div v-if="changePasswordVisible" class="settings-subpanel password-panel">
        <div class="input-group">
          <label for="old-password-input">Confirm Current Master Password</label>
          <input
            id="old-password-input"
            :value="oldPassword"
            type="password"
            autocomplete="off"
            @input="emit('update:oldPassword', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="input-group">
          <label for="new-password-input">New Master Password</label>
          <input
            id="new-password-input"
            :value="newPassword"
            type="password"
            autocomplete="off"
            @input="emit('update:newPassword', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="input-group">
          <label for="new-password-confirm">Confirm New Master Password</label>
          <input
            id="new-password-confirm"
            :value="passwordConfirmation"
            type="password"
            autocomplete="off"
            @input="emit('update:passwordConfirmation', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <button class="danger-btn" @click="emit('submitPassword')">
          Update Vault Security Key
        </button>
        <span class="status-msg" aria-live="polite">{{ passwordStatus }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel-box {
  width: 100%;
  box-sizing: border-box;
}

.backup-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.backup-actions button {
  width: 100%;
  box-sizing: border-box;
}

.warning-action-btn {
  border-color: #e67700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.5rem;
}

.badge-not-recommended {
  font-size: 0.72rem;
  background: #fff3bf;
  color: #e67700;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
}

.settings-subpanel {
  margin-top: 1rem;
  width: 100%;
  box-sizing: border-box;
}

.export-mode-banner {
  margin-bottom: 0.75rem;
  padding: 0.6rem;
  background: var(--banner-bg, #f8f9fa);
  border-left: 3px solid #2b8a3e;
  border-radius: 4px;
  word-break: break-word;
}

.export-mode-banner.warning-banner {
  border-left-color: #e67700;
}

.subpanel-hint {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.25rem;
  margin-bottom: 0;
}

.import-file-selector-bar {
  margin-bottom: 0.5rem;
  width: 100%;
}

.file-select-btn {
  width: 100%;
  box-sizing: border-box;
  background-color: var(--secondary-btn-bg, #e9ecef);
}

.backup-textarea {
  width: 100%;
  min-height: 120px;
  box-sizing: border-box;
}

.export-options-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
  width: 100%;
}

.export-options-group button,
.backup-submit {
  width: 100%;
  box-sizing: border-box;
}

.secondary-submit {
  background-color: #495057;
}

@media (min-width: 640px) {
  .backup-actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }

  .export-options-group {
    flex-direction: row;
  }

  .export-options-group button {
    flex: 1;
  }
}
</style>
<script setup lang="ts">
defineProps<{
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
  exportVault: [];
  importVault: [];
  togglePasswordPanel: [];
  submitBackup: [];
  submitPassword: [];
  "update:backupText": [value: string];
  "update:oldPassword": [value: string];
  "update:newPassword": [value: string];
  "update:passwordConfirmation": [value: string];
}>();
</script>

<template>
  <section class="nav-view-panel active">
    <div class="section-title">Data Administration</div>
    <div class="panel-box">
      <p class="section-desc">
        Manage encrypted vault string backups and security settings directly.
      </p>
      <div class="backup-actions">
        <button class="secondary-btn" @click="emit('exportVault')">
          Export Vault String
        </button>
        <button class="secondary-btn" @click="emit('importVault')">
          Import Vault String
        </button>
        <button class="secondary-btn change-password-button" @click="emit('togglePasswordPanel')">
          🔑 Change Password
        </button>
      </div>

      <div v-if="backupVisible" class="settings-subpanel">
        <textarea
          :value="backupText"
          :readonly="backupMode === 'export'"
          :placeholder="
            backupMode === 'export'
              ? 'Encrypted vault string'
              : 'Paste raw encrypted string structure blocks here for state restoration...'
          "
          class="backup-textarea"
          @input="emit('update:backupText', ($event.target as HTMLTextAreaElement).value)"
        />
        <button
          :class="{ 'danger-btn': backupMode === 'import' }"
          class="backup-submit"
          @click="emit('submitBackup')"
        >
          {{ backupMode === "export" ? "📋 Copy to Clipboard" : "🔥 Restore Backup (Overwrite)" }}
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

<!-- App.vue -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { BufferService } from "@core/services/BufferService";
import { VaultService } from "@core/services/VaultService";
import { withFreshTimestamp } from "@core/utils/date";
import { CryptoJSAdapter } from "../adapters/CryptoJSAdapter";
import { IndexedDBAdapter } from "../adapters/IndexedDBAdapter";
import AuthModal from "./components/AuthModal.vue";
import MainApp from "./components/MainApp.vue";
import SettingsView from "./components/SettingsView.vue";

function hasRealWritingSpaceContent(stored: string): boolean {
  return stored.replace(/\[TIME [^\]]*\]:/g, "").trim().length > 0;
}

const isUnlocked = ref(false);
const initialized = ref(false);
const storageError = ref("");
const firstTime = ref(false);
const isFirstTimeImportView = ref(false);
const isLockedExportView = ref(false);
const importing = ref<string | null>(null);

const mode = ref<"writingSpace" | "unlock">("writingSpace");
const password = ref("");
const unlocking = ref(false);
const writingSpaceText = ref("");
const writingSpaceSaveStatus = ref("");
const content = ref("");
const activeView = ref<"thoughts" | "analytics" | "settings">("thoughts");
const toast = ref("");

const backupVisible = ref(false);
const changePasswordVisible = ref(false);
const backupMode = ref<"encrypted-export" | "unencrypted-export" | "encrypted-import" | "unencrypted-import">("encrypted-export");
const backupText = ref("");
const backupStatus = ref("");
const oldPassword = ref("");
const newPassword = ref("");
const passwordConfirmation = ref("");
const passwordStatus = ref("");

// Backup Reminder State
const showBackupReminder = ref(false);
const dontShowBackupReminderAgain = ref(false);
const reminderIntervalDays = ref<number>(2);

const LAST_EXPORT_KEY = "daymemory-last-export-timestamp";
const DONT_SHOW_REMINDER_KEY = "daymemory-dont-show-backup-reminder";
const REMINDER_INTERVAL_KEY = "daymemory-backup-reminder-interval";

let vaultService: VaultService | null = null;
let writingSpaceService: BufferService | null = null;
let storageInstance: IndexedDBAdapter | null = null;

let writingSpaceAutosaveTimeout: ReturnType<typeof setTimeout> | null = null;
let writingSpaceStatusTimeout: ReturnType<typeof setTimeout> | null = null;
let passwordReloadTimeout: ReturnType<typeof setTimeout> | null = null;
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function clearTimer(timer: ReturnType<typeof setTimeout> | null): null {
  if (timer !== null) clearTimeout(timer);
  return null;
}

function showToast(message: string): void {
  toast.value = message;
  toastTimeout = clearTimer(toastTimeout);
  toastTimeout = setTimeout(() => (toast.value = ""), 3000);
}

function showSavedStatus(target: typeof writingSpaceSaveStatus): void {
  target.value = "Saved";
  writingSpaceStatusTimeout = clearTimer(writingSpaceStatusTimeout);
  writingSpaceStatusTimeout = setTimeout(() => (target.value = ""), 1500);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadReminderSettings(): Promise<void> {
  if (!storageInstance) return;
  try {
    const savedInterval = await storageInstance.getItem(REMINDER_INTERVAL_KEY);
    if (savedInterval !== null) {
      reminderIntervalDays.value = Number(savedInterval);
    }
  } catch (e) {
    console.error("Failed to load reminder interval from adapter", e);
  }
}

async function updateReminderIntervalDays(days: number): Promise<void> {
  reminderIntervalDays.value = days;
  if (!storageInstance) return;
  try {
    await storageInstance.setItem(REMINDER_INTERVAL_KEY, String(days));
    if (days === 0) {
      await storageInstance.setItem(DONT_SHOW_REMINDER_KEY, "true");
    } else {
      await storageInstance.removeItem(DONT_SHOW_REMINDER_KEY);
    }
  } catch (e) {
    console.error("Failed to update reminder interval in adapter", e);
  }
}

async function checkVaultExportReminder(): Promise<void> {
  if (!storageInstance) return;
  try {
    if (reminderIntervalDays.value === 0) return;

    const dontShow = (await storageInstance.getItem(DONT_SHOW_REMINDER_KEY)) === "true";
    if (dontShow) return;

    const lastExportStr = await storageInstance.getItem(LAST_EXPORT_KEY);
    const now = Date.now();
    const intervalMs = reminderIntervalDays.value * 24 * 60 * 60 * 1000;

    if (!lastExportStr || now - Number(lastExportStr) >= intervalMs) {
      showBackupReminder.value = true;
    }
  } catch (e) {
    console.error("Failed to check backup reminder state from adapter", e);
  }
}

async function recordExportTimestamp(): Promise<void> {
  if (!storageInstance) return;
  try {
    await storageInstance.setItem(LAST_EXPORT_KEY, String(Date.now()));
  } catch (e) {
    console.error("Failed to save export timestamp to adapter", e);
  }
}

async function closeBackupReminder(): Promise<void> {
  if (dontShowBackupReminderAgain.value && storageInstance) {
    try {
      await storageInstance.setItem(DONT_SHOW_REMINDER_KEY, "true");
    } catch (e) {
      console.error(e);
    }
  }
  showBackupReminder.value = false;
}

async function handleReminderBackupNow(): Promise<void> {
  if (dontShowBackupReminderAgain.value && storageInstance) {
    try {
      await storageInstance.setItem(DONT_SHOW_REMINDER_KEY, "true");
    } catch (e) {
      console.error(e);
    }
  }
  showBackupReminder.value = false;
  openLockedExport();
}

async function handleRemindInSettings(): Promise<void> {
  if (dontShowBackupReminderAgain.value && storageInstance) {
    try {
      await storageInstance.setItem(DONT_SHOW_REMINDER_KEY, "true");
    } catch (e) {
      console.error(e);
    }
  }
  showBackupReminder.value = false;
  navigate("settings");
}

async function initialize(): Promise<void> {
  const storage = new IndexedDBAdapter();
  storageInstance = storage;
  try {
    await storage.open();
    await loadReminderSettings();
    vaultService = new VaultService(storage, new CryptoJSAdapter());
    writingSpaceService = new BufferService(storage);

    const storedImport = await storage.getItem("importing");
    if (storedImport) {
      importing.value = storedImport;
    }

    firstTime.value = !(await vaultService.hasVault()) && !storedImport;

    const storedWritingSpace = await writingSpaceService.getBuffer();
    const initialText = withFreshTimestamp(storedWritingSpace);
    writingSpaceText.value = initialText;
    await writingSpaceService.saveBuffer(initialText);
  } catch (error) {
    console.error(error);
    storageError.value = `DayMemory couldn't access its local IndexedDB storage (${describeError(error)}). Check that site data is available and try again. Private/incognito mode or blocked site data can cause this.`;
  } finally {
    initialized.value = true;
  }
}

async function mergeWritingSpaceIntoVault(): Promise<boolean> {
  if (!writingSpaceService || !vaultService) throw new Error("Vault services are not initialized.");

  const pending = await writingSpaceService.getBuffer();
  if (!hasRealWritingSpaceContent(pending)) {
    if (pending) await writingSpaceService.clear();
    return false;
  }

  await vaultService.appendContent(pending);
  await writingSpaceService.clear();
  return true;
}

async function unlock(): Promise<void> {
  const enteredPassword = password.value.trim();
  if (!enteredPassword || unlocking.value || !vaultService) return;

  unlocking.value = true;
  let success = false;
  let merged = false;
  try {
    success = await vaultService.unlock(enteredPassword);
    if (success) {
      merged = await mergeWritingSpaceIntoVault();
      writingSpaceText.value = "";
    }
  } catch (error) {
    console.error(error);
    vaultService.lock();
    showToast(`Couldn't read or write the vault (${describeError(error)}). Nothing was changed.`);
    return;
  } finally {
    unlocking.value = false;
  }

  if (!success) {
    password.value = "";
    showToast("Incorrect password.");
    return;
  }

  isUnlocked.value = true;
  content.value = vaultService.getContent();

  if (merged) showToast("Your writings were added to the vault");
  await checkVaultExportReminder();
}

async function handleAuth(): Promise<void> {
  if (importing.value) {
    const enteredPassword = password.value.trim();
    if (!enteredPassword || unlocking.value || !vaultService || !storageInstance) return;

    unlocking.value = true;
    try {
      if (importing.value === "plain") {
        const success = await vaultService.changePassword("temp-dummy-password-for-import", enteredPassword);
        if (!success) {
          showToast("Failed to set new password.");
          unlocking.value = false;
          return;
        }
      } else if (importing.value === "vault") {
        const success = await vaultService.unlock(enteredPassword);
        if (!success) {
          password.value = "";
          showToast("Incorrect password.");
          unlocking.value = false;
          return;
        }
      }

      await storageInstance.removeItem("importing");
      importing.value = null;

      isUnlocked.value = true;
      content.value = vaultService.getContent();
      showToast("Vault successfully authenticated and unlocked.");
      await checkVaultExportReminder();
    } catch (error) {
      console.error(error);
      showToast(`Authentication failed (${describeError(error)}).`);
    } finally {
      unlocking.value = false;
    }
  } else {
    await unlock();
  }
}

async function openLockedExport(): Promise<void> {
  isLockedExportView.value = true;
  changePasswordVisible.value = false;
  await openExport("encrypted");
}

function closeLockedExport(): void {
  isLockedExportView.value = false;
  backupVisible.value = false;
  backupText.value = "";
  backupStatus.value = "";
}

function openFirstTimeImport(): void {
  isFirstTimeImportView.value = true;
  backupVisible.value = false;
  changePasswordVisible.value = false;
  backupText.value = "";
  backupStatus.value = "";
}

async function submitFirstTimeImportBackup(): Promise<void> {
  const raw = backupText.value.trim();
  if (!raw) return;

  const isUnencryptedImport = backupMode.value === "unencrypted-import";
  const importType = isUnencryptedImport ? "plain" : "vault";

  const confirmMsg = isUnencryptedImport
    ? "This will overwrite your current vault content with the imported plain history text content, and securely re-encrypt it. Proceed?"
    : "This will overwrite your current vault with the imported encrypted vault string. Proceed?";

  if (!window.confirm(confirmMsg)) {
    return;
  }

  try {
    if (!vaultService || !storageInstance) throw new Error("Vault service is not initialized.");

    const dummyPassword = "temp-dummy-password-for-import";
    await vaultService.unlock(dummyPassword);

    if (isUnencryptedImport) {
      await vaultService.saveContent(raw);
    } else {
      await vaultService.importRaw(raw);
    }

    await storageInstance.setItem("importing", importType);
    importing.value = importType;
    firstTime.value = false;

    isFirstTimeImportView.value = false;
    showToast("Import complete. Please authenticate.");
  } catch (error) {
    console.error(error);
    backupStatus.value = "Couldn't write the import data to storage. Nothing was changed.";
  }
}

async function updateVaultContent(newContent: string): Promise<void> {
  try {
    if (!vaultService) throw new Error("Vault service is not initialized.");
    await vaultService.saveContent(newContent);
    content.value = newContent;
  } catch (error) {
    console.error(error);
    showToast(`Failed to save changes: ${describeError(error)}`);
  }
}

function updateWritingSpace(value: string): void {
  writingSpaceText.value = value;
  writingSpaceAutosaveTimeout = clearTimer(writingSpaceAutosaveTimeout);
  writingSpaceAutosaveTimeout = setTimeout(() => void saveCurrentWritingSpace(), 500);
}

async function saveCurrentWritingSpace(): Promise<void> {
  if (!writingSpaceService) return;
  try {
    await writingSpaceService.saveBuffer(writingSpaceText.value);
  } catch (error) {
    console.error(error);
    writingSpaceSaveStatus.value = "Save failed";
    return;
  }
  showSavedStatus(writingSpaceSaveStatus);
}

function navigate(view: "thoughts" | "analytics" | "settings"): void {
  activeView.value = view;
  if (view === "settings") {
    backupVisible.value = false;
    changePasswordVisible.value = false;
  }
}

async function openExport(type: "encrypted" | "unencrypted"): Promise<void> {
  if (type === "unencrypted") {
    const confirmUnencrypted = window.confirm(
      "Skip plain text exports—they aren't secure. Only use them if you are migrating your history to another app. For regular backups, export the encrypted string, which you can unlock anytime with your password."
    );
    if (!confirmUnencrypted) return;
  }

  backupMode.value = type === "encrypted" ? "encrypted-export" : "unencrypted-export";
  changePasswordVisible.value = false;
  backupVisible.value = true;
  backupText.value = "";
  backupStatus.value = "";
  try {
    if (!vaultService) throw new Error("Vault service is not initialized.");
    if (type === "encrypted") {
      backupText.value = (await vaultService.exportRaw()) || "";
    } else {
      backupText.value = vaultService.getContent() || "";
    }
  } catch (error) {
    console.error(error);
    backupStatus.value = "Couldn't read vault content from storage.";
  }
}

function openImport(type: "encrypted" | "unencrypted"): void {
  backupMode.value = type === "encrypted" ? "encrypted-import" : "unencrypted-import";
  changePasswordVisible.value = false;
  backupVisible.value = true;
  backupText.value = "";
  backupStatus.value = "";
}

interface SaveFilePickerOptions {
  suggestedName: string;
  types: {
    description: string;
    accept: Record<string, string[]>;
  }[];
}

interface SaveFileHandle {
  createWritable(): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }>;
}

async function downloadFile(filename: string, text: string): Promise<void> {
  const filePickerWindow = window as Window & {
    showSaveFilePicker?: (options: SaveFilePickerOptions) => Promise<SaveFileHandle>;
  };

  if (typeof filePickerWindow.showSaveFilePicker === "function") {
    try {
      const options: SaveFilePickerOptions = {
        suggestedName: filename,
        types: [
          {
            description: 'Text Files',
            accept: {
              'text/plain': ['.txt'],
            },
          },
        ],
      };
      
      const handle = await filePickerWindow.showSaveFilePicker(options);
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      
      backupStatus.value = `File saved successfully.`;
      return;
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.warn('File System Access API failed, falling back to legacy download:', error);
    }
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  backupStatus.value = `Download started.`;
}

function handleFileImportUpload(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target?.result;
    if (typeof result === "string") {
      backupText.value = result;
      backupStatus.value = `Loaded file: ${file.name}`;
    }
  };
  reader.onerror = () => {
    backupStatus.value = "Failed to read the selected file.";
  };
  reader.readAsText(file);
  target.value = "";
}

async function submitBackup(actionType: "clipboard" | "file" | "restore"): Promise<void> {
  if (backupMode.value === "encrypted-export" || backupMode.value === "unencrypted-export") {
    if (!backupText.value) return;
    const isEncrypted = backupMode.value === "encrypted-export";
    const label = isEncrypted ? "Encrypted vault string" : "Unencrypted plain history text";
    const filename = isEncrypted ? "daymemory-vault-encrypted.txt" : "daymemory-plain-history.txt";

    if (isEncrypted) {
      await recordExportTimestamp();
    }

    if (actionType === "clipboard") {
      try {
        await navigator.clipboard.writeText(backupText.value);
        backupStatus.value = `${label} copied to clipboard.`;
      } catch (error) {
        console.error(error);
        backupStatus.value = `Couldn't copy ${label.toLowerCase()} to clipboard.`;
      }
    } else {
      try {
        await downloadFile(filename, backupText.value);
      } catch (error) {
        console.error(error);
        backupStatus.value = "Couldn't start the file download.";
      }
    }
    return;
  }

  const raw = backupText.value.trim();
  if (!raw) return;

  const isUnencryptedImport = backupMode.value === "unencrypted-import";
  const confirmMsg = isUnencryptedImport
    ? "This will overwrite your current vault content with the imported plain history text content, and securely re-encrypt it using your active master password. Proceed?"
    : "This will overwrite your current vault with the imported encrypted vault string. And you'll need to provide password of the imported vault to unlock it. Proceed?";

  if (!window.confirm(confirmMsg)) {
    return;
  }

  try {
    if (!vaultService || !storageInstance) throw new Error("Vault service is not initialized.");
    if (isUnencryptedImport) {
      await vaultService.saveContent(raw);
    } else {
      await vaultService.importRaw(raw);
      await storageInstance.setItem("importing", "vault");
    }
  } catch (error) {
    console.error(error);
    backupStatus.value = "Couldn't write the import data to storage. Nothing was changed.";
    return;
  }
  showToast("Vault imported. Reloading…");
  passwordReloadTimeout = setTimeout(() => window.location.reload(), 1200);
}

function togglePasswordPanel(): void {
  backupVisible.value = false;
  changePasswordVisible.value = !changePasswordVisible.value;
  oldPassword.value = "";
  newPassword.value = "";
  passwordConfirmation.value = "";
  passwordStatus.value = "";
}

async function submitPasswordChange(): Promise<void> {
  const old = oldPassword.value.trim();
  const next = newPassword.value.trim();
  const confirmation = passwordConfirmation.value.trim();

  if (!old || !next || !confirmation) {
    passwordStatus.value = "Please fill in all fields.";
    return;
  }
  if (next !== confirmation) {
    passwordStatus.value = "New passwords don't match.";
    return;
  }
  if (old === next) {
    passwordStatus.value = "New password must differ from the current one.";
    return;
  }

  let changed = false;
  try {
    if (!vaultService) throw new Error("Vault service is not initialized.");
    changed = await vaultService.changePassword(old, next);
  } catch (error) {
    console.error(error);
    passwordStatus.value = "Couldn't save the re-encrypted vault. Password unchanged.";
    return;
  }
  if (!changed) {
    passwordStatus.value = "Current password is incorrect.";
    return;
  }

  passwordStatus.value = "Password updated. Reloading…";
  passwordReloadTimeout = setTimeout(() => window.location.reload(), 1500);
}

function lockVault(): Promise<void> {
  vaultService?.lock();
  content.value = "";
  isUnlocked.value = false;
  mode.value = "writingSpace";
  password.value = "";
  return Promise.resolve();
}

onMounted(() => void initialize());

onBeforeUnmount(() => {
  writingSpaceAutosaveTimeout = clearTimer(writingSpaceAutosaveTimeout);
  writingSpaceStatusTimeout = clearTimer(writingSpaceStatusTimeout);
  passwordReloadTimeout = clearTimer(passwordReloadTimeout);
  toastTimeout = clearTimer(toastTimeout);
  vaultService?.lock();
});
</script>

<template>
  <main v-if="storageError" class="splash">
    <h2>Storage unavailable</h2>
    <p>{{ storageError }}</p>
  </main>
  <main v-else-if="!initialized" class="splash">
    <h2>Opening DayMemory…</h2>
  </main>
  <template v-else-if="isLockedExportView">
    <div class="app">
      <header class="app-header">
        <button type="button" class="text-btn" @click="closeLockedExport">Back</button>
        <h1>Export vault</h1>
      </header>

      <main class="view">
        <SettingsView
          :backup-visible="backupVisible"
          :change-password-visible="false"
          :backup-mode="backupMode"
          :backup-text="backupText"
          :backup-status="backupStatus"
          :old-password="oldPassword"
          :new-password="newPassword"
          :password-confirmation="passwordConfirmation"
          :password-status="passwordStatus"
          :reminder-interval-days="reminderIntervalDays"
          :export-only="true"
          @submit-backup="submitBackup"
          @update:backup-text="backupText = $event"
          @update:reminder-interval-days="updateReminderIntervalDays"
        />
      </main>
    </div>
  </template>
  <template v-else-if="isFirstTimeImportView">
    <div class="app">
      <header class="app-header">
        <h1>Import vault</h1>
      </header>

      <main class="view">
        <SettingsView
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
          :is-first-time-import="true"
          @open-export="openExport"
          @open-import="openImport"
          @toggle-password-panel="togglePasswordPanel"
          @submit-backup="submitFirstTimeImportBackup"
          @file-import-upload="handleFileImportUpload"
          @submit-password="submitPasswordChange"
          @update:backup-text="backupText = $event"
          @update:old-password="oldPassword = $event"
          @update:new-password="newPassword = $event"
          @update:password-confirmation="passwordConfirmation = $event"
          @update:reminder-interval-days="updateReminderIntervalDays"
        />
      </main>
    </div>
  </template>
  <template v-else>
    <AuthModal
      v-if="!isUnlocked"
      :first-time="firstTime"
      :importing="importing"
      :mode="mode"
      :password="password"
      :writing-space-text="writingSpaceText"
      :writing-space-save-status="writingSpaceSaveStatus"
      :unlocking="unlocking"
      @unlock="handleAuth"
      @update:password="password = $event"
      @update:writing-space-text="updateWritingSpace"
      @toggle-mode="mode = mode === 'writingSpace' ? 'unlock' : 'writingSpace'"
      @open-first-time-import="openFirstTimeImport"
      @open-locked-export="openLockedExport"
    />
    <MainApp
      v-else
      :active-view="activeView"
      :content="content"
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
      @lock="lockVault"
      @navigate="navigate"
      @open-export="openExport"
      @open-import="openImport"
      @toggle-password-panel="togglePasswordPanel"
      @submit-backup="submitBackup"
      @file-import-upload="handleFileImportUpload"
      @submit-password="submitPasswordChange"
      @update:backup-text="backupText = $event"
      @update:old-password="oldPassword = $event"
      @update:new-password="newPassword = $event"
      @update:password-confirmation="passwordConfirmation = $event"
      @update:reminder-interval-days="updateReminderIntervalDays"
      @update:content="updateVaultContent"
    />
  </template>

  <!-- Backup Reminder Popup -->
  <Transition name="toast">
    <div v-if="showBackupReminder" class="backup-reminder-overlay" @click.self="closeBackupReminder">
      <div class="backup-reminder-card" role="dialog" aria-labelledby="reminder-title">
        <h2 id="reminder-title">Secure your vault</h2>
        <p>
          You haven't exported your encrypted vault string in the last {{ reminderIntervalDays }} {{ reminderIntervalDays === 1 ? 'day' : 'days' }}. Regular backups to another device or cloud storage like Google Drive ensure you never lose your history.
        </p>
        <label class="backup-reminder-checkbox">
          <input
            v-model="dontShowBackupReminderAgain"
            type="checkbox"
          />
          Don't show again
        </label>
        <div class="backup-reminder-actions">
          <button type="button" class="btn secondary" @click="closeBackupReminder">Close</button>
          <button type="button" class="btn secondary" @click="handleRemindInSettings">Remind in…</button>
          <button type="button" class="btn" @click="handleReminderBackupNow">Backup now</button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="toast">
    <p v-if="toast" class="toast" role="status">{{ toast }}</p>
  </Transition>
</template>
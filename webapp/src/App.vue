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

function hasRealBufferContent(stored: string): boolean {
  return stored.replace(/\[TIME [^\]]*\]:/g, "").trim().length > 0;
}

const isUnlocked = ref(false);
const initialized = ref(false);
const storageError = ref("");
const firstTime = ref(false);
const mode = ref<"buffer" | "unlock">("buffer");
const password = ref("");
const unlocking = ref(false);
const bufferText = ref("");
const bufferSaveStatus = ref("");
const content = ref("");
const activeView = ref<"thoughts" | "settings">("thoughts");

const backupVisible = ref(false);
const changePasswordVisible = ref(false);
const backupMode = ref<"encrypted-export" | "unencrypted-export" | "import">("encrypted-export");
const backupText = ref("");
const backupStatus = ref("");
const oldPassword = ref("");
const newPassword = ref("");
const passwordConfirmation = ref("");
const passwordStatus = ref("");

let vaultService: VaultService | null = null;
let bufferService: BufferService | null = null;
let bufferAutosaveTimeout: ReturnType<typeof setTimeout> | null = null;
let bufferStatusTimeout: ReturnType<typeof setTimeout> | null = null;
let passwordReloadTimeout: ReturnType<typeof setTimeout> | null = null;

function clearTimer(timer: ReturnType<typeof setTimeout> | null): null {
  if (timer !== null) clearTimeout(timer);
  return null;
}

function showSavedStatus(target: typeof bufferSaveStatus): void {
  target.value = "✓ Saved";
  bufferStatusTimeout = clearTimer(bufferStatusTimeout);
  bufferStatusTimeout = setTimeout(() => (target.value = ""), 1500);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function initialize(): Promise<void> {
  const storage = new IndexedDBAdapter();
  try {
    await storage.open();
    vaultService = new VaultService(storage, new CryptoJSAdapter());
    bufferService = new BufferService(storage);
    firstTime.value = !(await vaultService.hasVault());

    const storedBuffer = await bufferService.getBuffer();
    const initialText = withFreshTimestamp(storedBuffer);
    bufferText.value = initialText;
    await bufferService.saveBuffer(initialText);
  } catch (error) {
    console.error(error);
    storageError.value = `DayMemory couldn't access its local IndexedDB storage (${describeError(error)}). Check that site data is available and try again. Private/incognito mode or blocked site data can cause this.`;
  } finally {
    initialized.value = true;
  }
}

async function mergeBufferIntoVault(): Promise<boolean> {
  if (!bufferService || !vaultService) throw new Error("Vault services are not initialized.");

  const pending = await bufferService.getBuffer();
  if (!hasRealBufferContent(pending)) {
    if (pending) await bufferService.clear();
    return false;
  }

  await vaultService.appendContent(pending);
  await bufferService.clear();
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
    if (success) merged = await mergeBufferIntoVault();
  } catch (error) {
    console.error(error);
    vaultService.lock();
    window.alert(
      `Couldn't read or write the vault in IndexedDB (${describeError(error)}). Nothing was changed; try again.`
    );
    return;
  } finally {
    unlocking.value = false;
  }

  if (!success) {
    password.value = "";
    window.alert("Incorrect password.");
    return;
  }

  isUnlocked.value = true;
  content.value = vaultService.getContent();

  if (merged) {
    window.setTimeout(() => {
      window.alert(
        "✅ Your pending buffer entries have been merged and securely encrypted into your vault. The local buffer is now cleared."
      );
    }, 150);
  }
}

async function updateVaultContent(newContent: string): Promise<void> {
  try {
    if (!vaultService) throw new Error("Vault service is not initialized.");
    await vaultService.saveContent(newContent);
    content.value = newContent;
  } catch (error) {
    console.error(error);
    window.alert(`Failed to save section edits: ${describeError(error)}`);
  }
}

function updateBuffer(value: string): void {
  bufferText.value = value;
  bufferAutosaveTimeout = clearTimer(bufferAutosaveTimeout);
  bufferAutosaveTimeout = setTimeout(() => void saveCurrentBuffer(), 500);
}

async function saveCurrentBuffer(): Promise<void> {
  if (!bufferService) return;
  try {
    await bufferService.saveBuffer(bufferText.value);
  } catch (error) {
    console.error(error);
    bufferSaveStatus.value = "⚠ Save failed";
    return;
  }
  showSavedStatus(bufferSaveStatus);
}

function navigate(view: "thoughts" | "settings"): void {
  activeView.value = view;
  if (view === "settings") {
    backupVisible.value = false;
    changePasswordVisible.value = false;
  }
}

async function openExport(type: "encrypted" | "unencrypted"): Promise<void> {
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
    backupStatus.value = "⚠ Couldn't read vault content from storage.";
  }
}

function importVault(): void {
  backupMode.value = "import";
  changePasswordVisible.value = false;
  backupVisible.value = true;
  backupText.value = "";
  backupStatus.value = "";
}

function downloadFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function submitBackup(actionType: "clipboard" | "file"): Promise<void> {
  if (backupMode.value === "encrypted-export" || backupMode.value === "unencrypted-export") {
    if (!backupText.value) return;
    const isEncrypted = backupMode.value === "encrypted-export";
    const label = isEncrypted ? "Encrypted vault string" : "Unencrypted vault content";
    const filename = isEncrypted ? "daymemory-vault-encrypted.txt" : "daymemory-vault-unencrypted.txt";

    if (actionType === "clipboard") {
      try {
        await navigator.clipboard.writeText(backupText.value);
        backupStatus.value = `${label} copied to clipboard!`;
      } catch (error) {
        console.error(error);
        backupStatus.value = `⚠ Couldn't copy ${label.toLowerCase()} to clipboard.`;
      }
    } else {
      try {
        downloadFile(filename, backupText.value);
        backupStatus.value = `${label} exported as file!`;
      } catch (error) {
        console.error(error);
        backupStatus.value = `⚠ Couldn't trigger file download.`;
      }
    }
    return;
  }

  // Import mode
  const raw = backupText.value.trim();
  if (!raw || !window.confirm("This will overwrite all current system entries with your backup text. Proceed?")) {
    return;
  }
  try {
    if (!vaultService) throw new Error("Vault service is not initialized.");
    await vaultService.importRaw(raw);
  } catch (error) {
    console.error(error);
    backupStatus.value = "⚠ Couldn't write the backup to storage. Nothing was changed.";
    return;
  }
  window.alert("Vault string imported successfully! App environment will now refresh.");
  window.location.reload();
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
    passwordStatus.value = "❌ Please fulfill all verification parameters.";
    return;
  }
  if (next !== confirmation) {
    passwordStatus.value = "❌ Mismatch across new target password entries.";
    return;
  }
  if (old === next) {
    passwordStatus.value = "❌ New password must be distinct from old baseline configuration.";
    return;
  }

  let changed = false;
  try {
    if (!vaultService) throw new Error("Vault service is not initialized.");
    changed = await vaultService.changePassword(old, next);
  } catch (error) {
    console.error(error);
    passwordStatus.value = "❌ Couldn't write the re-encrypted vault to storage. Password unchanged.";
    return;
  }
  if (!changed) {
    passwordStatus.value = "❌ Confirmed old master password validation fails.";
    return;
  }

  passwordStatus.value = "🎉 Encryption key swapped! Reloading engine state...";
  passwordReloadTimeout = setTimeout(() => window.location.reload(), 1500);
}

function lockVault(): Promise<void> {
  vaultService?.lock();
  content.value = "";
  isUnlocked.value = false;
  mode.value = "buffer";
  password.value = "";
  return Promise.resolve();
}

onMounted(() => void initialize());

onBeforeUnmount(() => {
  bufferAutosaveTimeout = clearTimer(bufferAutosaveTimeout);
  bufferStatusTimeout = clearTimer(bufferStatusTimeout);
  passwordReloadTimeout = clearTimer(passwordReloadTimeout);
  vaultService?.lock();
});
</script>

<template>
  <div v-if="storageError" class="modal-overlay">
    <div class="modal-content storage-error">
      <h2>Storage unavailable</h2>
      <p class="status-msg">{{ storageError }}</p>
    </div>
  </div>
  <div v-else-if="!initialized" class="modal-overlay">
    <div class="modal-content storage-error">
      <h2>Opening DayMemory…</h2>
    </div>
  </div>
  <template v-else>
    <AuthModal
      v-if="!isUnlocked"
      :first-time="firstTime"
      :mode="mode"
      :password="password"
      :buffer-text="bufferText"
      :buffer-save-status="bufferSaveStatus"
      :unlocking="unlocking"
      @unlock="unlock"
      @update:password="password = $event"
      @update:buffer-text="updateBuffer"
      @toggle-mode="mode = mode === 'buffer' ? 'unlock' : 'buffer'"
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
      @lock="lockVault"
      @navigate="navigate"
      @open-export="openExport"
      @import-vault="importVault"
      @toggle-password-panel="togglePasswordPanel"
      @submit-backup="submitBackup"
      @submit-password="submitPasswordChange"
      @update:backup-text="backupText = $event"
      @update:old-password="oldPassword = $event"
      @update:new-password="newPassword = $event"
      @update:password-confirmation="passwordConfirmation = $event"
      @update:content="updateVaultContent"
    />
  </template>
</template>
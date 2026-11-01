import { VaultService } from "@core/services/VaultService";
import { BufferService } from "@core/services/BufferService";
import { withFreshTimestamp } from "@core/utils/date";

import { IndexedDBAdapter } from "../adapters/IndexedDBAdapter";
import { CryptoJSAdapter } from "../adapters/CryptoJSAdapter";

const QUICK_OPEN = "\n[QUICK]\n";
const QUICK_CLOSE = "\n[/QUICK]\n";

/** Strips any QUICK tags so exactly one wrapper is ever applied. */
function unwrapQuick(stored: string): string {
  return stored.replace(/\n?\[\/?QUICK\]\n?/g, "").replace(/^\n+|\n+$/g, "");
}

function wrapQuick(inner: string): string {
  return `${QUICK_OPEN}${unwrapQuick(inner)}${QUICK_CLOSE}`;
}

/** True if there's anything besides empty timestamps. */
function hasRealBufferContent(stored: string): boolean {
  return unwrapQuick(stored).replace(/\[TIME [^\]]*\]:/g, "").trim().length > 0;
}

/** Replaces the lock screen with an explanation when IndexedDB can't be used. */
function showFatalStorageError(err: unknown): void {
  console.error(err);
  const modal = document.getElementById("auth-modal");
  if (!modal) return;
  const message = err instanceof Error ? err.message : String(err);
  modal.textContent = "";
  const box = document.createElement("div");
  box.className = "modal-content";
  box.style.padding = "1.5rem";
  const heading = document.createElement("h2");
  heading.textContent = "Storage unavailable";
  const body = document.createElement("p");
  body.className = "status-msg";
  body.style.display = "block";
  body.textContent = `DayMemory keeps your vault in IndexedDB, which couldn't be opened (${message}). Your data has not been touched. Private/incognito mode or blocked site data can cause this.`;
  box.append(heading, body);
  modal.appendChild(box);
}

async function bootstrap(): Promise<void> {
  // ---- Open IndexedDB before anything can read or write the vault ----
  const storage = new IndexedDBAdapter();
  try {
    await storage.open();
  } catch (err) {
    showFatalStorageError(err);
    return;
  }

  // ---- Wire adapters into core services ----
  const encryption = new CryptoJSAdapter();

  const vaultService = new VaultService(storage, encryption);
  const bufferService = new BufferService(storage);

  // ---- Small typed DOM helper ----
  function el<T extends HTMLElement>(id: string): T {
    const found = document.getElementById(id);
    if (!found) throw new Error(`Missing element #${id}`);
    return found as T;
  }

  // 1. Navigation Shell Elements
  const navItems = document.querySelectorAll<HTMLButtonElement>(".bottom-nav .nav-item");
  const viewPanels = document.querySelectorAll<HTMLElement>(".nav-view-panel");
  const viewTitle = el<HTMLHeadingElement>("view-title");

  // 2. Core Operational Logic Nodes
  const authModal = el<HTMLDivElement>("auth-modal");
  const authForm = el<HTMLFormElement>("auth-form");
  const passwordInput = el<HTMLInputElement>("password-input");
  const authFirstTimeHint = el<HTMLParagraphElement>("auth-first-time-hint");
  const mainApp = el<HTMLDivElement>("main-app");
  const lockBtn = el<HTMLButtonElement>("lock-btn");

  // 2b. Lock-Screen Buffer UI Elements
  const lockViewToggleBtn = el<HTMLButtonElement>("lock-view-toggle-btn");
  const authFormPanel = el<HTMLDivElement>("auth-form-panel");
  const bufferPanel = el<HTMLDivElement>("buffer-panel");
  const bufferInput = el<HTMLTextAreaElement>("buffer-input");
  const bufferSaveStatus = el<HTMLSpanElement>("buffer-save-status");

  // 3. View 1 (Home) Elements
  const memoryInput = el<HTMLTextAreaElement>("memory-input");
  const memorySaveStatus = el<HTMLSpanElement>("memory-save-status");

  // 4. View 2 (Settings Architecture Elements)
  const exportBtn = el<HTMLButtonElement>("export-btn");
  const importBtn = el<HTMLButtonElement>("import-btn");
  const changePwdBtn = el<HTMLButtonElement>("change-pwd-btn");
  const backupIoZone = el<HTMLDivElement>("backup-io-zone");
  const backupTextarea = el<HTMLTextAreaElement>("backup-textarea");
  const backupActionSubmitBtn = el<HTMLButtonElement>("backup-action-submit-btn");
  const backupStatusMsg = el<HTMLSpanElement>("backup-status-msg");

  // Password Management UI Elements
  const changePwdZone = el<HTMLDivElement>("change-pwd-zone");
  const oldPasswordInput = el<HTMLInputElement>("old-password-input");
  const newPasswordInput = el<HTMLInputElement>("new-password-input");
  const newPasswordConfirm = el<HTMLInputElement>("new-password-confirm");
  const submitChangePwdBtn = el<HTMLButtonElement>("submit-change-pwd-btn");
  const pwdStatusMsg = el<HTMLSpanElement>("pwd-status-msg");

  void vaultService
    .hasVault()
    .then((hasVault) => authFirstTimeHint.classList.toggle("visual-hidden", hasVault))
    .catch((err) => console.error(err));

  // Volatile UI State
  let backupMode: "export" | "import" = "export";

  // --- AUTOSAVE STATUS INDICATOR HELPER ---
  const savedIndicatorTimeouts = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
  function flashSavedIndicator(target: HTMLElement | null) {
    if (!target) return;
    target.textContent = "✓ Saved";
    const prev = savedIndicatorTimeouts.get(target);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      target.textContent = "";
    }, 1500);
    savedIndicatorTimeouts.set(target, t);
  }

  async function mergeBufferIntoVault(): Promise<boolean> {
    const pending = await bufferService.getBuffer();
    if (!hasRealBufferContent(pending)) {
      if (pending) await bufferService.clear();
      return false;
    }
    await vaultService.appendContent(wrapQuick(pending));
    await bufferService.clear();
    return true;
  }

  // --- Tab-Switching & View Management System ---
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const targetViewId = item.getAttribute("data-target");
      if (!targetViewId) return;
      switchActiveViewPanel(targetViewId);

      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");
    });
  });

  function switchActiveViewPanel(viewId: string) {
    viewPanels.forEach((panel) => panel.classList.remove("active"));
    const activePanel = document.getElementById(viewId);
    activePanel?.classList.add("active");

    if (viewId === "view-home") {
      viewTitle.textContent = "Thoughts";
    } else if (viewId === "view-settings") {
      viewTitle.textContent = "Settings";
      backupIoZone.classList.add("visual-hidden");
      changePwdZone.classList.add("visual-hidden");
    }
  }

  // --- Auth ---
  let unlocking = false;
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const enteredPassword = passwordInput.value.trim();
    if (!enteredPassword || unlocking) return;
    unlocking = true;

    let success = false;
    let merged = false;
    try {
      success = await vaultService.unlock(enteredPassword);
      if (success) merged = await mergeBufferIntoVault();
    } catch (err) {
      console.error(err);
      vaultService.lock();
      alert(
        `Couldn't read or write the vault in IndexedDB (${err instanceof Error ? err.message : err}). Nothing was changed; try again.`
      );
      return;
    } finally {
      unlocking = false;
    }

    if (!success) {
      passwordInput.value = "";
      alert("Incorrect password.");
      return;
    }

    authModal.classList.add("visual-hidden");
    mainApp.classList.remove("visual-hidden");

    // Timestamp goes in AFTER the buffer merge, so it lands below the merged entries.
    const content = withFreshTimestamp(vaultService.getContent());
    memoryInput.value = content;
    try {
      await vaultService.saveContent(content);
    } catch (err) {
      console.error(err);
      memorySaveStatus.textContent = "⚠ Save failed";
    }
    memoryInput.focus();
    memoryInput.setSelectionRange(content.length, content.length);
    memoryInput.scrollTop = memoryInput.scrollHeight;

    if (merged) {
      setTimeout(() => {
        alert(
          `✅ Your pending buffer entries have been merged and securely encrypted into your vault. The local buffer is now cleared.`
        );
      }, 150);
    }
  });

  // --- HOME VIEW LOGIC ---
  let memoryAutosaveTimeout: ReturnType<typeof setTimeout> | null = null;
  memoryInput.addEventListener("input", () => {
    if (memoryAutosaveTimeout) clearTimeout(memoryAutosaveTimeout);
    memoryAutosaveTimeout = setTimeout(() => void saveCurrentContent(), 500);
  });

  async function saveCurrentContent(): Promise<void> {
    const text = memoryInput.value;
    try {
      await vaultService.saveContent(text);
    } catch (err) {
      console.error(err);
      memorySaveStatus.textContent = "⚠ Save failed";
      return;
    }
    flashSavedIndicator(memorySaveStatus);
  }

  // --- SETTINGS & BACKUP INTERFACES ---
  exportBtn.addEventListener("click", async () => {
    backupMode = "export";
    changePwdZone.classList.add("visual-hidden");
    backupIoZone.classList.remove("visual-hidden");
    backupTextarea.value = "";
    backupTextarea.readOnly = true;
    backupActionSubmitBtn.textContent = "📋 Copy to Clipboard";
    backupActionSubmitBtn.className = "";
    backupStatusMsg.textContent = "";
    try {
      backupTextarea.value = (await vaultService.exportRaw()) || "";
    } catch (err) {
      console.error(err);
      backupStatusMsg.textContent = "⚠ Couldn't read the vault from storage.";
      return;
    }
    backupTextarea.select();
  });

  importBtn.addEventListener("click", () => {
    backupMode = "import";
    changePwdZone.classList.add("visual-hidden");
    backupIoZone.classList.remove("visual-hidden");
    backupTextarea.value = "";
    backupTextarea.readOnly = false;
    backupTextarea.placeholder = "Paste raw encrypted string structure blocks here for state restoration...";
    backupActionSubmitBtn.textContent = "🔥 Restore Backup (Overwrite)";
    backupActionSubmitBtn.className = "danger-btn";
    backupStatusMsg.textContent = "";
  });

  backupActionSubmitBtn.addEventListener("click", async () => {
    if (backupMode === "export") {
      if (!backupTextarea.value) return;
      navigator.clipboard.writeText(backupTextarea.value).then(() => {
        backupStatusMsg.textContent = "Encrypted vault string copied to clipboard!";
      });
    } else {
      const str = backupTextarea.value.trim();
      if (!str) return;
      if (confirm("This will overwrite all current system entries with your backup text. Proceed?")) {
        try {
          await vaultService.importRaw(str);
        } catch (err) {
          console.error(err);
          backupStatusMsg.textContent = "⚠ Couldn't write the backup to storage. Nothing was changed.";
          return;
        }
        alert("Vault string imported successfully! App environment will now refresh.");
        window.location.reload();
      }
    }
  });

  // --- CHANGE MASTER PASSWORD ---
  changePwdBtn.addEventListener("click", () => {
    backupIoZone.classList.add("visual-hidden");
    changePwdZone.classList.toggle("visual-hidden");
    oldPasswordInput.value = "";
    newPasswordInput.value = "";
    newPasswordConfirm.value = "";
    pwdStatusMsg.textContent = "";
    pwdStatusMsg.style.color = "inherit";
  });

  submitChangePwdBtn.addEventListener("click", async () => {
    const oldPwd = oldPasswordInput.value.trim();
    const newPwd = newPasswordInput.value.trim();
    const confirmNewPwd = newPasswordConfirm.value.trim();

    if (!oldPwd || !newPwd || !confirmNewPwd) {
      pwdStatusMsg.textContent = "❌ Please fulfill all verification parameters.";
      pwdStatusMsg.style.color = "var(--danger)";
      return;
    }

    if (newPwd !== confirmNewPwd) {
      pwdStatusMsg.textContent = "❌ Mismatch across new target password entries.";
      pwdStatusMsg.style.color = "var(--danger)";
      return;
    }

    if (oldPwd === newPwd) {
      pwdStatusMsg.textContent = "❌ New password must be distinct from old baseline configuration.";
      pwdStatusMsg.style.color = "var(--danger)";
      return;
    }

    let changed = false;
    try {
      changed = await vaultService.changePassword(oldPwd, newPwd);
    } catch (err) {
      console.error(err);
      pwdStatusMsg.textContent = "❌ Couldn't write the re-encrypted vault to storage. Password unchanged.";
      pwdStatusMsg.style.color = "var(--danger)";
      return;
    }
    if (!changed) {
      pwdStatusMsg.textContent = "❌ Confirmed old master password validation fails.";
      pwdStatusMsg.style.color = "var(--danger)";
      return;
    }

    pwdStatusMsg.textContent = "🎉 Encryption key swapped! Reloading engine state...";
    pwdStatusMsg.style.color = "green";

    setTimeout(() => {
      window.location.reload();
    }, 1500);
  });

  lockBtn.addEventListener("click", async () => {
    try {
      if (memoryAutosaveTimeout) {
        clearTimeout(memoryAutosaveTimeout);
        memoryAutosaveTimeout = null;
        await saveCurrentContent();
      }
    } finally {
      window.location.reload();
    }
  });

  // --- LOCK-SCREEN VIEW TOGGLE ---
  lockViewToggleBtn.addEventListener("click", () => {
    const bufferCurrentlyShown = !bufferPanel.classList.contains("visual-hidden");
    bufferPanel.classList.toggle("visual-hidden", bufferCurrentlyShown);
    authFormPanel.classList.toggle("visual-hidden", !bufferCurrentlyShown);
    lockViewToggleBtn.textContent = bufferCurrentlyShown ? "📝 Switch to Buffer" : "🔑 Switch to Unlock";
    if (!bufferCurrentlyShown) {
      bufferInput.focus();
      bufferInput.setSelectionRange(bufferInput.value.length, bufferInput.value.length);
    }
  });

  // --- BUFFER UI LOGIC ---
  // The textarea shows only the inner text; [QUICK] tags are applied on save.
  const storedBuffer = await bufferService.getBuffer();
  const initialInner = withFreshTimestamp(unwrapQuick(storedBuffer));
  bufferInput.value = initialInner;
  await bufferService.saveBuffer(wrapQuick(initialInner));

  let bufferAutosaveTimeout: ReturnType<typeof setTimeout> | null = null;
  bufferInput.addEventListener("input", () => {
    if (bufferAutosaveTimeout) clearTimeout(bufferAutosaveTimeout);
    bufferAutosaveTimeout = setTimeout(() => void saveCurrentBuffer(), 500);
  });

  async function saveCurrentBuffer(): Promise<void> {
    try {
      await bufferService.saveBuffer(wrapQuick(bufferInput.value));
    } catch (err) {
      console.error(err);
      bufferSaveStatus.textContent = "⚠ Save failed";
      return;
    }
    flashSavedIndicator(bufferSaveStatus);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});
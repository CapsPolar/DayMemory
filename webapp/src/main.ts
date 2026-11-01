import { VaultService } from "@core/services/VaultService";
import { BufferService } from "@core/services/BufferService";
import type { MemoryEntry } from "@core/models/Memory";
import { getTodayKey, formatReadableDate, getTimestampString } from "@core/utils/date";

import { IndexedDBAdapter } from "../adapters/IndexedDBAdapter";
import { CryptoJSAdapter } from "../adapters/CryptoJSAdapter";

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
  body.textContent = `DayMemory keeps your vault in IndexedDB, which couldn't be opened (${message}). Your data has not been touched. Private/incognito mode or blocked site data can cause this[cite: 18].`;
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
  const bufferFormLabel = el<HTMLLabelElement>("buffer-form-label");
  const bufferSaveStatus = el<HTMLSpanElement>("buffer-save-status");
  const bufferCalendarPicker = el<HTMLInputElement>("buffer-calendar-picker");
  const bufferTimelineContainer = el<HTMLDivElement>("buffer-timeline-container");

  // 3. View 1 (Home) Elements
  const memoryInput = el<HTMLTextAreaElement>("memory-input");
  const formLabel = el<HTMLLabelElement>("form-label");
  const memorySaveStatus = el<HTMLSpanElement>("memory-save-status");
  const memoriesContainer = el<HTMLDivElement>("memories-container");
  const calendarPicker = el<HTMLInputElement>("calendar-picker");

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
  let currentTargetDateKey = getTodayKey();
  let bufferTargetDateKey = getTodayKey();
  let backupMode: "export" | "import" = "export";

  function insertAutoTimestamp(textareaEl: HTMLTextAreaElement) {
    const stamp = getTimestampString();
    const current = textareaEl.value;
    if (!current.trim()) {
      textareaEl.value = stamp;
    } else {
      textareaEl.value = current.replace(/\s+$/, "") + "\n\n" + stamp;
    }
    textareaEl.focus();
    const endPos = textareaEl.value.length;
    textareaEl.setSelectionRange(endPos, endPos);
  }

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

  async function mergeBufferIntoVault(): Promise<number> {
    const buffer = await bufferService.getAll();
    const count = await vaultService.mergeAppends(buffer);
    if (count > 0) await bufferService.clear();
    return count;
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
      viewTitle.textContent = "Home";
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
    let mergedCount = 0;
    try {
      success = await vaultService.unlock(enteredPassword);
      if (success) mergedCount = await mergeBufferIntoVault();
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

    authModal.classList.add("visual-hidden");
    mainApp.classList.remove("visual-hidden");

    calendarPicker.value = getTodayKey();

    displayMemories(success);
    if (success) updateFormContext(getTodayKey(), true);

    if (mergedCount > 0) {
      setTimeout(() => {
        alert(
          `✅ ${mergedCount} pending buffer ${mergedCount === 1 ? "entry has" : "entries have"} been merged and securely encrypted into your vault. The local buffer is now cleared[cite: 18].`
        );
      }, 150);
    }
  });

  // --- HOME VIEW LOGIC ---
  calendarPicker.addEventListener("change", (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (value) updateFormContext(value, true);
  });

  function updateFormContext(dateKey: string, withTimestamp = false) {
    currentTargetDateKey = dateKey;
    calendarPicker.value = dateKey;
    const existingEntry = vaultService.getEntry(dateKey);
    const isToday = dateKey === getTodayKey();

    if (existingEntry) {
      memoryInput.value = existingEntry.text;
      formLabel.textContent = isToday
        ? `Editing Today (${formatReadableDate(dateKey)}):`
        : `Editing Entry for ${formatReadableDate(dateKey)}:`;
    } else {
      memoryInput.value = "";
      formLabel.textContent = `Write about Today (${formatReadableDate(dateKey)}):`;
    }

    if (withTimestamp) {
      insertAutoTimestamp(memoryInput);
      void saveCurrentMemoryEntry();
    }
  }

  let memoryAutosaveTimeout: ReturnType<typeof setTimeout> | null = null;
  memoryInput.addEventListener("input", () => {
    if (memoryAutosaveTimeout) clearTimeout(memoryAutosaveTimeout);
    memoryAutosaveTimeout = setTimeout(() => void saveCurrentMemoryEntry(), 500);
  });

  async function saveCurrentMemoryEntry(): Promise<void> {
    const text = memoryInput.value.trim();
    try {
      await vaultService.saveEntry(currentTargetDateKey, text);
    } catch (err) {
      console.error(err);
      memorySaveStatus.textContent = "⚠ Save failed";
      return;
    }
    displayMemories(true);
    flashSavedIndicator(memorySaveStatus);
  }

  function displayMemories(isSuccess: boolean) {
    memoriesContainer.innerHTML = "";
    if (!isSuccess) {
      memoriesContainer.innerHTML = `<div class="panel-box" style="border-left:4px solid var(--danger); font-style:italic;">[Incorrect password or corrupted data framework.]</div>`;
      return;
    }

    const timeline = vaultService.getTimeline();
    if (timeline.length === 0) {
      memoriesContainer.innerHTML = `<p class="status-msg">Your vault is clean. Write down your first memory above!</p>`;
      return;
    }

    timeline.forEach((memory: MemoryEntry) => {
      const card = document.createElement("div");
      card.className = "memory-card";
      card.innerHTML = `
                <div class="memory-card-header">
                    <div>${memory.readableDate}</div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="text-link-btn edit-entry-trigger">Edit</button>
                        <button class="text-link-btn delete-entry-trigger" style="color: var(--danger);">Delete</button>
                    </div>
                </div>
                <div class="memory-text">${memory.text || '<span style="color:var(--text-muted); font-style:italic;">[Empty entry block - click edit to write]</span>'}</div>
            `;

      card.querySelector(".edit-entry-trigger")?.addEventListener("click", () => {
        updateFormContext(memory.id, true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      card.querySelector(".delete-entry-trigger")?.addEventListener("click", async () => {
        if (
          confirm(
            `⚠️ DANGER: Are you sure you want to permanently delete the memory from ${memory.readableDate}? This action cannot be reversed.`
          )
        ) {
          try {
            await vaultService.deleteEntry(memory.id);
          } catch (err) {
            console.error(err);
            alert("Couldn't save the deletion to storage. Please try again.");
          }
          displayMemories(true);
          updateFormContext(getTodayKey());
        }
      });

      memoriesContainer.appendChild(card);
    });
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
    backupTextarea.placeholder = "Paste raw encrypted string structure blocks here for timeline state restoration...";
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
        await saveCurrentMemoryEntry();
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
  });

  // --- BUFFER UI LOGIC ---
  async function updateBufferFormContext(dateKey: string, withTimestamp = false): Promise<void> {
    bufferTargetDateKey = dateKey;
    bufferCalendarPicker.value = dateKey;
    const existingText = await bufferService.getEntry(dateKey);
    if (bufferTargetDateKey !== dateKey) return;
    const isToday = dateKey === getTodayKey();

    bufferInput.value = existingText;
    if (existingText) {
      bufferFormLabel.textContent = `Editing Pending Buffer for ${formatReadableDate(dateKey)}:`;
    } else {
      bufferFormLabel.textContent = isToday
        ? `Quick Add for Today (${formatReadableDate(dateKey)}):`
        : `Quick Add for ${formatReadableDate(dateKey)}:`;
    }

    if (withTimestamp) {
      insertAutoTimestamp(bufferInput);
      await saveCurrentBufferEntry();
    }
  }

  bufferCalendarPicker.addEventListener("change", (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (value) void updateBufferFormContext(value, true);
  });

  let bufferAutosaveTimeout: ReturnType<typeof setTimeout> | null = null;
  bufferInput.addEventListener("input", () => {
    if (bufferAutosaveTimeout) clearTimeout(bufferAutosaveTimeout);
    bufferAutosaveTimeout = setTimeout(() => void saveCurrentBufferEntry(), 500);
  });

  async function saveCurrentBufferEntry(): Promise<void> {
    const text = bufferInput.value.trim();
    try {
      await bufferService.saveEntry(bufferTargetDateKey, text);
    } catch (err) {
      console.error(err);
      bufferSaveStatus.textContent = "⚠ Save failed";
      return;
    }

    await renderBufferTimeline();
    flashSavedIndicator(bufferSaveStatus);
  }

  async function renderBufferTimeline(): Promise<void> {
    const buffer = await bufferService.getAll();
    const dateKeys = Object.keys(buffer)
      .filter((k) => buffer[k] && buffer[k].trim())
      .sort((a, b) => b.localeCompare(a));

    bufferTimelineContainer.innerHTML = "";

    if (dateKeys.length === 0) {
      bufferTimelineContainer.innerHTML = `<p class="status-msg">No pending buffer entries. Anything you write here stays local and unencrypted until you unlock the vault[cite: 18].</p>`;
      return;
    }

    dateKeys.forEach((dateKey) => {
      const card = document.createElement("div");
      card.className = "memory-card";
      card.innerHTML = `
                <div class="memory-card-header">
                    <div>${formatReadableDate(dateKey)} <span style="font-size:0.75rem; color: var(--text-muted);">(pending, unencrypted)</span></div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="text-link-btn buffer-edit-trigger">Edit</button>
                        <button class="text-link-btn buffer-delete-trigger" style="color: var(--danger);">Delete</button>
                    </div>
                </div>
                <div class="memory-text">${buffer[dateKey]}</div>
            `;

      card.querySelector(".buffer-edit-trigger")?.addEventListener("click", () => {
        void updateBufferFormContext(dateKey, true);
        bufferPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      card.querySelector(".buffer-delete-trigger")?.addEventListener("click", async () => {
        if (
          confirm(
            `⚠️ Discard the pending un-merged buffer entry for ${formatReadableDate(dateKey)}? This cannot be undone.`
          )
        ) {
          try {
            await bufferService.deleteEntry(dateKey);
          } catch (err) {
            console.error(err);
            alert("Couldn't delete the buffer entry from storage.");
            return;
          }
          await renderBufferTimeline();
          if (bufferTargetDateKey === dateKey) {
            await updateBufferFormContext(getTodayKey());
          }
        }
      });

      bufferTimelineContainer.appendChild(card);
    });
  }

  bufferCalendarPicker.value = getTodayKey();
  await updateBufferFormContext(getTodayKey(), true);
  await renderBufferTimeline();
}

document.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});
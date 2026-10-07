import { VaultService } from "@core/services/VaultService";
import { BufferService } from "@core/services/BufferService";
import { AiService } from "@core/services/AiService";
import type { AgentProfile } from "@core/models/Agent";
import type { MemoryEntry } from "@core/models/Memory";
import { getTodayKey, formatReadableDate, getTimestampString } from "@core/utils/date";

import { IndexedDBAdapter } from "../adapters/IndexedDBAdapter";
import { CryptoJSAdapter } from "../adapters/CryptoJSAdapter";
import { OllamaAdapter } from "../adapters/OllamaAdapter";

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

  // ---- Wire adapters into core services (this is the whole "bootstrap") ----
  const encryption = new CryptoJSAdapter();
  const aiEngine = new OllamaAdapter();

  const vaultService = new VaultService(storage, encryption);
  const bufferService = new BufferService(storage);
  const aiService = new AiService(storage, aiEngine);

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

  // 4. View 2 (Agents Hub) Elements
  const agentsListContainer = el<HTMLDivElement>("agents-list-container");
  const addAgentFab = el<HTMLButtonElement>("add-agent-fab");
  const createAgentModal = el<HTMLDivElement>("create-agent-modal");
  const createAgentForm = el<HTMLFormElement>("create-agent-form");
  const newAgentName = el<HTMLInputElement>("new-agent-name");
  const newAgentPrompt = el<HTMLTextAreaElement>("new-agent-prompt");
  const closeCreateModalBtn = el<HTMLButtonElement>("close-create-modal-btn");

  // 5. View 3 (Agent Deep Dive Drilldown View) Elements
  const agentDetailBackBtn = el<HTMLButtonElement>("agent-detail-back-btn");
  const agentConfigureToggleBtn = el<HTMLButtonElement>("agent-configure-toggle-btn");
  const agentConfigPanel = el<HTMLDivElement>("agent-config-panel");
  const editAgentName = el<HTMLInputElement>("edit-agent-name");
  const editAgentPrompt = el<HTMLTextAreaElement>("edit-agent-prompt");
  const saveAgentConfigBtn = el<HTMLButtonElement>("save-agent-config-btn");
  const deleteAgentBtn = el<HTMLButtonElement>("delete-agent-btn");
  const activeAgentHeading = el<HTMLHeadingElement>("active-agent-heading");
  const activeAgentPromptPreview = el<HTMLParagraphElement>("active-agent-prompt-preview");
  const batchRunBtn = el<HTMLButtonElement>("batch-run-btn");
  const clearInsightsBtn = el<HTMLButtonElement>("clear-insights-btn");
  const batchProgressMsg = el<HTMLDivElement>("batch-progress-msg");
  const agentInsightsTimeline = el<HTMLDivElement>("agent-insights-timeline");

  // CSV Target Elements
  const csvHeadersInput = el<HTMLInputElement>("csv-headers-input");
  const generateCsvBtn = el<HTMLButtonElement>("generate-csv-btn");
  const csvOutputZone = el<HTMLDivElement>("csv-output-zone");
  const csvTextarea = el<HTMLTextAreaElement>("csv-textarea");
  const copyCsvBtn = el<HTMLButtonElement>("copy-csv-btn");
  const csvCopyStatus = el<HTMLSpanElement>("csv-copy-status");

  // 6. View 4 (Settings Architecture Elements)
  const aiEndpointInput = el<HTMLInputElement>("ai-endpoint");
  const aiModelInput = el<HTMLInputElement>("ai-model");
  const saveSettingsBtn = el<HTMLButtonElement>("save-settings-btn");
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

  // A vault only exists once a password has been set on it - reuse that same
  // signal (rather than a separate flag) to greet brand-new users on the lock
  // screen. The hint stays hidden unless this check says there is no vault.
  void vaultService
    .hasVault()
    .then((hasVault) => authFirstTimeHint.classList.toggle("visual-hidden", hasVault))
    .catch((err) => console.error(err));

  // Volatile UI State
  let activeAgentProfile: AgentProfile | null = null;
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

  // Merges the pending buffer into the vault (via the core services) and
  // clears the buffer on success. Returns how many dates were merged.
  // The buffer is cleared only after the vault write has been committed.
  async function mergeBufferIntoVault(): Promise<number> {
    const buffer = await bufferService.getAll();
    const count = await vaultService.mergeAppends(buffer);
    if (count > 0) await bufferService.clear();
    return count;
  }

  // --- Tab-Switching & View Management System (Mobile Routing Engine) ---
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
    } else if (viewId === "view-agents") {
      viewTitle.textContent = "AI Agents";
      renderAgentsHub();
    } else if (viewId === "view-agent-detail") {
      viewTitle.textContent = activeAgentProfile ? activeAgentProfile.name : "Agent Tracker";
    } else if (viewId === "view-settings") {
      viewTitle.textContent = "Settings";
      void aiService.getConfig().then((config) => {
        aiEndpointInput.value = config.endpoint;
        aiModelInput.value = config.model;
      });
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
          `✅ ${mergedCount} pending buffer ${mergedCount === 1 ? "entry has" : "entries have"} been merged and securely encrypted into your vault. The local buffer is now cleared.`
        );
      }, 150);
    }
  });

  // --- HOME VIEW LOGIC (Timeline Updates with Calendar Extensions) ---
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

  // --- AUTOSAVE: writes to the vault shortly after the user stops typing ---
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

  // --- AGENTS LANDING PAGE VIEW MANAGEMENT ---
  function renderAgentsHub() {
    agentsListContainer.innerHTML = "";
    if (!vaultService.isUnlocked) {
      agentsListContainer.innerHTML =
        "<p class='status-msg'>The vault is locked, so agents (which are stored inside it) can't be shown. Reload and unlock with the correct password.</p>";
      return;
    }
    const agents = vaultService.listAgents();
    if (agents.length === 0) {
      agentsListContainer.innerHTML =
        "<p class='status-msg'>No operational analytical profiles. Hit the + FAB button to instantiate one!</p>";
      return;
    }

    agents.forEach((profile) => {
      const card = document.createElement("div");
      card.className = "agent-row-card";
      card.innerHTML = `
                <div>
                    <div class="agent-row-title">${profile.name}</div>
                    <p style="font-size:0.8rem; color:var(--text-muted); max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${profile.prompt}</p>
                </div>
                <button class="secondary-btn open-agent-btn" style="width:auto; padding:0.4rem 0.8rem; font-size:0.85rem;">Open →</button>
            `;
      card.querySelector(".open-agent-btn")?.addEventListener("click", () => {
        openAgentSubProfileView(profile);
      });
      agentsListContainer.appendChild(card);
    });
  }

  addAgentFab.addEventListener("click", () => createAgentModal.classList.remove("visual-hidden"));
  closeCreateModalBtn.addEventListener("click", () => createAgentModal.classList.add("visual-hidden"));

  createAgentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = newAgentName.value.trim().replace(/[^a-zA-Z0-9]/g, "");
    const prompt = newAgentPrompt.value.trim();

    try {
      await vaultService.createAgent(name, prompt);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not create agent.");
      return;
    }

    newAgentName.value = "";
    newAgentPrompt.value = "";
    createAgentModal.classList.add("visual-hidden");
    renderAgentsHub();
  });

  // --- NESTED AGENT SUB-PAGE TRACKER VIEW ---
  function openAgentSubProfileView(profile: AgentProfile) {
    activeAgentProfile = profile;
    agentConfigPanel.classList.add("visual-hidden");
    csvOutputZone.classList.add("visual-hidden");
    switchActiveViewPanel("view-agent-detail");

    activeAgentHeading.textContent = profile.name;
    activeAgentPromptPreview.textContent = `Prompt: "${profile.prompt}"`;

    editAgentName.value = profile.name;
    editAgentPrompt.value = profile.prompt;

    renderAgentInsightsTimelineList();
  }

  agentDetailBackBtn.addEventListener("click", () => {
    activeAgentProfile = null;
    switchActiveViewPanel("view-agents");
  });

  agentConfigureToggleBtn.addEventListener("click", () => {
    agentConfigPanel.classList.toggle("visual-hidden");
  });

  saveAgentConfigBtn.addEventListener("click", async () => {
    if (!activeAgentProfile) return;
    const newName = editAgentName.value.trim().replace(/[^a-zA-Z0-9]/g, "");
    const newPrompt = editAgentPrompt.value.trim();
    if (!newName || !newPrompt) return;

    const oldName = activeAgentProfile.name;

    // Renames the agent and moves its insights to the new name in a single
    // vault write, so the two can't get out of sync.
    let updated: AgentProfile;
    try {
      updated = await vaultService.updateAgent(oldName, newName, newPrompt);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update agent.");
      return;
    }

    activeAgentProfile = updated;
    openAgentSubProfileView(activeAgentProfile);
    alert("Agent configuration modified successfully.");
  });

  deleteAgentBtn.addEventListener("click", async () => {
    if (
      !activeAgentProfile ||
      !confirm(
        `Delete all profile criteria definitions for agent: ${activeAgentProfile.name}? Historic generations data properties will remain conserved.`
      )
    )
      return;

    try {
      await vaultService.deleteAgent(activeAgentProfile.name);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete agent.");
      return;
    }
    activeAgentProfile = null;
    switchActiveViewPanel("view-agents");
  });

  function renderAgentInsightsTimelineList() {
    agentInsightsTimeline.innerHTML = "";
    if (!activeAgentProfile) return;

    const timeline = vaultService.getTimeline();
    if (timeline.length === 0) {
      agentInsightsTimeline.innerHTML = "<p class='status-msg'>Timeline history blank.</p>";
      return;
    }

    const agent = activeAgentProfile;

    timeline.forEach((entry: MemoryEntry) => {
      const row = document.createElement("div");
      row.className = "panel-box";

      const insightText = entry.aiInsights?.[agent.name] || "";

      row.innerHTML = `
                <div class="memory-card-header">
                    <div>${entry.readableDate}</div>
                    <button class="text-link-btn single-day-run-trigger">${insightText ? "🔄 Re-Analyze" : "✨ Analyze Day"}</button>
                </div>
                <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem; background:rgba(0,0,0,0.02); padding:0.4rem; border-radius:4px;">Log: "${entry.text || "(No entry text added)"}"</div>
                <textarea class="agent-insight-edit-box" placeholder="No insight output logged. Click 'Analyze' to query model...">${insightText}</textarea>
            `;

      const tx = row.querySelector<HTMLTextAreaElement>(".agent-insight-edit-box")!;
      tx.addEventListener("input", () => {
        vaultService
          .setInsight(entry.id, agent.name, tx.value.trim() || null)
          .catch((err) => console.error("Failed to save insight edit:", err));
      });

      row.querySelector(".single-day-run-trigger")?.addEventListener("click", async (e) => {
        const btn = e.target as HTMLButtonElement;
        btn.disabled = true;
        btn.textContent = "Querying Local LLM...";
        const res = await aiService.analyze(agent, entry.text || "");
        if (res) {
          try {
            await vaultService.setInsight(entry.id, agent.name, res);
          } catch (err) {
            console.error(err);
            btn.disabled = false;
            btn.textContent = "Storage failed - Retry";
            return;
          }
          renderAgentInsightsTimelineList();
        } else {
          btn.disabled = false;
          btn.textContent = "Run Failed - Retry";
        }
      });

      agentInsightsTimeline.appendChild(row);
    });
  }

  batchRunBtn.addEventListener("click", async () => {
    const timeline = vaultService.getTimeline();
    if (timeline.length === 0 || !activeAgentProfile) return;
    if (!confirm(`Initialize asynchronous batch sequencing through all ${timeline.length} history slots?`)) return;

    const agent = activeAgentProfile;
    batchRunBtn.disabled = true;

    try {
      for (let i = 0; i < timeline.length; i++) {
        const entry = timeline[i];
        batchProgressMsg.textContent = `⏳ Processing: ${i + 1}/${timeline.length} (${entry.id})...`;

        const out = await aiService.analyze(agent, entry.text || "");
        if (out) {
          await vaultService.setInsight(entry.id, agent.name, out);
        }
      }
      batchProgressMsg.textContent = "✅ Batch computation completed.";
    } catch (err) {
      console.error(err);
      batchProgressMsg.textContent = "⚠ Batch stopped: couldn't write to storage.";
    }
    batchRunBtn.disabled = false;
    renderAgentInsightsTimelineList();
    setTimeout(() => {
      batchProgressMsg.textContent = "";
    }, 5000);
  });

  clearInsightsBtn.addEventListener("click", async () => {
    const timeline = vaultService.getTimeline();
    if (!activeAgentProfile || timeline.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to permanently clear all generated insight metrics for the agent: "${activeAgentProfile.name}" across all historical days?`
      )
    )
      return;

    try {
      await vaultService.clearAgentInsights(activeAgentProfile.name);
    } catch (err) {
      console.error(err);
      alert("Couldn't save the cleared insights to storage. Please try again.");
    }
    renderAgentInsightsTimelineList();

    csvOutputZone.classList.add("visual-hidden");

    batchProgressMsg.textContent = "🗑️ All insights for this agent cleared.";
    setTimeout(() => {
      batchProgressMsg.textContent = "";
    }, 4000);
  });

  // --- CSV EXPORT ---
  generateCsvBtn.addEventListener("click", () => {
    const timeline = vaultService.getTimeline();
    if (!activeAgentProfile || timeline.length === 0) return;

    const baseHeaders = csvHeadersInput.value.trim();
    if (!baseHeaders) {
      alert("Please provide valid column headers.");
      return;
    }

    csvTextarea.value = aiService.generateCsv(baseHeaders, timeline, activeAgentProfile.name);
    csvOutputZone.classList.remove("visual-hidden");
    csvCopyStatus.textContent = "";
    csvTextarea.select();
  });

  copyCsvBtn.addEventListener("click", () => {
    if (!csvTextarea.value) return;
    navigator.clipboard.writeText(csvTextarea.value).then(() => {
      csvCopyStatus.textContent = "CSV matrix copied to clipboard!";
      setTimeout(() => {
        csvCopyStatus.textContent = "";
      }, 3000);
    });
  });

  // --- VIEW 4 SETTINGS & CONTEXTUAL BACKUP INTERFACES ---
  saveSettingsBtn.addEventListener("click", async () => {
    try {
      await aiService.saveConfig({
        endpoint: aiEndpointInput.value.trim().replace(/\/$/, ""),
        model: aiModelInput.value.trim(),
      });
    } catch (err) {
      console.error(err);
      alert("Couldn't save settings to storage.");
      return;
    }
    alert("Global core engine settings mapped.");
  });

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
    // Flush an autosave that's still waiting on its debounce timer, so
    // locking right after typing doesn't drop the last half-second of text.
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

  // --- LOCK-SCREEN VIEW TOGGLE (Buffer UI <-> Unlock Form) ---
  lockViewToggleBtn.addEventListener("click", () => {
    const bufferCurrentlyShown = !bufferPanel.classList.contains("visual-hidden");
    bufferPanel.classList.toggle("visual-hidden", bufferCurrentlyShown);
    authFormPanel.classList.toggle("visual-hidden", !bufferCurrentlyShown);
    lockViewToggleBtn.textContent = bufferCurrentlyShown ? "📝 Switch to Buffer" : "🔑 Switch to Unlock";
  });

  // --- BUFFER (APPEND-WITHOUT-PASSWORD) UI LOGIC ---
  async function updateBufferFormContext(dateKey: string, withTimestamp = false): Promise<void> {
    bufferTargetDateKey = dateKey;
    bufferCalendarPicker.value = dateKey;
    const existingText = await bufferService.getEntry(dateKey);
    // The user picked a different date while we were reading storage.
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

  // --- AUTOSAVE: writes to the local buffer shortly after the user stops typing ---
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
      bufferTimelineContainer.innerHTML = `<p class="status-msg">No pending buffer entries. Anything you write here stays local and unencrypted until you unlock the vault.</p>`;
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

  // Initialize the lock-screen Buffer UI immediately on app open, with today's auto-timestamp
  bufferCalendarPicker.value = getTodayKey();
  await updateBufferFormContext(getTodayKey(), true);
  await renderBufferTimeline();
}

document.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});

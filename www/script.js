document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation Shell Elements
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const viewPanels = document.querySelectorAll('.nav-view-panel');
    const viewTitle = document.getElementById('view-title');

    // 2. Core Operational Logic Nodes
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const passwordInput = document.getElementById('password-input');
    const mainApp = document.getElementById('main-app');
    const lockBtn = document.getElementById('lock-btn');

    // 3. View 1 (Home) Elements
    const memoryForm = document.getElementById('memory-form');
    const memoryInput = document.getElementById('memory-input');
    const formLabel = document.getElementById('form-label');
    const saveBtn = document.getElementById('save-btn');
    const memoriesContainer = document.getElementById('memories-container');
    const calendarPicker = document.getElementById('calendar-picker');
    const quickAddEmptyBtn = document.getElementById('quick-add-empty-btn');

    // 4. View 2 (Agents Hub) Elements
    const agentsListContainer = document.getElementById('agents-list-container');
    const addAgentFab = document.getElementById('add-agent-fab');
    const createAgentModal = document.getElementById('create-agent-modal');
    const createAgentForm = document.getElementById('create-agent-form');
    const newAgentName = document.getElementById('new-agent-name');
    const newAgentPrompt = document.getElementById('new-agent-prompt');
    const closeCreateModalBtn = document.getElementById('close-create-modal-btn');

    // 5. View 3 (Agent Deep Dive Drilldown View) Elements
    const viewAgentDetail = document.getElementById('view-agent-detail');
    const agentDetailBackBtn = document.getElementById('agent-detail-back-btn');
    const agentConfigureToggleBtn = document.getElementById('agent-configure-toggle-btn');
    const agentConfigPanel = document.getElementById('agent-config-panel');
    const editAgentName = document.getElementById('edit-agent-name');
    const editAgentPrompt = document.getElementById('edit-agent-prompt');
    const saveAgentConfigBtn = document.getElementById('save-agent-config-btn');
    const deleteAgentBtn = document.getElementById('delete-agent-btn');
    const activeAgentHeading = document.getElementById('active-agent-heading');
    const activeAgentPromptPreview = document.getElementById('active-agent-prompt-preview');
    const batchRunBtn = document.getElementById('batch-run-btn');
    const clearInsightsBtn = document.getElementById('clear-insights-btn');
    const batchProgressMsg = document.getElementById('batch-progress-msg');
    const agentInsightsTimeline = document.getElementById('agent-insights-timeline');

    // CSV Target Elements
    const csvHeadersInput = document.getElementById('csv-headers-input');
    const generateCsvBtn = document.getElementById('generate-csv-btn');
    const csvOutputZone = document.getElementById('csv-output-zone');
    const csvTextarea = document.getElementById('csv-textarea');
    const copyCsvBtn = document.getElementById('copy-csv-btn');
    const csvCopyStatus = document.getElementById('csv-copy-status');

    // 6. View 4 (Settings Architecture Elements)
    const aiEndpointInput = document.getElementById('ai-endpoint');
    const aiModelInput = document.getElementById('ai-model');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const backupIoZone = document.getElementById('backup-io-zone');
    const backupTextarea = document.getElementById('backup-textarea');
    const backupActionSubmitBtn = document.getElementById('backup-action-submit-btn');
    const backupStatusMsg = document.getElementById('backup-status-msg');

    // Volatile State Enclosures
    let sessionKey = "";
    let decryptedTimeline = [];
    let activeAgentProfile = null; 
    let currentTargetDateKey = getTodayKey();
    let backupMode = "export"; // Tracking interface state: 'export' | 'import'

    // Configuration Core Sets
    let globalAiConfig = JSON.parse(localStorage.getItem('dayMemoryGlobalAiConfig')) || {
        endpoint: "http://127.0.0.1:11434", model: "llama3"
    };
    let aiProfiles = JSON.parse(localStorage.getItem('dayMemoryAiProfiles')) || [];

    function getTodayKey() {
        const d = new Date();
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    }

    function formatReadableDate(dateString) {
        const [year, month, day] = dateString.split('-');
        const dateObj = new Date(year, month - 1, day);
        return dateObj.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        });
    }

    // --- Tab-Switching & View Management System (Mobile Routing Engine) ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetViewId = item.getAttribute('data-target');
            switchActiveViewPanel(targetViewId);
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    function switchActiveViewPanel(viewId) {
        viewPanels.forEach(panel => panel.classList.remove('active'));
        const activePanel = document.getElementById(viewId);
        activePanel.classList.add('active');

        if (viewId === 'view-home') viewTitle.textContent = "Home";
        else if (viewId === 'view-agents') {
            viewTitle.textContent = "AI Agents";
            renderAgentsHub();
        } else if (viewId === 'view-agent-detail') {
            viewTitle.textContent = activeAgentProfile ? activeAgentProfile.name : "Agent Tracker";
        } else if (viewId === 'view-settings') {
            viewTitle.textContent = "Settings";
            aiEndpointInput.value = globalAiConfig.endpoint;
            aiModelInput.value = globalAiConfig.model;
        }
    }

    // --- Auth Encryption Systems ---
    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredPassword = passwordInput.value.trim();
        if (!enteredPassword) return;

        sessionKey = enteredPassword;
        const success = decryptAndLoadVault();

        authModal.classList.add('visual-hidden');
        mainApp.classList.remove('visual-hidden');
        
        // Populate standard system input baseline properties
        calendarPicker.value = getTodayKey();

        displayMemories(success);
        if (success) updateFormContext(getTodayKey());
    });

    function decryptAndLoadVault() {
        const encryptedVault = localStorage.getItem('dayMemoryVault');
        if (!encryptedVault) {
            decryptedTimeline = [];
            return true;
        }
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedVault, sessionKey);
            const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            if (!decryptedString) return false;
            decryptedTimeline = JSON.parse(decryptedString);
            return true;
        } catch (error) {
            return false;
        }
    }

    function encryptAndSaveVault() {
        const stringifiedVault = JSON.stringify(decryptedTimeline);
        const ciphertext = CryptoJS.AES.encrypt(stringifiedVault, sessionKey).toString();
        localStorage.setItem('dayMemoryVault', ciphertext);
    }

    // --- HOME VIEW LOGIC (Timeline Updates with Calendar Extensions) ---
    calendarPicker.addEventListener('change', (e) => {
        if (e.target.value) {
            updateFormContext(e.target.value);
        }
    });

    // FEATURE: Instantiates an empty memory slot immediately for any chosen date
    quickAddEmptyBtn.addEventListener('click', () => {
        const selectedDate = calendarPicker.value;
        if (!selectedDate) {
            alert("Please pick a valid date on the calendar input before adding.");
            return;
        }

        const existingEntry = decryptedTimeline.find(item => item.id === selectedDate);
        if (existingEntry) {
            alert(`A log matrix slot already exists for ${formatReadableDate(selectedDate)}. Loading it directly instead.`);
            updateFormContext(selectedDate);
            return;
        }

        // Push empty frame architecture
        decryptedTimeline.push({
            id: selectedDate,
            text: "",
            readableDate: formatReadableDate(selectedDate),
            aiInsights: {}
        });
        decryptedTimeline.sort((a, b) => b.id.localeCompare(a.id));

        encryptAndSaveVault();
        displayMemories(true);
        updateFormContext(selectedDate);
    });

    function updateFormContext(dateKey) {
        currentTargetDateKey = dateKey;
        calendarPicker.value = dateKey; // Force alignment
        const existingEntry = decryptedTimeline.find(item => item.id === dateKey);
        const isToday = (dateKey === getTodayKey());

        if (existingEntry) {
            memoryInput.value = existingEntry.text;
            formLabel.textContent = isToday ? `Editing Today (${formatReadableDate(dateKey)}):` : `Editing Entry for ${formatReadableDate(dateKey)}:`;
            saveBtn.textContent = "Update Entry";
        } else {
            memoryInput.value = "";
            formLabel.textContent = `Write about Today (${formatReadableDate(dateKey)}):`;
            saveBtn.textContent = "Save Reflection";
        }
    }

    memoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = memoryInput.value.trim();
        
        // FEATURE: Confirmation protection gateway before description changes save
        if (!confirm(`Are you sure you want to save modifications to the description text for ${formatReadableDate(currentTargetDateKey)}?`)) {
            return;
        }

        const existingIndex = decryptedTimeline.findIndex(item => item.id === currentTargetDateKey);
        if (existingIndex !== -1) {
            decryptedTimeline[existingIndex].text = text;
        } else {
            decryptedTimeline.push({
                id: currentTargetDateKey,
                text: text,
                readableDate: formatReadableDate(currentTargetDateKey),
                aiInsights: {}
            });
            decryptedTimeline.sort((a, b) => b.id.localeCompare(a.id));
        }

        encryptAndSaveVault();
        displayMemories(true);
        updateFormContext(currentTargetDateKey);
    });

    function displayMemories(isSuccess) {
        memoriesContainer.innerHTML = '';
        if (!isSuccess) {
            memoriesContainer.innerHTML = `<div class="panel-box" style="border-left:4px solid var(--danger); font-style:italic;">[Incorrect password or corrupted data framework.]</div>`;
            return;
        }
        if (decryptedTimeline.length === 0) {
            memoriesContainer.innerHTML = `<p class="status-msg">Your vault is clean. Write down your first memory above!</p>`;
            return;
        }

        decryptedTimeline.forEach(memory => {
            const card = document.createElement('div');
            card.className = 'memory-card';
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
            
            // Edit trigger click listener
            card.querySelector('.edit-entry-trigger').addEventListener('click', () => {
                updateFormContext(memory.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            // FEATURE: Deletion pipeline framework attached with warning verification logic
            card.querySelector('.delete-entry-trigger').addEventListener('click', () => {
                if (confirm(`⚠️ DANGER: Are you sure you want to permanently delete the memory from ${memory.readableDate}? This action cannot be reversed.`)) {
                    decryptedTimeline = decryptedTimeline.filter(item => item.id !== memory.id);
                    encryptAndSaveVault();
                    displayMemories(true);
                    
                    // Reset input view fields safely back to matching current settings context
                    updateFormContext(getTodayKey());
                }
            });

            memoriesContainer.appendChild(card);
        });
    }

    // --- AGENTS LANDING PAGE VIEW MANAGEMENT ---
    function renderAgentsHub() {
        agentsListContainer.innerHTML = "";
        if (aiProfiles.length === 0) {
            agentsListContainer.innerHTML = "<p class='status-msg'>No operational analytical profiles. Hit the + FAB button to instantiate one!</p>";
            return;
        }

        aiProfiles.forEach(profile => {
            const card = document.createElement('div');
            card.className = 'agent-row-card';
            card.innerHTML = `
                <div>
                    <div class="agent-row-title">${profile.name}</div>
                    <p style="font-size:0.8rem; color:var(--text-muted); max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${profile.prompt}</p>
                </div>
                <button class="secondary-btn open-agent-btn" style="width:auto; padding:0.4rem 0.8rem; font-size:0.85rem;">Open →</button>
            `;
            card.querySelector('.open-agent-btn').addEventListener('click', () => {
                openAgentSubProfileView(profile);
            });
            agentsListContainer.appendChild(card);
        });
    }

    addAgentFab.addEventListener('click', () => createAgentModal.classList.remove('visual-hidden'));
    closeCreateModalBtn.addEventListener('click', () => createAgentModal.classList.add('visual-hidden'));

    createAgentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = newAgentName.value.trim().replace(/[^a-zA-Z0-9]/g, "");
        const prompt = newAgentPrompt.value.trim();

        if (aiProfiles.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            alert("An identical profile moniker exists.");
            return;
        }

        aiProfiles.push({ name, prompt });
        localStorage.setItem('dayMemoryAiProfiles', JSON.stringify(aiProfiles));
        
        newAgentName.value = "";
        newAgentPrompt.value = "";
        createAgentModal.classList.add('visual-hidden');
        renderAgentsHub();
    });

    // --- NESTED AGENT SUB-PAGE TRACKER VIEW ---
    function openAgentSubProfileView(profile) {
        activeAgentProfile = profile;
        agentConfigPanel.classList.add('visual-hidden'); 
        csvOutputZone.classList.add('visual-hidden'); // Reset CSV output state container
        switchActiveViewPanel('view-agent-detail');

        activeAgentHeading.textContent = profile.name;
        activeAgentPromptPreview.textContent = `Prompt: "${profile.prompt}"`;
        
        editAgentName.value = profile.name;
        editAgentPrompt.value = profile.prompt;

        renderAgentInsightsTimelineList();
    }

    agentDetailBackBtn.addEventListener('click', () => {
        activeAgentProfile = null;
        switchActiveViewPanel('view-agents');
    });

    agentConfigureToggleBtn.addEventListener('click', () => {
        agentConfigPanel.classList.toggle('visual-hidden');
    });

    saveAgentConfigBtn.addEventListener('click', () => {
        if (!activeAgentProfile) return;
        const newName = editAgentName.value.trim().replace(/[^a-zA-Z0-9]/g, "");
        const newPrompt = editAgentPrompt.value.trim();

        if (!newName || !newPrompt) return;

        if (newName !== activeAgentProfile.name) {
            decryptedTimeline.forEach(entry => {
                if (entry.aiInsights && entry.aiInsights[activeAgentProfile.name]) {
                    entry.aiInsights[newName] = entry.aiInsights[activeAgentProfile.name];
                    delete entry.aiInsights[activeAgentProfile.name];
                }
            });
            encryptAndSaveVault();
        }

        const idx = aiProfiles.findIndex(p => p.name === activeAgentProfile.name);
        aiProfiles[idx] = { name: newName, prompt: newPrompt };
        localStorage.setItem('dayMemoryAiProfiles', JSON.stringify(aiProfiles));
        
        activeAgentProfile = aiProfiles[idx];
        openAgentSubProfileView(activeAgentProfile);
        alert("Agent configuration modified successfully.");
    });

    deleteAgentBtn.addEventListener('click', () => {
        if (!activeAgentProfile || !confirm(`Delete all profile criteria definitions for agent: ${activeAgentProfile.name}? Historic generations data properties will remain conserved.`)) return;
        
        aiProfiles = aiProfiles.filter(p => p.name !== activeAgentProfile.name);
        localStorage.setItem('dayMemoryAiProfiles', JSON.stringify(aiProfiles));
        
        activeAgentProfile = null;
        switchActiveViewPanel('view-agents');
    });

    function renderAgentInsightsTimelineList() {
        agentInsightsTimeline.innerHTML = "";
        if (decryptedTimeline.length === 0) {
            agentInsightsTimeline.innerHTML = "<p class='status-msg'>Timeline history blank.</p>";
            return;
        }

        decryptedTimeline.forEach(entry => {
            const row = document.createElement('div');
            row.className = 'panel-box';
            
            if (!entry.aiInsights) entry.aiInsights = {};
            const insightText = entry.aiInsights[activeAgentProfile.name] || "";

            row.innerHTML = `
                <div class="memory-card-header">
                    <div>${entry.readableDate}</div>
                    <button class="text-link-btn single-day-run-trigger">${insightText ? '🔄 Re-Analyze' : '✨ Analyze Day'}</button>
                </div>
                <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem; background:rgba(0,0,0,0.02); padding:0.4rem; border-radius:4px;">Log: "${entry.text || '(No entry text added)'}"</div>
                <textarea class="agent-insight-edit-box" placeholder="No insight output logged. Click 'Analyze' to query model...">${insightText}</textarea>
            `;

            const tx = row.querySelector('.agent-insight-edit-box');
            tx.addEventListener('input', () => {
                entry.aiInsights[activeAgentProfile.name] = tx.value.trim() || null;
                encryptAndSaveVault();
            });

            row.querySelector('.single-day-run-trigger').addEventListener('click', async (e) => {
                e.target.disabled = true;
                e.target.textContent = "Querying Local LLM...";
                const res = await callOllamaPipeline(activeAgentProfile.prompt, entry.text || "");
                if (res) {
                    entry.aiInsights[activeAgentProfile.name] = res;
                    encryptAndSaveVault();
                    renderAgentInsightsTimelineList();
                } else {
                    e.target.disabled = false;
                    e.target.textContent = "Run Failed - Retry";
                }
            });

            agentInsightsTimeline.appendChild(row);
        });
    }

    // --- OLLAMA API CORRECTIONS & DRIVER ---
    async function callOllamaPipeline(systemPrompt, userText) {
        try {
            const response = await fetch(`${globalAiConfig.endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: globalAiConfig.model,
                    prompt: `System Prompt Instructions: ${systemPrompt}\n\nJournal entry context content:\n"${userText}"`,
                    stream: false
                })
            });
            if (!response.ok) throw new Error();
            const data = await response.json();
            return data.response.trim();
        } catch (err) {
            alert(`Network connectivity dropped to Ollama API environment configuration path at: ${globalAiConfig.endpoint}. Double check CORS parameters.`);
            return null;
        }
    }

    batchRunBtn.addEventListener('click', async () => {
        if (decryptedTimeline.length === 0 || !activeAgentProfile) return;
        if (!confirm(`Initialize asynchronous batch sequencing through all ${decryptedTimeline.length} history slots?`)) return;

        batchRunBtn.disabled = true;
        
        for (let i = 0; i < decryptedTimeline.length; i++) {
            const entry = decryptedTimeline[i];
            batchProgressMsg.textContent = `⏳ Processing: ${i + 1}/${decryptedTimeline.length} (${entry.id})...`;
            
            if (!entry.aiInsights) entry.aiInsights = {};

            const out = await callOllamaPipeline(activeAgentProfile.prompt, entry.text || "");
            if (out) {
                entry.aiInsights[activeAgentProfile.name] = out;
                encryptAndSaveVault();
            }
        }

        batchProgressMsg.textContent = "✅ Batch computation completed.";
        batchRunBtn.disabled = false;
        renderAgentInsightsTimelineList();
        setTimeout(() => { batchProgressMsg.textContent = ""; }, 5000);
    });

    // --- FEATURE: CLEAR AGENT INSIGHT HISTORY SYSTEM ---
    clearInsightsBtn.addEventListener('click', () => {
        if (!activeAgentProfile || decryptedTimeline.length === 0) return;
        if (!confirm(`Are you sure you want to permanently clear all generated insight metrics for the agent: "${activeAgentProfile.name}" across all historical days?`)) return;

        decryptedTimeline.forEach(entry => {
            if (entry.aiInsights && entry.aiInsights[activeAgentProfile.name] !== undefined) {
                delete entry.aiInsights[activeAgentProfile.name];
            }
        });

        encryptAndSaveVault();
        renderAgentInsightsTimelineList();
        
        // Hide CSV workspace if open since data no longer matches
        csvOutputZone.classList.add('visual-hidden');
        
        batchProgressMsg.textContent = "🗑️ All insights for this agent cleared.";
        setTimeout(() => { batchProgressMsg.textContent = ""; }, 4000);
    });

    // --- CSV MULTI-ROW ESCAPED DATA GENERATOR ENGINE ---
    function escapeCsvCell(text) {
        if (text === null || text === undefined) return '""';
        let stringValue = String(text);
        if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
            return '"' + stringValue.replace(/"/g, '""') + '"';
        }
        return stringValue;
    }

    // --- UPDATED CSV MULTI-ROW EXTRACTION AND UNROLLING ENGINE ---
    generateCsvBtn.addEventListener('click', () => {
        if (!activeAgentProfile || decryptedTimeline.length === 0) return;

        const baseHeaders = csvHeadersInput.value.trim();
        if (!baseHeaders) {
            alert("Please provide valid column headers.");
            return;
        }

        let csvLines = [];
        csvLines.push(baseHeaders); 

        // Order history chronologically ascending (oldest to newest)
        const orderedTimeline = [...decryptedTimeline].sort((a, b) => a.id.localeCompare(b.id));

        orderedTimeline.forEach(entry => {
            const rawInsight = (entry.aiInsights && entry.aiInsights[activeAgentProfile.name]) ? entry.aiInsights[activeAgentProfile.name] : "";
            if (!rawInsight.trim()) return; // Skip blank days entirely to keep the spreadsheet tidy

            // Step 1: Split the internal day's insight by its line changes
            const subLines = rawInsight.split(/\r?\n/);

            subLines.forEach(line => {
                const cleanedLine = line.trim();
                if (!cleanedLine) return; // Skip empty trailing lines inside an entry

                // FIX: Split strictly by structural commas, safeguarding space structures in phrases
                const rawCells = cleanedLine.split(',');

                // Step 3: Prepare the row array, anchoring the first column with the entry date
                let rowCells = [escapeCsvCell(entry.id)];

                // Step 4: Clean, trim, and parse numbers for all extracted cells
                rawCells.forEach(cell => {
                    let standardCell = cell.trim();
                    
                    // Strip outermost quotes if the text chunk already has them so we can clean it
                    if (standardCell.startsWith('"') && standardCell.endsWith('"')) {
                        standardCell = standardCell.slice(1, -1).trim();
                    }

                    // Attempt numerical conversion (integerize or floatize)
                    if (standardCell !== "" && !isNaN(standardCell)) {
                        // If parsing the number results in the exact same value, output it nakedly
                        rowCells.push(Number(standardCell));
                    } else {
                        // Otherwise, re-package it through our secure CSV escape text formatter
                        rowCells.push(escapeCsvCell(standardCell));
                    }
                });

                // Step 5: Join the extracted data components with standard spacing
                csvLines.push(rowCells.join(', '));
            });
        });

        csvTextarea.value = csvLines.join('\n');
        csvOutputZone.classList.remove('visual-hidden');
        csvCopyStatus.textContent = "";
        csvTextarea.select();
    });

    copyCsvBtn.addEventListener('click', () => {
        if (!csvTextarea.value) return;
        navigator.clipboard.writeText(csvTextarea.value).then(() => {
            csvCopyStatus.textContent = "CSV matrix copied to clipboard!";
            setTimeout(() => { csvCopyStatus.textContent = ""; }, 3000);
        });
    });

    // --- VIEW 4 SETTINGS & CONTEXTUAL BACKUP INTERFACES ---
    saveSettingsBtn.addEventListener('click', () => {
        globalAiConfig.endpoint = aiEndpointInput.value.trim().replace(/\/$/, "");
        globalAiConfig.model = aiModelInput.value.trim();
        localStorage.setItem('dayMemoryGlobalAiConfig', JSON.stringify(globalAiConfig));
        alert("Global core engine settings mapped.");
    });

    exportBtn.addEventListener('click', () => {
        backupMode = "export";
        backupIoZone.classList.remove('visual-hidden');
        backupTextarea.value = localStorage.getItem('dayMemoryVault') || "";
        backupTextarea.readOnly = true;
        backupActionSubmitBtn.textContent = "📋 Copy to Clipboard";
        backupActionSubmitBtn.className = ""; 
        backupStatusMsg.textContent = "";
        backupTextarea.select();
    });

    importBtn.addEventListener('click', () => {
        backupMode = "import";
        backupIoZone.classList.remove('visual-hidden');
        backupTextarea.value = "";
        backupTextarea.readOnly = false;
        backupTextarea.placeholder = "Paste raw encrypted string structure blocks here for timeline state restoration...";
        backupActionSubmitBtn.textContent = "🔥 Restore Backup (Overwrite)";
        backupActionSubmitBtn.className = "danger-btn"; 
        backupStatusMsg.textContent = "";
    });

    backupActionSubmitBtn.addEventListener('click', () => {
        if (backupMode === "export") {
            if (!backupTextarea.value) return;
            navigator.clipboard.writeText(backupTextarea.value).then(() => {
                backupStatusMsg.textContent = "Encrypted vault string copied to clipboard!";
            });
        } else {
            const str = backupTextarea.value.trim();
            if (!str) return;
            if (confirm("This will overwrite all current system entries with your backup text. Proceed?")) {
                localStorage.setItem('dayMemoryVault', str);
                alert("Vault string imported successfully! App environment will now refresh.");
                window.location.reload();
            }
        }
    });

    lockBtn.addEventListener('click', () => window.location.reload());
});
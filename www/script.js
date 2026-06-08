document.addEventListener('DOMContentLoaded', () => {
    // Core Layout Elements
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const passwordInput = document.getElementById('password-input');
    const mainApp = document.getElementById('main-app');
    
    const memoryForm = document.getElementById('memory-form');
    const memoryInput = document.getElementById('memory-input');
    const formLabel = document.getElementById('form-label');
    const saveBtn = document.getElementById('save-btn');
    const memoriesContainer = document.getElementById('memories-container');
    const lockBtn = document.getElementById('lock-btn');

    // New Day-wise Inline AI Workspace nodes
    const dayInsightsWorkspace = document.getElementById('day-insights-workspace');
    const dayInsightsList = document.getElementById('day-insights-list');

    // AI Global & Profile Configuration Elements
    const aiEndpointInput = document.getElementById('ai-endpoint');
    const aiModelInput = document.getElementById('ai-model');
    const saveGlobalAiBtn = document.getElementById('save-global-ai-btn');
    const profileCreationForm = document.getElementById('profile-creation-form');
    const newProfileName = document.getElementById('new-profile-name');
    const newProfilePrompt = document.getElementById('new-profile-prompt');
    const activeProfilesContainer = document.getElementById('active-profiles-container');

    // Portability Elements
    const exportTriggerBtn = document.getElementById('export-trigger-btn');
    const importTriggerBtn = document.getElementById('import-trigger-btn');
    const exportPanel = document.getElementById('export-panel');
    const importPanel = document.getElementById('import-panel');
    const exportOutput = document.getElementById('export-output');
    const copyVaultBtn = document.getElementById('copy-vault-btn');
    const copyStatus = document.getElementById('copy-status');
    const importInput = document.getElementById('import-input');
    const submitImportBtn = document.getElementById('submit-import-btn');
    const importStatus = document.getElementById('import-status');

    // Volatile Core App State
    let sessionKey = ""; 
    let decryptedTimeline = []; 
    let currentTargetDateKey = getTodayKey(); 

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
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // --- Analytics Engine Configuration Management Matrix ---
    let globalAiConfig = JSON.parse(localStorage.getItem('dayMemoryGlobalAiConfig')) || {
        endpoint: "http://127.0.0.1:11434", model: "llama3"
    };
    let aiProfiles = JSON.parse(localStorage.getItem('dayMemoryAiProfiles')) || [];

    function saveGlobalAiCredentials() {
        globalAiConfig.endpoint = aiEndpointInput.value.trim().replace(/\/$/, "");
        globalAiConfig.model = aiModelInput.value.trim();
        localStorage.setItem('dayMemoryGlobalAiConfig', JSON.stringify(globalAiConfig));
        alert("Global Ollama connection parameters updated.");
    }
    saveGlobalAiBtn.addEventListener('click', saveGlobalAiCredentials);

    profileCreationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = newProfileName.value.trim().replace(/[^a-zA-Z0-9]/g, ""); // strip space and punctuation tokens
        const prompt = newProfilePrompt.value.trim();

        if (aiProfiles.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            alert("A profile with this identifier name already exists.");
            return;
        }

        aiProfiles.push({ name, prompt });
        localStorage.setItem('dayMemoryAiProfiles', JSON.stringify(aiProfiles));
        
        newProfileName.value = "";
        newProfilePrompt.value = "";
        renderAiDashboard();
        if (decryptedTimeline.length > 0) updateFormContext(currentTargetDateKey);
    });

    function deleteAiProfile(profileName) {
        if (!confirm(`Are you sure you want to delete the "${profileName}" profile? This stops execution capabilities but keeps historical data unchanged.`)) return;
        aiProfiles = aiProfiles.filter(p => p.name !== profileName);
        localStorage.setItem('dayMemoryAiProfiles', JSON.stringify(aiProfiles));
        renderAiDashboard();
        updateFormContext(currentTargetDateKey);
    }

    // --- Authentication Decryption Interface Blocks ---
    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredPassword = passwordInput.value.trim();
        if (!enteredPassword) return;

        sessionKey = enteredPassword;
        const success = decryptAndLoadVault();

        authModal.classList.add('visual-hidden');
        mainApp.classList.remove('visual-hidden');
        
        // Initialize Config Layout Coordinates
        aiEndpointInput.value = globalAiConfig.endpoint;
        aiModelInput.value = globalAiConfig.model;
        
        displayMemories(success);
        if (success) {
            renderAiDashboard();
            updateFormContext(getTodayKey());
        }
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

    // --- Expanded Day-Wise Editing Workspace Context Logic ---
    function updateFormContext(dateKey) {
        currentTargetDateKey = dateKey;
        const existingEntry = decryptedTimeline.find(item => item.id === dateKey);
        const isToday = (dateKey === getTodayKey());

        // Setup textual base contexts
        if (existingEntry) {
            memoryInput.value = existingEntry.text;
            formLabel.textContent = isToday ? `Editing today's reflection (${formatReadableDate(dateKey)}):` : `Editing historical record for ${formatReadableDate(dateKey)}:`;
            saveBtn.textContent = "Update Memory";
            
            // Build the day-wise explicit inner matrix dashboard summary edit zones
            renderDayInsightsWorkspace(existingEntry);
        } else {
            memoryInput.value = "";
            dayInsightsWorkspace.classList.add('visual-hidden');
            formLabel.textContent = `Write about today (${formatReadableDate(dateKey)}):`;
            saveBtn.textContent = "Save New Memory";
        }
    }

    function renderDayInsightsWorkspace(entry) {
        dayInsightsList.innerHTML = "";
        
        if (aiProfiles.length === 0) {
            dayInsightsWorkspace.classList.add('visual-hidden');
            return;
        }
        
        dayInsightsWorkspace.classList.remove('visual-hidden');
        if (!entry.aiInsights) entry.aiInsights = {};

        aiProfiles.forEach(profile => {
            const row = document.createElement('div');
            row.className = 'day-insight-row-item';

            const meta = document.createElement('div');
            meta.className = 'day-insight-meta';
            
            const label = document.createElement('div');
            label.className = 'day-insight-label';
            label.textContent = `Agent profile: ${profile.name}`;

            const tray = document.createElement('div');
            tray.className = 'agent-control-tray';

            const runBtn = document.createElement('button');
            runBtn.type = "button";
            runBtn.className = "edit-action-btn";
            runBtn.textContent = entry.aiInsights[profile.name] ? "🔄 Re-Analyze" : "✨ Analyze";
            
            runBtn.addEventListener('click', async () => {
                runBtn.disabled = true;
                runBtn.textContent = "Processing...";
                const result = await fetchOllamaGeneration(profile.prompt, entry.text);
                if (result) {
                    entry.aiInsights[profile.name] = result;
                    encryptAndSaveVault();
                    renderDayInsightsWorkspace(entry);
                } else {
                    runBtn.disabled = false;
                    runBtn.textContent = "Retry Failed";
                }
            });

            tray.appendChild(runBtn);
            meta.appendChild(label);
            meta.appendChild(tray);

            const textarea = document.createElement('textarea');
            textarea.className = 'day-insight-body-text';
            textarea.value = entry.aiInsights[profile.name] || "[No analysis ran for this custom profile yet.]";
            textarea.placeholder = "Analysis metadata content...";
            
            // Enable manual inline modification syncing directly back to state variables
            textarea.addEventListener('input', () => {
                entry.aiInsights[profile.name] = textarea.value.trim() || null;
                encryptAndSaveVault(); 
            });

            row.appendChild(meta);
            row.appendChild(textarea);
            dayInsightsList.appendChild(row);
        });
    }

    // Manual Form Submission Core Actions
    memoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = memoryInput.value.trim();
        if (!text) return;

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
        updateFormContext(getTodayKey());
    });

    // --- Core Low-level Ollama API Fetcher Pipeline ---
    async function fetchOllamaGeneration(systemPrompt, journalText) {
        try {
            const response = await fetch(`${globalAiConfig.endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: globalAiConfig.model,
                    prompt: `System Assignment Protocol: ${systemPrompt}\n\nJournal Narrative Data block:\n"${journalText}"`,
                    stream: false
                })
            });
            if (!response.ok) throw new Error();
            const data = await response.json();
            return data.response.trim();
        } catch (e) {
            alert(`Ollama execution broken. Verify CORS connection configurations at endpoint url address: ${globalAiConfig.endpoint}`);
            return null;
        }
    }

    // --- Global Batch Timeline Iteration Processor ("Analyze All Pages") ---
    async function runBatchProfileAnalysis(profile) {
        if (decryptedTimeline.length === 0) {
            alert("Your entry history timeline is completely blank. Nothing to parse.");
            return;
        }

        if (!confirm(`This will trigger sequentially ordered queries through all ${decryptedTimeline.length} entries inside your log using your local machine model capabilities. Proceed?`)) return;

        const statusIndicator = document.getElementById(`batch-status-${profile.name}`);
        
        for (let i = 0; i < decryptedTimeline.length; i++) {
            const entry = decryptedTimeline[i];
            statusIndicator.textContent = `⏳ Scanning entry ${i + 1}/${decryptedTimeline.length} (${entry.id})...`;
            
            if (!entry.aiInsights) entry.aiInsights = {};

            const result = await fetchOllamaGeneration(profile.prompt, entry.text);
            if (result) {
                entry.aiInsights[profile.name] = result;
                encryptAndSaveVault(); // Progress saved incrementally per node block iteration
            } else {
                if (!confirm("Ollama pipeline request dropped mid-batch processing loop. Skip this node step and continue processing remaining history records?")) {
                    statusIndicator.textContent = "❌ Processing tracking aborted.";
                    if (currentTargetDateKey === entry.id) updateFormContext(entry.id);
                    return;
                }
            }
        }

        statusIndicator.textContent = "✅ Batch run completed successfully!";
        setTimeout(() => { statusIndicator.textContent = ""; }, 5000);
        
        // Sync working workspace states
        updateFormContext(currentTargetDateKey);
    }

    // --- Dynamic AI Dashboard Control Renderer ---
    function renderAiDashboard() {
        activeProfilesContainer.innerHTML = "";
        
        if (aiProfiles.length === 0) {
            activeProfilesContainer.innerHTML = "<p class='no-memories'>No operational analysis agents running. Create one above!</p>";
            return;
        }

        aiProfiles.forEach(profile => {
            const card = document.createElement('div');
            card.className = "profile-agent-card";

            const header = document.createElement('div');
            header.className = "profile-header-wrapper";

            const title = document.createElement('div');
            title.className = "profile-title-tag";
            title.textContent = `Agent: ${profile.name}`;

            const delBtn = document.createElement('button');
            delBtn.className = "delete-profile-btn";
            delBtn.textContent = "Remove Profile";
            delBtn.addEventListener('click', () => deleteAiProfile(profile.name));

            header.appendChild(title);
            header.appendChild(delBtn);

            const promptPre = document.createElement('div');
            promptPre.className = "profile-prompt-preview";
            promptPre.textContent = `System Prompt: ${profile.prompt}`;

            const tray = document.createElement('div');
            tray.className = "agent-control-tray";

            const batchBtn = document.createElement('button');
            batchBtn.className = "secondary-btn";
            batchBtn.style.borderColor = "var(--accent)";
            batchBtn.textContent = "🚀 Run Batch Analysis (All Pages)";
            batchBtn.addEventListener('click', () => runBatchProfileAnalysis(profile));

            const statusSpan = document.createElement('span');
            statusSpan.id = `batch-status-${profile.name}`;
            statusSpan.className = "status-msg";
            statusSpan.style.color = "var(--accent)";

            tray.appendChild(batchBtn);
            tray.appendChild(statusSpan);

            card.appendChild(header);
            card.appendChild(promptPre);
            card.appendChild(tray);

            activeProfilesContainer.appendChild(card);
        });
    }

    // --- Render Core Scannable Timelines (Clean Layout Mode) ---
    function displayMemories(isSuccessfullyDecrypted) {
        memoriesContainer.innerHTML = '';

        if (!isSuccessfullyDecrypted) {
            const errorCard = document.createElement('div');
            errorCard.className = 'memory-card';
            errorCard.style.borderLeft = '4px solid #ef4444';
            errorCard.style.color = 'var(--text-muted)';
            errorCard.style.fontStyle = 'italic';
            errorCard.textContent = "[Undecipherable vault state context. Verification token missing.]";
            memoriesContainer.appendChild(errorCard);
            
            memoryInput.disabled = true;
            saveBtn.disabled = true;
            document.querySelector('.backup-section').style.display = 'none';
            document.querySelector('.ai-dashboard-section').style.display = 'none';
            return;
        }

        document.querySelector('.backup-section').style.display = 'block';
        document.querySelector('.ai-dashboard-section').style.display = 'block';
        memoryInput.disabled = false;
        saveBtn.disabled = false;

        if (decryptedTimeline.length === 0) {
            memoriesContainer.innerHTML = '<p class="no-memories">Timeline empty.</p>';
            return;
        }

        decryptedTimeline.forEach((memory) => {
            const card = document.createElement('div');
            card.className = 'memory-card';

            const cardHeader = document.createElement('div');
            cardHeader.className = 'memory-card-header';

            const dateDiv = document.createElement('div');
            dateDiv.className = 'memory-date';
            dateDiv.textContent = memory.readableDate;

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-action-btn';
            editBtn.textContent = "Edit";
            editBtn.addEventListener('click', () => {
                updateFormContext(memory.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            cardHeader.appendChild(dateDiv);
            cardHeader.appendChild(editBtn);

            const textDiv = document.createElement('div');
            textDiv.className = 'memory-text';
            textDiv.textContent = memory.text;

            card.appendChild(cardHeader);
            card.appendChild(textDiv);
            memoriesContainer.appendChild(card);
        });
    }

    // --- Backup Operations Pipeline Layouts ---
    exportTriggerBtn.addEventListener('click', () => {
        importPanel.classList.add('visual-hidden');
        exportPanel.classList.toggle('visual-hidden');
        if (!exportPanel.classList.contains('visual-hidden')) {
            exportOutput.value = localStorage.getItem('dayMemoryVault') || "";
            exportOutput.select();
        }
    });

    importTriggerBtn.addEventListener('click', () => {
        exportPanel.classList.add('visual-hidden');
        importPanel.classList.toggle('visual-hidden');
        importInput.value = "";
    });

    copyVaultBtn.addEventListener('click', () => {
        if (!exportOutput.value) return;
        navigator.clipboard.writeText(exportOutput.value).then(() => {
            copyStatus.textContent = "Copied successfully!";
            setTimeout(() => { copyStatus.textContent = ""; }, 3000);
        });
    });

    submitImportBtn.addEventListener('click', () => {
        const importedString = importInput.value.trim();
        if (!importedString) return;
        localStorage.setItem('dayMemoryVault', importedString);
        alert("Encrypted vault string imported successfully! Reloading environment...");
        window.location.reload();
    });

    lockBtn.addEventListener('click', () => {
        window.location.reload(); 
    });
});
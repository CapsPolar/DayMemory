document.addEventListener('DOMContentLoaded', () => {
    // Core Layout DOM Elements
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const passwordInput = document.getElementById('password-input');
    const mainApp = document.getElementById('main-app');
    
    const memoryForm = document.getElementById('memory-form');
    const memoryInput = document.getElementById('memory-input');
    const aiEditGroup = document.getElementById('ai-edit-group');
    const aiMemoryInput = document.getElementById('ai-memory-input');
    const formLabel = document.getElementById('form-label');
    const saveBtn = document.getElementById('save-btn');
    const memoriesContainer = document.getElementById('memories-container');
    const lockBtn = document.getElementById('lock-btn');

    // AI Settings UI Elements
    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const aiEndpointInput = document.getElementById('ai-endpoint');
    const aiModelInput = document.getElementById('ai-model');
    const aiPromptInput = document.getElementById('ai-prompt');
    const settingsOpenBtn = document.getElementById('settings-open-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');

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

    // Volatile runtime state variables
    let sessionKey = ""; 
    let decryptedTimeline = []; 
    let currentTargetDateKey = getTodayKey(); 

    const defaultAiSettings = {
        endpoint: "http://127.0.0.1:11434",
        model: "llama3",
        prompt: "You are a personal journal assistant. Review the following daily journal entry and extract key insights, emotional tones, core achievements, and any important follow-up action items in a concise, bulleted description format."
    };

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

    function getAiSettings() {
        const stored = localStorage.getItem('dayMemoryAiConfig');
        return stored ? JSON.parse(stored) : defaultAiSettings;
    }

    // Unlock Flow Action
    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredPassword = passwordInput.value.trim();
        if (!enteredPassword) return;

        sessionKey = enteredPassword;
        const success = decryptAndLoadVault();

        authModal.classList.add('visual-hidden');
        mainApp.classList.remove('visual-hidden');
        
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

    // Adjust workspace parameters for new entries or edits
    function updateFormContext(dateKey) {
        currentTargetDateKey = dateKey;
        const existingEntry = decryptedTimeline.find(item => item.id === dateKey);
        const isToday = (dateKey === getTodayKey());

        if (existingEntry) {
            memoryInput.value = existingEntry.text;
            
            // If the record has an AI summary, display the summary editing workspace box
            if (existingEntry.aiAnalysis) {
                aiEditGroup.classList.remove('visual-hidden');
                aiMemoryInput.value = existingEntry.aiAnalysis;
            } else {
                aiEditGroup.classList.add('visual-hidden');
                aiMemoryInput.value = "";
            }

            formLabel.textContent = isToday ? `Editing today's reflection (${formatReadableDate(dateKey)}):` : `Editing historical record for ${formatReadableDate(dateKey)}:`;
            saveBtn.textContent = "Update Memory";
        } else {
            memoryInput.value = "";
            aiMemoryInput.value = "";
            aiEditGroup.classList.add('visual-hidden');
            formLabel.textContent = `Write about today (${formatReadableDate(dateKey)}):`;
            saveBtn.textContent = "Save New Memory";
        }
    }

    // Handle Form Commit (Persisting Manual Changes)
    memoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = memoryInput.value.trim();
        if (!text) return;

        const existingIndex = decryptedTimeline.findIndex(item => item.id === currentTargetDateKey);
        
        if (existingIndex !== -1) {
            // Save updates to description text field
            decryptedTimeline[existingIndex].text = text;
            
            // Also preserve manual changes to the AI analysis text area if visible
            if (!aiEditGroup.classList.contains('visual-hidden')) {
                decryptedTimeline[existingIndex].aiAnalysis = aiMemoryInput.value.trim() || null;
            }
        } else {
            decryptedTimeline.push({
                id: currentTargetDateKey,
                text: text,
                readableDate: formatReadableDate(currentTargetDateKey),
                aiAnalysis: null
            });
            decryptedTimeline.sort((a, b) => b.id.localeCompare(a.id));
        }

        encryptAndSaveVault();
        displayMemories(true);
        updateFormContext(getTodayKey());
    });

    // --- Local Ollama API Pipeline ---
    async function requestAiAnalysis(dateKey, cardElement) {
        const entry = decryptedTimeline.find(item => item.id === dateKey);
        if (!entry) return;

        const aiConfig = getAiSettings();
        const actionArea = cardElement.querySelector('.card-actions-wrapper');
        const originalContent = actionArea.innerHTML;
        actionArea.innerHTML = `<span class="ai-loading-spinner">✨ Requesting local LLM (${aiConfig.model})...</span>`;

        try {
            const response = await fetch(`${aiConfig.endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: aiConfig.model,
                    prompt: `System Guide: ${aiConfig.prompt}\n\nJournal Entry:\n"${entry.text}"`,
                    stream: false
                })
            });

            if (!response.ok) throw new Error("Connection broken.");

            const data = await response.json();
            const analysisResult = data.response.trim();

            entry.aiAnalysis = analysisResult;

            encryptAndSaveVault();
            displayMemories(true);

            // Sync form workspace immediately if currently editing this card
            if (currentTargetDateKey === dateKey) {
                updateFormContext(dateKey);
            }

        } catch (err) {
            alert(`Ollama Connection Error: Verify server execution state at ${aiConfig.endpoint} and check your OLLAMA_ORIGINS parameter tags.`);
            actionArea.innerHTML = originalContent;
            bindCardActions(cardElement, dateKey);
        }
    }

    function bindCardActions(cardElement, dateKey) {
        cardElement.querySelector('.edit-action-btn').addEventListener('click', () => {
            updateFormContext(dateKey);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        const aiBtn = cardElement.querySelector('.ai-action-btn');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => requestAiAnalysis(dateKey, cardElement));
        }
    }

    // Render Timeline Layout Matrices
    function displayMemories(isSuccessfullyDecrypted) {
        memoriesContainer.innerHTML = '';

        if (!isSuccessfullyDecrypted) {
            const errorCard = document.createElement('div');
            errorCard.className = 'memory-card';
            errorCard.style.borderLeft = '4px solid #ef4444';
            errorCard.style.color = 'var(--text-muted)';
            errorCard.style.fontStyle = 'italic';
            errorCard.textContent = "[Undecipherable vault. The master password entered may be incorrect.]";
            memoriesContainer.appendChild(errorCard);
            
            memoryInput.disabled = true;
            saveBtn.disabled = true;
            document.querySelector('.backup-section').style.display = 'none';
            settingsOpenBtn.style.display = 'none';
            return;
        }

        document.querySelector('.backup-section').style.display = 'block';
        settingsOpenBtn.style.display = 'inline-block';
        memoryInput.disabled = false;
        saveBtn.disabled = false;

        if (decryptedTimeline.length === 0) {
            memoriesContainer.innerHTML = '<p class="no-memories">Your secure vault is empty. Write your first entry above!</p>';
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

            const actionsWrapper = document.createElement('div');
            actionsWrapper.className = 'card-actions-wrapper';

            // NEW: Alternate label between New Generation and Re-Analysis updates
            const aiButtonLabel = memory.aiAnalysis ? "🔄 Re-Analyze" : "✨ Analyze with AI";

            actionsWrapper.innerHTML = `
                <button class="edit-action-btn ai-action-btn">${aiButtonLabel}</button>
                <button class="edit-action-btn">Edit</button>
            `;

            cardHeader.appendChild(dateDiv);
            cardHeader.appendChild(actionsWrapper);

            const textDiv = document.createElement('div');
            textDiv.className = 'memory-text';
            textDiv.textContent = memory.text;

            card.appendChild(cardHeader);
            card.appendChild(textDiv);

            if (memory.aiAnalysis) {
                const aiBlock = document.createElement('div');
                aiBlock.className = 'ai-analysis-block';
                aiBlock.innerHTML = `
                    <div class="ai-title">🤖 AI Key Insights Summary</div>
                    <div class="ai-text">${memory.aiAnalysis}</div>
                `;
                card.appendChild(aiBlock);
            }

            memoriesContainer.appendChild(card);
            bindCardActions(card, memory.id);
        });
    }

    // --- Settings UI Toggles ---
    settingsOpenBtn.addEventListener('click', () => {
        const config = getAiSettings();
        aiEndpointInput.value = config.endpoint;
        aiModelInput.value = config.model;
        aiPromptInput.value = config.prompt;
        settingsModal.classList.remove('visual-hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('visual-hidden');
    });

    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const updatedConfig = {
            endpoint: aiEndpointInput.value.trim().replace(/\/$/, ""), 
            model: aiModelInput.value.trim(),
            prompt: aiPromptInput.value.trim()
        };
        localStorage.setItem('dayMemoryAiConfig', JSON.stringify(updatedConfig));
        settingsModal.classList.add('visual-hidden');
        alert("Local AI configurations successfully saved!");
    });

    // --- Backup Framework Operations ---
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
        if (importedString.length < 20 || importedString.includes(" ")) {
            importStatus.textContent = "Invalid entry validation format.";
            return;
        }
        localStorage.setItem('dayMemoryVault', importedString);
        alert("Encrypted vault string imported! Reloading environment...");
        window.location.reload();
    });

    lockBtn.addEventListener('click', () => {
        window.location.reload(); 
    });
});
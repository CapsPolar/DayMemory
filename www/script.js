document.addEventListener('DOMContentLoaded', () => {
    // Core DOM Elements
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

    // NEW: Portability Elements
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

    // Volatile runtime state
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

    // Auth Controller
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

    function updateFormContext(dateKey) {
        currentTargetDateKey = dateKey;
        const existingEntry = decryptedTimeline.find(item => item.id === dateKey);
        const isToday = (dateKey === getTodayKey());

        if (existingEntry) {
            memoryInput.value = existingEntry.text;
            formLabel.textContent = isToday ? `Editing today's reflection (${formatReadableDate(dateKey)}):` : `Editing historical record for ${formatReadableDate(dateKey)}:`;
            saveBtn.textContent = "Update Memory";
        } else {
            memoryInput.value = "";
            formLabel.textContent = `Write about today (${formatReadableDate(dateKey)}):`;
            saveBtn.textContent = "Save New Memory";
        }
    }

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
                readableDate: formatReadableDate(currentTargetDateKey)
            });
            decryptedTimeline.sort((a, b) => b.id.localeCompare(a.id));
        }

        encryptAndSaveVault();
        displayMemories(true);
        updateFormContext(getTodayKey());
    });

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
            saveBtn.textContent = "Vault Locked";
            
            // Hide export features if decryption failed
            document.querySelector('.backup-section').style.display = 'none';
            return;
        }

        document.querySelector('.backup-section').style.display = 'block';

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

    // --- NEW: BACKUP MANAGEMENT IMPLEMENTATION ---

    // Toggle Panels
    exportTriggerBtn.addEventListener('click', () => {
        importPanel.classList.add('visual-hidden');
        exportPanel.classList.toggle('visual-hidden');
        
        if (!exportPanel.classList.contains('visual-hidden')) {
            // Pull raw encrypted data directly from LocalStorage to ensure accuracy
            exportOutput.value = localStorage.getItem('dayMemoryVault') || "";
            exportOutput.select();
        }
    });

    importTriggerBtn.addEventListener('click', () => {
        exportPanel.classList.add('visual-hidden');
        importPanel.classList.toggle('visual-hidden');
        importInput.value = "";
    });

    // Clipboard copy action using modern asynchronous API
    copyVaultBtn.addEventListener('click', () => {
        if (!exportOutput.value) return;
        
        navigator.clipboard.writeText(exportOutput.value).then(() => {
            copyStatus.textContent = "Copied successfully!";
            setTimeout(() => { copyStatus.textContent = ""; }, 3000);
        }).catch(err => {
            copyStatus.className = "status-msg text-danger";
            copyStatus.textContent = "Failed to copy.";
        });
    });

    // Import action logic
    submitImportBtn.addEventListener('click', () => {
        const importedString = importInput.value.trim();
        
        if (!importedString) {
            showImportError("Please paste a valid encrypted string.");
            return;
        }

        try {
            // Cryptographic Integrity Verification Check:
            // Attempt to decrypt the pasted string using the CURRENT active window password
            const bytes = CryptoJS.AES.decrypt(importedString, sessionKey);
            const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedString) {
                throw new Error("Wrong key mapping layout context");
            }
            
            // Check parsing compatibility
            const parsedData = JSON.parse(decryptedString);
            if (!Array.isArray(parsedData)) {
                throw new Error("Data payload layout structured incorrectly.");
            }

            // If verified, replace local variable references and sync to persistent hardware memory
            decryptedTimeline = parsedData;
            localStorage.setItem('dayMemoryVault', importedString);

            // Re-render display timeline layers smoothly
            displayMemories(true);
            updateFormContext(getTodayKey());
            importPanel.classList.add('visual-hidden');
            alert("Vault backup successfully verified and restored!");
            
        } catch (e) {
            showImportError("Import failed! The data is corrupted, improperly structured, or wasn't encrypted with your current active password.");
        }
    });

    function showImportError(msg) {
        importStatus.textContent = msg;
        setTimeout(() => { importStatus.textContent = ""; }, 6000);
    }

    lockBtn.addEventListener('click', () => {
        window.location.reload(); 
    });
});
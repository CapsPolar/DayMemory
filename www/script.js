document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
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

    // Volatile runtime state
    let sessionKey = ""; 
    let decryptedTimeline = []; 
    
    // Target state tracker for edits: either 'today' or a historic 'YYYY-MM-DD' key
    let currentTargetDateKey = getTodayKey(); 

    // Helper: Generate local YYYY-MM-DD identifier
    function getTodayKey() {
        const d = new Date();
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    }

    // Helper: Turn YYYY-MM-DD string into a beautiful readable label
    function formatReadableDate(dateString) {
        const [year, month, day] = dateString.split('-');
        const dateObj = new Date(year, month - 1, day);
        return dateObj.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // Handle Authentication
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

    // Adjusts the top layout input values based on whether you are editing today or a past card
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
        memoryInput.focus();
    }

    // Handle form submit (Both New submissions and Edits)
    memoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = memoryInput.value.trim();
        if (!text) return;

        const existingIndex = decryptedTimeline.findIndex(item => item.id === currentTargetDateKey);

        if (existingIndex !== -1) {
            // Update mode
            decryptedTimeline[existingIndex].text = text;
        } else {
            // New mode for a missing calendar node
            const newMemory = {
                id: currentTargetDateKey, // Primary Key is explicitly the string date 'YYYY-MM-DD'
                text: text,
                readableDate: formatReadableDate(currentTargetDateKey)
            };
            decryptedTimeline.push(newMemory);
            
            // Re-sort the local timeline elements array chronologically descending
            decryptedTimeline.sort((a, b) => b.id.localeCompare(a.id));
        }

        encryptAndSaveVault();
        displayMemories(true);
        updateFormContext(getTodayKey()); // Reset back down to target today
    });

    // Render Timeline View
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
            return;
        }

        if (decryptedTimeline.length === 0) {
            memoriesContainer.innerHTML = '<p class="no-memories">Your secure vault is empty. Write your first entry above!</p>';
            return;
        }

        memoryInput.disabled = false;
        saveBtn.disabled = false;

        decryptedTimeline.forEach((memory) => {
            const card = document.createElement('div');
            card.className = 'memory-card';

            const cardHeader = document.createElement('div');
            cardHeader.className = 'memory-card-header';

            const dateDiv = document.createElement('div');
            dateDiv.className = 'memory-date';
            dateDiv.textContent = memory.readableDate;

            // Small edit toggle element injection
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

    lockBtn.addEventListener('click', () => {
        window.location.reload(); 
    });
});
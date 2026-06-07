document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const passwordInput = document.getElementById('password-input');
    const mainApp = document.getElementById('main-app');
    
    const memoryForm = document.getElementById('memory-form');
    const memoryInput = document.getElementById('memory-input');
    const memoriesContainer = document.getElementById('memories-container');
    const lockBtn = document.getElementById('lock-btn');

    // Volatile runtime state
    let sessionKey = ""; 
    let decryptedTimeline = []; // Holds raw memory objects only in runtime memory

    // Handle Authentication Modal Submission
    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredPassword = passwordInput.value.trim();

        if (!enteredPassword) return;

        sessionKey = enteredPassword;
        
        // Attempt to decrypt the whole vault right now
        const success = decryptAndLoadVault();

        // Reveal the main application layer regardless of success
        authModal.classList.add('visual-hidden');
        mainApp.classList.remove('visual-hidden');
        
        // Render whatever we have (valid timeline or single error block)
        displayMemories(success);
    });

    // Decrypt the single vault string from localStorage
    function decryptAndLoadVault() {
        const encryptedVault = localStorage.getItem('dayMemoryVault');
        
        // If there's no vault data at all, it's a fresh initialization
        if (!encryptedVault) {
            decryptedTimeline = [];
            return true;
        }

        try {
            // Decrypt the entire master string using the sessionKey
            const bytes = CryptoJS.AES.decrypt(encryptedVault, sessionKey);
            const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedString) return false; // Bad password resulting in empty string
            
            // Parse the decrypted string back into the working array
            decryptedTimeline = JSON.parse(decryptedString);
            return true;
        } catch (error) {
            return false; // Decryption failed or JSON parsing broke due to bad key
        }
    }

    // Encrypt and Save the Entire Vault State
    function encryptAndSaveVault() {
        // Stringify the whole array of entries at once
        const stringifiedVault = JSON.stringify(decryptedTimeline);
        
        // Encrypt that single string
        const ciphertext = CryptoJS.AES.encrypt(stringifiedVault, sessionKey).toString();
        
        // Store it as a single entry in LocalStorage
        localStorage.setItem('dayMemoryVault', ciphertext);
    }

    // Handle saving new entries
    memoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = memoryInput.value.trim();
        if (!text) return;

        const newMemory = {
            id: Date.now(),
            text: text,
            date: new Date().toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })
        };

        // Add new item to the front of the runtime array (Newest first)
        decryptedTimeline.unshift(newMemory);

        // Re-encrypt the entire state and save to disk
        encryptAndSaveVault();

        displayMemories(true);
        memoryForm.reset();
    });

    // Handle UI Rendering
    function displayMemories(isSuccessfullyDecrypted) {
        memoriesContainer.innerHTML = '';

        // Case 1: Decryption failed (Wrong password)
        if (!isSuccessfullyDecrypted) {
            const errorCard = document.createElement('div');
            errorCard.className = 'memory-card';
            errorCard.style.borderLeft = '4px solid #ef4444';
            errorCard.style.color = 'var(--text-muted)';
            errorCard.style.fontStyle = 'italic';
            errorCard.textContent = "[Undecipherable vault. The master password entered may be incorrect.]";
            memoriesContainer.appendChild(errorCard);
            
            // Disable the input form so they can't accidentally overwrite data while locked out
            memoryInput.disabled = true;
            memoryForm.querySelector('button[type="submit"]').disabled = true;
            memoryForm.querySelector('button[type="submit"]').textContent = "Vault Locked";
            return;
        }

        // Case 2: Vault is empty but successfully opened
        if (decryptedTimeline.length === 0) {
            memoriesContainer.innerHTML = '<p class="no-memories">Your secure vault is empty. Write your first entry above!</p>';
            return;
        }

        // Ensure inputs are active if successfully decrypted
        memoryInput.disabled = false;
        memoryForm.querySelector('button[type="submit"]').disabled = false;
        memoryForm.querySelector('button[type="submit"]').textContent = "Encrypt & Save Memory";

        // Case 3: Loop through and render the raw data already in memory
        decryptedTimeline.forEach((memory) => {
            const card = document.createElement('div');
            card.className = 'memory-card';

            const dateDiv = document.createElement('div');
            dateDiv.className = 'memory-date';
            dateDiv.textContent = memory.date;

            const textDiv = document.createElement('div');
            textDiv.className = 'memory-text';
            textDiv.textContent = memory.text;

            card.appendChild(dateDiv);
            card.appendChild(textDiv);
            memoriesContainer.appendChild(card);
        });
    }

    // Manual lock mechanism
    lockBtn.addEventListener('click', () => {
        window.location.reload(); 
    });
});
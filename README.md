# DayMemory

### A quiet place to put your thoughts down.

DayMemory is a private, local-first journal for the things you want to remember: a passing thought, a rough day, a small win, or the numbers you want to look back on later. Open it, write without breaking your flow, and unlock your history when you're ready.

**No account. No cloud sync. Your journal stays in your browser.**

**Try DayMemory:** [daymemory.pages.dev](https://daymemory.pages.dev/)

> DayMemory is a personal journaling app, not an independently audited security product. Read [Privacy and encryption](#privacy-and-encryption) before putting sensitive information in it.

## What you can do

- **Write right away.** The writing space is available before you unlock your vault, with automatic timestamps and autosave.
- **Keep a searchable history.** Unlock to bring your pending writing into your journal, browse it, search for phrases, and edit entries.
- **Protect your vault with a password.** Journal history is encrypted before it is saved to browser storage.
- **Back up and restore.** Export an encrypted vault string for safekeeping, or import an encrypted backup or plain text history.
- **Make it yours.** Choose light, dark, or system theme, and set a reminder to export a backup.
- **Take it offline.** Install DayMemory as a PWA; its service worker caches the app shell for offline use after the app has loaded.

The **Analytics** screen is currently a coming-soon placeholder; analytics and AI-powered insights are not available in the app yet.

## Get started

You’ll need a recent version of Node.js and npm.

```bash
cd webapp
npm install
npm run dev
```

Open the local URL printed by Vite. To create and preview a production build:

```bash
npm run build
npm run preview
```

The production files are written to `webapp/dist`. Deploy that directory to a static host. The current app and service worker use root-relative URLs, so serve DayMemory from the site root (or update the app’s base paths and service-worker scope for a subdirectory deployment). Use HTTPS in production; browsers only allow service workers in secure contexts (with localhost as a development exception).

## Privacy and encryption

DayMemory has no account or application backend. The vault and writing buffer are stored in the browser’s **IndexedDB**. The app does not sync your entries to a DayMemory server. Installing the PWA does not move your data off the device.

### What is encrypted

The vault is encrypted by the `CryptoJSAdapter` before it is written to IndexedDB. It uses CryptoJS’s passphrase-based `AES.encrypt` API. With the library defaults used here, that means **AES-256-CBC with PKCS#7 padding** and a salted, OpenSSL-compatible ciphertext format.

### Important limitations

- **Quick writing comes first.** All writing starts in the quick writing space, which is autosaved locally as plain text while the vault is locked. When you unlock, DayMemory adds that writing to the encrypted vault and clears the pending buffer.
- **The passphrase derivation is a legacy default.** CryptoJS’s passphrase API uses an MD5-based EVP_BytesToKey-style derivation, not a modern password-hardening KDF such as Argon2id or scrypt. Choose a long, unique passphrase.
- **AES-CBC does not authenticate the ciphertext.** The current format has no authentication tag, so it does not provide a cryptographic integrity check. Wrong passwords or damaged data may not always be distinguishable from valid plaintext.
- **There is no password recovery.** If you lose your password, there is no way to open that encrypted vault. This is intentional: DayMemory has no account or recovery key that could bypass your password.
- **Browser storage is not a backup.** Clearing site data, losing the device, or browser storage failure can remove your journal. Export your encrypted vault regularly and keep the backup somewhere safe.
- **Plain text exports are readable.** Anyone with an unencrypted export can read your history. Use plain text export when you want to migrate your writing to another app.

An encrypted backup contains the vault ciphertext, not your password. Someone with the backup string still needs the vault password to decrypt it, so you can store encrypted backups with a cloud provider or share the string without sharing your password. Keep your password secret; anyone who has both can access the vault.

## Built with

- **Vue 3**, **TypeScript**, and **Vite**
- **IndexedDB** for browser-local persistence
- **CryptoJS** for passphrase-based AES encryption
- **Hexagonal architecture**: the TypeScript core contains domain models and services, and depends on storage and encryption ports rather than browser APIs. The web app supplies adapters for IndexedDB and CryptoJS.
- **PWA service worker** for caching the application shell

## Your data, your choice

DayMemory supports both encrypted backups and plain text export/import, so you can back up your vault, move it between devices, or migrate your writing to another app. Encrypted backups can be restored with the password used to create them. Plain text export is available when you need portable, readable history.

## Project layout

```text
core/
  models/       Vault data and journal types
  ports/        Storage and encryption interfaces
  services/     Vault and pending-writing behavior
  utils/        Timestamp helpers
webapp/
  adapters/     IndexedDB and CryptoJS browser adapters
  src/          Vue application and views
  public/       Styles, icons, manifest, and service worker
```

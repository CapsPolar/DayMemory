import type { EncryptionPort } from "@core/ports/EncryptionPort";

// The `CryptoJS` global used below is declared ambiently in
// ./types/crypto-js.d.ts (picked up automatically via tsconfig's "include").

/**
 * EncryptionPort implementation backed by the CryptoJS UMD build loaded
 * globally via <script src="/crypto-js.min.js"> in index.html.
 */
export class CryptoJSAdapter implements EncryptionPort {
  encrypt(plaintext: string, passphrase: string): string {
    return CryptoJS.AES.encrypt(plaintext, passphrase).toString();
  }

  decrypt(ciphertext: string, passphrase: string): string | null {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, passphrase);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted ? decrypted : null;
    } catch {
      return null;
    }
  }
}

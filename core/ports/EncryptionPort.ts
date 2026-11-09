/**
 * Port the core depends on for symmetric encryption of the vault.
 * The webapp connects this to an adapter (e.g. CryptoJSAdapter) that is
 * type compatible with this interface.
 */
export interface EncryptionPort {
  /** Encrypts plaintext with the given passphrase, returning ciphertext. */
  encrypt(plaintext: string, passphrase: string): string;
  /**
   * Attempts to decrypt ciphertext with the given passphrase.
   * Returns the plaintext, or null if the passphrase is wrong / data is corrupt.
   */
  decrypt(ciphertext: string, passphrase: string): string | null;
}

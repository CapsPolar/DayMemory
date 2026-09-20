/**
 * crypto-js.min.js is vendored as a static file (webapp/public/crypto-js.min.js)
 * and loaded via a plain <script> tag in index.html, exactly like the
 * original app — it is not npm-installed or ES-imported. This just
 * declares the UMD global it attaches to `window` so CryptoJSAdapter can
 * use it under strict TypeScript.
 */
declare const CryptoJS: {
  AES: {
    encrypt(message: string, key: string): { toString(): string };
    decrypt(
      ciphertext: string,
      key: string
    ): { toString(encoding: unknown): string };
  };
  enc: {
    Utf8: unknown;
  };
};

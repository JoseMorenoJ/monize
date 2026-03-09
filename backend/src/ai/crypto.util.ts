import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 16;

function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.scryptSync(secret, salt, 32);
}

function deriveLegacyKey(secret: string): Buffer {
  return crypto.scryptSync(secret, "totp-encryption-salt", 32);
}

export function encrypt(text: string, jwtSecret: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(jwtSecret, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  return `${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function isLegacyEncryption(encryptedText: string): boolean {
  return encryptedText.split(":").length === 3;
}

export function decrypt(encryptedText: string, jwtSecret: string): string {
  const parts = encryptedText.split(":");

  let key: Buffer;
  let ivHex: string;
  let authTagHex: string;
  let ciphertext: string;

  if (parts.length === 4) {
    const salt = Buffer.from(parts[0], "hex");
    key = deriveKey(jwtSecret, salt);
    ivHex = parts[1];
    authTagHex = parts[2];
    ciphertext = parts[3];
  } else if (parts.length === 3) {
    key = deriveLegacyKey(jwtSecret);
    ivHex = parts[0];
    authTagHex = parts[1];
    ciphertext = parts[2];
  } else {
    throw new Error("Invalid encrypted text format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function migrateFromLegacy(
  encryptedText: string,
  jwtSecret: string,
): string | null {
  if (!isLegacyEncryption(encryptedText)) {
    return null;
  }
  const plaintext = decrypt(encryptedText, jwtSecret);
  return encrypt(plaintext, jwtSecret);
}

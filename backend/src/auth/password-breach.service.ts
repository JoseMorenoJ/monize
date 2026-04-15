import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";

@Injectable()
export class PasswordBreachService {
  private readonly logger = new Logger(PasswordBreachService.name);
  private readonly HIBP_API = "https://api.pwnedpasswords.com/range/";

  async isBreached(password: string): Promise<boolean> {
    try {
      // SHA-1 is required by the HIBP k-Anonymity API protocol; we are not
      // using it to hash passwords for storage. Only the first 5 hex chars
      // of the hash ever leave this process (the prefix is sent to HIBP to
      // receive back a list of matching suffixes for local comparison). The
      // password itself and the remaining 35 hex chars of the hash never
      // leave the process. This is a known-safe use of SHA-1.
      // bearer:disable javascript_lang_weak_hash_sha1
      // codeql[js/insufficient-password-hash]
      const sha1 = crypto
        .createHash("sha1")
        .update(password)
        .digest("hex")
        .toUpperCase();
      const prefix = sha1.substring(0, 5);
      const suffix = sha1.substring(5);

      const response = await fetch(`${this.HIBP_API}${prefix}`, {
        headers: { "User-Agent": "Monize-PasswordCheck" },
      });

      if (!response.ok) {
        this.logger.warn(
          `HIBP API returned status ${response.status}, failing open`,
        );
        return false;
      }

      const body = await response.text();
      const lines = body.split("\n");
      const suffixBuffer = Buffer.from(suffix);

      return lines.some((line) => {
        const [hashSuffix] = line.split(":");
        const candidate = Buffer.from(hashSuffix.trim());
        return (
          candidate.length === suffixBuffer.length &&
          crypto.timingSafeEqual(candidate, suffixBuffer)
        );
      });
    } catch (error) {
      this.logger.warn(
        `HIBP API request failed, failing open: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";

@Injectable()
export class PasswordBreachService {
  private readonly logger = new Logger(PasswordBreachService.name);
  private readonly HIBP_API = "https://api.pwnedpasswords.com/range/";

  async isBreached(password: string): Promise<boolean> {
    try {
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

      return lines.some((line) => {
        const [hashSuffix] = line.split(":");
        return hashSuffix.trim() === suffix;
      });
    } catch (error) {
      this.logger.warn(
        `HIBP API request failed, failing open: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

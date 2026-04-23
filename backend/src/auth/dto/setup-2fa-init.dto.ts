import { IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Body for POST /auth/2fa/setup. The current password must be re-verified
 * before we generate (and display) a new TOTP secret, so a session-hijacker
 * cannot force-enroll their own authenticator and lock out the real user.
 */
export class Setup2faInitDto {
  @ApiProperty({ description: "Current account password" })
  @IsString()
  @MaxLength(128)
  currentPassword: string;
}

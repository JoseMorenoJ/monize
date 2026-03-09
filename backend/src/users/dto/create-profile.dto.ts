import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, MaxLength, Matches } from "class-validator";
import { SanitizeHtml } from "../../common/decorators/sanitize-html.decorator";

export class CreateProfileDto {
  @ApiProperty({ description: "Profile display name" })
  @IsString()
  @MaxLength(100)
  @SanitizeHtml()
  firstName: string;

  @ApiPropertyOptional({ description: "Optional last name / subtitle" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @SanitizeHtml()
  lastName?: string;

  @ApiPropertyOptional({ description: "Avatar background color (hex)", example: "#6366f1" })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "avatarColor must be a valid hex color" })
  avatarColor?: string;
}

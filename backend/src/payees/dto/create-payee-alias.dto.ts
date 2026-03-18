import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, IsUUID } from "class-validator";
import { SanitizeHtml } from "../../common/decorators/sanitize-html.decorator";

export class CreatePayeeAliasDto {
  @ApiProperty({
    example: "payee-uuid",
    description: "ID of the payee this alias maps to",
  })
  @IsUUID()
  payeeId: string;

  @ApiProperty({
    example: "STARBUCKS #*",
    description:
      "Alias pattern for matching imported payee names. Supports * wildcard for partial matching. Case-insensitive.",
  })
  @IsString()
  @MaxLength(255)
  @SanitizeHtml()
  alias: string;
}

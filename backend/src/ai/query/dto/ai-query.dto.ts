import {
  IsString,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
} from "class-validator";
import { Type } from "class-transformer";
import { SanitizeHtml } from "../../../common/decorators/sanitize-html.decorator";

class ConversationMessageDto {
  @IsIn(["user", "assistant"])
  role: "user" | "assistant";

  @IsString()
  @MaxLength(50000)
  content: string;
}

/**
 * Maximum number of conversation history messages the client may send.
 * Keeps context size bounded while allowing enough turns for a
 * natural back-and-forth (10 pairs of user+assistant messages).
 */
export const MAX_HISTORY_MESSAGES = 20;

export class AiQueryDto {
  @IsString()
  @MaxLength(2000)
  @IsNotEmpty()
  @SanitizeHtml()
  query: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageDto)
  conversationHistory?: ConversationMessageDto[];
}

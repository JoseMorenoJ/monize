import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class GetRecentTransactionsDto {
  @ApiPropertyOptional({
    description: "Number of recent transactions to return",
    minimum: 1,
    maximum: 20,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiPropertyOptional({
    description:
      "Restrict results to transactions matching this payee ID. When set, results are returned in raw recency order without dedup.",
  })
  @IsOptional()
  @IsUUID()
  payeeId?: string;

  @ApiPropertyOptional({
    description:
      "Restrict results to transactions whose free-text payeeName matches exactly. Ignored if payeeId is also provided.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  payeeName?: string;
}

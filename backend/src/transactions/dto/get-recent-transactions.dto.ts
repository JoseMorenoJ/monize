import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class GetRecentTransactionsDto {
  @ApiPropertyOptional({
    description: "Number of recent distinct transactions to return",
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
}

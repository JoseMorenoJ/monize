import { ApiProperty } from "@nestjs/swagger";
import { IsUUID, IsOptional, IsBoolean } from "class-validator";

export class MergePayeeDto {
  @ApiProperty({
    example: "target-payee-uuid",
    description: "ID of the payee to merge INTO (the canonical/real payee)",
  })
  @IsUUID()
  targetPayeeId: string;

  @ApiProperty({
    example: "source-payee-uuid",
    description:
      "ID of the payee to merge FROM (the imported/duplicate payee that will be deleted)",
  })
  @IsUUID()
  sourcePayeeId: string;

  @ApiProperty({
    example: true,
    required: false,
    description:
      "Whether to add the source payee name as an alias on the target payee (default: true)",
  })
  @IsOptional()
  @IsBoolean()
  addAsAlias?: boolean;
}

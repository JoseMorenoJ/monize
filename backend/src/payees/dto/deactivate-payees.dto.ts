import { IsArray, ArrayMaxSize, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class DeactivatePayeesDto {
  @ApiProperty({
    description: "Array of payee IDs to deactivate",
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID("4", { each: true })
  payeeIds: string[];
}

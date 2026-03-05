import { PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { CreatePayeeDto } from "./create-payee.dto";

export class UpdatePayeeDto extends PartialType(CreatePayeeDto) {
  @ApiProperty({
    example: true,
    required: false,
    description: "Whether the payee is active",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

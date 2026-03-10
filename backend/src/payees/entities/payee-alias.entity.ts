import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { ApiProperty } from "@nestjs/swagger";
import { Payee } from "./payee.entity";
import { User } from "../../users/entities/user.entity";

@Entity("payee_aliases")
export class PayeeAlias {
  @ApiProperty({ example: "c5f5d5f0-1234-4567-890a-123456789abc" })
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ApiProperty({ example: "payee-uuid" })
  @Column({ type: "uuid", name: "payee_id" })
  payeeId: string;

  @ManyToOne(() => Payee, { onDelete: "CASCADE" })
  @JoinColumn({ name: "payee_id" })
  payee?: Payee;

  @ApiProperty({ example: "user-uuid" })
  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user?: User;

  @ApiProperty({
    example: "STARBUCKS*",
    description:
      "Alias pattern for matching imported payee names (supports * wildcard)",
  })
  @Column({ type: "varchar", length: 255 })
  alias: string;

  @ApiProperty()
  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Payee } from "./entities/payee.entity";
import { PayeeAlias } from "./entities/payee-alias.entity";
import { Transaction } from "../transactions/entities/transaction.entity";
import { ScheduledTransaction } from "../scheduled-transactions/entities/scheduled-transaction.entity";
import { Category } from "../categories/entities/category.entity";
import { PayeesService } from "./payees.service";
import { PayeesController } from "./payees.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payee,
      PayeeAlias,
      Transaction,
      ScheduledTransaction,
      Category,
    ]),
  ],
  providers: [PayeesService],
  controllers: [PayeesController],
  exports: [PayeesService],
})
export class PayeesModule {}

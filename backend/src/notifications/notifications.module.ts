import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmailService } from "./email.service";
import { BillReminderService } from "./bill-reminder.service";
import { NotificationsController } from "./notifications.controller";
import { ScheduledTransaction } from "../scheduled-transactions/entities/scheduled-transaction.entity";

@Module({
  imports: [TypeOrmModule.forFeature([ScheduledTransaction])],
  providers: [EmailService, BillReminderService],
  controllers: [NotificationsController],
  exports: [EmailService],
})
export class NotificationsModule {}

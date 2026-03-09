import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ScheduledTransaction } from "../scheduled-transactions/entities/scheduled-transaction.entity";
import { EmailService } from "./email.service";

@Injectable()
export class BillReminderService {
  private readonly logger = new Logger(BillReminderService.name);

  constructor(
    @InjectRepository(ScheduledTransaction)
    private scheduledTransactionsRepo: Repository<ScheduledTransaction>,
    private emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendBillReminders(): Promise<void> {
    if (!this.emailService.getStatus().configured) {
      this.logger.debug("SMTP not configured, skipping bill reminders");
      return;
    }

    this.logger.debug(
      "Email notifications disabled (profiles have no email addresses)",
    );
  }
}

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BillReminderService } from "./bill-reminder.service";
import { EmailService } from "./email.service";
import { ScheduledTransaction } from "../scheduled-transactions/entities/scheduled-transaction.entity";

describe("BillReminderService", () => {
  let service: BillReminderService;
  let emailService: Record<string, jest.Mock>;

  beforeEach(async () => {
    emailService = {
      getStatus: jest.fn(),
      sendMail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillReminderService,
        {
          provide: getRepositoryToken(ScheduledTransaction),
          useValue: { find: jest.fn() },
        },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<BillReminderService>(BillReminderService);
  });

  describe("sendBillReminders", () => {
    it("returns early when SMTP is not configured", async () => {
      emailService.getStatus.mockReturnValue({ configured: false });

      await service.sendBillReminders();

      expect(emailService.sendMail).not.toHaveBeenCalled();
    });

    it("does not send any emails (profiles have no email addresses)", async () => {
      emailService.getStatus.mockReturnValue({ configured: true });

      await service.sendBillReminders();

      expect(emailService.sendMail).not.toHaveBeenCalled();
    });
  });
});

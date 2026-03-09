import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { EmailService } from "./email.service";

describe("NotificationsController", () => {
  let controller: NotificationsController;
  let mockEmailService: Partial<Record<keyof EmailService, jest.Mock>>;
  const mockReq = { user: { id: "user-1" } };

  beforeEach(async () => {
    mockEmailService = {
      getStatus: jest.fn(),
      sendMail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  describe("getSmtpStatus()", () => {
    it("delegates to emailService.getStatus", () => {
      const status = { configured: true, host: "smtp.example.com" };
      mockEmailService.getStatus!.mockReturnValue(status);

      const result = controller.getSmtpStatus();

      expect(result).toEqual(status);
      expect(mockEmailService.getStatus).toHaveBeenCalledWith();
    });
  });

  describe("sendTestEmail()", () => {
    it("always throws BadRequestException (profiles have no email)", async () => {
      await expect(controller.sendTestEmail(mockReq)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.sendTestEmail(mockReq)).rejects.toThrow(
        "Email is not supported. Profiles do not have email addresses.",
      );
      expect(mockEmailService.sendMail).not.toHaveBeenCalled();
    });
  });
});

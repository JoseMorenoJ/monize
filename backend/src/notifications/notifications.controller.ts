import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  BadRequestException,
} from "@nestjs/common";
import { SessionGuard } from "../common/guards/session.guard";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { EmailService } from "./email.service";

@ApiTags("Notifications")
@Controller("notifications")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly emailService: EmailService) {}

  @Get("smtp-status")
  @ApiOperation({ summary: "Check if SMTP is configured" })
  getSmtpStatus() {
    return this.emailService.getStatus();
  }

  @Post("test-email")
  @ApiOperation({ summary: "Send a test email to the current user" })
  async sendTestEmail(@Request() req) {
    throw new BadRequestException(
      "Email is not supported. Profiles do not have email addresses.",
    );
  }
}

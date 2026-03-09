import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  Res,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { Response } from "express";
import { ParseUUIDPipe } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { SessionGuard } from "../common/guards/session.guard";
import { UsersService } from "./users.service";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { DemoRestricted } from "../common/decorators/demo-restricted.decorator";

@ApiTags("Users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --- Public endpoints (no session required) ---

  @Get()
  @ApiOperation({ summary: "List all profiles" })
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @DemoRestricted()
  @ApiOperation({ summary: "Create a new profile" })
  @ApiResponse({ status: 201, description: "Profile created successfully" })
  create(@Body() dto: CreateProfileDto) {
    return this.usersService.create(dto);
  }

  @Post(":id/select")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Select a profile (sets session cookie)" })
  async selectProfile(
    @Param("id", ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const profile = await this.usersService.findById(id);
    if (!profile) {
      throw new NotFoundException("Profile not found");
    }
    res.cookie("profile_session", id, {
      httpOnly: true,
      signed: true,
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return profile;
  }

  @Post("deselect")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Deselect current profile (clears session cookie)" })
  deselect(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("profile_session");
    return { ok: true };
  }

  // --- Protected endpoints (session required) ---

  @Get("me")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Get current profile" })
  getProfile(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  @Patch("profile")
  @UseGuards(SessionGuard)
  @DemoRestricted()
  @ApiOperation({ summary: "Update current profile" })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Delete(":id")
  @UseGuards(SessionGuard)
  @DemoRestricted()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete a profile" })
  @ApiResponse({ status: 200, description: "Profile deleted successfully" })
  async deleteProfile(@Param("id", ParseUUIDPipe) id: string) {
    await this.usersService.deleteProfile(id);
    return { message: "Profile deleted successfully" };
  }

  @Get("preferences")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Get current profile preferences" })
  getPreferences(@Request() req) {
    return this.usersService.getPreferences(req.user.id);
  }

  @Patch("preferences")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Update current profile preferences" })
  @ApiResponse({ status: 200, description: "Preferences updated successfully" })
  updatePreferences(@Request() req, @Body() dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(req.user.id, dto);
  }
}

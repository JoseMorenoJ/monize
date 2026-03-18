import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { UserPreference } from "./entities/user-preference.entity";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { CreateProfileDto } from "./dto/create-profile.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserPreference)
    private preferencesRepository: Repository<UserPreference>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: "ASC" } });
  }

  async create(dto: CreateProfileDto): Promise<User> {
    const user = this.usersRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName ?? null,
      avatarColor: dto.avatarColor ?? "#6366f1",
    });
    return this.usersRepository.save(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Profile not found");
    }
    if (dto.firstName !== undefined) {
      user.firstName = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      user.lastName = dto.lastName ?? null;
    }
    if (dto.avatarColor !== undefined) {
      user.avatarColor = dto.avatarColor;
    }
    return this.usersRepository.save(user);
  }

  async deleteProfile(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Profile not found");
    }
    await this.usersRepository.remove(user);
  }

  async getPreferences(userId: string): Promise<UserPreference> {
    let preferences = await this.preferencesRepository.findOne({
      where: { userId },
    });

    if (!preferences) {
      preferences = new UserPreference();
      preferences.userId = userId;
      preferences.defaultCurrency = "USD";
      preferences.dateFormat = "browser";
      preferences.numberFormat = "browser";
      preferences.theme = "system";
      preferences.timezone = "browser";
      preferences.gettingStartedDismissed = false;
      await this.preferencesRepository.save(preferences);
    }

    return preferences;
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<UserPreference> {
    let preferences = await this.preferencesRepository.findOne({
      where: { userId },
    });

    if (!preferences) {
      preferences = await this.getPreferences(userId);
    }

    if (dto.defaultCurrency !== undefined) {
      preferences.defaultCurrency = dto.defaultCurrency;
    }
    if (dto.dateFormat !== undefined) {
      preferences.dateFormat = dto.dateFormat;
    }
    if (dto.numberFormat !== undefined) {
      preferences.numberFormat = dto.numberFormat;
    }
    if (dto.theme !== undefined) {
      preferences.theme = dto.theme;
    }
    if (dto.timezone !== undefined) {
      preferences.timezone = dto.timezone;
    }
    if (dto.gettingStartedDismissed !== undefined) {
      preferences.gettingStartedDismissed = dto.gettingStartedDismissed;
    }
    if (dto.weekStartsOn !== undefined) {
      preferences.weekStartsOn = dto.weekStartsOn;
    }
    if (dto.budgetDigestEnabled !== undefined) {
      preferences.budgetDigestEnabled = dto.budgetDigestEnabled;
    }
    if (dto.budgetDigestDay !== undefined) {
      preferences.budgetDigestDay = dto.budgetDigestDay;
    }
    if (dto.favouriteReportIds !== undefined) {
      preferences.favouriteReportIds = dto.favouriteReportIds;
    }

    return this.preferencesRepository.save(preferences);
  }
}

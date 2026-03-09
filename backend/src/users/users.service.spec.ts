import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { User } from "./entities/user.entity";
import { UserPreference } from "./entities/user-preference.entity";

describe("UsersService", () => {
  let service: UsersService;
  let usersRepository: Record<string, jest.Mock>;
  let preferencesRepository: Record<string, jest.Mock>;

  const mockUser = {
    id: "user-1",
    firstName: "Test",
    lastName: "User",
    avatarColor: "#6366f1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPreferences = {
    userId: "user-1",
    defaultCurrency: "USD",
    dateFormat: "browser",
    numberFormat: "browser",
    theme: "system",
    timezone: "browser",
    gettingStartedDismissed: false,
  };

  beforeEach(async () => {
    usersRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => data),
      remove: jest.fn(),
    };

    preferencesRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((data) => data),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepository },
        {
          provide: getRepositoryToken(UserPreference),
          useValue: preferencesRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe("findById", () => {
    it("returns user when found", async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById("user-1");

      expect(result).toEqual(mockUser);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: "user-1" },
      });
    });

    it("returns null when not found", async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("returns all profiles", async () => {
      usersRepository.find.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(usersRepository.find).toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("creates a new profile", async () => {
      usersRepository.create.mockImplementation((data) => data);
      usersRepository.save.mockImplementation((data) => data);

      const result = await service.create({
        firstName: "New",
        lastName: "Profile",
        avatarColor: "#ff0000",
      });

      expect(result.firstName).toBe("New");
      expect(result.lastName).toBe("Profile");
      expect(result.avatarColor).toBe("#ff0000");
    });

    it("uses default avatar color when not provided", async () => {
      usersRepository.create.mockImplementation((data) => data);
      usersRepository.save.mockImplementation((data) => data);

      const result = await service.create({ firstName: "Simple" });

      expect(result.avatarColor).toBe("#6366f1");
    });
  });

  describe("updateProfile", () => {
    it("updates name and avatar color", async () => {
      usersRepository.findOne.mockResolvedValue({ ...mockUser });
      usersRepository.save.mockImplementation((user) => user);

      const result = await service.updateProfile("user-1", {
        firstName: "Updated",
        avatarColor: "#00ff00",
      });

      expect(result.firstName).toBe("Updated");
      expect(result.avatarColor).toBe("#00ff00");
    });

    it("throws NotFoundException when profile not found", async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile("nonexistent", { firstName: "Test" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteProfile", () => {
    it("deletes a profile", async () => {
      usersRepository.findOne.mockResolvedValue({ ...mockUser });

      await service.deleteProfile("user-1");

      expect(usersRepository.remove).toHaveBeenCalled();
    });

    it("throws NotFoundException when profile not found", async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteProfile("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getPreferences", () => {
    it("returns existing preferences", async () => {
      preferencesRepository.findOne.mockResolvedValue(mockPreferences);

      const result = await service.getPreferences("user-1");

      expect(result).toEqual(mockPreferences);
    });

    it("creates default preferences when none exist", async () => {
      preferencesRepository.findOne.mockResolvedValue(null);
      preferencesRepository.save.mockImplementation((data) => data);

      const result = await service.getPreferences("user-1");

      expect(preferencesRepository.save).toHaveBeenCalled();
      expect(result.userId).toBe("user-1");
      expect(result.defaultCurrency).toBe("USD");
      expect(result.theme).toBe("system");
    });
  });

  describe("updatePreferences", () => {
    it("updates only provided fields", async () => {
      preferencesRepository.findOne.mockResolvedValue({ ...mockPreferences });

      await service.updatePreferences("user-1", { theme: "dark" });

      const savedData = preferencesRepository.save.mock.calls[0][0];
      expect(savedData.theme).toBe("dark");
      expect(savedData.defaultCurrency).toBe("USD");
    });

    it("creates defaults first if preferences do not exist", async () => {
      preferencesRepository.findOne.mockResolvedValue(null);
      preferencesRepository.save.mockImplementation((data) => data);

      await service.updatePreferences("user-1", { defaultCurrency: "EUR" });

      expect(preferencesRepository.save).toHaveBeenCalled();
    });
  });
});

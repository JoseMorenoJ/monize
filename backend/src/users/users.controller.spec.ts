import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

describe("UsersController", () => {
  let controller: UsersController;
  let mockUsersService: Record<string, jest.Mock>;
  const mockReq = { user: { id: "user-1" } };

  beforeEach(async () => {
    mockUsersService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateProfile: jest.fn(),
      deleteProfile: jest.fn(),
      getPreferences: jest.fn(),
      updatePreferences: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe("getProfile()", () => {
    it("returns the user profile", async () => {
      const expected = {
        id: "user-1",
        firstName: "John",
        lastName: "Doe",
        avatarColor: "#6366f1",
      };
      mockUsersService.findById.mockResolvedValue(expected);

      const result = await controller.getProfile(mockReq);

      expect(result).toEqual(expected);
      expect(mockUsersService.findById).toHaveBeenCalledWith("user-1");
    });

    it("returns null when user is not found", async () => {
      mockUsersService.findById.mockResolvedValue(null);

      const result = await controller.getProfile(mockReq);

      expect(result).toBeNull();
    });
  });

  describe("updateProfile()", () => {
    it("delegates to usersService.updateProfile with userId and dto", async () => {
      const dto = { firstName: "Jane", lastName: "Smith" };
      const expected = {
        id: "user-1",
        firstName: "Jane",
        lastName: "Smith",
      };
      mockUsersService.updateProfile.mockResolvedValue(expected);

      const result = await controller.updateProfile(mockReq, dto as any);

      expect(result).toEqual(expected);
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
        "user-1",
        dto,
      );
    });
  });

  describe("getPreferences()", () => {
    it("delegates to usersService.getPreferences with userId", async () => {
      const expected = { currency: "USD", dateFormat: "MM/DD/YYYY" };
      mockUsersService.getPreferences.mockResolvedValue(expected);

      const result = await controller.getPreferences(mockReq);

      expect(result).toEqual(expected);
      expect(mockUsersService.getPreferences).toHaveBeenCalledWith("user-1");
    });
  });

  describe("updatePreferences()", () => {
    it("delegates to usersService.updatePreferences with userId and dto", async () => {
      const dto = { currency: "EUR" };
      const expected = { currency: "EUR", dateFormat: "MM/DD/YYYY" };
      mockUsersService.updatePreferences.mockResolvedValue(expected);

      const result = await controller.updatePreferences(mockReq, dto as any);

      expect(result).toEqual(expected);
      expect(mockUsersService.updatePreferences).toHaveBeenCalledWith(
        "user-1",
        dto,
      );
    });
  });
});

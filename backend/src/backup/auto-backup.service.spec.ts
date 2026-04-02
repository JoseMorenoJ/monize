import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import { AutoBackupService } from "./auto-backup.service";
import { AutoBackupSettings } from "./entities/auto-backup-settings.entity";

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    createWriteStream: jest.fn(),
    readdirSync: jest.fn(),
    unlinkSync: jest.fn(),
    promises: {
      stat: jest.fn(),
      writeFile: jest.fn(),
      unlink: jest.fn(),
    },
  };
});

const fsMock = fs as jest.Mocked<typeof fs>;
const fsPromises = fs.promises as jest.Mocked<typeof fs.promises>;

jest.mock("stream/promises", () => ({
  pipeline: jest.fn().mockResolvedValue(undefined),
}));

describe("AutoBackupService", () => {
  let service: AutoBackupService;
  let mockSettingsRepo: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  const userId = "test-user-id";

  function createSettings(
    overrides: Partial<AutoBackupSettings> = {},
  ): AutoBackupSettings {
    const s = new AutoBackupSettings();
    s.userId = userId;
    s.enabled = false;
    s.folderPath = "";
    s.frequency = "daily";
    s.retentionDaily = 7;
    s.retentionWeekly = 4;
    s.retentionMonthly = 6;
    s.lastBackupAt = null;
    s.lastBackupStatus = null;
    s.lastBackupError = null;
    s.nextBackupAt = null;
    Object.assign(s, overrides);
    return s;
  }

  beforeEach(async () => {
    mockSettingsRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data) => {
        const s = new AutoBackupSettings();
        Object.assign(s, data);
        return s;
      }),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoBackupService,
        {
          provide: getRepositoryToken(AutoBackupSettings),
          useValue: mockSettingsRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<AutoBackupService>(AutoBackupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getSettings", () => {
    it("should return existing settings when found", async () => {
      const existing = createSettings({
        enabled: true,
        folderPath: "/backups",
      });
      mockSettingsRepo.findOne.mockResolvedValue(existing);

      const result = await service.getSettings(userId);

      expect(result).toBe(existing);
      expect(mockSettingsRepo.findOne).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it("should return defaults when no settings exist", async () => {
      mockSettingsRepo.findOne.mockResolvedValue(null);

      const result = await service.getSettings(userId);

      expect(result.userId).toBe(userId);
      expect(result.enabled).toBe(false);
      expect(result.folderPath).toBe("");
      expect(result.frequency).toBe("daily");
      expect(result.retentionDaily).toBe(7);
      expect(result.retentionWeekly).toBe(4);
      expect(result.retentionMonthly).toBe(6);
    });
  });

  describe("updateSettings", () => {
    it("should create new settings if none exist", async () => {
      mockSettingsRepo.findOne.mockResolvedValue(null);

      await service.updateSettings(userId, {
        folderPath: "/backups",
        frequency: "weekly",
      });

      expect(mockSettingsRepo.create).toHaveBeenCalledWith({ userId });
      expect(mockSettingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          folderPath: "/backups",
          frequency: "weekly",
        }),
      );
    });

    it("should update existing settings", async () => {
      const existing = createSettings({ folderPath: "/old" });
      mockSettingsRepo.findOne.mockResolvedValue(existing);

      await service.updateSettings(userId, {
        folderPath: "/new-backups",
        retentionDaily: 14,
      });

      expect(mockSettingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          folderPath: "/new-backups",
          retentionDaily: 14,
        }),
      );
    });

    it("should throw if enabling without a folder path", async () => {
      mockSettingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateSettings(userId, { enabled: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should validate folder is writable when enabling", async () => {
      const existing = createSettings({ folderPath: "/backups" });
      mockSettingsRepo.findOne.mockResolvedValue(existing);

      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockResolvedValue(
        undefined,
      );
      (fsPromises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);

      await service.updateSettings(userId, { enabled: true });

      expect(mockSettingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          nextBackupAt: expect.any(Date),
        }),
      );
    });

    it("should clear nextBackupAt when disabling", async () => {
      const existing = createSettings({
        enabled: true,
        folderPath: "/backups",
        nextBackupAt: new Date(),
      });
      mockSettingsRepo.findOne.mockResolvedValue(existing);

      await service.updateSettings(userId, { enabled: false });

      expect(mockSettingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          nextBackupAt: null,
        }),
      );
    });

    it("should reject non-absolute paths", async () => {
      mockSettingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateSettings(userId, { folderPath: "relative/path" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject paths with '..'", async () => {
      mockSettingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateSettings(userId, { folderPath: "/backups/../etc" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should update retention values", async () => {
      const existing = createSettings();
      mockSettingsRepo.findOne.mockResolvedValue(existing);

      await service.updateSettings(userId, {
        retentionDaily: 30,
        retentionWeekly: 12,
        retentionMonthly: 24,
      });

      expect(mockSettingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          retentionDaily: 30,
          retentionWeekly: 12,
          retentionMonthly: 24,
        }),
      );
    });
  });

  describe("validateFolder", () => {
    it("should return valid for a writable directory", async () => {
      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockResolvedValue(
        undefined,
      );
      (fsPromises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);

      const result = await service.validateFolder("/backups");

      expect(result).toEqual({ valid: true });
    });

    it("should return invalid for non-existent directory", async () => {
      (fsPromises.stat as unknown as jest.Mock).mockRejectedValue({
        code: "ENOENT",
      });

      const result = await service.validateFolder("/no-such-dir");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return invalid for non-directory path", async () => {
      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => false,
      });

      const result = await service.validateFolder("/some/file.txt");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not a directory");
    });

    it("should return invalid for non-writable directory", async () => {
      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockRejectedValue(
        new Error("EACCES"),
      );

      const result = await service.validateFolder("/read-only");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not writable");
    });

    it("should return invalid for relative paths", async () => {
      const result = await service.validateFolder("relative/path");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("absolute path");
    });

    it("should return invalid for paths with '..'", async () => {
      const result = await service.validateFolder("/backups/../etc");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("..");
    });
  });

  describe("runManualBackup", () => {
    it("should throw if no settings configured", async () => {
      mockSettingsRepo.findOne.mockResolvedValue(null);

      await expect(service.runManualBackup(userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw if no folder path set", async () => {
      mockSettingsRepo.findOne.mockResolvedValue(
        createSettings({ folderPath: "" }),
      );

      await expect(service.runManualBackup(userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should run backup and update status on success", async () => {
      const existing = createSettings({
        enabled: true,
        folderPath: "/backups",
      });
      mockSettingsRepo.findOne.mockResolvedValue(existing);

      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockResolvedValue(
        undefined,
      );
      (fsPromises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);
      (fsMock.createWriteStream as unknown as jest.Mock).mockReturnValue({
        on: jest.fn(),
      });
      (fsMock.readdirSync as unknown as jest.Mock).mockReturnValue([]);

      const result = await service.runManualBackup(userId);

      expect(result.message).toBe("Backup completed successfully");
      expect(result.filename).toMatch(/^monize-backup-.*\.json\.gz$/);
      expect(mockSettingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastBackupStatus: "success",
          lastBackupError: null,
        }),
      );
    });
  });

  describe("handleAutoBackupCron", () => {
    it("should do nothing if no backups are due", async () => {
      mockSettingsRepo.find.mockResolvedValue([]);

      await service.handleAutoBackupCron();

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it("should process due backups and update status", async () => {
      const settings = createSettings({
        enabled: true,
        folderPath: "/backups",
        nextBackupAt: new Date(Date.now() - 3600000),
      });
      mockSettingsRepo.find.mockResolvedValue([settings]);

      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockResolvedValue(
        undefined,
      );
      (fsPromises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);
      (fsMock.createWriteStream as unknown as jest.Mock).mockReturnValue({
        on: jest.fn(),
      });
      (fsMock.readdirSync as unknown as jest.Mock).mockReturnValue([]);

      await service.handleAutoBackupCron();

      expect(mockSettingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastBackupStatus: "success",
          nextBackupAt: expect.any(Date),
        }),
      );
    });

    it("should mark status as failed on error and continue", async () => {
      const settings = createSettings({
        enabled: true,
        folderPath: "/backups",
        nextBackupAt: new Date(Date.now() - 3600000),
      });
      mockSettingsRepo.find.mockResolvedValue([settings]);

      (fsPromises.stat as unknown as jest.Mock).mockRejectedValue({
        code: "ENOENT",
      });

      await service.handleAutoBackupCron();

      expect(mockSettingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastBackupStatus: "failed",
          lastBackupError: expect.any(String),
          nextBackupAt: expect.any(Date),
        }),
      );
    });
  });

  describe("retention policy", () => {
    it("should keep the most recent N daily backups", async () => {
      const settings = createSettings({
        enabled: true,
        folderPath: "/backups",
        retentionDaily: 2,
        retentionWeekly: 0,
        retentionMonthly: 0,
      });
      mockSettingsRepo.findOne.mockResolvedValue(settings);

      const files = [
        "monize-backup-2026-04-01T10-00-00.json.gz",
        "monize-backup-2026-04-02T10-00-00.json.gz",
        "monize-backup-2026-04-03T10-00-00.json.gz",
      ];
      (fsMock.readdirSync as unknown as jest.Mock).mockReturnValue(files);

      // Set up mocks for the full runManualBackup flow
      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockResolvedValue(
        undefined,
      );
      (fsPromises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);
      (fsMock.createWriteStream as unknown as jest.Mock).mockReturnValue({
        on: jest.fn(),
      });

      await service.runManualBackup(userId);

      // Should delete the oldest file (April 1), keep April 2 and 3
      expect(fsMock.unlinkSync).toHaveBeenCalledWith(
        "/backups/monize-backup-2026-04-01T10-00-00.json.gz",
      );
      expect(fsMock.unlinkSync).toHaveBeenCalledTimes(1);
    });

    it("should keep one per calendar week for weekly retention", async () => {
      const settings = createSettings({
        enabled: true,
        folderPath: "/backups",
        retentionDaily: 0,
        retentionWeekly: 1,
        retentionMonthly: 0,
      });
      mockSettingsRepo.findOne.mockResolvedValue(settings);

      // Two files in the same week
      const files = [
        "monize-backup-2026-03-30T10-00-00.json.gz", // Monday
        "monize-backup-2026-03-31T10-00-00.json.gz", // Tuesday
      ];
      (fsMock.readdirSync as unknown as jest.Mock).mockReturnValue(files);

      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockResolvedValue(
        undefined,
      );
      (fsPromises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);
      (fsMock.createWriteStream as unknown as jest.Mock).mockReturnValue({
        on: jest.fn(),
      });

      await service.runManualBackup(userId);

      // Newest (Mar 31) is kept by weekly, oldest (Mar 30) is deleted
      expect(fsMock.unlinkSync).toHaveBeenCalledWith(
        "/backups/monize-backup-2026-03-30T10-00-00.json.gz",
      );
    });

    it("should keep one per calendar month for monthly retention", async () => {
      const settings = createSettings({
        enabled: true,
        folderPath: "/backups",
        retentionDaily: 0,
        retentionWeekly: 0,
        retentionMonthly: 1,
      });
      mockSettingsRepo.findOne.mockResolvedValue(settings);

      // Files in two different months
      const files = [
        "monize-backup-2026-02-15T10-00-00.json.gz",
        "monize-backup-2026-03-15T10-00-00.json.gz",
      ];
      (fsMock.readdirSync as unknown as jest.Mock).mockReturnValue(files);

      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockResolvedValue(
        undefined,
      );
      (fsPromises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);
      (fsMock.createWriteStream as unknown as jest.Mock).mockReturnValue({
        on: jest.fn(),
      });

      await service.runManualBackup(userId);

      // Keep most recent month (March), delete oldest (February)
      expect(fsMock.unlinkSync).toHaveBeenCalledWith(
        "/backups/monize-backup-2026-02-15T10-00-00.json.gz",
      );
    });

    it("should not delete non-backup files", async () => {
      const settings = createSettings({
        enabled: true,
        folderPath: "/backups",
        retentionDaily: 1,
        retentionWeekly: 0,
        retentionMonthly: 0,
      });
      mockSettingsRepo.findOne.mockResolvedValue(settings);

      const files = [
        "monize-backup-2026-04-01T10-00-00.json.gz",
        "some-other-file.txt",
        "readme.md",
      ];
      (fsMock.readdirSync as unknown as jest.Mock).mockReturnValue(files);

      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockResolvedValue(
        undefined,
      );
      (fsPromises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);
      (fsMock.createWriteStream as unknown as jest.Mock).mockReturnValue({
        on: jest.fn(),
      });

      await service.runManualBackup(userId);

      // Only the backup file is matched; non-matching files are ignored
      expect(fsMock.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe("frequency calculation", () => {
    it("should calculate next backup for daily frequency", async () => {
      const existing = createSettings({ folderPath: "/backups" });
      mockSettingsRepo.findOne.mockResolvedValue(existing);

      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockResolvedValue(
        undefined,
      );
      (fsPromises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);

      const before = Date.now();
      await service.updateSettings(userId, {
        enabled: true,
        frequency: "daily",
      });
      const after = Date.now();

      const savedCall = mockSettingsRepo.save.mock.calls[0][0];
      const nextAt = savedCall.nextBackupAt.getTime();
      // Should be roughly 24 hours from now
      expect(nextAt).toBeGreaterThanOrEqual(
        before + 24 * 60 * 60 * 1000 - 1000,
      );
      expect(nextAt).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 1000);
    });

    it("should calculate next backup for every6hours frequency", async () => {
      const existing = createSettings({ folderPath: "/backups" });
      mockSettingsRepo.findOne.mockResolvedValue(existing);

      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockResolvedValue(
        undefined,
      );
      (fsPromises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);

      const before = Date.now();
      await service.updateSettings(userId, {
        enabled: true,
        frequency: "every6hours",
      });
      const after = Date.now();

      const savedCall = mockSettingsRepo.save.mock.calls[0][0];
      const nextAt = savedCall.nextBackupAt.getTime();
      expect(nextAt).toBeGreaterThanOrEqual(before + 6 * 60 * 60 * 1000 - 1000);
      expect(nextAt).toBeLessThanOrEqual(after + 6 * 60 * 60 * 1000 + 1000);
    });

    it("should calculate next backup for weekly frequency", async () => {
      const existing = createSettings({ folderPath: "/backups" });
      mockSettingsRepo.findOne.mockResolvedValue(existing);

      (fsPromises.stat as unknown as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
      });
      (fsPromises.writeFile as unknown as jest.Mock).mockResolvedValue(
        undefined,
      );
      (fsPromises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);

      const before = Date.now();
      await service.updateSettings(userId, {
        enabled: true,
        frequency: "weekly",
      });
      const after = Date.now();

      const savedCall = mockSettingsRepo.save.mock.calls[0][0];
      const nextAt = savedCall.nextBackupAt.getTime();
      expect(nextAt).toBeGreaterThanOrEqual(
        before + 168 * 60 * 60 * 1000 - 1000,
      );
      expect(nextAt).toBeLessThanOrEqual(after + 168 * 60 * 60 * 1000 + 1000);
    });
  });
});

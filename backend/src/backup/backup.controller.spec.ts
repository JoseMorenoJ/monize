import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { BackupController } from "./backup.controller";
import { BackupService } from "./backup.service";
import { SessionGuard } from "../common/guards/session.guard";

describe("BackupController", () => {
  let controller: BackupController;
  let mockBackupService: Record<string, jest.Mock>;

  const userId = "test-user-id";
  const mockReq = {
    user: { id: userId },
    body: Buffer.from("gzip-data"),
    headers: {},
  };

  beforeEach(async () => {
    mockBackupService = {
      streamExport: jest.fn().mockResolvedValue(undefined),
      restoreData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BackupController],
      providers: [
        {
          provide: BackupService,
          useValue: mockBackupService,
        },
      ],
    }).overrideGuard(SessionGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<BackupController>(BackupController);
  });

  describe("exportBackup", () => {
    it("should set response headers and delegate to streamExport", async () => {
      const mockRes = {
        setHeader: jest.fn(),
      };

      await controller.exportBackup(mockReq, mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/gzip",
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        expect.stringContaining(".json.gz"),
      );
      expect(mockBackupService.streamExport).toHaveBeenCalledWith(
        userId,
        mockRes,
      );
    });
  });

  describe("restoreBackup", () => {
    it("should pass compressed body to service", async () => {
      const mockResult = {
        message: "Backup restored successfully",
        restored: { categories: 5 },
      };
      mockBackupService.restoreData.mockResolvedValue(mockResult);

      const req = {
        user: { id: userId },
        body: Buffer.from("gzip-data"),
        headers: {},
      };

      const result = await controller.restoreBackup(req);

      expect(mockBackupService.restoreData).toHaveBeenCalledWith(userId, {
        compressedData: req.body,
      });
      expect(result).toEqual(mockResult);
    });

    it("should throw BadRequestException if body is not a buffer", async () => {
      const req = {
        user: { id: userId },
        body: "not-a-buffer",
        headers: {},
      };

      await expect(controller.restoreBackup(req)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if body is empty buffer", async () => {
      const req = {
        user: { id: userId },
        body: Buffer.alloc(0),
        headers: {},
      };

      await expect(controller.restoreBackup(req)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

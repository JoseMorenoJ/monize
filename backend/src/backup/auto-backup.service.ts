import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, LessThanOrEqual } from "typeorm";
import { Cron } from "@nestjs/schedule";
import { createWriteStream, promises as fs, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { AutoBackupSettings } from "./entities/auto-backup-settings.entity";
import {
  UpdateAutoBackupSettingsDto,
  AutoBackupFrequency,
} from "./dto/update-auto-backup-settings.dto";

const BACKUP_VERSION = 1;

const BACKUP_FILE_PREFIX = "monize-backup-";
const BACKUP_FILE_PATTERN =
  /^monize-backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.json\.gz$/;

const FREQUENCY_HOURS: Record<AutoBackupFrequency, number> = {
  every6hours: 6,
  every12hours: 12,
  daily: 24,
  weekly: 168,
};

@Injectable()
export class AutoBackupService {
  private readonly logger = new Logger(AutoBackupService.name);

  constructor(
    @InjectRepository(AutoBackupSettings)
    private readonly settingsRepo: Repository<AutoBackupSettings>,
    private readonly dataSource: DataSource,
  ) {}

  async getSettings(userId: string): Promise<AutoBackupSettings> {
    const existing = await this.settingsRepo.findOne({
      where: { userId },
    });
    if (existing) return existing;

    // Return default settings (not persisted yet)
    const defaults = new AutoBackupSettings();
    defaults.userId = userId;
    defaults.enabled = false;
    defaults.folderPath = "";
    defaults.frequency = "daily";
    defaults.retentionDaily = 7;
    defaults.retentionWeekly = 4;
    defaults.retentionMonthly = 6;
    defaults.lastBackupAt = null;
    defaults.lastBackupStatus = null;
    defaults.lastBackupError = null;
    defaults.nextBackupAt = null;
    return defaults;
  }

  async updateSettings(
    userId: string,
    dto: UpdateAutoBackupSettingsDto,
  ): Promise<AutoBackupSettings> {
    let settings = await this.settingsRepo.findOne({
      where: { userId },
    });

    if (!settings) {
      settings = this.settingsRepo.create({ userId });
    }

    if (dto.folderPath !== undefined) {
      this.validateFolderPath(dto.folderPath);
      settings.folderPath = dto.folderPath;
    }
    if (dto.frequency !== undefined) {
      settings.frequency = dto.frequency;
    }
    if (dto.retentionDaily !== undefined) {
      settings.retentionDaily = dto.retentionDaily;
    }
    if (dto.retentionWeekly !== undefined) {
      settings.retentionWeekly = dto.retentionWeekly;
    }
    if (dto.retentionMonthly !== undefined) {
      settings.retentionMonthly = dto.retentionMonthly;
    }

    if (dto.enabled !== undefined) {
      settings.enabled = dto.enabled;
      if (dto.enabled) {
        if (!settings.folderPath) {
          throw new BadRequestException(
            "A folder path must be set before enabling automatic backups",
          );
        }
        await this.assertFolderWritable(settings.folderPath);
        settings.nextBackupAt = this.calculateNextBackupAt(
          settings.frequency as AutoBackupFrequency,
          new Date(),
        );
      } else {
        settings.nextBackupAt = null;
      }
    }

    return this.settingsRepo.save(settings);
  }

  async validateFolder(
    folderPath: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      this.validateFolderPath(folderPath);
      await this.assertFolderWritable(folderPath);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async runManualBackup(
    userId: string,
  ): Promise<{ message: string; filename: string }> {
    const settings = await this.settingsRepo.findOne({
      where: { userId },
    });
    if (!settings || !settings.folderPath) {
      throw new BadRequestException(
        "Auto-backup is not configured. Please set a folder path first.",
      );
    }

    await this.assertFolderWritable(settings.folderPath);
    const filename = await this.exportToFile(userId, settings.folderPath);
    await this.enforceRetention(settings.folderPath, settings);

    settings.lastBackupAt = new Date();
    settings.lastBackupStatus = "success";
    settings.lastBackupError = null;
    if (settings.enabled) {
      settings.nextBackupAt = this.calculateNextBackupAt(
        settings.frequency as AutoBackupFrequency,
        new Date(),
      );
    }
    await this.settingsRepo.save(settings);

    return { message: "Backup completed successfully", filename };
  }

  @Cron("0 * * * *")
  async handleAutoBackupCron(): Promise<void> {
    const now = new Date();
    const dueSettings = await this.settingsRepo.find({
      where: {
        enabled: true,
        nextBackupAt: LessThanOrEqual(now),
      },
    });

    if (dueSettings.length === 0) return;

    this.logger.log(`Auto-backup cron: ${dueSettings.length} backup(s) due`);

    for (const settings of dueSettings) {
      try {
        await this.assertFolderWritable(settings.folderPath);
        const filename = await this.exportToFile(
          settings.userId,
          settings.folderPath,
        );
        await this.enforceRetention(settings.folderPath, settings);

        settings.lastBackupAt = now;
        settings.lastBackupStatus = "success";
        settings.lastBackupError = null;
        settings.nextBackupAt = this.calculateNextBackupAt(
          settings.frequency as AutoBackupFrequency,
          now,
        );
        await this.settingsRepo.save(settings);

        this.logger.log(
          `Auto-backup completed for user ${settings.userId}: ${filename}`,
        );
      } catch (error) {
        this.logger.error(
          `Auto-backup failed for user ${settings.userId}: ${error.message}`,
        );
        settings.lastBackupAt = now;
        settings.lastBackupStatus = "failed";
        settings.lastBackupError = String(error.message).slice(0, 1024);
        settings.nextBackupAt = this.calculateNextBackupAt(
          settings.frequency as AutoBackupFrequency,
          now,
        );
        await this.settingsRepo.save(settings);
      }
    }
  }

  private async exportToFile(
    userId: string,
    folderPath: string,
  ): Promise<string> {
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\.\d{3}Z$/, "");
    const filename = `${BACKUP_FILE_PREFIX}${timestamp}.json.gz`;
    const filepath = join(folderPath, filename);

    const tableQueries: Array<{ key: string; sql: string }> = [
      {
        key: "currencies",
        sql: "SELECT * FROM currencies WHERE created_by_user_id = $1",
      },
      {
        key: "user_preferences",
        sql: "SELECT * FROM user_preferences WHERE user_id = $1",
      },
      {
        key: "user_currency_preferences",
        sql: "SELECT * FROM user_currency_preferences WHERE user_id = $1",
      },
      {
        key: "categories",
        sql: "SELECT * FROM categories WHERE user_id = $1 ORDER BY parent_id NULLS FIRST, name",
      },
      {
        key: "payees",
        sql: "SELECT * FROM payees WHERE user_id = $1 ORDER BY name",
      },
      {
        key: "payee_aliases",
        sql: "SELECT * FROM payee_aliases WHERE user_id = $1",
      },
      {
        key: "accounts",
        sql: "SELECT * FROM accounts WHERE user_id = $1 ORDER BY name",
      },
      {
        key: "tags",
        sql: "SELECT * FROM tags WHERE user_id = $1 ORDER BY name",
      },
      {
        key: "transactions",
        sql: "SELECT * FROM transactions WHERE user_id = $1 ORDER BY transaction_date, created_at",
      },
      {
        key: "transaction_splits",
        sql: `SELECT ts.* FROM transaction_splits ts
              JOIN transactions t ON ts.transaction_id = t.id
              WHERE t.user_id = $1`,
      },
      {
        key: "transaction_tags",
        sql: `SELECT tt.* FROM transaction_tags tt
              JOIN transactions t ON tt.transaction_id = t.id
              WHERE t.user_id = $1`,
      },
      {
        key: "transaction_split_tags",
        sql: `SELECT tst.* FROM transaction_split_tags tst
              JOIN transaction_splits ts ON tst.transaction_split_id = ts.id
              JOIN transactions t ON ts.transaction_id = t.id
              WHERE t.user_id = $1`,
      },
      {
        key: "scheduled_transactions",
        sql: "SELECT * FROM scheduled_transactions WHERE user_id = $1",
      },
      {
        key: "scheduled_transaction_splits",
        sql: `SELECT sts.* FROM scheduled_transaction_splits sts
              JOIN scheduled_transactions st ON sts.scheduled_transaction_id = st.id
              WHERE st.user_id = $1`,
      },
      {
        key: "scheduled_transaction_overrides",
        sql: `SELECT sto.* FROM scheduled_transaction_overrides sto
              JOIN scheduled_transactions st ON sto.scheduled_transaction_id = st.id
              WHERE st.user_id = $1`,
      },
      {
        key: "securities",
        sql: "SELECT * FROM securities WHERE user_id = $1",
      },
      {
        key: "security_prices",
        sql: `SELECT sp.* FROM security_prices sp
              JOIN securities s ON sp.security_id = s.id
              WHERE s.user_id = $1`,
      },
      {
        key: "holdings",
        sql: `SELECT h.* FROM holdings h
              JOIN accounts a ON h.account_id = a.id
              WHERE a.user_id = $1`,
      },
      {
        key: "investment_transactions",
        sql: "SELECT * FROM investment_transactions WHERE user_id = $1",
      },
      { key: "budgets", sql: "SELECT * FROM budgets WHERE user_id = $1" },
      {
        key: "budget_categories",
        sql: `SELECT bc.* FROM budget_categories bc
              JOIN budgets b ON bc.budget_id = b.id
              WHERE b.user_id = $1`,
      },
      {
        key: "budget_periods",
        sql: `SELECT bp.* FROM budget_periods bp
              JOIN budgets b ON bp.budget_id = b.id
              WHERE b.user_id = $1`,
      },
      {
        key: "budget_period_categories",
        sql: `SELECT bpc.* FROM budget_period_categories bpc
              JOIN budget_periods bp ON bpc.budget_period_id = bp.id
              JOIN budgets b ON bp.budget_id = b.id
              WHERE b.user_id = $1`,
      },
      {
        key: "budget_alerts",
        sql: "SELECT * FROM budget_alerts WHERE user_id = $1",
      },
      {
        key: "custom_reports",
        sql: "SELECT * FROM custom_reports WHERE user_id = $1",
      },
      {
        key: "import_column_mappings",
        sql: "SELECT * FROM import_column_mappings WHERE user_id = $1",
      },
      {
        key: "monthly_account_balances",
        sql: "SELECT * FROM monthly_account_balances WHERE user_id = $1",
      },
    ];

    // Build the full JSON in memory for each table, then stream through gzip
    const chunks: string[] = [];
    chunks.push(
      `{"version":${BACKUP_VERSION},"exportedAt":"${new Date().toISOString()}"`,
    );

    for (const { key, sql } of tableQueries) {
      const rows = await this.dataSource.query(sql, [userId]);
      chunks.push(`,"${key}":${JSON.stringify(rows)}`);
    }

    chunks.push("}");

    const jsonString = chunks.join("");
    const readable = Readable.from([jsonString]);
    const gzip = createGzip();
    const writable = createWriteStream(filepath);

    await pipeline(readable, gzip, writable);

    this.logger.log(`Backup written to ${filepath}`);
    return filename;
  }

  private enforceRetention(
    folderPath: string,
    settings: AutoBackupSettings,
  ): void {
    let entries: string[];
    try {
      entries = readdirSync(folderPath);
    } catch {
      return;
    }

    // Parse all backup files with valid timestamps
    const backupFiles: Array<{ name: string; date: Date }> = [];
    for (const name of entries) {
      const match = BACKUP_FILE_PATTERN.exec(name);
      if (match) {
        // Convert filename timestamp back to Date
        const isoStr = match[1].replace(
          /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})$/,
          "$1T$2:$3:$4Z",
        );
        const date = new Date(isoStr);
        if (!isNaN(date.getTime())) {
          backupFiles.push({ name, date });
        }
      }
    }

    if (backupFiles.length === 0) return;

    // Sort newest first
    const sorted = [...backupFiles].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );

    const filesToKeep = new Set<string>();

    // Daily retention: keep the N most recent backups
    const dailyLimit = settings.retentionDaily;
    for (let i = 0; i < Math.min(dailyLimit, sorted.length); i++) {
      filesToKeep.add(sorted[i].name);
    }

    // Weekly retention: keep one per calendar week (ISO week) for N weeks
    if (settings.retentionWeekly > 0) {
      const weeksSeen = new Set<string>();
      for (const file of sorted) {
        const weekKey = this.getIsoWeekKey(file.date);
        if (!weeksSeen.has(weekKey)) {
          weeksSeen.add(weekKey);
          if (weeksSeen.size <= settings.retentionWeekly) {
            filesToKeep.add(file.name);
          }
        }
      }
    }

    // Monthly retention: keep one per calendar month for N months
    if (settings.retentionMonthly > 0) {
      const monthsSeen = new Set<string>();
      for (const file of sorted) {
        const monthKey = `${file.date.getUTCFullYear()}-${String(file.date.getUTCMonth() + 1).padStart(2, "0")}`;
        if (!monthsSeen.has(monthKey)) {
          monthsSeen.add(monthKey);
          if (monthsSeen.size <= settings.retentionMonthly) {
            filesToKeep.add(file.name);
          }
        }
      }
    }

    // Delete files not covered by any retention tier
    for (const file of sorted) {
      if (!filesToKeep.has(file.name)) {
        try {
          unlinkSync(join(folderPath, file.name));
          this.logger.log(`Retention: deleted old backup ${file.name}`);
        } catch (err) {
          this.logger.warn(
            `Retention: failed to delete ${file.name}: ${err.message}`,
          );
        }
      }
    }
  }

  private getIsoWeekKey(date: Date): string {
    // ISO week: the week that contains the Thursday
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
      ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  private calculateNextBackupAt(
    frequency: AutoBackupFrequency,
    fromDate: Date,
  ): Date {
    const hours = FREQUENCY_HOURS[frequency] ?? 24;
    return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
  }

  private validateFolderPath(folderPath: string): void {
    if (!folderPath.startsWith("/")) {
      throw new BadRequestException("Folder path must be an absolute path");
    }
    if (folderPath.includes("..")) {
      throw new BadRequestException(
        "Folder path must not contain '..' segments",
      );
    }
  }

  private async assertFolderWritable(folderPath: string): Promise<void> {
    try {
      const stat = await fs.stat(folderPath);
      if (!stat.isDirectory()) {
        throw new BadRequestException(`Path is not a directory: ${folderPath}`);
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new BadRequestException(
          `Folder does not exist: ${folderPath}. Ensure the path is mapped as a Docker volume.`,
        );
      }
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        `Cannot access folder: ${folderPath} - ${error.message}`,
      );
    }

    // Test write access by creating and removing a temporary file
    const testFile = join(folderPath, `.monize-write-test-${Date.now()}`);
    try {
      await fs.writeFile(testFile, "");
      await fs.unlink(testFile);
    } catch {
      throw new BadRequestException(
        `Folder is not writable: ${folderPath}. Check container permissions.`,
      );
    }
  }
}

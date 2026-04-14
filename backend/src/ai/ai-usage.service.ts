import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { Cron } from "@nestjs/schedule";
import { AiUsageLog } from "./entities/ai-usage-log.entity";
import { AiProviderConfig } from "./entities/ai-provider-config.entity";
import { AiUsageSummary } from "./dto/ai-response.dto";

interface CostRate {
  inputCostPer1M: number | null;
  outputCostPer1M: number | null;
}

const TOKENS_PER_UNIT = 1_000_000;

function rateKey(provider: string, model: string | null): string {
  return `${provider}::${model ?? ""}`;
}

function computeCost(
  inputTokens: number,
  outputTokens: number,
  rate: CostRate | undefined,
): number | null {
  if (!rate) return null;
  if (rate.inputCostPer1M === null && rate.outputCostPer1M === null) {
    return null;
  }
  const inputCost =
    rate.inputCostPer1M !== null
      ? (inputTokens / TOKENS_PER_UNIT) * rate.inputCostPer1M
      : 0;
  const outputCost =
    rate.outputCostPer1M !== null
      ? (outputTokens / TOKENS_PER_UNIT) * rate.outputCostPer1M
      : 0;
  return Math.round((inputCost + outputCost) * 10000) / 10000;
}

interface LogUsageParams {
  userId: string;
  provider: string;
  model: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  error?: string;
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    @InjectRepository(AiUsageLog)
    private readonly usageLogRepository: Repository<AiUsageLog>,
    @InjectRepository(AiProviderConfig)
    private readonly providerConfigRepository: Repository<AiProviderConfig>,
  ) {}

  @Cron("0 4 * * *")
  async purgeOldUsageLogs(): Promise<void> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const result = await this.usageLogRepository.delete({
        createdAt: LessThan(cutoff),
      });

      if (result.affected && result.affected > 0) {
        this.logger.log(`Purged ${result.affected} old AI usage logs`);
      }
    } catch (error) {
      this.logger.error(
        "Failed to purge old usage logs",
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async logUsage(params: LogUsageParams): Promise<AiUsageLog> {
    const log = this.usageLogRepository.create({
      userId: params.userId,
      provider: params.provider,
      model: params.model,
      feature: params.feature,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      durationMs: params.durationMs,
      error: params.error || null,
    });
    return this.usageLogRepository.save(log);
  }

  async getUsageSummary(
    userId: string,
    days?: number,
  ): Promise<AiUsageSummary> {
    const [byProviderModel, byFeatureModel, recentLogs, totals, userConfigs] =
      await Promise.all([
        // Group by provider AND model so we can look up per-model cost rates.
        this.usageLogRepository
          .createQueryBuilder("log")
          .select("log.provider", "provider")
          .addSelect("log.model", "model")
          .addSelect("COUNT(*)", "requests")
          .addSelect("SUM(log.input_tokens)", "inputTokens")
          .addSelect("SUM(log.output_tokens)", "outputTokens")
          .where("log.user_id = :userId", { userId })
          .andWhere(
            days
              ? "log.created_at >= NOW() - make_interval(days => :days)"
              : "1=1",
            { days },
          )
          .groupBy("log.provider")
          .addGroupBy("log.model")
          .getRawMany(),

        this.usageLogRepository
          .createQueryBuilder("log")
          .select("log.feature", "feature")
          .addSelect("log.provider", "provider")
          .addSelect("log.model", "model")
          .addSelect("COUNT(*)", "requests")
          .addSelect("SUM(log.input_tokens)", "inputTokens")
          .addSelect("SUM(log.output_tokens)", "outputTokens")
          .where("log.user_id = :userId", { userId })
          .andWhere(
            days
              ? "log.created_at >= NOW() - make_interval(days => :days)"
              : "1=1",
            { days },
          )
          .groupBy("log.feature")
          .addGroupBy("log.provider")
          .addGroupBy("log.model")
          .getRawMany(),

        this.usageLogRepository.find({
          where: { userId },
          order: { createdAt: "DESC" },
          take: 20,
        }),

        this.usageLogRepository
          .createQueryBuilder("log")
          .select("COUNT(*)", "totalRequests")
          .addSelect("COALESCE(SUM(log.input_tokens), 0)", "totalInputTokens")
          .addSelect("COALESCE(SUM(log.output_tokens), 0)", "totalOutputTokens")
          .where("log.user_id = :userId", { userId })
          .andWhere(
            days
              ? "log.created_at >= NOW() - make_interval(days => :days)"
              : "1=1",
            { days },
          )
          .getRawOne(),

        this.providerConfigRepository.find({
          where: { userId },
          select: [
            "provider",
            "model",
            "inputCostPer1M",
            "outputCostPer1M",
          ] as (keyof AiProviderConfig)[],
        }),
      ]);

    // Build (provider, model) -> rate lookup from the user's configured providers.
    const rateMap = new Map<string, CostRate>();
    for (const cfg of userConfigs) {
      rateMap.set(rateKey(cfg.provider, cfg.model), {
        inputCostPer1M: cfg.inputCostPer1M,
        outputCostPer1M: cfg.outputCostPer1M,
      });
    }

    // Collapse (provider, model) aggregates into byProvider, summing cost
    // across models. If no logs under a provider match a rate, cost stays null.
    const providerAgg = new Map<
      string,
      {
        provider: string;
        requests: number;
        inputTokens: number;
        outputTokens: number;
        cost: number;
        hasCost: boolean;
      }
    >();

    for (const row of byProviderModel as Record<string, string | null>[]) {
      const provider = row.provider as string;
      const model = row.model as string | null;
      const requests = parseInt(row.requests as string, 10) || 0;
      const inputTokens = parseInt(row.inputTokens as string, 10) || 0;
      const outputTokens = parseInt(row.outputTokens as string, 10) || 0;
      const rate = rateMap.get(rateKey(provider, model));
      const cost = computeCost(inputTokens, outputTokens, rate);

      const existing = providerAgg.get(provider);
      if (existing) {
        existing.requests += requests;
        existing.inputTokens += inputTokens;
        existing.outputTokens += outputTokens;
        if (cost !== null) {
          existing.cost += cost;
          existing.hasCost = true;
        }
      } else {
        providerAgg.set(provider, {
          provider,
          requests,
          inputTokens,
          outputTokens,
          cost: cost ?? 0,
          hasCost: cost !== null,
        });
      }
    }

    // Same pattern for byFeature.
    const featureAgg = new Map<
      string,
      {
        feature: string;
        requests: number;
        inputTokens: number;
        outputTokens: number;
        cost: number;
        hasCost: boolean;
      }
    >();

    for (const row of byFeatureModel as Record<string, string | null>[]) {
      const feature = row.feature as string;
      const provider = row.provider as string;
      const model = row.model as string | null;
      const requests = parseInt(row.requests as string, 10) || 0;
      const inputTokens = parseInt(row.inputTokens as string, 10) || 0;
      const outputTokens = parseInt(row.outputTokens as string, 10) || 0;
      const rate = rateMap.get(rateKey(provider, model));
      const cost = computeCost(inputTokens, outputTokens, rate);

      const existing = featureAgg.get(feature);
      if (existing) {
        existing.requests += requests;
        existing.inputTokens += inputTokens;
        existing.outputTokens += outputTokens;
        if (cost !== null) {
          existing.cost += cost;
          existing.hasCost = true;
        }
      } else {
        featureAgg.set(feature, {
          feature,
          requests,
          inputTokens,
          outputTokens,
          cost: cost ?? 0,
          hasCost: cost !== null,
        });
      }
    }

    // Compute total estimated cost by summing per-provider costs.
    let totalEstimatedCost: number | null = null;
    for (const agg of providerAgg.values()) {
      if (agg.hasCost) {
        totalEstimatedCost = (totalEstimatedCost ?? 0) + agg.cost;
      }
    }
    if (totalEstimatedCost !== null) {
      totalEstimatedCost = Math.round(totalEstimatedCost * 10000) / 10000;
    }

    return {
      totalRequests: parseInt(totals.totalRequests, 10) || 0,
      totalInputTokens: parseInt(totals.totalInputTokens, 10) || 0,
      totalOutputTokens: parseInt(totals.totalOutputTokens, 10) || 0,
      totalEstimatedCost,
      byProvider: Array.from(providerAgg.values()).map((agg) => ({
        provider: agg.provider,
        requests: agg.requests,
        inputTokens: agg.inputTokens,
        outputTokens: agg.outputTokens,
        estimatedCost: agg.hasCost
          ? Math.round(agg.cost * 10000) / 10000
          : null,
      })),
      byFeature: Array.from(featureAgg.values()).map((agg) => ({
        feature: agg.feature,
        requests: agg.requests,
        inputTokens: agg.inputTokens,
        outputTokens: agg.outputTokens,
        estimatedCost: agg.hasCost
          ? Math.round(agg.cost * 10000) / 10000
          : null,
      })),
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        provider: log.provider,
        model: log.model,
        feature: log.feature,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        durationMs: log.durationMs,
        estimatedCost: computeCost(
          log.inputTokens,
          log.outputTokens,
          rateMap.get(rateKey(log.provider, log.model)),
        ),
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }
}

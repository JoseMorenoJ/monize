export interface AiProviderConfigResponse {
  id: string;
  provider: string;
  displayName: string | null;
  isActive: boolean;
  priority: number;
  model: string | null;
  apiKeyMasked: string | null;
  baseUrl: string | null;
  config: Record<string, unknown>;
  inputCostPer1M: number | null;
  outputCostPer1M: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiUsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  /**
   * Sum of estimated costs for logs that have a matching provider+model
   * configuration with cost rates defined. Null when no matching configured
   * rates exist for any logs in the period.
   */
  totalEstimatedCost: number | null;
  byProvider: Array<{
    provider: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number | null;
  }>;
  byFeature: Array<{
    feature: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number | null;
  }>;
  recentLogs: Array<{
    id: string;
    provider: string;
    model: string;
    feature: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    estimatedCost: number | null;
    createdAt: string;
  }>;
}

export interface AiStatusResponse {
  configured: boolean;
  encryptionAvailable: boolean;
  activeProviders: number;
  hasSystemDefault: boolean;
  systemDefaultProvider: string | null;
  systemDefaultModel: string | null;
}

export interface AiConnectionTestResponse {
  available: boolean;
  error?: string;
}
